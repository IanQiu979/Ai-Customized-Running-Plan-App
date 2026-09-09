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
  createTemplateSkeletonBuilder,
  createUnavailableSkeletonBuilder,
  type PromptBuilder,
} from '../src/lib/planEngine';
import { NO_RACE_DISTANCE_MESSAGE } from '../../src/lib/planLibrary/openQuestions';
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

describe('createTemplateSkeletonBuilder', () => {
  it('builds a real plan from an explicit duration', async () => {
    // Free needs a target distance (Ian's Q1 ruling, 2026-09-10) — the library is organised by
    // distance — but not a race date. This is the "training, no race booked" Free runner.
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'duration',
      durationWeeks: 8,
      intake: { ...INTAKE, raceDistance: '10k' },
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.durationWeeks).toBe(8);
    expect(result.ok && result.plan.weeks).toHaveLength(8);
  });

  it('reconciles a race date into a whole number of weeks when no duration is given', async () => {
    // 2026-08-01 -> 2026-10-24 is exactly 12 weeks (84 days).
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'race',
      raceDistance: '5k',
      raceDate: '2026-10-24T00:00:00.000Z',
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.durationWeeks).toBe(12);
  });

  it('clamps a far-future race date at MAX_PLAN_DURATION_WEEKS instead of an unbounded plan', async () => {
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'race',
      raceDistance: '5k',
      raceDate: '2126-08-01T00:00:00.000Z', // a century out
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.durationWeeks).toBe(104);
    expect(result.ok && result.plan.weeks).toHaveLength(104);
  });

  it('floors a race date in the past (or this week) at a one-week plan, never refusing', async () => {
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'race',
      raceDistance: '5k',
      raceDate: '2026-08-02T00:00:00.000Z',
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.durationWeeks).toBe(1);
  });

  it('gates numeric pace fields on tier density — free gets none, pro gets them', async () => {
    const intakeWithRecent = {
      ...INTAKE,
      raceDistance: '5k' as const,
      recentPerformance: { distance: '5k' as const, timeSec: 1200 },
    };

    const free = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'duration',
      durationWeeks: 4,
      intake: intakeWithRecent,
      now: '2026-08-01T00:00:00.000Z',
    });
    const pro = await createTemplateSkeletonBuilder().build({
      tier: 'pro',
      goalType: 'duration',
      durationWeeks: 4,
      intake: intakeWithRecent,
      now: '2026-08-01T00:00:00.000Z',
    });

    const freeRuns = (free.ok ? free.plan.weeks : []).flatMap((week) =>
      week.days.filter((day): day is Extract<typeof day, { kind: 'run' }> => day.kind === 'run')
    );
    const proRuns = (pro.ok ? pro.plan.weeks : []).flatMap((week) =>
      week.days.filter((day): day is Extract<typeof day, { kind: 'run' }> => day.kind === 'run')
    );

    expect(freeRuns.some((run) => run.pace !== undefined)).toBe(false);
    expect(proRuns.some((run) => run.pace !== undefined)).toBe(true);
  });
});

describe('createTemplateSkeletonBuilder — no race named anywhere', () => {
  /**
   * The captain's 2026-08-15 report: "the race stage should be optional, it's not a mandatory
   * thing you need to input." Home used to refuse to generate without one. `INTAKE` here has no
   * `raceDistance`, which is exactly that runner — the request must produce a real plan, and it
   * must not have a 5K (or any other distance) invented for it on the way through.
   *
   * **That rule now applies to the paid tiers only.** Ian's Q1 ruling (2026-09-10) requires a
   * target distance on Free, because Free is served entirely from the 40-plan library and the
   * library is organised by distance. A race *date* stays optional on every tier — it is the
   * distance, not the booking, that Free needs.
   */
  it('builds a real plan for a paid runner who named no race', async () => {
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'pro',
      goalType: 'duration',
      durationWeeks: 12,
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.weeks).toHaveLength(12);
    expect(result.plan.title).toBe('12-Week Running Plan');
    expect(result.plan.weeklyLoad.every((km) => km > 0)).toBe(true);
  });

  it('refuses a Free request with no distance rather than inventing or borrowing one', async () => {
    // Two wrong answers this guards against: defaulting onto the 10K calendar (Ian ruled it out
    // explicitly), and falling through to `buildTemplatePlan`, which would put a Free user back on
    // the paid tiers' skeleton and undo the 2026-09-06 tier split. `invalid_request` makes the
    // flow release the reservation, so the refusal costs the runner no quota.
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'duration',
      durationWeeks: 12,
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_request');
    expect(result.message).toBe(NO_RACE_DISTANCE_MESSAGE);
  });

  it('still serves a Free runner who named a distance but no race date', async () => {
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'free',
      goalType: 'duration',
      durationWeeks: 12,
      intake: { ...INTAKE, raceDistance: 'half' },
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.raceDate).toBeUndefined();
    expect(result.plan.weeks).toHaveLength(12);
  });

  it('leaves the race fields off the plan instead of defaulting them to 5K', async () => {
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'pro',
      goalType: 'duration',
      durationWeeks: 12,
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.raceDistance).toBeUndefined();
    expect(result.plan.raceDate).toBeUndefined();
  });

  it('emits no taper phase, because there is no race day to taper into', async () => {
    // Before the fix this returned base x4 / build x4 / peak x2 / taper x2 — the 5K weighting,
    // reached through a silent `?? '5k'`, winding a general-fitness runner down for a race that
    // did not exist.
    const result = await createTemplateSkeletonBuilder().build({
      tier: 'pro',
      goalType: 'duration',
      durationWeeks: 12,
      intake: INTAKE,
      now: '2026-08-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.weeks.map((week) => week.phase)).not.toContain('taper');
  });
});
