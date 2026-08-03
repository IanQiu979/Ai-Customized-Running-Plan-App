/**
 * `generate-plan`'s orchestration — the eleven documented steps, in order, with every dependency
 * injected.
 *
 * This is the file the pipeline's rules actually live in, so it is written to be read against
 * `docs/reference/plan-generation.md` "The generation pipeline" side by side; each step is
 * numbered in a comment matching that list. It imports no Cloudflare binding, no `Deno`/`process`,
 * and makes no network call of its own — that is what lets every branch below be unit-tested with
 * zero Anthropic spend (`deps.ts` is the only file that reads a secret).
 *
 * THE INVARIANT THAT MATTERS MOST: a reservation is either settled or released on **every** exit
 * path. A reservation that is neither holds a quota slot for `RESERVATION_TTL_MS`, and a user who
 * lost a plan slot to a server bug will never believe the number again. The `try/catch` around the
 * generation body exists for exactly that, not for tidiness.
 */

import type { IntakeResponses, Plan, Tier } from '../../../src/lib/planTypes';
import type { GeneratePlanRequest } from '../../../src/lib/planTypes';
import type { PlanPersonalizer, SkeletonBuilder } from './planEngine';
import type { PlanStore } from './store';

export interface GeneratePlanDeps {
  store: PlanStore;
  skeleton: SkeletonBuilder;
  personalizer: PlanPersonalizer;
  /** The user's saved intake answers, or null if they have not completed intake. */
  loadIntake(userId: string): Promise<IntakeResponses | null>;
  /** Injected so the flow is deterministic under test. ISO-8601 UTC. */
  now(): string;
}

export type GeneratePlanOutcome =
  | { kind: 'ok'; plan: Plan; planId: string; isFallback: boolean; replayed: boolean }
  | { kind: 'invalid_request'; message: string }
  | { kind: 'intake_required'; message: string }
  | { kind: 'over_quota'; tier: Tier; used: number; limit: number; periodEnd: string | null }
  | { kind: 'engine_unavailable'; message: string }
  | { kind: 'internal_error'; message: string };

/** `notes` is free text that reaches a model prompt, so it is length-capped at the door. */
const MAX_NOTES_LENGTH = 1000;

