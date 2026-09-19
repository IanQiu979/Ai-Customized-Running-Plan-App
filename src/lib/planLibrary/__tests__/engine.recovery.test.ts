/**
 * Property test: every `RECOVERY` week of every plan in the 40-plan register is a real, sane
 * reduction — the captain's 2026-09-12 user-audit item, pinned over the whole library rather than
 * one plan.
 *
 * The three invariants are the same ones `src/lib/__tests__/planTemplates.deload.test.ts` pins on
 * the paid-tier skeleton, and they are all pre-existing rules of `plan-blueprint-examples.md`:
 * § 2 rule 7 (15–25% below the preceding loading week; "remove hard volume before removing easy
 * frequency"), § 6 ("shorten Day 7"), § 9 ("`LR-recovery` is 60–70% of the preceding long run").
 * The bands come from `loadRules.ts`, which both engines read.
 *
 * The library was already correct on 2026-09-12 — the audit's `14 km + 2 km + 3 km` rest week
 * came from the other engine — so this suite is the guard that keeps it that way.
 *
 * The grid sweeps `H0` and every one of § 17's seven `H1` modules (issue #106, 2026-09-19): a
 * declared injury's module reduction used to be re-applied on every week, on top of `RECOVERY`'s
 * own cut, so an injured runner's rest weeks fell to ~68% of the preceding week, below the band.
 * `lower_back` (INJ-6) is swept for the total band only: its "keep Day 7 at `LR-low`" pin is
 * applied on rest weeks too, so Day 7 never shortens there and the easy runs carry the whole cut
 * — a separate, pre-existing shape defect whose reading (is the pin a value or a cap?) is the
 * captain's, tracked as issue #119. The other six modules pass all three invariants.
 */

import {
  DELOAD_LONG_RUN_SHARE_MAX,
  DELOAD_LONG_RUN_SHARE_MIN,
  DELOAD_REDUCTION_MAX,
  DELOAD_REDUCTION_MIN,
} from '../../loadRules';
import type {
  ExperienceAnswer,
  InjuryFlag,
  IntakeResponses,
  Plan,
  RaceDistance,
  Week,
  Workout,
} from '../../planTypes';
import { buildLibraryPlan } from '../engine';
import { CANONICAL_WEEKS, LIBRARY_DISTANCE, type LibraryDistance } from '../registry';

const EXPERIENCES: ExperienceAnswer[] = ['new', 'some', 'regular', 'experienced', 'competitive'];
const DISTANCES: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
/** `H0`, then each § 17 module on its own — every reachable injury state (Q5: any flag is `H1`). */
const INJURY_ANSWERS: InjuryFlag[][] = [
  [],
  ['knee'],
  ['ankle_achilles'],
  ['shin_splints'],
  ['it_band'],
  ['hip_glute'],
  ['lower_back'],
  ['plantar_arch'],
];
/** See the header: the Day-7 pin keeps these plans out of the two shape invariants for now. */
const TOTAL_BAND_ONLY: InjuryFlag[] = ['lower_back'];

function runsOf(week: Week): Workout[] {
  return week.days.filter((day): day is Workout => day.kind === 'run');
}

function longRunKm(week: Week): number {
  return runsOf(week).find((run) => run.isLongRun === true)?.distanceKm ?? 0;
}

