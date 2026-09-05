/**
 * Regression coverage for the core-purpose audit's headline finding (`v22-distance-specific-
 * plans`): every distance except the byte-pinned golden 5K fixture read `FIVE_K_WEEKLY_LOAD` /
 * `FIVE_K_LONG_RUNS`, scaled by the runner's own weekly km — so a marathon, half, or 10K plan was
 * a 5K plan's curve wearing that distance's phase weights. Concretely: a 50 km/week runner
 * training for a marathon was never asked to run beyond ~21 km (`15 × 50/35`,
 * `FIVE_K_LONG_RUNS`'s own peak) in 16 weeks, regardless of how much further out the race date
 * was.
 *
 * A test that replays generated output back through `clampLongRun` (as
 * `planTemplates.genericLongRun.test.ts` already does) cannot catch this bug — the safety clamp
 * makes no distinction between a genuine distance-specific target and a stretched 5K one, so it
 * passes on the bug and the fix equally. These tests instead compare distances directly against
 * each other and against a literal reconstruction of the old (buggy) output, so a regression back
 * to "every distance shares one curve" fails loudly.
 */

import { buildTemplatePlan } from '../planTemplates';
import { longRunShareCap, maxSingleRunKm } from '../loadRules';
import type { Day, IntakeResponses, RaceDistance, Workout } from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function longRunsOf(intake: IntakeResponses, raceDistance: RaceDistance, durationWeeks: number) {
  const plan = buildTemplatePlan({
    intake: { ...intake, raceDistance },
    goalType: 'race',
    durationWeeks,
    raceDistance,
    raceDate: '2026-12-25',
    tierAtGeneration: 'pro',
    density: 'paid',
  });
  return plan.weeks.map(
    (week) =>
      week.days.filter(isWorkout).find((day) => day.isLongRun === true)?.distanceKm ?? 0,
  );
}

function peakOf(longRuns: number[]): number {
  return Math.max(...longRuns);
}

const RUNNER: IntakeResponses = {
  goal: 'Marathon',
  age: 35,
  experience: 'experienced',
  daysPerWeek: 4,
  weeklyKm: 50,
  recentPerformance: { distance: 'half', timeSec: 6600 },
  injuries: ['none'],
};

