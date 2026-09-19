/**
 * The Pro/Elite personalization prompt: request shape, structural extraction, and — the part that
 * matters most — that merging a model's answer onto the skeleton can never change a number.
 */

import { describe, expect, it } from 'vitest';

import { createPlanPersonalizer } from '../src/lib/planEngine';
import type { ModelCallResult, ModelCaller } from '../src/lib/model';
import {
  buildPlanPersonalizationRequest,
  extractPersonalizationPayload,
  isPersonalizationShaped,
  mergePersonalization,
  MAX_COACH_INTRO_LENGTH,
  MAX_WHY_LENGTH,
  PLAN_PERSONALIZATION_MODEL,
  PLAN_PERSONALIZATION_TOOL_NAME,
  planPersonalizationPromptBuilder,
} from '../src/lib/planPersonalizationPrompt';
import { INTAKE, makePlan } from './fakes';

const SKELETON = makePlan({
  durationWeeks: 2,
  weeklyLoad: [20, 12],
  weeks: [
    {
      weekNumber: 1,
      totalWeeks: 2,
      phase: 'base',
      isDeload: false,
      volumeKm: 20,
      days: [
        { kind: 'rest' },
        { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, effortDescription: 'Easy.' },
        { kind: 'rest' },
        { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, effortDescription: 'Easy.' },
        { kind: 'rest' },
        { kind: 'run', effort: 'easy', label: 'LR', distanceKm: 10, effortDescription: 'Easy.' },
        { kind: 'rest' },
      ],
    },
    {
      weekNumber: 2,
      totalWeeks: 2,
      phase: 'taper',
      isDeload: true,
      volumeKm: 12,
      days: [
        { kind: 'rest' },
        { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 3, effortDescription: 'Easy.' },
        { kind: 'rest' },
        { kind: 'rest' },
        { kind: 'rest' },
        { kind: 'run', effort: 'easy', label: 'LR', distanceKm: 9, effortDescription: 'Easy.' },
        { kind: 'rest' },
      ],
    },
  ],
});

const INPUT_BASE = { skeleton: SKELETON, tier: 'pro' as const, intake: INTAKE };

function toolUseResponse(input: unknown) {
  return { content: [{ type: 'tool_use', name: PLAN_PERSONALIZATION_TOOL_NAME, input }] };
}

describe('buildPlanPersonalizationRequest', () => {
  it('forces the tool call and names claude-sonnet-5', () => {
    const request = buildPlanPersonalizationRequest({ skeleton: SKELETON, tier: 'pro', intake: INTAKE });

    expect(request.model).toBe(PLAN_PERSONALIZATION_MODEL);
    expect(request.tool_choice).toEqual({ type: 'tool', name: PLAN_PERSONALIZATION_TOOL_NAME });
    expect(Array.isArray(request.tools)).toBe(true);
  });

  it('sets no temperature/top_p/top_k — claude-sonnet-5 400s on any non-default value', () => {
    const request = buildPlanPersonalizationRequest({ skeleton: SKELETON, tier: 'pro', intake: INTAKE });

    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    expect(request).not.toHaveProperty('top_k');
  });

  it('only asks Elite for per-workout reasoning', () => {
    const proRequest = buildPlanPersonalizationRequest({ skeleton: SKELETON, tier: 'pro', intake: INTAKE });
    const eliteRequest = buildPlanPersonalizationRequest({ skeleton: SKELETON, tier: 'elite', intake: INTAKE });

    const proSchema = (proRequest.tools as [{ input_schema: { required: string[] } }])[0].input_schema;
    const eliteSchema = (eliteRequest.tools as [{ input_schema: { required: string[] } }])[0].input_schema;

    expect(proSchema.required).not.toContain('workouts');
    expect(eliteSchema.required).toContain('workouts');
  });

  it('tells the model a dateless distance is a base block, and a dated one is a race', () => {
    // Issue #76: `raceDate`, not `raceDistance`, means a race is booked. The prompt is a reader of
    // the skeleton like any other, so it must not present a base block's distance as a race.
    const text = (skeleton: typeof SKELETON) =>
      JSON.stringify(buildPlanPersonalizationRequest({ ...INPUT_BASE, skeleton }));
    const baseBlock = text(makePlan({ ...SKELETON, goalType: 'duration', raceDistance: '10k' }));
    expect(baseBlock).toContain('Target distance: 10k');
    expect(baseBlock).toContain('No race is booked');
    expect(baseBlock).not.toContain('Race date:');

    const race = text(
      makePlan({ ...SKELETON, goalType: 'race', raceDistance: '10k', raceDate: '2026-12-05' }),
    );
    expect(race).toContain('Target distance: 10k');
    expect(race).toContain('Race date: 2026-12-05');
    expect(race).not.toContain('No race is booked');

    const noDistance = text(makePlan({ ...SKELETON, goalType: 'duration' }));
    expect(noDistance).not.toContain('Target distance');
    expect(noDistance).not.toContain('No race is booked');
  });

  it('never sends a numeric field (pace, hrZone, rpe) — only the compact day summary', () => {
    const request = buildPlanPersonalizationRequest({
      skeleton: SKELETON,
      tier: 'pro',
      intake: { ...INTAKE, recentPerformance: { distance: '5k', timeSec: 1200 } },
    });

    const serialized = JSON.stringify(request);
    expect(serialized).not.toMatch(/hrZone/);
    expect(serialized).not.toMatch(/"rpe"/);
  });
});

