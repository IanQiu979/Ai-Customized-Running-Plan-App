/**
 * The two seams `generate-plan` builds a plan through: the deterministic skeleton builder, and the
 * paid-tier personalizer that decorates it.
 *
 * **Skeleton — swap 1, now landed.** `createTemplateSkeletonBuilder()` wires this to
 * `src/lib/planTemplates.ts`'s `buildTemplatePlan`, the deterministic engine ported from Ian's
 * coaching library. `createUnavailableSkeletonBuilder()` is kept below (and exercised by its own
 * test) as the documented fallback shape — the structured 503 `generate-plan-flow.ts` returns if a
 * skeleton builder is ever unbound again — not because it is still the production binding.
 *
 * **Personalizer — swap 2, still open.** The Pro/Elite personalization prompt is coaching-sensitive
 * work of its own (`docs/reference/plan-generation.md` step 7). `CLAUDE.md`'s "Coaching domain"
 * section is explicit that training content is not the code's to invent, so
 * `createPlanPersonalizer` still takes `promptBuilder: null` in production
 * (`workers/src/deps.ts`) — paid tiers get the same coach-authored skeleton as Free, marked as a
 * quota-exempt fallback, until that prompt is written.
 *
 * Serving `fixtures/examplePlan.ts` as if it were generated, or writing a second, competing
 * generator here, is exactly the failure the sibling repo shipped as its issue #128, where a mock
 * bound as production served every user for weeks — that is why the skeleton swap goes through
 * the one ported, tested engine and nothing improvised alongside it.
 *
 * THE REMAINING SWAP HAS A NAMED OWNER: `createDeps()` in `workers/src/deps.ts`, one binding, same
 * as the first.
 */

import type { Engine, IntakeResponses, Plan, Tier } from '../../../src/lib/planTypes';
import type { GoalType, RaceDistance } from '../../../src/lib/planTypes';
import { buildLibraryPlan } from '../../../src/lib/planLibrary/engine';
import { buildTemplatePlan } from '../../../src/lib/planTemplates';
import { MAX_PLAN_WEEKS } from '../../../src/lib/planRequest';
import type { ModelCaller } from './model';
import { isPlanShaped } from './planValidation';

export interface SkeletonInput {
  tier: Tier;
  goalType: GoalType;
  raceDistance?: RaceDistance;
  raceDate?: string;
  durationWeeks?: number;
  intake: IntakeResponses;
  /** ISO-8601 UTC. Injected rather than read from the clock, so the flow stays deterministic. */
  now: string;
}

export type SkeletonResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'engine_unavailable' | 'invalid_request'; message: string };

/**
 * Steps 4, 5, 8 and 9 of the pipeline: reconcile plan length, build the parametric skeleton,
 * expand it, and clamp every week against `src/lib/loadRules.ts`. All deterministic, all
 * coach-authored, all identical across tiers — the skeleton is never removed at any tier.
 */
export interface SkeletonBuilder {
  build(input: SkeletonInput): Promise<SkeletonResult>;
}

export interface PersonalizeInput {
  skeleton: Plan;
  tier: Exclude<Tier, 'free'>;
  intake: IntakeResponses;
  notes?: string;
}

export type PersonalizeResult =
  | { ok: true; plan: Plan; engine: Engine }
  | { ok: false; reason: 'prompt_unavailable' | 'model_error' | 'invalid_shape'; message: string };

/** Step 7: the single Claude call that personalizes the skeleton for Pro and Elite. */
export interface PlanPersonalizer {
  personalize(input: PersonalizeInput): Promise<PersonalizeResult>;
}

/** Builds the Messages request for a personalization. Absent until the prompt work lands. */
export type PromptBuilder = (input: PersonalizeInput) => {
  request: Parameters<ModelCaller['send']>[0];
  /** Pulls the plan document out of the model's (forced-tool-call) response. */
  extract: (response: unknown) => unknown;
};

/**
 * The typed-unavailable skeleton builder — the shape `generate-plan-flow.ts` falls back to if a
 * skeleton is ever unbound again, not the production binding (`createDeps()` in
 * `workers/src/deps.ts` binds `createTemplateSkeletonBuilder` below).
 */
