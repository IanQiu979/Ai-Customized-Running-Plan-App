/**
 * The app's own routes — everything that is not better-auth's.
 *
 * Every handler here takes an already-verified `userId`. Authentication happens once, in
 * `index.ts`, before dispatch: "authenticate the JWT first and reject anon before any work"
 * (`planning/03-engineering-requirements.md`, "Conventions for all edge functions"). A handler
 * that could be reached without a session would be a hole no amount of care inside it could close,
 * so none of them can be.
 *
 * ROUTES THAT ONLY EXIST BECAUSE THERE IS NO RLS. The Supabase design let the client read its own
 * `intake_responses`, `plans`, and `subscriptions` rows directly, with RLS as the guard. D1 has no
 * RLS and no client-facing API at all, so those three reads become `GET /api/intake`,
 * `GET /api/plans`, and the `tier` field of `GET /api/quota-status`. Same data, same ownership
 * rule, enforced in code instead of in the database.
 */

import type { GeneratePlanRequest, IntakeResponses, Tier } from '../../src/lib/planTypes';
import type { Deps } from './deps';
import { PRIVACY_POLICY_VERSION } from '../../src/constants/legal';
import { fail, ok, readJson } from './http';
import { generatePlan } from './lib/generate-plan-flow';
import { isPurchasableTier, TIER_PLAN_LIMITS } from '../../src/lib/tierLimits';

// ---------------------------------------------------------------------------------------------
// POST /api/generate-plan
// ---------------------------------------------------------------------------------------------

/**
 * The core call. All eleven pipeline steps run inside `generatePlan`; this function is only the
 * HTTP skin — parse, delegate, map the typed outcome onto a status code.
 *
 * The status codes are the documented contract (`docs/architecture.md`'s API table), not a fresh
 * choice: `402` over quota, `403` anonymous. A client written against the docs branches on those
 * exact numbers.
 */
export async function handleGeneratePlan(request: Request, userId: string, deps: Deps): Promise<Response> {
  const body = await readJson<GeneratePlanRequest>(request);
  if (!body) {
    return fail(400, 'invalid_request', 'Request body must be valid JSON.');
  }

  const outcome = await generatePlan(userId, body, deps.generatePlan);

  switch (outcome.kind) {
    case 'ok':
      return ok({
        plan: outcome.plan,
        planId: outcome.planId,
        isFallback: outcome.isFallback,
        quotaConsumed: outcome.quotaConsumed,
      });

    case 'over_quota':
      return fail(402, 'over_quota', 'You have used every plan in this period.', {
        quota: {
          tier: outcome.tier,
          used: outcome.used,
          limit: outcome.limit,
          periodEnd: outcome.periodEnd,
        },
      });

    case 'intake_required':
      return fail(409, 'intake_required', outcome.message);

    case 'invalid_request':
      return fail(400, 'invalid_request', outcome.message);

    case 'engine_unavailable':
      // 503, not 500: the request was fine and retrying later will work. Nothing was charged.
      return fail(503, 'engine_unavailable', outcome.message);

    case 'internal_error':
      // The message is one this code wrote, never a stack trace — see `http.ts`.
      return fail(500, 'internal_error', outcome.message);
  }
}

// ---------------------------------------------------------------------------------------------
// GET /api/quota-status
// ---------------------------------------------------------------------------------------------

/**
 * Drives Home's "2 of 3 plans left". `used` is counted from the `plans` table server-side — never
 * a client counter, and never a number the client sent back.
 *
 * It shares `store.quotaWindow` and `store.countUsed` with `generate-plan`, which is the point:
 * `docs/reference/plan-generation.md` requires one shared period function precisely so this
 * endpoint cannot promise a slot that `generate-plan` then refuses.
 */
