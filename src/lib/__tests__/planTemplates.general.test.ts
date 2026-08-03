import { buildTemplatePlan } from '../planTemplates';
import { WEEKLY_INCREASE_REJECT_ABOVE } from '../loadRules';
import type { Day, ExperienceAnswer, GoalType, IntakeResponses, Plan, RaceDistance, Workout } from '../planTypes';

const BASE_INTAKE: IntakeResponses = {
  goal: 'Build fitness',
  age: 35,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 35,
  raceDistance: '5k',
  goalTimeSec: 1200,
  recentPerformance: { distance: '5k', timeSec: 1350 },
  injuries: ['none'],
};

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

/**
 * A race week's own distance is fixed by the event and cannot be clamped down like an ordinary
 * training week — a marathon race day is 42.195 km regardless of the runner's taper volume. That
 * week complies with the growth cap either the ordinary way (its actual, user-visible volume is
 * within the 15% cap off the last loading week) or because it sits exactly at the mathematically
 * mandatory minimum forced by the fixed race distance plus one required run per remaining day
 * (i.e. there is no discretionary padding beyond what the race itself forces).
 */
function assertWeekGrowthCapCompliance(
  week: ReturnType<typeof buildTemplatePlan>['weeks'][number],
  lastLoadingWeekKm: number,
): void {
  if (lastLoadingWeekKm <= 0) return;
  const growth = (week.volumeKm - lastLoadingWeekKm) / lastLoadingWeekKm;
  if (growth <= WEEKLY_INCREASE_REJECT_ABOVE + 1e-9) return;

  const raceDay = week.days.filter(isWorkout).find((day) => day.label === 'Race Day');
  if (raceDay === undefined) {
    throw new Error(
      `week ${week.weekNumber} grew ${(growth * 100).toFixed(1)}% off ${lastLoadingWeekKm} km, exceeding the reject threshold`,
    );
  }
  const otherRuns = week.days.filter(isWorkout).filter((day) => day !== raceDay).length;
  const mandatoryFloorKm = (raceDay.distanceKm ?? 0) + otherRuns;
  expect(week.volumeKm).toBeLessThanOrEqual(mandatoryFloorKm + 1e-9);
}

function build(args: {
  goalType?: GoalType;
  durationWeeks?: number;
  raceDistance?: RaceDistance;
  daysPerWeek?: number;
  weeklyKm?: number;
}) {
  const goalType = args.goalType ?? 'race';
  const raceDistance = args.raceDistance ?? '5k';
  return buildTemplatePlan({
    intake: {
      ...BASE_INTAKE,
      daysPerWeek: args.daysPerWeek ?? BASE_INTAKE.daysPerWeek,
      weeklyKm: args.weeklyKm ?? BASE_INTAKE.weeklyKm,
      raceDistance,
    },
    goalType,
    durationWeeks: args.durationWeeks ?? 12,
    raceDistance,
    raceDate: goalType === 'race' ? '2026-10-02' : undefined,
    tierAtGeneration: 'pro',
    density: 'paid',
  });
}

