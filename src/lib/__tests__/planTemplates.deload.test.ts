/**
 * Recovery ("rest") weeks on the generic template path — the captain's 2026-09-12 user-audit item.
 *
 * The evidence: a 10 km plan averaging ~35 km/week produced a rest week of `14 km long run + 2 km
 * + 3 km`. The total was a ~45% drop (the pre-2026-09-06 band, still what the last-deployed Worker
 * runs) and the *distribution* was absurd — the long run barely moved while the easy runs collapsed
 * to warm-up length. The 2026-09-06 band change fixed the total; the distribution defect stayed,
 * because `buildGenericWeek` had "no separate deload formula for the long run the way
 * `deloadVolume` is one for weekly volume" (its own comment): the rest week's long run followed
 * the *loading* curve, and the easy runs absorbed the entire 20% cut.
 *
 * The rules this suite pins are all pre-existing coaching rules, not new numbers:
 * - `plan-blueprint-examples.md` § 2 rule 7: recovery weeks are 15–25% below the preceding loading
 *   week (20% target) and "remove hard volume before removing easy frequency";
 * - § 6: "During `RECOVERY`, remove Q2, replace Q1 with short strides or a shortened threshold
 *   touch only when healthy, and shorten Day 7";
 * - § 9: "`LR-recovery` is 60–70% of the preceding long run" — `loadRules.ts`'s
 *   `DELOAD_LONG_RUN_SHARE_MIN`/`_MAX`, the same authority `deloadVolume` reads for the total.
 *
 * The easy-run floor is derived from the band, not invented: the deepest cut the band permits to
 * the *week* (`DELOAD_REDUCTION_MAX`, 25%) is also the deepest cut any single easy run may take
 * against the preceding loading week's shortest non-long run (quality included — that slot is the
 * hard volume being removed, and once it converts to easy it shares the easy budget). "Remove
 * hard volume before easy" means an easy run can never be cut deeper than the week is allowed to
 * be.
 */

import { buildTemplatePlan } from '../planTemplates';
import {
  DELOAD_LONG_RUN_SHARE_MAX,
  DELOAD_LONG_RUN_SHARE_MIN,
  DELOAD_REDUCTION_MAX,
  DELOAD_REDUCTION_MIN,
} from '../loadRules';
import type {
  Day,
  ExperienceAnswer,
  GoalType,
  IntakeResponses,
  Plan,
  RaceDistance,
  Week,
  Workout,
} from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function runsOf(week: Week): Workout[] {
  return week.days.filter(isWorkout);
}

function longRunKm(week: Week): number {
  return runsOf(week).find((run) => run.isLongRun === true)?.distanceKm ?? 0;
}

/**
 * Every run that is not the long run. On a loading week that includes the quality session; on a
 * rest week (quality removed, its slot now an easy run) these are exactly the easy runs the week is
 * supposed to keep "at a runnable length". Comparing rest-week easy runs against *all* of the
 * loading week's other runs is what "remove hard volume before removing easy frequency" measures:
 * the quality slot is the hard volume, and once it converts to easy it shares the easy budget.
 */
