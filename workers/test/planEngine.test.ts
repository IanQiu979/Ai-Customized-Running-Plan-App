/**
 * The personalizer's control flow: one call, structural validation, retry once, give up.
 *
 * A fake `promptBuilder` and a scripted `ModelCaller` stand in for the unwritten prompt, so every
 * branch below is exercised with zero network and zero Anthropic spend. When the real prompt lands,
 * it changes one argument in `deps.ts` and inherits all of this.
 */

import { describe, expect, it } from 'vitest';

import type { ModelCallResult, ModelCaller } from '../src/lib/model';
import {
  createPlanPersonalizer,
  createUnavailableSkeletonBuilder,
  type PromptBuilder,
} from '../src/lib/planEngine';
import { INTAKE, makePlan } from './fakes';

const INPUT = { skeleton: makePlan(), tier: 'pro' as const, intake: INTAKE };

/** Answers with each scripted result in turn, and records how many times it was asked. */
function scriptedCaller(...results: ModelCallResult[]): ModelCaller & { calls: number } {
  const caller = {
    calls: 0,
    async send() {
      const result = results[Math.min(caller.calls, results.length - 1)];
      caller.calls += 1;
      return result;
    },
  };
  return caller;
}

const prompt: PromptBuilder = () => ({
  request: { model: 'claude-sonnet-5', max_tokens: 4096 },
  extract: (response) => (response as { plan?: unknown }).plan,
});

describe('createPlanPersonalizer', () => {
  it('makes no model call at all while the prompt is unwritten', async () => {
    // The shipped configuration. It must be a typed failure, not a fabricated plan — the flow then
    // serves the template as a quota-exempt fallback.
    const caller = scriptedCaller({ ok: true, response: {} });

    const result = await createPlanPersonalizer(caller, null).personalize(INPUT);

    expect(result).toMatchObject({ ok: false, reason: 'prompt_unavailable' });
    expect(caller.calls).toBe(0);
  });

  it('returns a personalized plan when the model answers with a valid shape', async () => {
    const caller = scriptedCaller({ ok: true, response: { plan: makePlan({ title: 'Coached' }) } });

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.title).toBe('Coached');
  });

  it('never emits engine "ai" — every paid plan is skeleton-constrained hybrid', async () => {
    // `planTypes.ts`'s `Engine` comment: an earlier "unconstrained Elite" design was corrected on
    // 2026-07-10, and no code path may emit `'ai'` in v1. The model does not get to name its own
    // engine.
    const caller = scriptedCaller({ ok: true, response: { plan: makePlan({ engine: 'ai' }) } });

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result.ok && result.plan.engine).toBe('hybrid');
    expect(result.ok && result.engine).toBe('hybrid');
  });

  it('retries exactly once after a malformed response, then succeeds', async () => {
    const caller = scriptedCaller(
      { ok: true, response: { plan: { nonsense: true } } },
      { ok: true, response: { plan: makePlan() } }
    );

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result.ok).toBe(true);
    expect(caller.calls).toBe(2);
  });

  it('gives up after a second malformed response instead of retrying forever', async () => {
    const caller = scriptedCaller({ ok: true, response: { plan: { nonsense: true } } });

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result).toMatchObject({ ok: false, reason: 'invalid_shape' });
    expect(caller.calls).toBe(2);
  });

  it('retries a transient provider failure once', async () => {
    const caller = scriptedCaller(
      { ok: false, kind: 'timeout', message: 'slow' },
      { ok: true, response: { plan: makePlan() } }
    );

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result.ok).toBe(true);
    expect(caller.calls).toBe(2);
  });

  it('does not retry a missing API key — the second attempt would fail identically', async () => {
    const caller = scriptedCaller({ ok: false, kind: 'not_configured', message: 'no key' });

    const result = await createPlanPersonalizer(caller, prompt).personalize(INPUT);

    expect(result).toMatchObject({ ok: false, reason: 'model_error' });
    expect(caller.calls).toBe(1);
  });
});

describe('createUnavailableSkeletonBuilder', () => {
  it('reports engine_unavailable rather than inventing a plan', async () => {
    // Serving `fixtures/examplePlan.ts` here, or any plausible-looking generated plan, is the one
    // outcome a running app must never produce. See `lib/planEngine.ts`'s header.
    const result = await createUnavailableSkeletonBuilder().build({
      tier: 'free',
      goalType: 'duration',
      durationWeeks: 8,
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, reason: 'engine_unavailable' });
  });
});