export async function handleQuotaStatus(
  userId: string,
  userEmail: string | null | undefined,
  deps: Deps
): Promise<Response> {
  const now = new Date().toISOString();
  const window = await deps.store.quotaWindow(userId, now);
  const used = await deps.store.countUsed(userId, window, now);

  return ok({
    tier: window.tier,
    used,
    limit: window.limit,
    unlimited: window.limit === null,
    // Free's allowance is lifetime, so there is no period end to report and the client must not
    // render a countdown for it (`tierLimits.ts`'s `FREE_IS_LIFETIME`).
    periodEnd: window.periodEnd,
    // Server-decided, per `dummyPurchase.ts` — the paywall renders this, never computes it.
    purchasesAvailable: deps.purchasesAvailable(userEmail),
  });
}

// ---------------------------------------------------------------------------------------------
// POST /api/purchase-tier
// ---------------------------------------------------------------------------------------------

interface PurchaseTierBody {
  tier?: unknown;
  source?: unknown;
}

/**
 * The v1 dummy purchase.
 *
 * It goes through the server even though nothing is charged, and that is the whole design:
 * "Dummy payment must not be a client-side flag that unlocks tier — even the dummy flow goes
 * through an edge function that sets `subscriptions`, so v2's real IAP slots into the same path"
 * (`planning/03-engineering-requirements.md` "Security requirements"). v2 swaps `source` to
 * `'revenuecat'` and verifies a receipt here: same route, same table write, unchanged client
 * contract.
 */
export async function handlePurchaseTier(
  request: Request,
  userId: string,
  userEmail: string | null | undefined,
  deps: Deps
): Promise<Response> {
  // Trusted-testers-only gate ahead of everything else (`dummyPurchase.ts`) — the v1 dummy
  // purchase stays available for the captain's testers until public launch, and off for anyone
  // else. This is the server-side check the design demands; nothing upstream of it may substitute
  // a client-side flag.
  const grant = deps.purchaseGrant(userEmail);
  if (grant === null) {
    return fail(403, 'purchases_unavailable', 'Test upgrades are not available yet.');
  }

  const body = await readJson<PurchaseTierBody>(request);
  if (!body) {
    return fail(400, 'invalid_request', 'Request body must be valid JSON.');
  }
  if (!isPurchasableTier(body.tier)) {
    return fail(400, 'invalid_request', 'tier must be "pro" or "elite".');
  }
  // v1 accepts the dummy source only. A client claiming `'revenuecat'` would be claiming a receipt
  // was verified when no verification code exists yet, so it is refused rather than trusted.
  if (body.source !== 'dummy') {
    return fail(400, 'invalid_request', 'source must be "dummy" in v1.');
  }

  const now = new Date().toISOString();
  await deps.store.recordPurchase(userId, body.tier, 'dummy', now);
  if (grant === 'allowlist') {
    console.log('dummy purchase granted via allowlist', { userId });
  }

  // Computed, not stored — see `subscriptions` in `0002_app_schema.sql`.
  const window = await deps.store.quotaWindow(userId, now);
  return ok({ tier: window.tier, periodStart: window.periodStart, periodEnd: window.periodEnd });
}

// ---------------------------------------------------------------------------------------------
// POST /api/delete-account
// ---------------------------------------------------------------------------------------------

interface DeleteAccountBody {
  password?: unknown;
}

/**
 * Erase the account and everything it owns.
 *
 * The app's own copy promises "This permanently deletes your account, your intake answers, and
 * every plan you've generated. This can't be undone" (`docs/design/frontend-design-brief.md`), so
 * this really deletes rows — no soft-delete flag, which would make that copy a lie.
 *
 * It is also the ONLY route that deletes a plan. There is deliberately no per-plan delete: count-
 * based quota depends on plans being undeletable, or a user could reset their own count.
 *
 * RE-AUTH, like V2.3's `delete-account.tsx` (captain's decision, change-list item 10, 2026-09-20):
 * a valid session alone is not enough for this one destructive action. `deps.store.getCredentialPassword`
 * reads the account's real `providerId = 'credential'` row — never a client-asserted flag, per
 * `AGENTS.md`'s "no business rules in the client" — and the two cases branch here:
 *   - a credential row exists: the request MUST carry the correct plaintext `password`, checked
 *     with the identical `deps.verifyPassword` (`better-auth/crypto`'s `verifyPassword`) that
 *     `emailAndPassword`'s own sign-in handler uses. A missing or wrong password is a `401` and
 *     `deps.store.deleteAccount` is never called — the check happens strictly before the delete.
 *   - no credential row (Google/OAuth-only): the existing confirm-only path is preserved exactly,
 *     so a passwordless runner is never locked out of deleting their own account.
 */