function otherRunsKm(week: Week): number[] {
  return runsOf(week)
    .filter((run) => run.isLongRun !== true)
    .map((run) => run.distanceKm ?? 0);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Every (loading week → the rest week that follows it) pair in a plan. The captain's ruling makes a
 * no-race plan's final week a forced loading week and a race plan ends in taper/race, so the last
 * week is never a rest week and every rest week has a predecessor.
 */
function restWeekPairs(plan: Plan): { loading: Week; rest: Week }[] {
  const pairs: { loading: Week; rest: Week }[] = [];
  let loading: Week | undefined;
  for (const week of plan.weeks) {
    if (week.isDeload) {
      if (loading !== undefined) pairs.push({ loading, rest: week });
    } else {
      loading = week;
    }
  }
  return pairs;
}

/**
 * The three invariants from the brief, as one checker so the captain's case and the sweep assert
 * the identical thing. Returns human-readable breaches rather than throwing, so a sweep reports the
 * whole offender set, not the first one.
 */
function restWeekBreaches(plan: Plan, label: string): string[] {
  const breaches: string[] = [];
  for (const { loading, rest } of restWeekPairs(plan)) {
    const where = `${label} week ${rest.weekNumber} (after ${loading.volumeKm} km loading week ${loading.weekNumber})`;
    const render = (week: Week) =>
      runsOf(week)
        .map((run) => `${run.distanceKm}${run.isLongRun ? 'L' : run.effort !== 'easy' ? 'Q' : ''}`)
        .join('/');
    const detail = `loading ${render(loading)} → rest ${render(rest)}`;

    // 1. The total is a real reduction inside the band — 75–85% of the preceding loading week.
    // The engine renders whole kilometres, so a 1 km rounding allowance rides on both edges.
    const ratio = rest.volumeKm / loading.volumeKm;
    const bandLow = (1 - DELOAD_REDUCTION_MAX) * loading.volumeKm - 1;
    const bandHigh = (1 - DELOAD_REDUCTION_MIN) * loading.volumeKm + 1;
    if (rest.volumeKm < bandLow || rest.volumeKm > bandHigh) {
      breaches.push(`${where}: total ${rest.volumeKm} km is ${(ratio * 100).toFixed(0)}% — ${detail}`);
    }

    // 2. No easy run collapses: each rest-week easy run is at least (1 - DELOAD_REDUCTION_MAX) of
    // the loading week's shortest other run (whole-km rounding allowed).
    const loadingEasy = otherRunsKm(loading);
    const restEasy = otherRunsKm(rest);
    if (loadingEasy.length > 0 && restEasy.length > 0) {
      const floorKm = (1 - DELOAD_REDUCTION_MAX) * Math.min(...loadingEasy) - 1;
      for (const km of restEasy) {
        if (km < floorKm) {
          breaches.push(`${where}: easy run ${km} km is below the ${floorKm.toFixed(1)} km floor — ${detail}`);
        }
      }
    }

    // 3. Hard volume goes first: the long run is cut proportionally MORE than the easy runs, and
    // lands inside § 9's 60–70% of the preceding long run (whole-km rounding allowed).
    const loadingLong = longRunKm(loading);
    const restLong = longRunKm(rest);
    if (loadingLong > 0 && restLong > 0) {
      const longCut = restLong / loadingLong;
      if (restLong < DELOAD_LONG_RUN_SHARE_MIN * loadingLong - 0.5 || restLong > DELOAD_LONG_RUN_SHARE_MAX * loadingLong + 0.5) {
        breaches.push(`${where}: long run ${restLong} km is ${(longCut * 100).toFixed(0)}% of ${loadingLong} km — ${detail}`);
      }
      if (loadingEasy.length > 0 && restEasy.length > 0) {
        const easyCut = mean(restEasy) / mean(loadingEasy);
        if (longCut >= easyCut) {
          breaches.push(
            `${where}: long run cut to ${(longCut * 100).toFixed(0)}% but easy runs to ${(easyCut * 100).toFixed(0)}% — ${detail}`,
          );
        }
      }
    }
  }
  return breaches;
}

function build(
  intake: Partial<IntakeResponses>,
  params: { weeks?: number; goalType?: GoalType; raceDistance?: RaceDistance } = {},
): Plan {
  const raceDistance = params.raceDistance ?? intake.raceDistance ?? '10k';
  return buildTemplatePlan({
    intake: {
      goal: 'Run a strong race',
      age: 32,
      experience: 'regular',
      daysPerWeek: 3,
      weeklyKm: 35,
      injuries: [],
      ...intake,
      raceDistance,
    },
    goalType: params.goalType ?? 'race',
    durationWeeks: params.weeks ?? 12,
    raceDistance,
    raceDate: '2027-01-01',
    tierAtGeneration: 'free',
    density: 'free',
  });
}

// ---------------------------------------------------------------------------

describe("the captain's case — 10 km goal, ~35 km/week, three runs a week", () => {
  const plan = build({});

  it('has rest weeks to check', () => {
    expect(restWeekPairs(plan).length).toBeGreaterThan(0);
  });

  it('makes every rest week a real, sane reduction: 75–85% total, no collapsed easy run, long run cut first', () => {
    expect(restWeekBreaches(plan, "captain's case")).toEqual([]);
  });

  it('never grows the long run into a rest week', () => {
    for (const { loading, rest } of restWeekPairs(plan)) {
      expect(longRunKm(rest)).toBeLessThan(longRunKm(loading));
    }
  });
});

describe('property: every rest week on the generic path, across distances, levels, layouts and volumes', () => {
  const experiences: ExperienceAnswer[] = ['new', 'some', 'regular', 'experienced', 'competitive'];
  const distances: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];

  it.each(distances)('%s plans keep every rest week inside the invariants', (raceDistance) => {
    const breaches: string[] = [];
    let restWeeks = 0;
    for (const experience of experiences) {
      for (const daysPerWeek of [3, 4, 5, 6]) {
        for (const weeklyKm of [20, 35, 50, 70]) {
          for (const weeks of [10, 12, 16]) {
            for (const goalType of ['race', 'duration'] as const) {
              // The golden 12-week/4-day 5K fixture is coach-authored and byte-pinned; its dips are
              // a captain-ruled exception to the band (`[key=golden-deloads-outside-new-band]`).
              if (raceDistance === '5k' && weeks === 12 && daysPerWeek === 4 && goalType === 'race') continue;
              const plan = build({ experience, daysPerWeek, weeklyKm, raceDistance }, { weeks, goalType, raceDistance });
              restWeeks += restWeekPairs(plan).length;
              breaches.push(
                ...restWeekBreaches(plan, `${experience}/${daysPerWeek}d/${weeklyKm}km/${weeks}w/${goalType}`),
              );
            }
          }
        }
      }
    }
    expect(restWeeks).toBeGreaterThan(0);
    expect(breaches).toEqual([]);
  });
});