/** Every run that is not the long run — on a loading week that includes the quality session. */
function otherRunsKm(week: Week): number[] {
  return runsOf(week)
    .filter((run) => run.isLongRun !== true)
    .map((run) => run.distanceKm ?? 0);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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

/** The library renders to 0.1 km, so the tolerance is a tenth, not the skeleton's whole kilometre. */
const ROUNDING_KM = 0.1;

function restWeekBreaches(plan: Plan, label: string, shape = true): string[] {
  const breaches: string[] = [];
  for (const { loading, rest } of restWeekPairs(plan)) {
    const where = `${label} week ${rest.weekNumber} (after ${loading.volumeKm} km loading week ${loading.weekNumber})`;
    const render = (week: Week) =>
      runsOf(week)
        .map((run) => `${run.distanceKm}${run.isLongRun ? 'L' : run.effort !== 'easy' ? 'Q' : ''}`)
        .join('/');
    const detail = `loading ${render(loading)} → rest ${render(rest)}`;

    // 1. Total inside the band.
    const ratio = rest.volumeKm / loading.volumeKm;
    if (
      rest.volumeKm < (1 - DELOAD_REDUCTION_MAX) * loading.volumeKm - ROUNDING_KM ||
      rest.volumeKm > (1 - DELOAD_REDUCTION_MIN) * loading.volumeKm + ROUNDING_KM
    ) {
      breaches.push(`${where}: total ${rest.volumeKm} km is ${(ratio * 100).toFixed(0)}% — ${detail}`);
    }
    if (!shape) continue;

    // 2. No easy run collapses below the band's own deepest permitted cut.
    const loadingOthers = otherRunsKm(loading);
    const restOthers = otherRunsKm(rest);
    if (loadingOthers.length > 0 && restOthers.length > 0) {
      const floorKm = (1 - DELOAD_REDUCTION_MAX) * Math.min(...loadingOthers) - ROUNDING_KM;
      for (const km of restOthers) {
        if (km < floorKm) {
          breaches.push(`${where}: easy run ${km} km is below the ${floorKm.toFixed(1)} km floor — ${detail}`);
        }
      }
    }

    // 3. The long run is shortened into § 9's band and takes a proportionally bigger cut than the
    // easy runs.
    const loadingLong = longRunKm(loading);
    const restLong = longRunKm(rest);
    if (loadingLong > 0 && restLong > 0) {
      const longCut = restLong / loadingLong;
      if (
        restLong < DELOAD_LONG_RUN_SHARE_MIN * loadingLong - ROUNDING_KM ||
        restLong > DELOAD_LONG_RUN_SHARE_MAX * loadingLong + ROUNDING_KM
      ) {
        breaches.push(`${where}: long run ${restLong} km is ${(longCut * 100).toFixed(0)}% of ${loadingLong} km — ${detail}`);
      }
      if (loadingOthers.length > 0 && restOthers.length > 0) {
        const easyCut = mean(restOthers) / mean(loadingOthers);
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
  params: { weeks: number; goalType: 'race' | 'duration'; raceDistance: RaceDistance },
): Plan {
  const result = buildLibraryPlan({
    intake: {
      goal: 'Run a strong race',
      age: 32,
      experience: 'regular',
      daysPerWeek: 4,
      weeklyKm: 35,
      injuries: [],
      ...intake,
      raceDistance: params.raceDistance,
    },
    goalType: params.goalType,
    durationWeeks: params.weeks,
    raceDistance: params.raceDistance,
    raceDate: '2027-01-01',
    tierAtGeneration: 'free',
  });
  if (!result.ok) throw new Error(`expected a library plan, got gap ${result.gap}`);
  return result.plan;
}

describe('every recovery week in the 40-plan register is a real, sane reduction', () => {
  it.each(DISTANCES)('%s — every track, layout, volume and duration', (raceDistance) => {
    const canonical = CANONICAL_WEEKS[LIBRARY_DISTANCE[raceDistance] as LibraryDistance];
    const breaches: string[] = [];
    let restWeeks = 0;
    for (const experience of EXPERIENCES) {
      for (const daysPerWeek of [3, 4, 5, 6, 7]) {
        for (const weeklyKm of [15, 25, 35, 50, 70]) {
          for (const weeks of [canonical - 4, canonical, canonical + 4]) {
            for (const goalType of ['race', 'duration'] as const) {
              for (const recentPerformance of [undefined, { distance: '10k' as const, timeSec: 3000 }]) {
                for (const injuries of INJURY_ANSWERS) {
                  const plan = build(
                    {
                      experience,
                      daysPerWeek,
                      weeklyKm,
                      injuries,
                      ...(recentPerformance ? { recentPerformance } : {}),
                    },
                    { weeks, goalType, raceDistance },
                  );
                  restWeeks += restWeekPairs(plan).length;
                  breaches.push(
                    ...restWeekBreaches(
                      plan,
                      `${experience}/${daysPerWeek}d/${weeklyKm}km/${weeks}w/${goalType}/${recentPerformance ? 'timed' : 'untimed'}/${injuries[0] ?? 'H0'}`,
                      !injuries.some((flag) => TOTAL_BAND_ONLY.includes(flag)),
                    ),
                  );
                }
              }
            }
          }
        }
      }
    }
    expect(restWeeks).toBeGreaterThan(0);
    expect(breaches).toEqual([]);
  });
});
