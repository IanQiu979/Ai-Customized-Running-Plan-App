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
    // The source's prepared-intermediate four-day pattern is the first layout with enough
    // sessions to express both the captain's final 35% share ceiling and a marathon-specific
    // long run. The exact three-day E/Q1/LR layout is more constrained: with its fixed Q1 dose
    // and easy <= long invariant, the settled cap yields an 11 km peak, so it is covered by the
    // all-frequency safety survey below rather than misrepresented as this headline case.
    const marathonRunner: IntakeResponses = { ...RUNNER, daysPerWeek: 4 };
    const longRuns = longRunsOf(marathonRunner, 'marathon', 16);
    const peak = peakOf(longRuns);

    // Independently reconstructed from the pre-fix 16-week stretched-5K curve and its integer
    // safety/distribution passes: this same four-day intake peaked at 19 km. Keep that old output
    // literal here; generating a current 5K plan as the oracle would make both sides depend on the
    // builder under test and let a shared regression pass unnoticed.
    const oldStretchedFiveKPeakKm = 19;
    expect(peak).toBeGreaterThan(oldStretchedFiveKPeakKm);
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

describe("marathon long-run ceilings are distance-aware and enforce the captain's 35% share ruling", () => {
  function marathonPlan(daysPerWeek: number) {
    const intake: IntakeResponses = {
      goal: 'Marathon',
      age: 35,
      experience: 'experienced',
      daysPerWeek,
      weeklyKm: 50,
      recentPerformance: { distance: 'half', timeSec: 6600 },
      injuries: ['none'],
    };
    return buildTemplatePlan({
      intake: { ...intake, raceDistance: 'marathon' },
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: 'marathon',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
  }

  it('leaves every other distance untouched by the marathon override', () => {
    expect(longRunShareCap('intermediate', 4, '5k')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, '10k')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, 'half')).toBeLessThan(1);
    expect(longRunShareCap('intermediate', 4, undefined)).toBeLessThan(1);
    expect(maxSingleRunKm('intermediate', '5k')).toBe(25);
    expect(maxSingleRunKm('intermediate', '10k')).toBe(25);
    expect(maxSingleRunKm('intermediate', 'half')).toBe(25);
  });

  it('lifts the absolute kilometre ceiling only for a prepared intermediate/advanced marathoner whose pace makes the time cap enforceable', () => {
    // The bypass defers to the 180-minute time cap and the spike guard. Neither can stand in for
    // the level cap without a pace and a demonstrated base, so the loose case is opted into with
    // both; everything else keeps the blueprint's own ≤25 / ≤35 km. Beginners never bypass.
    const prepared = { readiness: 'prepared', easyPaceSecPerKm: 360 } as const;
    expect(maxSingleRunKm('intermediate', 'marathon', prepared)).toBe(Infinity);
    expect(maxSingleRunKm('advanced', 'marathon', prepared)).toBe(Infinity);
    expect(maxSingleRunKm('beginner', 'marathon', prepared)).toBe(14);
    expect(maxSingleRunKm('intermediate', 'marathon')).toBe(25);
    expect(maxSingleRunKm('advanced', 'marathon')).toBe(35);
    expect(maxSingleRunKm('advanced', 'marathon', { readiness: 'first-timer', easyPaceSecPerKm: 300 })).toBe(35);
    expect(maxSingleRunKm('advanced', 'marathon', { readiness: 'prepared' })).toBe(35);
  });

  it.each([3, 4, 5, 6])(
    'keeps every loading-week long run at or below 35%% of generated weekly volume for the 50 km/week, 16-week intermediate marathon survey at %i days/week',
    (daysPerWeek) => {
      const plan = marathonPlan(daysPerWeek);
      let checkedLoadingLongRuns = 0;
      for (const week of plan.weeks) {
        if (week.isDeload) continue;
        const longRun = week.days
          .filter(isWorkout)
          .find((day) => day.isLongRun === true)?.distanceKm;
        if (longRun === undefined) continue;
        checkedLoadingLongRuns += 1;

        // Literal captain-owned policy. Deliberately independent of `longRunShareCap`, so
        // mutating the marathon override back to `Infinity` cannot make this assertion vacuous.
        expect(longRun / week.volumeKm).toBeLessThanOrEqual(0.35);
      }
      expect(checkedLoadingLongRuns).toBeGreaterThan(0);
    },
  );

  it('uses the prepared-intermediate four-day peak layout E + Q1 + E + LR, dropping Q2 before easy support', () => {
    const peakWeek = marathonPlan(4).weeks.find(
      (week) => week.phase === 'peak' && !week.isDeload,
    );
    expect(peakWeek).toBeDefined();

    const layout = peakWeek!.days.map((day) => {
      if (day.kind === 'rest') return 'rest';
      if (day.isLongRun === true) return 'long';
      if (day.effort === 'tempo' || day.effort === 'interval') return 'quality';
      return 'easy';
    });
    expect(layout).toEqual(['easy', 'rest', 'quality', 'rest', 'easy', 'long', 'rest']);
  });

  it('scopes the visible three-day limitation to normalized-three-run intermediate/advanced marathon race plans', () => {
    const limitation =
      "With three running days, the 35% long-run cap limits this plan's long-run progression. Add a fourth running day for fuller marathon preparation.";

    // Two available days normalize to the source's three-run floor, so raw-input equality is
    // not enough. Both intermediate and advanced race plans carry the disclosure.
    expect(marathonPlan(2).disclaimers).toContain(limitation);
    expect(marathonPlan(3).disclaimers).toContain(limitation);
    const advanced = buildTemplatePlan({
      intake: { ...RUNNER, experience: 'competitive', daysPerWeek: 3, raceDistance: 'marathon' },
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: 'marathon',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(advanced.disclaimers).toContain(limitation);

    // Four days can express the fuller layout, while beginner, non-marathon, and no-race plans
    // belong to different source-defined tracks and must not inherit this warning by accident.
    expect(marathonPlan(4).disclaimers).not.toContain(limitation);
    const beginner = buildTemplatePlan({
      intake: { ...RUNNER, experience: 'new', daysPerWeek: 3, raceDistance: 'marathon' },
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: 'marathon',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(beginner.disclaimers).not.toContain(limitation);
    const half = buildTemplatePlan({
      intake: { ...RUNNER, daysPerWeek: 3, raceDistance: 'half' },
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: 'half',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(half.disclaimers).not.toContain(limitation);
    const noRace = buildTemplatePlan({
      intake: { ...RUNNER, daysPerWeek: 3, raceDistance: 'marathon' },
      goalType: 'duration',
      durationWeeks: 16,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(noRace.disclaimers).not.toContain(limitation);
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
    // The assertion is on race week's *training* component — its total minus race day — because
    // race day is the one cost no taper can shrink. The allowance is built only from the plan's
    // own peak training week and race day itself, deliberately borrowing no term from
    // `preRaceBudgetKm` (not its ratio, not its floor, not `MIN_PRE_RACE_RUN_KM`): an allowance
    // that re-derives the function's own floor cannot fail in the region that floor governs,
    // which is exactly the region that regressed. Where the peak has room above race day, the
    // training component must fit in that room; where race day alone already meets or outweighs
    // the peak (a 12 km/week runner's own 5K), no taper can hold the total under the peak, so the
    // bound falls back to the peak itself — the week may not also out-train the biggest week.
    //
    // The matrix stays on runners whose peak has real room above race day. Below that — a runner
    // whose race is most of their biggest week — `preRaceBudgetKm`'s shakeout floor deliberately
    // outranks the peak headroom, because bounding by the headroom there reinstates the §1.4 bug
    // (verified: it breaks the three low-volume race-week profiles in
    // `planTemplates.genericLongRun.test.ts`). That regime is bounded by the taper ratio instead,
    // which this test cannot reference without becoming circular.
    const cases: {
      raceDistance: RaceDistance;
      durationWeeks: number;
      weeklyKm?: number;
      dayCounts?: number[];
    }[] = [
      { raceDistance: '5k', durationWeeks: 12 },
      { raceDistance: '10k', durationWeeks: 14 },
      { raceDistance: 'half', durationWeeks: 16 },
      { raceDistance: 'marathon', durationWeeks: 16 },
      { raceDistance: 'marathon', durationWeeks: 24 },
    ];
    for (const { raceDistance, durationWeeks, weeklyKm, dayCounts } of cases) {
      for (const daysPerWeek of dayCounts ?? [3, 4, 5, 6]) {
        for (const experience of ['some', 'experienced', 'competitive'] as const) {
          // The 12-week/4-day 5K is the byte-pinned golden fixture (`buildCanonicalFiveKWeek`),
          // which assembles race week by the literal subtraction the captain approved. It is not
          // the generic path this bound belongs to and must not be re-shaped to satisfy it.
          if (raceDistance === '5k' && durationWeeks === 12 && daysPerWeek === 4) continue;
          const plan = buildTemplatePlan({
            intake: {
              ...RUNNER,
              daysPerWeek,
              experience,
              raceDistance,
              ...(weeklyKm !== undefined ? { weeklyKm } : {}),
            },
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
          const trainingKm = raceWeek.volumeKm - raceDayKm;
          const allowanceKm =
            peakTrainingKm > raceDayKm ? peakTrainingKm - raceDayKm : peakTrainingKm;
          expect({
            raceDistance,
            durationWeeks,
            daysPerWeek,
            weeklyKm: weeklyKm ?? RUNNER.weeklyKm,
            experience,
            trainingKm,
          }).toEqual({
            raceDistance,
            durationWeeks,
            daysPerWeek,
            weeklyKm: weeklyKm ?? RUNNER.weeklyKm,
            experience,
            trainingKm: Math.min(trainingKm, allowanceKm),
          });
        }
      }
    }
  });

  it("holds race week's pre-race running inside the peak week's room above race day, dropping days rather than shrinking them", () => {
    // Two bounds that used to be traded off against each other, now both true at once.
    //
    // The budget is capped by the peak week minus race day. When that leaves too little to give
    // every requested pre-race day a real shakeout, the days are dropped to rest — not shrunk to
    // the sub-2 km filler that is the §1.4 bug's signature. A per-day floor that scaled with the
    // requested day count used to override the cap instead: a 12 km/week runner training six days
    // took 10 km of pre-race running against 6 km of room, and a 9 km/week runner took 5 against
    // 2.
    //
    // The allowance uses only the plan's own peak week and race day — nothing from the budget
    // function — plus the one documented exception: where race day alone already meets or exceeds
    // the peak, a single 2 km shakeout is scheduled regardless, so the bound is "fits in the
    // headroom, or is one short run where the headroom cannot fund even that".
    for (const weeklyKm of [9, 12, 20]) {
      for (const daysPerWeek of [3, 4, 5, 6]) {
        const plan = buildTemplatePlan({
          intake: { ...RUNNER, daysPerWeek, weeklyKm, raceDistance: '5k' },
          goalType: 'race',
          durationWeeks: 10,
          raceDistance: '5k',
          raceDate: '2026-12-25',
          tierAtGeneration: 'pro',
          density: 'paid',
        });
        const raceWeek = plan.weeks[plan.weeks.length - 1];
        const raceDayKm = raceWeek.days
          .filter(isWorkout)
          .reduce((max, run) => Math.max(max, run.distanceKm ?? 0), 0);
        const peakTrainingKm = Math.max(...plan.weeks.slice(0, -1).map((week) => week.volumeKm));
        const preRace = raceWeek.days
          .filter(isWorkout)
          .filter((run) => (run.distanceKm ?? 0) !== raceDayKm);
        const preRaceKm = preRace.reduce((sum, run) => sum + (run.distanceKm ?? 0), 0);
        // Fits in the room above race day, or — where that room cannot fund even one real run —
        // is exactly one minimum shakeout. 2 km is this suite's own definition of a real run, the
        // same threshold `planTemplates.genericLongRun.test.ts` asserts, not a term lifted from
        // the budget function.
        const headroomKm = Math.max(0, peakTrainingKm - raceDayKm);
        const allowanceKm = Math.max(headroomKm, 2);
        const shortestPreRaceKm = Math.min(...preRace.map((run) => run.distanceKm ?? 0));

        expect({ weeklyKm, daysPerWeek, preRaceKm, shortestPreRaceKm }).toEqual({
          weeklyKm,
          daysPerWeek,
          preRaceKm: Math.min(preRaceKm, allowanceKm),
          shortestPreRaceKm: Math.max(shortestPreRaceKm, 2),
        });
      }
    }
  });

  it('gives a runner whose race day alone outweighs their peak week exactly one shakeout and otherwise rest', () => {
    // The documented boundary of the rule above: no headroom exists at all, so the peak bound
    // yields to a single 2 km shakeout rather than a race week with no running but the race.
    // `placeWorkouts` must leave the freed slots as real rest — it pads short weeks with 1 km
    // filler runs for every other caller, which is exactly what the day-dropping is avoiding.
    const plan = buildTemplatePlan({
      intake: { ...RUNNER, daysPerWeek: 6, weeklyKm: 5, raceDistance: '5k' },
      goalType: 'race',
      durationWeeks: 10,
      raceDistance: '5k',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    const raceWeek = plan.weeks[plan.weeks.length - 1];
    const runs = raceWeek.days.filter(isWorkout);
    const preRace = runs.filter((run) => run.label !== 'Race Day');

    expect(preRace.map((run) => run.distanceKm)).toEqual([2]);
    expect(raceWeek.days.filter((day) => day.kind === 'rest')).toHaveLength(5);
  });

  it('places surviving shakeouts in the latest available slots nearest race day for a low-volume, high-frequency runner', () => {
    const plan = buildTemplatePlan({
      intake: { ...RUNNER, daysPerWeek: 6, weeklyKm: 12, raceDistance: '5k' },
      goalType: 'race',
      durationWeeks: 10,
      raceDistance: '5k',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    const raceWeek = plan.weeks[plan.weeks.length - 1];

    // The six requested days cannot all receive a real run from this race-week budget (the peak
    // training week is 15 km, so 5 km is all the room above a 10 km race day). The two survivors
    // belong in the two latest slots the three-run layout leaves before Sunday; Monday stays
    // genuine rest instead of receiving the first surviving run by array order.
    expect(
      raceWeek.days.map((day) =>
        day.kind === 'rest' ? 'rest' : `${day.label}:${day.distanceKm ?? 0}`,
      ),
    ).toEqual(['rest', 'rest', 'rest', 'ER:3', 'rest', 'SR:2', 'Race Day:10']);
  });

  it.each([2, 3])(
    'puts the sole real shakeout on the latest pre-race slot when %i available days normalize to the three-run floor',
    (daysPerWeek) => {
      const plan = buildTemplatePlan({
        intake: { ...RUNNER, daysPerWeek, weeklyKm: 5, raceDistance: '5k' },
        goalType: 'race',
        durationWeeks: 10,
        raceDistance: '5k',
        raceDate: '2026-12-25',
        tierAtGeneration: 'pro',
        density: 'paid',
      });
      const raceWeek = plan.weeks[plan.weeks.length - 1];

      expect(
        raceWeek.days.map((day) =>
          day.kind === 'rest' ? 'rest' : `${day.label}:${day.distanceKm ?? 0}`,
        ),
      ).toEqual(['rest', 'rest', 'rest', 'rest', 'rest', 'SR:2', 'Race Day:10']);
    },
  );

  it('does not let a canonical curve dip land on an unflagged week of a no-race plan either', () => {
    // Same defect as the marathon case below, on the path that serves every general-fitness plan:
    // `curvesForDistance` hands `undefined` the 5K shape, whose dips sat at fixed array positions
    // while `deloadEveryWeeks` returns 3 for this 55-year-old — so weeks 4 and 5 were both
    // suppressed without being flagged `isDeload`, and week 4 became the growth base for the rest.
    const plan = buildTemplatePlan({
      intake: {
        ...RUNNER,
        age: 55,
        experience: 'regular',
        daysPerWeek: 4,
        weeklyKm: 30,
        raceDistance: undefined,
      },
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    const loading = plan.weeks.filter((week) => !week.isDeload);
    for (let i = 1; i < loading.length; i += 1) {
      expect(loading[i].volumeKm).toBeGreaterThanOrEqual(loading[i - 1].volumeKm);
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
