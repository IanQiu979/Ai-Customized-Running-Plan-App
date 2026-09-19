/**
 * Property test: a declared injury's volume reduction is applied to the plan ONCE, never
 * compounded week over week — issue #106 (2026-09-19).
 *
 * `plan-blueprint-examples.md` § 17: "Percentage reductions apply to the validated baseline once;
 * they never stack", and every module's `H1` row reads "First loading week −15%/−20%". § 16 `H1`
 * adds "Week 1 at 90% of validated baseline". So week 1 carries both factors together —
 * `(1 − module%) × 0.9` of its healthy twin — and weeks after it ramp off week 1's own reduced
 * volume through the § 5 state machine and `loadRules.ts`'s growth cap, exactly as
 * `planTemplates.ts`'s `applyInjuryVolumeAdjustment` already does on the paid skeleton.
 *
 * One legitimate extra step sits below that share and is not compounding: the healthy plan's
 * `ENTRY → LOAD-1` move is `0.9 × B → B` (+11.1%), while the injured plan, seeded lower, is held
 * to `clampWeeklyVolume`'s +10%. That is a single, bounded step — the floor below is that product,
 * from the same constants — after which every later state is relative to the previous loading
 * week or the peak, so the share can only hold or climb back. Compounding is the opposite shape:
 * the share falls on every loading week, without a floor.
 *
 * Before the fix, `engine.ts` multiplied every week's target by the module reduction while
 * `LOAD-2`/`LOAD-3`/`HOLD`/`RECOVERY` targets are computed *from* the previous (already reduced)
 * loading week, so a knee's 15% became 0.85 × 0.85 × … and a 14-week 10K plan sat at 29% of its
 * healthy twin by week 12.
 */

import { WEEKLY_INCREASE_RECALC_AT } from '../../loadRules';
import type { ExperienceAnswer, InjuryFlag, IntakeResponses, Plan, RaceDistance, Week, Workout } from '../../planTypes';
import { buildLibraryPlan } from '../engine';
import { composeInjuryEffect, H1_WEEK_1_BASELINE_SHARE } from '../injury';
import { CANONICAL_WEEKS, LIBRARY_DISTANCE, VOLUME_STATE_TARGETS, type LibraryDistance } from '../registry';

/**
 * Every run renders to 0.1 km and the seven-day reconciliation can move a week's total up to a
 * tenth per run from its exact target (a 25 km target renders 25.1 over three runs; 18.9 renders
 * 18.7). That rendered total then seeds the next week's target through `lastLoadingKm`, so the
 * drift carries forward one rounding per week — the healthy plan resets to `B` at each `LOAD-1`,
 * the growth-capped injured plan does not. The allowance is therefore linear in the week number;
 * the bug it guards against was geometric (0.85 × 0.85 × …), so the two cannot be confused: the
 * issue's own week 12 was 17 km short against a 3.6 km allowance.
 */
const ROUNDING_KM_PER_RUN = 0.1;

function runCount(week: Week): number {
  return week.days.filter((day): day is Workout => day.kind === 'run').length;
}

function roundingAllowanceKm(healthy: Week, injured: Week): number {
  return ROUNDING_KM_PER_RUN * Math.max(runCount(healthy), runCount(injured)) * healthy.weekNumber;
}

const EXPERIENCES: ExperienceAnswer[] = ['new', 'some', 'regular', 'experienced', 'competitive'];
const DISTANCES: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
const FLAGS: Exclude<InjuryFlag, 'none'>[] = [
  'knee',
  'ankle_achilles',
  'shin_splints',
  'it_band',
  'hip_glute',
  'lower_back',
  'plantar_arch',
];

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

/** Week 1's share of the healthy week 1: § 16's 90% and the module's first-loading-week cut. */
function onceAppliedShare(flag: Exclude<InjuryFlag, 'none'>): number {
  return (1 - composeInjuryEffect('H1', [flag]).volumeReductionPct) * H1_WEEK_1_BASELINE_SHARE;
}

/**
 * The deepest share any week may carry: week 1's, less the one growth-cap step described in the
 * header (`0.9 × B → B` for the healthy plan against `× 1.10` for the injured one).
 */