describe('distance-specific plans (core-purpose audit) — no distance is a relabelled 5K curve', () => {
  it('produces a strictly increasing peak long run across 5K < 10K < half < marathon for the identical runner, each at its own canonical duration', () => {
    // Same runner (age, experience, days/week, weekly km, recent performance) — only the
    // distance (and its canonical duration: 12/14/16/24 weeks,
    // `plan-blueprint-examples.md` § "Resolved for the V1 library") changes. Before this fix,
    // every one of these four peaks was identical (all four curves were `FIVE_K_LONG_RUNS`).
    const fiveK = peakOf(longRunsOf(RUNNER, '5k', 12));
    const tenK = peakOf(longRunsOf(RUNNER, '10k', 14));
    const half = peakOf(longRunsOf(RUNNER, 'half', 16));
    const marathon = peakOf(longRunsOf(RUNNER, 'marathon', 24));

    expect(fiveK).toBeLessThan(tenK);
    expect(tenK).toBeLessThan(half);
    expect(half).toBeLessThan(marathon);
  });

  it('a 50 km/week, 16-week marathon plan builds toward a genuinely marathon-length long run — the exact scenario the core-purpose audit reported capped at ~21 km', () => {
    // 3 days/week: a real, common lower-frequency marathon pattern (long run + two other runs),
    // and — documented honestly, not hidden — the day count at which
    // `loadRules.ts`'s run-count-scaled `longRunShareCap` leaves the most headroom for this
    // fix to show through. At higher day counts (5-6/week, also common for marathon training)
    // that same cap becomes the dominant ceiling and this fix's improvement shrinks or reverses
    // — a distance-vs-level safety-cap gap flagged separately (see this task's `needs-decision`
    // status line), not something silently reconciled here.
    const marathonRunner: IntakeResponses = { ...RUNNER, daysPerWeek: 3 };
    const longRuns = longRunsOf(marathonRunner, 'marathon', 16);
    const peak = peakOf(longRuns);

    // The literal old-bug reconstruction: what this exact intake (16 weeks, 3 days/week,
    // 50 km/week) produces when forced through the 5K curve instead of a marathon one — i.e.
    // exactly what `buildGenericWeek` computed before this fix, for a race distance no different
    // in the old code's eyes from a marathon. Computed by generating a 16-week/3-day "5K" plan
    // at the same weekly km — not hand-derived — so this assertion is pinned to the actual old
    // formula's output, not an approximation of it.
    const oldBugPeak = peakOf(longRunsOf(marathonRunner, '5k', 16));
    expect(oldBugPeak).toBe(19); // pinned so a curve-shape edit here is a deliberate, visible change
    expect(peak).toBeGreaterThan(oldBugPeak);
    expect(peak).toBeGreaterThan(21); // the audit's own reported ceiling for this exact runner

    // Genuine progression, not a step straight to peak and back: the long run in the second
    // quarter of the loading block is meaningfully shorter than the peak, and the peak sits in
    // the back half of the plan (race-specific block), not the front.
    const nonRaceLongRuns = longRuns.filter((km) => km > 0);
    const peakIndex = longRuns.indexOf(peak);
    expect(peakIndex).toBeGreaterThanOrEqual(Math.floor(longRuns.length / 2));
    expect(nonRaceLongRuns[1]).toBeLessThan(peak);
  });

  it('gives half and 10K their own peak long runs too, not a second copy of the marathon or 5K fix', () => {
    const tenK = longRunsOf(RUNNER, '10k', 14);
    const half = longRunsOf(RUNNER, 'half', 16);
    const fiveK = longRunsOf(RUNNER, '5k', 12);
    expect(peakOf(tenK)).toBeGreaterThan(peakOf(fiveK));
    expect(peakOf(half)).toBeGreaterThan(peakOf(tenK));
    // Not flat: each distance still ramps rather than jumping straight to its peak.
    expect(tenK[0]).toBeLessThan(peakOf(tenK));
    expect(half[0]).toBeLessThan(peakOf(half));
  });
});

