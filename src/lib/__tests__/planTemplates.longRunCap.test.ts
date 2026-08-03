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
import { clampLongRun, LONG_RUN_SHARE_CAP, toExperienceLevel } from '../loadRules';
import type { Day, IntakeResponses, Plan, Week, Workout } from '../planTypes';

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