describe('extractPersonalizationPayload', () => {
  it('pulls the tool_use input out of a well-formed response', () => {
    const payload = { coachIntro: 'Welcome', weeks: [{ weekNumber: 1, why: 'Base building.' }] };

    expect(extractPersonalizationPayload(toolUseResponse(payload))).toEqual(payload);
  });

  it('returns undefined for a response with no tool_use block', () => {
    expect(extractPersonalizationPayload({ content: [{ type: 'text', text: 'nope' }] })).toBeUndefined();
    expect(extractPersonalizationPayload({})).toBeUndefined();
    expect(extractPersonalizationPayload(null)).toBeUndefined();
  });
});

describe('isPersonalizationShaped', () => {
  it('accepts a minimal valid Pro payload', () => {
    expect(
      isPersonalizationShaped({ coachIntro: 'Hi', weeks: [{ weekNumber: 1, why: 'Because.' }] }),
    ).toBe(true);
  });

  it('accepts an Elite payload carrying workouts', () => {
    expect(
      isPersonalizationShaped({
        coachIntro: 'Hi',
        weeks: [{ weekNumber: 1, why: 'Because.' }],
        workouts: [{ weekNumber: 1, dayIndex: 1, why: 'Easy shakeout.' }],
      }),
    ).toBe(true);
  });

  it('rejects a missing coachIntro', () => {
    expect(isPersonalizationShaped({ weeks: [{ weekNumber: 1, why: 'x' }] })).toBe(false);
  });

  it('rejects an empty weeks array', () => {
    expect(isPersonalizationShaped({ coachIntro: 'Hi', weeks: [] })).toBe(false);
  });

  it('rejects a dayIndex outside 0-6', () => {
    expect(
      isPersonalizationShaped({
        coachIntro: 'Hi',
        weeks: [{ weekNumber: 1, why: 'x' }],
        workouts: [{ weekNumber: 1, dayIndex: 7, why: 'x' }],
      }),
    ).toBe(false);
  });

  it('rejects prose that is only whitespace', () => {
    expect(isPersonalizationShaped({ coachIntro: '   ', weeks: [{ weekNumber: 1, why: 'x' }] })).toBe(
      false,
    );
  });
});