export async function handleDeleteAccount(request: Request, userId: string, deps: Deps): Promise<Response> {
  const credentialHash = await deps.store.getCredentialPassword(userId);

  if (credentialHash !== null) {
    const body = await readJson<DeleteAccountBody>(request);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return fail(401, 'invalid_password', 'Enter your password to delete your account.');
    }
    const valid = await deps.verifyPassword({ hash: credentialHash, password });
    if (!valid) {
      return fail(401, 'invalid_password', 'That password is incorrect.');
    }
  }

  await deps.store.deleteAccount(userId);
  return ok({ deleted: true });
}

// ---------------------------------------------------------------------------------------------
// GET / PUT /api/intake
// ---------------------------------------------------------------------------------------------

export async function handleGetIntake(userId: string, deps: Deps): Promise<Response> {
  const intake = await deps.store.getIntake(userId);
  return ok({ intake });
}

/**
 * The wire shape of a PUT /api/intake body: the stored intake row plus the one-time consent
 * assertion for a 13–17 runner. `guardianConsent` deliberately does NOT live on `IntakeResponses`
 * (`src/lib/planTypes.ts`) — that interface is the stored intake row, shared verbatim between the
 * app and the workers, and a one-time consent action is not part of it.
 */
type IntakePutBody = IntakeResponses & { guardianConsent?: boolean };

/**
 * Save the intake answers.
 *
 * Validation here is deliberately shallow — required fields, ranges, closed sets — because the
 * table's own CHECK constraints are the real gate (`0002_app_schema.sql`). Two layers is right:
 * this one produces a readable message, the table one cannot be bypassed by a future caller that
 * forgets to use this route.
 *
 * A 13–17 runner additionally requires an explicit `guardianConsent: true` on the request
 * (captain's ruling, 2026-09-19 — GDPR Art. 9(2)(a) / Thai PDPA s.26 both require explicit
 * consent for this age band). Missing or false consent is refused before anything is persisted —
 * neither the intake nor a consent row. On success, the consent event is written in the SAME
 * `db.batch()` transaction as the intake upsert (`upsertIntake`'s `guardianConsent` param) so the
 * intake row can never persist without its consent record, or vice versa. 18+ runners are
 * unaffected: no consent handling, no consent row.
 */
export async function handlePutIntake(request: Request, userId: string, deps: Deps): Promise<Response> {
  const body = await readJson<IntakePutBody>(request);
  if (!body) {
    return fail(400, 'invalid_request', 'Request body must be valid JSON.');
  }

  const problem = validateIntake(body);
  if (problem) {
    return fail(400, 'invalid_request', problem);
  }

  const requiresGuardianConsent = body.age >= 13 && body.age <= 17;
  if (requiresGuardianConsent && body.guardianConsent !== true) {
    return fail(400, 'invalid_request', 'Guardian consent is required for runners aged 13 to 17.');
  }

  const now = new Date().toISOString();
  await deps.store.upsertIntake(
    userId,
    body,
    now,
    requiresGuardianConsent ? { grantedAt: now, policyVersion: PRIVACY_POLICY_VERSION } : undefined
  );

  return ok({ saved: true });
}

const EXPERIENCE_ANSWERS = new Set(['new', 'some', 'regular', 'experienced', 'competitive']);
const INJURY_FLAGS = new Set([
  'knee',
  'ankle_achilles',
  'shin_splints',
  'it_band',
  'hip_glute',
  'lower_back',
  'plantar_arch',
  'none',
]);

