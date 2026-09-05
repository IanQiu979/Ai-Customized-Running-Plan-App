/**
 * Regression coverage for the scout's Bug 2 (plan-accuracy s1): `clampLongRun()` was never
 * called by the plan generator, and golden-path quality-session distances were never scaled to
 * the runner's volume. Together they let the long run breach its experience-level weekly-share
 * cap on 6 of 9 loading weeks at the locked 27 km/week intake — clean only at exactly the
 * 35 km golden-fixture baseline.
 *
 * The existing `planTemplates.golden.test.ts` and `examplePlan.fixture.test.ts` suites exercise
 * only that single clean baseline; this suite sweeps several baselines, including the locked
 * intake's 27 km/week, and replays every long run through `clampLongRun()` as an oracle exactly
 * the way the scout did — a long run the oracle would shorten is a breached cap.
 */

import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  clampLongRun,
  LONG_RUN_SHARE_CAP,
  LONG_RUN_SPIKE_MULTIPLE,
  longRunShareCap,
  MAX_SINGLE_RUN_KM,
  toExperienceLevel,
} from '../loadRules';
import type {
  Day,
  ExperienceAnswer,
  IntakeResponses,
  Plan,
  Week,
  Workout,
} from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function findLongRun(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((day) => day.isLongRun === true);
}

/**
 * The golden path is reached only by a 12-week / 5K / 4-days-a-week race plan. Keeps the
 * runner's experience at 'experienced' (→ intermediate, share cap 0.32) so every baseline in
 * the sweep is judged against the same level, and gives the lock from the scout's intake.
 */
function buildGoldenPlanAt(weeklyKm: number): Plan {
  const intake: IntakeResponses = {
    goal: 'Run a fast 5K',
    age: 16,
    experience: 'experienced',
    daysPerWeek: 4,
    weeklyKm,
    raceDistance: '5k',
    goalTimeSec: 1320, // 22:00
    recentPerformance: { distance: '5k', timeSec: 1516 }, // 25:16
    injuries: ['none'],
  };
  const params: TemplatePlanParams = {
    intake,
    goalType: 'race',
    durationWeeks: 12,
    raceDistance: '5k',
    tierAtGeneration: 'free',
    density: 'free',
  };
  return buildTemplatePlan(params);
}

