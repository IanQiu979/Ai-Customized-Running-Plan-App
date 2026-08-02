/**
 * The two seams `generate-plan` builds a plan through: the deterministic skeleton builder, and the
 * paid-tier personalizer that decorates it.
 *
 * NEITHER HAS A REAL IMPLEMENTATION IN THIS BRANCH, and that is deliberate rather than unfinished:
 *
 *   - The skeleton comes from `src/lib/planTemplates.ts` + `src/lib/paceDerivation.ts`, which are
 *     being written in a parallel task against the red TDD suites already in the repo
 *     (`planTemplates.golden.test.ts`, `paceDerivation.test.ts`, quarantined in `jest.config.js`).
 *     Writing a second, competing generator here — or serving `fixtures/examplePlan.ts` as if it
 *     were generated — is exactly the failure the sibling repo shipped as its issue #128, where a
 *     mock bound as production served every user for weeks.
 *   - The personalization prompt is coaching-sensitive work of its own
 *     (`docs/reference/plan-generation.md` step 7). `CLAUDE.md`'s "Coaching domain" section is
 *     explicit that training content is not the code's to invent.
 *
 * So both production factories return a typed *unavailable*, and `generate-plan-flow.ts` handles
 * that as a first-class outcome: the reservation is released, no quota is consumed, and the caller
 * gets a structured `503`. The alternative — a plausible-looking plan from nowhere — is the one
 * outcome a running app must never produce.
 *
 * THE SWAP HAS A NAMED OWNER, because "a later task will replace this binding" is how issue #128
 * happened: the swap is `createDeps()` in `workers/src/deps.ts`, one binding each, and the plan
 * engine's own done-when (deleting the two `jest.config.js` quarantine lines) is not met until it
 * is done.
 */

import type { Engine, IntakeResponses, Plan, Tier } from '../../../src/lib/planTypes';
import type { GoalType, RaceDistance } from '../../../src/lib/planTypes';
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

/** The production skeleton builder, until `src/lib/planTemplates.ts` exists. See the file header. */
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