describe('readiness path (first-timer vs prepared) — driven by demonstrated capacity, never goal time', () => {
  function phaseCounts(weeklyKm: number, recentPerformance: IntakeResponses['recentPerformance']) {
    const intake: IntakeResponses = {
      goal: 'Marathon',
      age: 35,
      experience: 'experienced',
      daysPerWeek: 4,
      weeklyKm,
      goalTimeSec: 3 * 60 * 60, // a 3-hour marathon goal — must have no bearing on readiness
      recentPerformance,
      injuries: ['none'],
    };
    const plan = buildTemplatePlan({
      intake,
      goalType: 'race',
      durationWeeks: 20,
      raceDistance: 'marathon',
      raceDate: '2027-01-01',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    return plan.weeks.reduce<Record<string, number>>((counts, week) => {
      counts[week.phase] = (counts[week.phase] ?? 0) + 1;
      return counts;
    }, {});
  }

  it('gives a first-timer (weekly volume below the marathon prerequisite) more base weeks and fewer peak weeks than a prepared runner at the same duration', () => {
    const firstTimer = phaseCounts(30, undefined);
    const prepared = phaseCounts(50, { distance: 'half', timeSec: 6600 });
    expect(firstTimer.base).toBeGreaterThan(prepared.base);
    expect(firstTimer.peak).toBeLessThan(prepared.peak);
    // Build and taper — the phases readiness does not touch — stay the same.
    expect(firstTimer.build).toBe(prepared.build);
    expect(firstTimer.taper).toBe(prepared.taper);
  });

  it('also treats a good-volume marathon runner as a first-timer without long-run evidence — weekly km alone is not enough for marathon', () => {
    // 50 km/week clears the volume bar, but a recent 5K is not the "longest run in the last 30
    // days" proxy Example D's intake assumes for a marathon race-specific block.
    const noEvidence = phaseCounts(50, { distance: '5k', timeSec: 1200 });
    const withEvidence = phaseCounts(50, { distance: 'half', timeSec: 6600 });
    expect(noEvidence.base).toBeGreaterThan(withEvidence.base);
    expect(noEvidence.peak).toBeLessThan(withEvidence.peak);
  });

  it('is unaffected by goal time — an ambitious goal time on a low-volume intake does not buy the prepared path', () => {
    const modestGoal = phaseCounts(30, undefined);
    // Same intake, but recompute with a much faster goal time to prove the classification doesn't move.
    const intake: IntakeResponses = {
      goal: 'Marathon',
      age: 35,
      experience: 'experienced',
      daysPerWeek: 4,
      weeklyKm: 30,
      goalTimeSec: 2.5 * 60 * 60, // an aggressive sub-2:30 goal on 30 km/week
      recentPerformance: undefined,
      injuries: ['none'],
    };
    const plan = buildTemplatePlan({
      intake,
      goalType: 'race',
      durationWeeks: 20,
      raceDistance: 'marathon',
      raceDate: '2027-01-01',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    const ambitiousGoalCounts = plan.weeks.reduce<Record<string, number>>((counts, week) => {
      counts[week.phase] = (counts[week.phase] ?? 0) + 1;
      return counts;
    }, {});
    expect(ambitiousGoalCounts).toEqual(modestGoal);
  });

  it('does not apply readiness to a no-race (duration) plan — there is no race entry to be prepared or unprepared for', () => {
    const lowVolumeIntake: IntakeResponses = {
      goal: 'Get fitter',
      age: 35,
      experience: 'experienced',
      daysPerWeek: 4,
      weeklyKm: 30,
      raceDistance: 'marathon',
      injuries: ['none'],
    };
    const plan = buildTemplatePlan({
      intake: lowVolumeIntake,
      goalType: 'duration',
      durationWeeks: 18,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    // Marathon race weights are [9, 9, 8, 4]; minus the taper (no-race plans have none) that is
    // [9, 9, 8] of 18 weeks, proportionally allocated — the unshifted weights (this is a
    // duration/no-race plan, so readiness never applies), matching
    // `planTemplates.noRace.test.ts`'s equivalent 26-week assertion in spirit.
    const counts = plan.weeks.reduce<Record<string, number>>((c, week) => {
      c[week.phase] = (c[week.phase] ?? 0) + 1;
      return c;
    }, {});
    expect(counts.base).toBe(6);
    expect(counts.build).toBe(6);
    expect(counts.peak).toBe(6);
    expect(counts.taper).toBeUndefined();
  });
});

describe('marathon long-run ceilings are distance-aware and PROVISIONALLY non-binding for intermediate/advanced (Firstmate engineering ruling, 2026-09-06, [key=marathon-longrun-share-cap])', () => {
  function marathonPeak(daysPerWeek: number) {
    const intake: IntakeResponses = {
      goal: 'Marathon',
      age: 35,
      experience: 'experienced',
      daysPerWeek,
      weeklyKm: 50,
      recentPerformance: { distance: 'half', timeSec: 6600 },
      injuries: ['none'],
    };
    const plan = buildTemplatePlan({
      intake: { ...intake, raceDistance: 'marathon' },
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: 'marathon',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    return Math.max(
      ...plan.weeks.map(
        (week) =>
          week.days.filter(isWorkout).find((day) => day.isLongRun === true)?.distanceKm ?? 0,
      ),
    );
  }

  it('longRunShareCap and maxSingleRunKm both return Infinity for marathon/intermediate — the loosened, captain-pending mechanism', () => {
    expect(longRunShareCap('intermediate', 4, 'marathon')).toBe(Infinity);
    expect(longRunShareCap('advanced', 4, 'marathon')).toBe(Infinity);
    expect(maxSingleRunKm('intermediate', 'marathon')).toBe(Infinity);
    expect(maxSingleRunKm('advanced', 'marathon')).toBe(Infinity);
  });

  it('leaves every other distance untouched by the marathon override', () => {
    expect(longRunShareCap('intermediate', 4, '5k')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, '10k')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, 'half')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, undefined)).toBeLessThan(1);
    expect(maxSingleRunKm('intermediate', '5k')).toBe(25);
    expect(maxSingleRunKm('intermediate', '10k')).toBe(25);
    expect(maxSingleRunKm('intermediate', 'half')).toBe(25);
  });

  it("keeps beginner's marathon ceiling at its existing conservative 14 km — a deliberate first-timer safety floor, not touched by this ruling", () => {
    expect(maxSingleRunKm('beginner', 'marathon')).toBe(14);
  });

  it('produces the same marathon peak long run regardless of days/week, since neither day-count-sensitive cap still binds — the survey behind the ruling', () => {
    // Before this ruling, this exact 50 km/week, 16-week, intermediate scenario surveyed at
    // 25/19/16/8 km for 3/4/5/6 days/week (`docs/change_log.md`'s 2026-09-06 (later) entry) —
    // the run-count-scaled share cap dominated, and the most common marathon frequency (5-6
    // days) was worst-affected. Now the curve, spike guard, and time cap (none of which vary by
    // day count) govern instead, so every day count converges on the same peak.
    const peaks = [3, 4, 5, 6].map(marathonPeak);
    expect(new Set(peaks).size).toBe(1);
    expect(peaks[0]).toBeGreaterThan(25); // clears even the best pre-ruling day count (3 days)
  });
});

/**
 * Review-round regressions on the distance-specific work above. Each case below was observed in
 * generated plan output before its fix; none of them is caught by replaying the long run back
 * through `clampLongRun`, because every one of them lives outside the run the clamp inspects.
 */
describe('distance-aware ceilings and the curves that feed them', () => {
  function marathonPlan(overrides: Partial<IntakeResponses>, durationWeeks: number) {
    return buildTemplatePlan({
      intake: { ...RUNNER, ...overrides, raceDistance: 'marathon' },
      goalType: 'race',
      durationWeeks,
      raceDistance: 'marathon',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
  }

  it("keeps beginner's marathon weekly-share cap on the run-count-scaled ladder, matching maxSingleRunKm's own beginner gate", () => {
    // The absolute ceiling above already excludes `beginner` from the marathon override; the
    // share ceiling must too, or a first-time marathoner loses the only volume-relative ceiling
    // they have.
    expect(longRunShareCap('beginner', 3, 'marathon')).toBeCloseTo(
      longRunShareCap('beginner', 3, undefined),
    );
    expect(longRunShareCap('beginner', 6, 'marathon')).toBeCloseTo(
      longRunShareCap('beginner', 6, undefined),
    );
    expect(longRunShareCap('beginner', 3, 'marathon')).toBeLessThan(1);
  });

  it('never emits an easy run longer than the week it belongs to actually schedules as its long run', () => {
    // The safety ceilings (time cap, spike guard) bite only on the long run; the kilometres they
    // take off it used to be handed to the easy days under a ceiling derived from the *unclamped*
    // candidate, so a 3-day marathon week shipped a 31 km "easy run" beside a 28 km long run.
    for (const daysPerWeek of [3, 4, 5, 6]) {
      const plan = marathonPlan({ daysPerWeek }, 16);
      for (const week of plan.weeks) {
        const runs = week.days.filter(isWorkout);
        const long = runs.find((run) => run.isLongRun === true);
        if (!long) continue;
        // Easy runs only. A quality session may legitimately exceed the long run — the captain's
        // `longrun-share-cap-floor` ruling makes the safety cap win even when that costs the long
        // run its "longest run of the week" status.
        for (const run of runs) {
          if (run.isLongRun === true || run.effort !== 'easy') continue;
          expect(run.distanceKm ?? 0).toBeLessThanOrEqual(long.distanceKm ?? 0);
        }
      }
    }
  });

  it("never lets race week's total — pre-race running plus race day — exceed the plan's own peak training week", () => {
    // Race day is a fixed, unshrinkable cost stacked on top of a pre-race budget derived from a
    // race-inclusive ratio, so for a long race the final week of a plan whose phase is `taper`
    // used to report as its biggest week (a 3-day, 50 km/week marathon: 69 km race week against a
    // 66 km peak).
    //
    // The allowance is race day plus a minimum real shakeout per pre-race day: where the race
    // alone already outweighs the peak (a low-volume runner's own goal race), no taper can hold
    // the week under it, and the overshoot is the race, never budget the engine chose.
    const cases: { raceDistance: RaceDistance; durationWeeks: number }[] = [
      { raceDistance: '5k', durationWeeks: 12 },
      { raceDistance: '10k', durationWeeks: 14 },
      { raceDistance: 'half', durationWeeks: 16 },
      { raceDistance: 'marathon', durationWeeks: 16 },
      { raceDistance: 'marathon', durationWeeks: 24 },
    ];
    for (const { raceDistance, durationWeeks } of cases) {
      for (const daysPerWeek of [3, 4, 5, 6]) {
        for (const experience of ['some', 'experienced', 'competitive'] as const) {
          // The 12-week/4-day 5K is the byte-pinned golden fixture (`buildCanonicalFiveKWeek`),
          // which assembles race week by the literal subtraction the captain approved. It is not
          // the generic path this bound belongs to and must not be re-shaped to satisfy it.
          if (raceDistance === '5k' && durationWeeks === 12 && daysPerWeek === 4) continue;
          const plan = buildTemplatePlan({
            intake: { ...RUNNER, daysPerWeek, experience, raceDistance },
            goalType: 'race',
            durationWeeks,
            raceDistance,
            raceDate: '2026-12-25',
            tierAtGeneration: 'pro',
            density: 'paid',
          });
          const raceWeek = plan.weeks[plan.weeks.length - 1];
          const peakTrainingKm = Math.max(
            ...plan.weeks.slice(0, -1).map((week) => week.volumeKm),
          );
          const raceDayKm = raceWeek.days
            .filter(isWorkout)
            .reduce((max, run) => Math.max(max, run.distanceKm ?? 0), 0);
          const preRaceDays = Math.max(0, Math.min(7, Math.max(3, Math.round(daysPerWeek))) - 1);
          const ceilingKm = Math.max(peakTrainingKm, raceDayKm + preRaceDays * 2);
          expect({
            raceDistance,
            durationWeeks,
            daysPerWeek,
            experience,
            raceWeekKm: raceWeek.volumeKm,
          }).toEqual({
            raceDistance,
            durationWeeks,
            daysPerWeek,
            experience,
            raceWeekKm: Math.min(raceWeek.volumeKm, ceilingKm),
          });
        }
      }
    }
  });

  it('does not let a canonical curve dip land on a week the engine has not flagged as a deload', () => {
    // `deloadEveryWeeks` returns 3 for an advanced runner, so any recovery dip the curve itself
    // encoded on a fixed 4-week cadence used to land mid-block: an unflagged low week that then
    // became the growth base for everything after it.
    const plan = marathonPlan({ daysPerWeek: 5, weeklyKm: 60, experience: 'competitive' }, 24);
    const loading = plan.weeks.filter(
      (week) => !week.isDeload && week.weekNumber < plan.weeks.length - 2,
    );
    for (let i = 1; i < loading.length; i += 1) {
      expect(loading[i].volumeKm).toBeGreaterThanOrEqual(loading[i - 1].volumeKm);
    }
  });

  it('keeps a duration (no-race) block on the ordinary level ceilings even when the runner named marathon as their distance', () => {
    // The loosened marathon ceilings are a race-block ruling. A general-fitness block that merely
    // carries the distance tag has no race to build toward, so it stays on `MAX_SINGLE_RUN_KM`.
    const plan = buildTemplatePlan({
      intake: { ...RUNNER, daysPerWeek: 6, weeklyKm: 90, raceDistance: 'marathon' },
      goalType: 'duration',
      durationWeeks: 16,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    const longest = Math.max(
      ...plan.weeks.map(
        (week) =>
          week.days.filter(isWorkout).find((day) => day.isLongRun === true)?.distanceKm ?? 0,
      ),
    );
    expect(longest).toBeLessThanOrEqual(maxSingleRunKm('intermediate'));
  });
});