function validateIntake(intake: IntakeResponses): string | null {
  if (!intake || typeof intake !== 'object' || Array.isArray(intake)) {
    return 'Request body must be a JSON object.';
  }
  if (
    typeof intake.goal !== 'string' ||
    intake.goal.trim().length === 0 ||
    intake.goal.length > 500
  ) {
    return 'goal is required and must be 500 characters or fewer.';
  }
  // Age is not optional and never inferred: max HR is `220 − age`, so without it no HR zone is
  // computable at any tier, and 50+ forces a 3-week deload cadence.
  if (!Number.isInteger(intake.age) || intake.age < 13 || intake.age > 100) {
    return 'age must be a whole number between 13 and 100.';
  }
  if (typeof intake.experience !== 'string' || !EXPERIENCE_ANSWERS.has(intake.experience)) {
    return 'experience must be one of new|some|regular|experienced|competitive.';
  }
  if (!Number.isInteger(intake.daysPerWeek) || intake.daysPerWeek < 1 || intake.daysPerWeek > 7) {
    return 'daysPerWeek must be a whole number between 1 and 7.';
  }
  if (typeof intake.weeklyKm !== 'number' || !Number.isFinite(intake.weeklyKm) || intake.weeklyKm < 0) {
    return 'weeklyKm must be a non-negative number.';
  }
  if (
    !Array.isArray(intake.injuries) ||
    intake.injuries.length === 0 ||
    !intake.injuries.every((f) => INJURY_FLAGS.has(f)) ||
    (intake.injuries.includes('none') && intake.injuries.length > 1)
  ) {
    return 'injuries must be a non-empty array of injury flags, with "none" used by itself.';
  }
  if (
    intake.raceDistance !== undefined &&
    !['5k', '10k', 'half', 'marathon'].includes(intake.raceDistance)
  ) {
    return 'raceDistance must be one of 5k|10k|half|marathon.';
  }
  if (intake.raceDate !== undefined && !isIsoCalendarDate(intake.raceDate)) {
    return 'raceDate must be a valid YYYY-MM-DD calendar date.';
  }
  if (intake.goalTimeSec !== undefined && (!Number.isInteger(intake.goalTimeSec) || intake.goalTimeSec <= 0)) {
    return 'goalTimeSec must be a positive whole number of seconds.';
  }
  if (
    intake.injuryNotes !== undefined &&
    (typeof intake.injuryNotes !== 'string' || intake.injuryNotes.length > 2000)
  ) {
    return 'injuryNotes must be a string of 2000 characters or fewer.';
  }
  // Half a recent performance disables every numeric pace without saying so. Refuse it here as
  // well as in the table, because the table's message is not one a user could act on.
  if (intake.recentPerformance !== undefined) {
    const { distance, timeSec } = intake.recentPerformance ?? {};
    if (
      !distance ||
      !['5k', '10k', 'half', 'marathon'].includes(distance) ||
      !Number.isInteger(timeSec) ||
      timeSec <= 0
    ) {
      return 'recentPerformance must have both a distance and a positive timeSec, or be omitted.';
    }
  }
  return null;
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

// ---------------------------------------------------------------------------------------------
// GET /api/plans, GET /api/plans/:id
// ---------------------------------------------------------------------------------------------

/** My Plans. Summaries only — the full documents would be megabytes for a heavy user. */
export async function handleListPlans(userId: string, deps: Deps): Promise<Response> {
  const rows = await deps.store.listPlans(userId);
  return ok({
    plans: rows.map((row) => ({
      planId: row.id,
      title: row.plan?.title ?? null,
      tierAtGeneration: row.tierAtGeneration,
      engine: row.engine,
      isFallback: row.isFallback,
      createdAt: row.createdAt,
    })),
  });
}

/** One plan. A plan id belonging to someone else is a 404, not a 403 — it does not exist to you. */
export async function handleGetPlan(userId: string, planId: string, deps: Deps): Promise<Response> {
  const row = await deps.store.getPlan(userId, planId);
  if (!row || row.status !== 'settled' || !row.plan) {
    return fail(404, 'not_found', 'No such plan.');
  }
  return ok({
    plan: row.plan,
    planId: row.id,
    isFallback: row.isFallback,
    quotaConsumed: row.quotaConsumed,
  });
}

/** Exported for the tier-limit display the paywall renders. Never an enforcement path. */
export function tierLimitFor(tier: Tier): number {
  return TIER_PLAN_LIMITS[tier];
}
