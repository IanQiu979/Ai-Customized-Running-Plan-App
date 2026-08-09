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
 * THE TWO BINDINGS A FOLLOW-UP TASK CHANGES — this list exists so no swap is left ownerless the
 * way the sibling repo's issue #128 was.
 * ============================================================================================
 *   1. `skeleton:` — DONE. `createTemplateSkeletonBuilder()` wires `src/lib/planTemplates.ts` +
 *      `src/lib/paceDerivation.ts`, now that the plan-engine task has landed them.
 *   2. `promptBuilder` (the second argument to `createPlanPersonalizer`) — still `null`, swap it
 *      for the real Pro/Elite prompt once that work lands. Until then paid tiers fall back to the
 *      template plan, marked `isFallback: true`, which is quota-exempt.
 * Neither swap needs anything else in this project to change.
 */

import { isAllUsersUnlimitedAccessEnabled } from './access';
import type { Env } from './env';
import type { GeneratePlanDeps } from './lib/generate-plan-flow';
import { createPlanPersonalizer, createTemplateSkeletonBuilder } from './lib/planEngine';
import { resolveModelCaller } from './lib/model';
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
      personalizer: createPlanPersonalizer(modelCaller, null), // swap 2 — see the header
      loadIntake: (userId) => store.getIntake(userId),
      now: () => new Date().toISOString(),
    },
  };
}