function floorShare(flag: Exclude<InjuryFlag, 'none'>): number {
  return (
    onceAppliedShare(flag) * (1 + WEEKLY_INCREASE_RECALC_AT) * (VOLUME_STATE_TARGETS.ENTRY.target ?? 1)
  );
}

/**
 * Every week of the injured plan against the same week of the healthy plan. A week that carries
 * more than the once-applied cut plus the single growth-cap step is a breach — that is exactly
 * what compounding looks like. (Only a floor: the seven-day reconciliation's per-run minimums can
 * lift a 15 km week a few tenths, on both plans, and that is rendering, not the cut.)
 */
function compoundingBreaches(
  healthy: Plan,
  injured: Plan,
  flag: Exclude<InjuryFlag, 'none'>,
  label: string,
): string[] {
  const breaches: string[] = [];
  const floor = floorShare(flag);
  healthy.weeks.forEach((week, index) => {
    const injuredWeek = injured.weeks[index]!;
    const injuredKm = injuredWeek.volumeKm;
    if (injuredKm < floor * week.volumeKm - roundingAllowanceKm(week, injuredWeek)) {
      breaches.push(
        `${label} week ${week.weekNumber}: ${injuredKm} km is ${((injuredKm / week.volumeKm) * 100).toFixed(0)}% of the healthy ${week.volumeKm} km, below the once-applied ${(floor * 100).toFixed(1)}%`,
      );
    }
  });
  return breaches;
}

describe('a declared injury reduces the plan once, not every week (issue #106)', () => {
  it('holds the issue’s own intake: regular, 3 days, 35 km, knee, 14-week 10K', () => {
    const params = { weeks: 14, goalType: 'race' as const, raceDistance: '10k' as const };
    const healthy = build({ daysPerWeek: 3 }, params);
    const injured = build({ daysPerWeek: 3, injuries: ['knee'] }, params);

    // Week 12 is the issue's headline: 10.6 km against a healthy 36.9 km before the fix.
    const week12 = injured.weeks[11]!;
    const healthyWeek12 = healthy.weeks[11]!;
    expect(week12.isDeload).toBe(true);
    expect(week12.volumeKm).toBeGreaterThanOrEqual(
      floorShare('knee') * healthyWeek12.volumeKm - roundingAllowanceKm(healthyWeek12, week12),
    );

    expect(compoundingBreaches(healthy, injured, 'knee', 'issue-106')).toEqual([]);
  });

  it('does not compound week over week: a late loading week is no further from healthy than week 1', () => {
    const params = { weeks: 14, goalType: 'race' as const, raceDistance: '10k' as const };
    const healthy = build({ daysPerWeek: 3 }, params);
    const injured = build({ daysPerWeek: 3, injuries: ['knee'] }, params);
    const share = (index: number) => injured.weeks[index]!.volumeKm / healthy.weeks[index]!.volumeKm;
    // Week 1 carries both cuts; by week 11 (the last loading week before the final rest week) the
    // runner has ramped back to at least that same share, not fallen beneath it.
    expect(share(10)).toBeGreaterThanOrEqual(share(0) - 0.01);
  });

  it.each(DISTANCES)('%s — every module, track, layout, volume and duration', (raceDistance) => {
    const canonical = CANONICAL_WEEKS[LIBRARY_DISTANCE[raceDistance] as LibraryDistance];
    const breaches: string[] = [];
    let compared = 0;
    for (const experience of EXPERIENCES) {
      for (const daysPerWeek of [3, 4, 5, 6, 7]) {
        for (const weeklyKm of [15, 25, 35, 50, 70]) {
          for (const weeks of [canonical - 4, canonical, canonical + 4]) {
            for (const goalType of ['race', 'duration'] as const) {
              const healthy = build({ experience, daysPerWeek, weeklyKm }, { weeks, goalType, raceDistance });
              for (const flag of FLAGS) {
                const injured = build(
                  { experience, daysPerWeek, weeklyKm, injuries: [flag] },
                  { weeks, goalType, raceDistance },
                );
                compared += injured.weeks.length;
                breaches.push(
                  ...compoundingBreaches(
                    healthy,
                    injured,
                    flag,
                    `${experience}/${daysPerWeek}d/${weeklyKm}km/${weeks}w/${goalType}/${flag}`,
                  ),
                );
              }
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
    expect(breaches).toEqual([]);
  });
});