export async function generatePlan(
  userId: string,
  request: GeneratePlanRequest,
  deps: GeneratePlanDeps
): Promise<GeneratePlanOutcome> {
  const now = deps.now();

  // --- request validation (step 1's other half; auth itself happened in the route) -------------
  const invalid = validateRequest(request);
  if (invalid) {
    return { kind: 'invalid_request', message: invalid };
  }

  const intake = await deps.loadIntake(userId);
  if (!intake) {
    return {
      kind: 'intake_required',
      message: 'Complete the intake questionnaire before generating a plan.',
    };
  }

  // --- steps 2 + 3: idempotency replay and the atomic quota gate, in one call ------------------
  // `store.reserve` folds both together on purpose: the replay lookup and the conditional insert
  // must not have a gap between them, and the UNIQUE constraint closes the one that remains.
  const window = await deps.store.quotaWindow(userId, now);
  const reservation = await deps.store.reserve({
    userId,
    tier: window.tier,
    idempotencyKey: request.idempotencyKey,
    goalType: request.goalType,
    raceDistance: request.raceDistance,
    raceDate: request.raceDate,
    durationWeeks: request.durationWeeks,
    now,
  });

  if (reservation.outcome === 'over_quota') {
    return {
      kind: 'over_quota',
      tier: window.tier,
      used: reservation.used,
      limit: window.limit,
      periodEnd: window.periodEnd,
    };
  }

  if (reservation.outcome === 'replayed') {
    const { row } = reservation;
    // A settled row replays as itself — this is what makes a network-timeout retry safe.
    if (row.status === 'settled' && row.plan) {
      return { kind: 'ok', plan: row.plan, planId: row.id, isFallback: row.isFallback, replayed: true };
    }
    // A live reservation for the same key means the first request is still generating. Returning
    // an error here is correct: two generations for one key must not run concurrently, and the
    // client's retry will replay the settled row once the first finishes.
    if (row.status === 'reserved') {
      return {
        kind: 'internal_error',
        message: 'A plan for this request is already being generated. Retry in a moment.',
      };
    }
    // A released row means the earlier attempt failed. The client must mint a fresh key rather
    // than replay a corpse — surfacing that as an error is the honest answer.
    return {
      kind: 'invalid_request',
      message: 'This request previously failed. Start a new plan to try again.',
    };
  }

  const planId = reservation.planId;

  try {
    // --- steps 4, 5, 8, 9: reconcile length, build the skeleton, expand, clamp -----------------
    // All deterministic and all inside the skeleton builder, because the load-rule clamp must run
    // on the same code path for every tier — Free's plan and Pro's clamped output are the same
    // arithmetic.
    const skeleton = await deps.skeleton.build({
      tier: window.tier,
      goalType: request.goalType,
      raceDistance: request.raceDistance,
      raceDate: request.raceDate,
      durationWeeks: request.durationWeeks,
      intake,
      now,
    });

    if (!skeleton.ok) {
      // No plan means no charge. Release before returning, always.
      await deps.store.release(planId, userId, `skeleton_${skeleton.reason}`);
      return skeleton.reason === 'invalid_request'
        ? { kind: 'invalid_request', message: skeleton.message }
        : { kind: 'engine_unavailable', message: skeleton.message };
    }

    // --- step 6: Free stops here. No AI call, ever. --------------------------------------------
    if (window.tier === 'free') {
      const plan = stamp(skeleton.plan, window.tier, 'template', false);
      await deps.store.settle({ planId, userId, plan, engine: 'template', isFallback: false, now });
      return { kind: 'ok', plan, planId, isFallback: false, replayed: false };
    }

    // --- step 7 + 10: one Claude call, structurally validated, retried once, then fall back ----
    const personalized = await deps.personalizer.personalize({
      skeleton: skeleton.plan,
      tier: window.tier,
      intake,
      notes: request.notes,
    });

    if (personalized.ok) {
      const plan = stamp(personalized.plan, window.tier, personalized.engine, false);
      await deps.store.settle({ planId, userId, plan, engine: personalized.engine, isFallback: false, now });
      return { kind: 'ok', plan, planId, isFallback: false, replayed: false };
    }

    // Fall back to the pure template plan, rendered at Free density — "a template has no 'why';
    // fabricating one would lie" (`docs/reference/plan-generation.md` step 10). The runner still
    // gets a real, coach-authored plan; `store.settle` decides whether it costs them a slot.
    const fallback = stamp(skeleton.plan, window.tier, 'template', true);
    await deps.store.settle({ planId, userId, plan: fallback, engine: 'template', isFallback: true, now });
    return { kind: 'ok', plan: fallback, planId, isFallback: true, replayed: false };
  } catch (error) {
    // The invariant. Any unexpected throw still hands the slot back before the error surfaces.
    await deps.store
      .release(planId, userId, 'internal_error')
      .catch(() => {
        /* A failed release is already the worst case; do not mask the original error with it. */
      });
    return {
      kind: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stamps the fields the *server* owns onto a plan, overwriting whatever was there.
 *
 * `tierAtGeneration`, `engine`, and `isFallback` decide how the plan renders forever, and a plan
 * renders at its own density for life (`planTypes.ts`: "a downgrade never retroactively strips
 * content from a plan the user already paid for"). None of the three may come from a model's
 * output or a client's request.
 */
function stamp(plan: Plan, tier: Tier, engine: Plan['engine'], isFallback: boolean): Plan {
  return { ...plan, tierAtGeneration: tier, engine, isFallback };
}

function validateRequest(request: GeneratePlanRequest): string | null {
  if (!request || typeof request !== 'object') {
    return 'Request body must be a JSON object.';
  }
  if (typeof request.idempotencyKey !== 'string' || request.idempotencyKey.trim().length === 0) {
    return 'idempotencyKey is required.';
  }
  if (request.goalType !== 'race' && request.goalType !== 'duration') {
    return 'goalType must be "race" or "duration".';
  }
  if (request.goalType === 'race') {
    if (!request.raceDistance) return 'raceDistance is required when goalType is "race".';
    if (!request.raceDate) return 'raceDate is required when goalType is "race".';
    if (Number.isNaN(Date.parse(request.raceDate))) return 'raceDate must be an ISO date.';
  }
  if (request.goalType === 'duration') {
    if (typeof request.durationWeeks !== 'number' || request.durationWeeks <= 0) {
      return 'durationWeeks must be a positive number when goalType is "duration".';
    }
  }
  if (request.notes !== undefined) {
    if (typeof request.notes !== 'string') return 'notes must be a string.';
    if (request.notes.length > MAX_NOTES_LENGTH) {
      return `notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
    }
  }
  return null;
}