export function createUnavailableSkeletonBuilder(): SkeletonBuilder {
  return {
    async build() {
      return {
        ok: false,
        reason: 'engine_unavailable',
        message:
          'The plan engine (src/lib/planTemplates.ts) is not built yet. generate-plan is wired ' +
          'end to end and will serve real plans the moment it is bound in workers/src/deps.ts.',
      };
    },
  };
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Abuse-prevention ceiling on how many weeks a single generated plan may span — arithmetic
 * bound-checking, not a coaching decision. Every McMillan plan example in the coaching library
 * tops out well under a year (`docs/reference/plan-generation.md` step 7 talks in terms of
 * "24–30 weeks"); 104 weeks (two years) is generous headroom while still bounding the cost of
 * `buildTemplatePlan`'s per-week generation loop against a client sending an absurd
 * `durationWeeks` or a race date decades out — before this was wired to a real engine, that input
 * was inert (every request 503'd first), so nothing enforced it.
 *
 * The number itself lives in `src/lib/planRequest.ts` (`MAX_PLAN_WEEKS`), which both sides import,
 * so the client's "104 weeks or fewer" refusal and this one are one value, not two.
 */
export const MAX_PLAN_DURATION_WEEKS = MAX_PLAN_WEEKS;

/**
 * How many weeks a race-goal plan should span when the client sends a race date instead of an
 * explicit duration: the gap between `now` and `raceDate`, rounded to the nearest whole week,
 * clamped to `[1, MAX_PLAN_DURATION_WEEKS]`. The clamp is the abuse-prevention bound above; it is
 * NOT the tier-specific "a race farther out than the tier's max plan length gets a delayed start"
 * behavior `docs/reference/plan-generation.md` step 4 describes — no tier max-plan-length number
 * has been ruled on yet, so that part is deliberately not implemented here rather than guessed
 * at. A race beyond the cap still gets a real, honest plan; it's simply capped at the same length
 * as any other over-long request, not silently truncated without a floor.
 */
function weeksUntilRace(raceDate: string, now: string): number {
  const diffMs = Date.parse(raceDate) - Date.parse(now);
  return Math.min(MAX_PLAN_DURATION_WEEKS, Math.max(1, Math.round(diffMs / MS_PER_WEEK)));
}

/**
 * The production skeleton builder, wired to the deterministic template engine
 * (`src/lib/planTemplates.ts`'s `buildTemplatePlan`). Density (`'free'` vs `'paid'`) is the lever
 * that engine already exposes for what's tier-gated in a template plan's own output (numeric
 * pace/HR fields) — this wiring only selects which side of it a request gets, it invents nothing.
 */
export function createTemplateSkeletonBuilder(): SkeletonBuilder {
  return {
    async build(input) {
      const durationWeeks =
        input.durationWeeks ?? (input.raceDate ? weeksUntilRace(input.raceDate, input.now) : 1);

      // Captain's ruling, 2026-09-06: the plan engine splits by tier. **Free is served entirely
      // from the 40-plan deterministic library** (`src/lib/planLibrary/`, ported from
      // `planning/research/plan-blueprint-examples.md`); paying tiers keep the AI curve generator,
      // for which this template plan is the skeleton. The library is not a fallback for the
      // generator and not a parameter source for it — the two never meet.
      if (input.tier === 'free') {
        const library = buildLibraryPlan({
          intake: input.intake,
          goalType: input.goalType,
          durationWeeks,
          ...(input.raceDistance !== undefined ? { raceDistance: input.raceDistance } : {}),
          ...(input.raceDate !== undefined ? { raceDate: input.raceDate } : {}),
          tierAtGeneration: input.tier,
        });
        if (library.ok) return { ok: true, plan: library.plan };
        // The one uncovered request shape: a runner who named no race distance at all. The register
        // has no plan for them and none is invented — see `planLibrary/openQuestions.ts` (Q1) and
        // `docs/reference/coaching/free-engine-open-questions.md`. Until the captain rules, they
        // keep the generic template engine rather than being refused a plan.
      }

      const plan = buildTemplatePlan({
        intake: input.intake,
        goalType: input.goalType,
        durationWeeks,
        raceDistance: input.raceDistance,
        raceDate: input.raceDate,
        tierAtGeneration: input.tier,
        density: input.tier === 'free' ? 'free' : 'paid',
      });

      return { ok: true, plan };
    },
  };
}

/** How long one personalization call may take before it is abandoned as a timeout. */
export const MODEL_TIMEOUT_MS = 60_000;

/**
 * The real personalizer's control flow — model call, structural validation, **retry once**, give
 * up — exactly as `docs/reference/plan-generation.md` "Validation" specifies.
 *
 * It is production-shaped and fully exercised by tests (which inject a fake `promptBuilder` and a
 * stub `ModelCaller`), but production passes `promptBuilder = null`, so the real path short-circuits
 * before any network call. That is the seam: when the prompt lands, one argument changes and every
 * branch below is already tested.
 *
 * Note what happens on failure — nothing dramatic. A typed failure returns to the flow, which
 * serves the template plan as `isFallback: true`. A model that cannot be reached costs the runner
 * a "why", never a plan.
 */
export function createPlanPersonalizer(
  modelCaller: ModelCaller,
  promptBuilder: PromptBuilder | null
): PlanPersonalizer {
  return {
    async personalize(input) {
      if (!promptBuilder) {
        return {
          ok: false,
          reason: 'prompt_unavailable',
          message:
            'The Pro/Elite personalization prompt is not written yet, so no model call is made. ' +
            'Paid tiers currently receive the same coach-authored skeleton as Free, marked as a ' +
            'fallback (and therefore quota-exempt).',
        };
      }

      const { request, extract } = promptBuilder(input);

      // Two attempts, never more: one generate, one retry on a structural failure.
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const result = await modelCaller.send(request, MODEL_TIMEOUT_MS);

        if (!result.ok) {
          // `not_configured` is not worth retrying — the second attempt would fail identically.
          if (result.kind === 'not_configured' || attempt === 2) {
            return { ok: false, reason: 'model_error', message: result.message };
          }
          continue;
        }

        const candidate = extract(result.response);
        if (isPlanShaped(candidate)) {
          // `engine: 'ai'` is never emitted in v1 — every paid plan is skeleton-constrained
          // `hybrid` (`planTypes.ts`'s `Engine` comment). Stamped here rather than trusted from
          // the model, which has no business naming its own engine.
          return { ok: true, plan: { ...candidate, engine: 'hybrid' }, engine: 'hybrid' };
        }

        if (attempt === 2) {
          return {
            ok: false,
            reason: 'invalid_shape',
            message: 'Model output failed structural validation twice.',
          };
        }
      }

      /* c8 ignore next */
      return { ok: false, reason: 'invalid_shape', message: 'unreachable' };
    },
  };
}
