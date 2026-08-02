/**
 * The structural validator.
 *
 * Half these tests exist to pin what it must NOT reject. Echo V1's lesson was that a strict
 * validator produced more bad fallback plans than it prevented, so a test asserting "an
 * unusual-but-well-formed plan still passes" is guarding against a future tightening, not padding.
 */

import { describe, expect, it } from 'vitest';

import { isPlanShaped } from '../src/lib/planValidation';
import { makePlan } from './fakes';

describe('isPlanShaped — accepts', () => {
  it('a well-formed plan', () => {
    expect(isPlanShaped(makePlan())).toBe(true);
  });

  it('a duration-based workout instead of a distance-based one', () => {
    const plan = makePlan();
    plan.weeks[0].days = [
      { kind: 'rest' },
      { kind: 'run', effort: 'easy', label: 'ER', durationMin: 40, effortDescription: 'Easy.' },
      { kind: 'rest' },
      { kind: 'rest' },
      { kind: 'rest' },
      { kind: 'rest' },
      { kind: 'rest' },
    ];
    expect(isPlanShaped(plan)).toBe(true);
  });

  it('a week of nothing but rest', () => {
    // A full rest week is legitimate — an injury protocol or a race-week taper can produce one —
    // and rejecting it would fall back on a plan that was correct.
    const plan = makePlan();
    plan.weeks[0].days = Array.from({ length: 7 }, () => ({ kind: 'rest' as const })) as never;
    plan.weeks[0].volumeKm = 0;
    expect(isPlanShaped(plan)).toBe(true);
  });

  it('a volume the load rules would clamp', () => {
    // Not this validator's job. `src/lib/loadRules.ts` owns the numbers, deterministically, and
    // judging them here is exactly the content validation the design forbids.
    const plan = makePlan();
    plan.weeks[0].volumeKm = 400;
    expect(isPlanShaped(plan)).toBe(true);
  });
});

describe('isPlanShaped — rejects', () => {
  it.each([
    ['a non-object', 'not a plan'],
    ['null', null],
    ['an array', []],
  ])('%s', (_label, value) => {
    expect(isPlanShaped(value)).toBe(false);
  });

  it('a week with fewer than seven days', () => {
    // Rest days are real slots, not absences. A six-day week is a dropped day.
    const plan = makePlan();
    (plan.weeks[0].days as unknown as unknown[]).pop();
    expect(isPlanShaped(plan)).toBe(false);
  });

  it('a run carrying both a distance and a duration', () => {
    const plan = makePlan();
    plan.weeks[0].days = [
      { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, durationMin: 30, effortDescription: 'Easy.' },
      ...plan.weeks[0].days.slice(1),
    ] as never;
    expect(isPlanShaped(plan)).toBe(false);
  });

  it('a run with neither a distance nor a duration', () => {
    const plan = makePlan();
    plan.weeks[0].days = [
      { kind: 'run', effort: 'easy', label: 'ER', effortDescription: 'Easy.' },
      ...plan.weeks[0].days.slice(1),
    ] as never;
    expect(isPlanShaped(plan)).toBe(false);
  });

  it('a run with an effort outside the five-level scale', () => {
    const plan = makePlan();
    plan.weeks[0].days = [
      { kind: 'run', effort: 'sprint', label: 'X', distanceKm: 5, effortDescription: 'Hard.' },
      ...plan.weeks[0].days.slice(1),
    ] as never;
    expect(isPlanShaped(plan)).toBe(false);
  });

  it('a run with no effort description', () => {
    // On Free this is the only pace signal a runner gets; without it the row renders blank.
    const plan = makePlan();
    plan.weeks[0].days = [
      { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, effortDescription: '' },
      ...plan.weeks[0].days.slice(1),
    ] as never;
    expect(isPlanShaped(plan)).toBe(false);
  });

  it('an empty disclaimers array', () => {
    // Rule 10: legally required, never empty — the one structural failure with a legal cost.
    expect(isPlanShaped(makePlan({ disclaimers: [] }))).toBe(false);
  });

  it('a week count that disagrees with durationWeeks', () => {
    expect(isPlanShaped(makePlan({ durationWeeks: 12 }))).toBe(false);
  });

  it('a weeklyLoad that disagrees with the week count', () => {
    expect(isPlanShaped(makePlan({ weeklyLoad: [20, 22] }))).toBe(false);
  });

  it('an unknown phase', () => {
    const plan = makePlan();
    (plan.weeks[0] as { phase: string }).phase = 'sharpening';
    expect(isPlanShaped(plan)).toBe(false);
  });
});