describe('golden 5K path — long-run weekly-share cap holds at any baseline (scout bug 2 regression)', () => {
  const BASELINES = [20, 27, 35, 50];

  it.each(BASELINES)(
    'replays every long run through clampLongRun unclamped at %i km/week, proving no loading week breaches its share cap',
    (weeklyKm) => {
      const plan = buildGoldenPlanAt(weeklyKm);
      const level = toExperienceLevel('experienced');
      const cap = LONG_RUN_SHARE_CAP[level];
      let previousLongestKm = 0;
      let lastLoadingWeekKm = 0;

      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (longRun) {
          const { km } = clampLongRun({
            proposedKm: longRun.distanceKm ?? 0,
            weeklyKm: week.volumeKm,
            level,
            previousLongestKm,
            isDeload: week.isDeload,
            lastLoadingWeekKm,
          });
          expect(km).toBe(longRun.distanceKm);
          // Direct share check, loading weeks only: deload weeks are measured against the last
          // loading week's volume (ruling R1c), which the oracle above already enforces.
          if (!week.isDeload) {
            expect((longRun.distanceKm ?? 0) / week.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
          }
          previousLongestKm = Math.max(previousLongestKm, longRun.distanceKm ?? 0);
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
    },
  );

  it('still keeps the 35 km baseline (the golden fixture\'s own) byte-identical to the doc\'s long-run schedule', () => {
    const plan = buildGoldenPlanAt(35);
    const expected = [10, 11, 12, 8, 13, 14, 15, 10, 14, 15, 12];
    plan.weeks.slice(0, 11).forEach((week, index) => {
      expect(findLongRun(week)?.distanceKm).toBe(expected[index]);
    });
  });

  it('asserts the locked 27 km/week case directly: the long-run share previously hit 35.5% (week 11) and 34.6% (week 1)', () => {
    const plan = buildGoldenPlanAt(27);
    let lastLoadingWeekKm = 0;
    for (const week of plan.weeks) {
      const longRun = findLongRun(week);
      if (longRun) {
        const denominator = week.isDeload && lastLoadingWeekKm > 0 ? lastLoadingWeekKm : week.volumeKm;
        expect((longRun.distanceKm ?? 0) / denominator).toBeLessThanOrEqual(
          LONG_RUN_SHARE_CAP.intermediate + 1e-9,
        );
      }
      if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    }
  });
});

/**
 * The golden 12-week / 4-day / 5K plan is the one genuinely coach-authored plan in the product —
 * its weekly load, tempo and interval tables are Ian's own coaching, not generated output. It is
 * therefore deliberately NOT routed through the run-count-scaled cap or the per-week fixed easy
 * ceiling the generic path uses; nothing here clamps or rewrites those numbers.
 *
 * What it is no longer is *unmeasured*. The sweep above only ever exercised `experienced`
 * (→ intermediate). This block replays the same four checks the generic suite applies
 * (`planTemplates.genericLongRun.test.ts`) across every level, age band and volume the path can
 * be reached with, so the coach-authored plan is verified against the safety rules rather than
 * silently exempt from them. A breach here is a coaching question for Ian, not a licence to clamp.
 */
interface GoldenProfile {
  name: string;
  experience: ExperienceAnswer;
  age: number;
  weeklyKm: number;
}

const GOLDEN_PROFILES: GoldenProfile[] = [
  { name: 'beginner — brand new, 12 km/wk, 30 y/o', experience: 'new', age: 30, weeklyKm: 12 },
  { name: 'beginner — brand new, 20 km/wk, 16 y/o (youth, RPE not HR)', experience: 'new', age: 16, weeklyKm: 20 },
  { name: 'beginner — some experience, 30 km/wk, 55 y/o (3-week deload cadence)', experience: 'some', age: 55, weeklyKm: 30 },
  { name: 'intermediate — regular, 35 km/wk, 30 y/o', experience: 'regular', age: 30, weeklyKm: 35 },
  { name: 'intermediate — experienced, 27 km/wk, 16 y/o', experience: 'experienced', age: 16, weeklyKm: 27 },
  { name: 'intermediate — experienced, 45 km/wk, 55 y/o', experience: 'experienced', age: 55, weeklyKm: 45 },
  { name: 'advanced — competitive, 60 km/wk, 30 y/o', experience: 'competitive', age: 30, weeklyKm: 60 },
  { name: 'advanced — competitive, 80 km/wk, 55 y/o', experience: 'competitive', age: 55, weeklyKm: 80 },
];

function buildGoldenPlanFor(profile: GoldenProfile): Plan {
  const intake: IntakeResponses = {
    goal: 'Run a fast 5K',
    age: profile.age,
    experience: profile.experience,
    daysPerWeek: 4,
    weeklyKm: profile.weeklyKm,
    raceDistance: '5k',
    recentPerformance: { distance: '5k', timeSec: 1516 },
    injuries: ['none'],
  };
  const params: TemplatePlanParams = {
    intake,
    goalType: 'race',
    durationWeeks: 12,
    raceDistance: '5k',
    tierAtGeneration: 'pro',
    density: 'paid',
  };
  return buildTemplatePlan(params);
}

function plan_longRuns(plan: Plan): number[] {
  return plan.weeks
    .map((week) => findLongRun(week)?.distanceKm ?? 0)
    .filter((km) => km > 0);
}

describe('golden 5K path — the coach-authored plan is verified against the caps, not exempt from them', () => {
  const CASES = GOLDEN_PROFILES.map((profile) => [profile.name, profile] as const);

  it.each(CASES)(
    'holds %s inside the weekly-share cap on every week',
    (_name, profile) => {
      const plan = buildGoldenPlanFor(profile);
      // R1c: a deload's long run is measured against the last *loading* week, not its own
      // deliberately-reduced volume.
      const cap = longRunShareCap(toExperienceLevel(profile.experience), 4);
      let lastLoadingWeekKm = 0;
      const breaches: string[] = [];
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (longRun) {
          // The larger of the two, never `isValidDeload`-gated. Gating on it let a *collapsed* week
          // launder itself: a golden 12 km/wk beginner's week-4 "deload" is a 4 km total, which
          // fails `isValidDeload`, so the denominator fell back to that same 4 km and the ratio
          // was inside the cap by construction. R1c's intent is to measure against the week's
          // un-reduced reference volume, so take whichever of the two is bigger.
          const denomKm = week.isDeload ? Math.max(week.volumeKm, lastLoadingWeekKm) : week.volumeKm;
          const share = (longRun.distanceKm ?? 0) / denomKm;
          if (share > cap + 1e-9) {
            breaches.push(`week ${week.weekNumber}: ${longRun.distanceKm} km of ${denomKm} km = ${(share * 100).toFixed(1)}%`);
          }
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
      expect(breaches).toEqual([]);
    },
  );

  it.each(CASES)(
    'never lets %s spike its long run past the spike multiple over its previous longest',
    (_name, profile) => {
      const plan = buildGoldenPlanFor(profile);
      let previousLongestKm = 0;
      const breaches: string[] = [];
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun) continue;
        const km = longRun.distanceKm ?? 0;
        if (previousLongestKm > 0 && km > Math.ceil(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE)) {
          breaches.push(`week ${week.weekNumber}: ${km} km after a previous longest of ${previousLongestKm} km`);
        }
        previousLongestKm = Math.max(previousLongestKm, km);
      }
      expect(breaches).toEqual([]);
    },
  );

  it.each(CASES)(
    'keeps every long run of %s under the level absolute single-run ceiling',
    (_name, profile) => {
      const plan = buildGoldenPlanFor(profile);
      const ceiling = MAX_SINGLE_RUN_KM[toExperienceLevel(profile.experience)];
      const breaches = plan.weeks
        .map((week) => ({ week, longRun: findLongRun(week) }))
        .filter(({ longRun }) => (longRun?.distanceKm ?? 0) > ceiling)
        .map(({ week, longRun }) => `week ${week.weekNumber}: ${longRun?.distanceKm} km > ${ceiling} km`);
      expect(breaches).toEqual([]);
    },
  );

  /**
   * Progression, as opposed to safety, is where this path stops being clean — and it is not this
   * branch's to fix. The generic path's spike ceiling is read in whole kilometres so a sub-10 km
   * long run can still grow; the coach-authored path deliberately keeps the raw fractional
   * ceiling it has always had, which below 10 km rounds back to the previous longest and holds
   * the long run still. Fixing that here would reshape Ian's own plan, so the numbers are pinned
   * instead: they are green today, and any drift — improvement or regression — fails.
   */
  const PROGRESSION: Record<string, { peakLongRunKm: number; firstLongRunKm: number; peakLoadingWeekKm: number }> = {
    'beginner — brand new, 12 km/wk, 30 y/o': { peakLongRunKm: 2, firstLongRunKm: 2, peakLoadingWeekKm: 10 },
    'beginner — brand new, 20 km/wk, 16 y/o (youth, RPE not HR)': { peakLongRunKm: 3, firstLongRunKm: 3, peakLoadingWeekKm: 17 },
    'beginner — some experience, 30 km/wk, 55 y/o (3-week deload cadence)': { peakLongRunKm: 5, firstLongRunKm: 5, peakLoadingWeekKm: 27 },
    'intermediate — regular, 35 km/wk, 30 y/o': { peakLongRunKm: 15, firstLongRunKm: 10, peakLoadingWeekKm: 48 },
    'intermediate — experienced, 27 km/wk, 16 y/o': { peakLongRunKm: 8, firstLongRunKm: 8, peakLoadingWeekKm: 30 },
    'intermediate — experienced, 45 km/wk, 55 y/o': { peakLongRunKm: 17, firstLongRunKm: 13, peakLoadingWeekKm: 54 },
    'advanced — competitive, 60 km/wk, 30 y/o': { peakLongRunKm: 24, firstLongRunKm: 17, peakLoadingWeekKm: 72 },
    'advanced — competitive, 80 km/wk, 55 y/o': { peakLongRunKm: 34, firstLongRunKm: 23, peakLoadingWeekKm: 98 },
  };

  it.each(CASES)('pins the progression the coach-authored plan actually delivers for %s', (name, profile) => {
    const plan = buildGoldenPlanFor(profile);
    const longRuns = plan_longRuns(plan);
    const loadingWeeks = plan.weeks.slice(0, -1).filter((week) => !week.isDeload);
    expect({
      peakLongRunKm: Math.max(...longRuns),
      firstLongRunKm: longRuns[0],
      peakLoadingWeekKm: Math.max(...loadingWeeks.map((week) => week.volumeKm)),
    }).toEqual(PROGRESSION[name]);
  });

  it('names the intakes where that progression is a coaching question, not a passing grade', () => {
    // Open, and deliberately not fixed here: three beginner intakes never grow the long run at
    // all, and their biggest week never reaches the volume the runner said they already run.
    // Ian's call — the plan those numbers come from is his, not the engine's.
    const stalled = CASES.filter(([name]) => PROGRESSION[name].peakLongRunKm === PROGRESSION[name].firstLongRunKm)
      .map(([name]) => name);
    const shortOfDeclared = CASES.filter(([name, profile]) => PROGRESSION[name].peakLoadingWeekKm < profile.weeklyKm)
      .map(([name]) => name);
    expect(stalled).toEqual([
      'beginner — brand new, 12 km/wk, 30 y/o',
      'beginner — brand new, 20 km/wk, 16 y/o (youth, RPE not HR)',
      'beginner — some experience, 30 km/wk, 55 y/o (3-week deload cadence)',
      'intermediate — experienced, 27 km/wk, 16 y/o',
    ]);
    expect(shortOfDeclared).toEqual([
      'beginner — brand new, 12 km/wk, 30 y/o',
      'beginner — brand new, 20 km/wk, 16 y/o (youth, RPE not HR)',
      'beginner — some experience, 30 km/wk, 55 y/o (3-week deload cadence)',
    ]);
  });
});
