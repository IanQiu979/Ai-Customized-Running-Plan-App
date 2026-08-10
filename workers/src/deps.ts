/**
 * Runtime wiring. The ONLY file that reads a secret out of `env`, and the only one that decides
 * which implementation each seam gets.
 *
 * Same role as `supabase/functions/analyze-form/deps.ts` in the sibling repo: everything it builds
 * is injected into pure orchestration (`lib/generate-plan-flow.ts`), which imports nothing from
 * here. That direction is load-bearing — reverse it and the flow's tests start needing a network,
 * a key, and real Anthropic spend.
 *
 * ============================================================================================
 * THE TWO BINDINGS — this list exists so no swap is left ownerless the way the sibling repo's
 * issue #128 was.
 * ============================================================================================
 *   1. `skeleton:` — DONE. `createTemplateSkeletonBuilder()` wires `src/lib/planTemplates.ts` +
 *      `src/lib/paceDerivation.ts`, now that the plan-engine task has landed them.
 *   2. `promptBuilder` — DONE. `planPersonalizationPromptBuilder` (`lib/planPersonalizationPrompt.ts`)
 *      is the real Pro/Elite prompt: it never re-emits a number, only the coaching "why" text, and
 *      is merged onto the already-clamped skeleton (see that file's header for why this is a
 *      narrower, safer design than the original "one representative week + expander" sketch).
 *      With no `ANTHROPIC_API_KEY` configured (still true everywhere today — see `lib/model.ts`),
 *      `resolveModelCaller` binds `createUnconfiguredModelCaller`, so this prompt is built but the
 *      call always answers `not_configured` and paid tiers fall back to the template plan, marked
 *      `isFallback: true` (quota-exempt), until the captain pushes the key.
 * Both swaps are bound; only the key is still missing.
 */

import { isAllUsersUnlimitedAccessEnabled } from './access';
import type { Env } from './env';
import type { GeneratePlanDeps } from './lib/generate-plan-flow';
import { createPlanPersonalizer, createTemplateSkeletonBuilder } from './lib/planEngine';
import { resolveModelCaller } from './lib/model';
import { planPersonalizationPromptBuilder } from './lib/planPersonalizationPrompt';
import { D1PlanStore } from './lib/store';

export interface Deps {
  store: D1PlanStore;
  generatePlan: GeneratePlanDeps;
}

export function createDeps(env: Env): Deps {
  const store = new D1PlanStore(
    env.DB,
    isAllUsersUnlimitedAccessEnabled(env.ALL_USERS_UNLIMITED_ACCESS)
  );

  // `ANTHROPIC_API_KEY` is read here and in no other file. Absent → `createUnconfiguredModelCaller`,
  // which fails honestly instead of fabricating a plan. See `lib/model.ts`.
  const modelCaller = resolveModelCaller(env.ANTHROPIC_API_KEY);

  return {
    store,
    generatePlan: {
      store,
      skeleton: createTemplateSkeletonBuilder(), // swap 1 — see the header
      personalizer: createPlanPersonalizer(modelCaller, planPersonalizationPromptBuilder), // swap 2 — see the header
      loadIntake: (userId) => store.getIntake(userId),
      now: () => new Date().toISOString(),
    },
  };
}