describe('buildTemplatePlan — parametric inputs', () => {
  it.each([
    ['5k', 12],
    ['10k', 16],
    ['half', 18],
    ['marathon', 26],
  ] as const)('scales to a %s plan with %i weeks', (raceDistance, durationWeeks) => {
    const plan = build({ raceDistance, durationWeeks });
    expect(plan.weeks).toHaveLength(durationWeeks);
    expect(plan.weeks.map((week) => week.weekNumber)).toEqual(
      Array.from({ length: durationWeeks }, (_, index) => index + 1),
    );
    expect(plan.weeks.at(-1)?.days.filter(isWorkout).some((day) => day.label === 'Race Day')).toBe(
      true,
    );
  });

  it.each([2, 3, 4, 5, 6, 7])(
    'uses the source minimum of three runs and otherwise honors %i available days',
    (daysPerWeek) => {
      const plan = build({ raceDistance: '10k', durationWeeks: 16, daysPerWeek });
      const expectedRuns = Math.max(3, daysPerWeek);
      for (const week of plan.weeks) {
        expect(week.days.filter(isWorkout)).toHaveLength(expectedRuns);
      }
    },
  );

  it('scales weekly load from the starting volume', () => {
    const lower = build({ raceDistance: '10k', durationWeeks: 16, weeklyKm: 25 });
    const higher = build({ raceDistance: '10k', durationWeeks: 16, weeklyKm: 50 });
    expect(higher.weeklyLoad[0]).toBeGreaterThan(lower.weeklyLoad[0]);
    expect(higher.weeklyLoad.at(-1)).toBeGreaterThan(lower.weeklyLoad.at(-1) ?? 0);
  });

  it('keeps every generated week internally balanced and hard sessions separated', () => {
    const plan = build({ raceDistance: 'marathon', durationWeeks: 26, daysPerWeek: 6 });
    for (const week of plan.weeks) {
      const workouts = week.days.filter(isWorkout);
      expect(workouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0)).toBe(
        week.volumeKm,
      );
      const hardIndexes = week.days
        .map((day, index) => ({ day, index }))
        .filter(
          ({ day }) =>
            isWorkout(day) && (day.effort === 'tempo' || day.effort === 'interval'),
        )
        .map(({ index }) => index);
      for (let left = 0; left < hardIndexes.length; left += 1) {
        for (let right = left + 1; right < hardIndexes.length; right += 1) {
          expect(Math.abs(hardIndexes[left] - hardIndexes[right])).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('never grows a non-deload week — including the race week — beyond the reject threshold off the last loading week, unless mathematically forced by the fixed race distance (issue #22)', () => {
    const plan = build({ raceDistance: '10k', durationWeeks: 6, daysPerWeek: 4, weeklyKm: 35 });
    let lastLoadingWeekKm = 0;
    for (const week of plan.weeks) {
      if (!week.isDeload) {
        assertWeekGrowthCapCompliance(week, lastLoadingWeekKm);
        lastLoadingWeekKm = week.volumeKm;
      }
    }
  });

  it('materially reduces a deload week off the last loading week', () => {
    const plan = build({ raceDistance: '10k', durationWeeks: 8, daysPerWeek: 4, weeklyKm: 35 });
    let lastLoadingWeekKm = 0;
    for (const week of plan.weeks) {
      if (week.isDeload && lastLoadingWeekKm > 0) {
        expect(week.volumeKm).toBeLessThan(lastLoadingWeekKm * 0.75);
      }
      if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    }
  });

  it.each([
    ['10k', 6, 4, 35],
    ['10k', 16, 5, 25],
    ['half', 18, 6, 40],
    ['marathon', 26, 3, 30],
    ['10k', 8, 7, 35],
    ['half', 26, 3, 40],
    ['half', 26, 3, 60],
    ['marathon', 18, 7, 60],
    ['5k', 16, 5, 20],
    ['10k', 12, 6, 15],
  ] as const)(
    'keeps every week — including the race week and every deload — growth-cap compliant across durations/days/volumes (%s, %i weeks, %i days, %i km)',
    (raceDistance, durationWeeks, daysPerWeek, weeklyKm) => {
      const plan = build({ raceDistance, durationWeeks, daysPerWeek, weeklyKm });
      let lastLoadingWeekKm = 0;
      for (const week of plan.weeks) {
        if (week.isDeload) {
          if (lastLoadingWeekKm > 0) {
            expect(week.volumeKm).toBeLessThan(lastLoadingWeekKm * 0.75);
          }
        } else {
          assertWeekGrowthCapCompliance(week, lastLoadingWeekKm);
          lastLoadingWeekKm = week.volumeKm;
        }
      }
    },
  );

  it('does not leak race fields or race sessions into a duration plan', () => {
    const plan = build({ goalType: 'duration', durationWeeks: 8 });
    expect(plan.title).toBe('8-Week Running Plan');
    expect(plan.raceDistance).toBeUndefined();
    expect(plan.raceDate).toBeUndefined();
    expect(plan.goalRealism).toBeUndefined();
    expect(
      plan.weeks
        .flatMap((week) => week.days.filter(isWorkout))
        .some((workout) => workout.label === 'Race Day' || workout.label === 'RP'),
    ).toBe(false);
  });
});

describe('buildTemplatePlan — deload cadence by experience and age off the golden path (generic 12-week/10K)', () => {
  // Ian's 2026-08-03 ruling ("pro runners = 3 weeks, beginners = 4") must hold on the generic
  // path too, not just the canonical 5K shape, and the age >= 50 rule still beats every level.

  function genericTenKPlanFor(age: number, experience: ExperienceAnswer): Plan {
    return buildTemplatePlan({
      intake: {
        ...BASE_INTAKE,
        age,
        experience,
        raceDistance: '10k',
      },
      goalType: 'race',
      durationWeeks: 12,
      raceDistance: '10k',
      raceDate: '2026-10-02',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
  }

  function deloadWeekNumbers(plan: Plan): number[] {
    return plan.weeks
      .map((week, index) => (week.isDeload ? index + 1 : 0))
      .filter((weekNumber) => weekNumber > 0);
  }

  it('deloads an under-50 advanced/competitive runner every 3 weeks (3, 6, 9)', () => {
    expect(deloadWeekNumbers(genericTenKPlanFor(30, 'competitive'))).toEqual([3, 6, 9]);
  });

  it('deloads an under-50 beginner runner every 4 weeks (4, 8)', () => {
    expect(deloadWeekNumbers(genericTenKPlanFor(30, 'new'))).toEqual([4, 8]);
  });

  it('keeps an under-50 intermediate runner at the every-4-week cadence (4, 8)', () => {
    expect(deloadWeekNumbers(genericTenKPlanFor(30, 'regular'))).toEqual([4, 8]);
  });

  it('deloads a 50+ beginner every 3 weeks (3, 6, 9) — the age rule beats the beginner cadence', () => {
    expect(deloadWeekNumbers(genericTenKPlanFor(55, 'new'))).toEqual([3, 6, 9]);
  });

  it('deloads a 50+ advanced runner every 3 weeks (3, 6, 9) — age and experience agree', () => {
    expect(deloadWeekNumbers(genericTenKPlanFor(55, 'competitive'))).toEqual([3, 6, 9]);
  });
});