describe('mergePersonalization', () => {
  it('sets coachIntro and week.why without touching any structural field', () => {
    const payload = {
      coachIntro: 'Welcome to your plan.',
      weeks: [
        { weekNumber: 1, why: 'This week builds your base.' },
        { weekNumber: 2, why: 'Taper week — trust the work.' },
      ],
    };

    const merged = mergePersonalization(SKELETON, payload, 'pro');

    expect(merged.coachIntro).toBe('Welcome to your plan.');
    expect(merged.weeks[0].why).toBe('This week builds your base.');
    expect(merged.weeks[1].why).toBe('Taper week — trust the work.');
    // Every structural field is byte-identical to the skeleton.
    expect(merged.weeks).toEqual(
      SKELETON.weeks.map((week, i) => ({ ...week, why: payload.weeks[i].why })),
    );
    expect(merged.weeks[0].volumeKm).toBe(20);
    expect(merged.weeks[1].isDeload).toBe(true);
  });

  it('merges per-workout why only at Elite, and only onto run days', () => {
    const payload = {
      coachIntro: 'Welcome.',
      weeks: [{ weekNumber: 1, why: 'Base week.' }],
      workouts: [
        { weekNumber: 1, dayIndex: 1, why: 'Easy shakeout to open the week.' },
        { weekNumber: 1, dayIndex: 0, why: 'This is a rest day — should be ignored.' },
      ],
    };

    const elite = mergePersonalization(SKELETON, payload, 'elite');
    const eliteDay1 = elite.weeks[0].days[1] as { why?: string };
    const eliteDay0 = elite.weeks[0].days[0] as { kind: string; why?: string };
    expect(eliteDay1.why).toBe('Easy shakeout to open the week.');
    expect(eliteDay0.kind).toBe('rest');
    expect(eliteDay0.why).toBeUndefined();

    const pro = mergePersonalization(SKELETON, payload, 'pro');
    const proDay1 = pro.weeks[0].days[1] as { why?: string };
    expect(proDay1.why).toBeUndefined();
  });

  it('never mutates the original skeleton object', () => {
    const before = JSON.stringify(SKELETON);
    mergePersonalization(
      SKELETON,
      { coachIntro: 'Hi', weeks: [{ weekNumber: 1, why: 'x' }] },
      'pro',
    );
    expect(JSON.stringify(SKELETON)).toBe(before);
  });

  it('truncates an oversized why/coachIntro rather than storing it unbounded', () => {
    const longWhy = 'x'.repeat(MAX_WHY_LENGTH + 500);
    const longIntro = 'y'.repeat(MAX_COACH_INTRO_LENGTH + 500);

    const merged = mergePersonalization(
      SKELETON,
      { coachIntro: longIntro, weeks: [{ weekNumber: 1, why: longWhy }] },
      'pro',
    );

    expect(merged.coachIntro!.length).toBeLessThanOrEqual(MAX_COACH_INTRO_LENGTH);
    expect(merged.weeks[0].why!.length).toBeLessThanOrEqual(MAX_WHY_LENGTH);
  });

  it('leaves a week with no matching payload entry with why left as the skeleton had it', () => {
    const merged = mergePersonalization(
      SKELETON,
      { coachIntro: 'Hi', weeks: [{ weekNumber: 1, why: 'Only week 1 explained.' }] },
      'pro',
    );

    expect(merged.weeks[0].why).toBe('Only week 1 explained.');
    expect(merged.weeks[1].why).toBeUndefined();
  });
});

describe('planPersonalizationPromptBuilder wired through createPlanPersonalizer', () => {
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

  it('produces a Plan-shaped, structurally-clamped plan end to end', async () => {
    const payload = {
      coachIntro: 'Welcome to your 5K build.',
      weeks: [
        { weekNumber: 1, why: 'Establishing your aerobic base.' },
        { weekNumber: 2, why: 'Taper — arrive fresh.' },
      ],
    };
    const caller = scriptedCaller({ ok: true, response: toolUseResponse(payload) });

    const result = await createPlanPersonalizer(caller, planPersonalizationPromptBuilder).personalize({
      skeleton: SKELETON,
      tier: 'pro',
      intake: INTAKE,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.engine).toBe('hybrid');
    expect(result.plan.coachIntro).toBe('Welcome to your 5K build.');
    expect(result.plan.weeks[0].volumeKm).toBe(SKELETON.weeks[0].volumeKm);
    expect(result.plan.weeks[1].isDeload).toBe(SKELETON.weeks[1].isDeload);
  });

  it('falls back to a retry, then invalid_shape, when the model never returns the tool call', async () => {
    const caller = scriptedCaller({ ok: true, response: { content: [{ type: 'text', text: 'oops' }] } });

    const result = await createPlanPersonalizer(caller, planPersonalizationPromptBuilder).personalize({
      skeleton: SKELETON,
      tier: 'pro',
      intake: INTAKE,
    });

    expect(result).toMatchObject({ ok: false, reason: 'invalid_shape' });
    expect(caller.calls).toBe(2);
  });
});
