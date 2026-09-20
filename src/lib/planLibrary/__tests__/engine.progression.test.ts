/**
 * Property sweep: every plan the Free library renders has a peak phase that is its highest-volume
 * block, phases that follow volume, and every safety ceiling intact — the captain's ruling of
 * 2026-09-20 (coach sign-off pack, `docs/change_log.md`), the library-engine counterpart of
 * `src/lib/__tests__/planTemplates.progression.test.ts`'s #103 sweep of the paid skeleton.
 *
 * What the sign-off pack found, on all four of its Free plans: the single highest week was labelled
 * `build` and sat beside a lower `peak` phase (5K week 9 build 25.3 km > week 10 peak 24.8; marathon
 * week 13 build 70.1 > week 11 peak 66.5; the half's build week 11 outranked every peak week, giving
 * peak → recovery → build → peak → taper). Two things fixed it, both in `engine.ts`: `HOLD` holds
 * the preceding loading week at the top of § 5's own 95–100% band, and phase labels are derived from
 * the rendered volumes (`derivePhases`) instead of the calendar state.
 *
 * The grid is the paid sweep's — distance × experience × 3–7 days × 10–110 km/week × eight
 * durations × recent time present/absent — on race plans (the library requires a distance, and a
 * race date is what gives it a taper), plus the no-race lengths that make the calendar cycle.
 */

import {
  DELOAD_REDUCTION_MAX,
  DELOAD_REDUCTION_MIN,
  isValidDeload,
  LONG_RUN_MAX_MINUTES,
  longRunShareCap,
  toExperienceLevel,
} from '../../loadRules';
import { deriveTrainingPaces } from '../../paceDerivation';
import type {
  Day,
  ExperienceAnswer,
  IntakeResponses,
  Phase,
  Plan,
  RaceDistance,
  Week,
  Workout,
} from '../../planTypes';
import { buildLibraryPlan } from '../engine';

const DISTANCES: readonly RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
const EXPERIENCES: readonly ExperienceAnswer[] = ['new', 'some', 'regular', 'experienced', 'competitive'];
const DAYS = [3, 4, 5, 6, 7] as const;
const WEEKLY_KM = Array.from({ length: 11 }, (_, index) => 10 + index * 10);
const DURATIONS = [6, 8, 10, 12, 14, 16, 20, 24] as const;
const RECENT = [undefined, { distance: '10k', timeSec: 2700 }] as const;
const RACE_MATRIX_SIZE = 17_600;

/** The library renders to 0.1 km, so a share or band check tolerates a tenth, not a kilometre. */
const ROUNDING_KM = 0.1;

/**
 * Race plans in the sweep with no peak phase at all. Every one is a six- or eight-week plan whose
 * calendar adaptation left no loading block after the opening aerobic block — § 8 rule 3's safe
 * completion plan for a first-timer, or a prepared runner's cut that lands on the taper — so
 * there is nothing for a peak to be. Pinned as a ceiling so a phase-derivation change that drops
 * a real peak is a visible edit.
 */
const NO_PEAK_CEILING = 1355;

function isRun(day: Day): day is Workout {
  return day.kind === 'run';
}

function isRaceWeek(week: Week): boolean {
  return week.days.filter(isRun).some((run) => run.label === 'Race Day');
}

function longRunOf(week: Week): Workout | undefined {
  return week.days.filter(isRun).find((run) => run.isLongRun === true);
}

function loadingWeeks(plan: Plan): Week[] {
  return plan.weeks.filter((week) => !week.isDeload && !isRaceWeek(week));
}

function loadingMaxKm(plan: Plan, phase: Phase): number {
  return Math.max(-Infinity, ...loadingWeeks(plan).filter((week) => week.phase === phase).map((week) => week.volumeKm));
}

const PHASE_ORDER: Record<Phase, number> = { base: 0, build: 1, peak: 2, taper: 3 };

function build(args: {
  raceDistance: RaceDistance;
  experience: ExperienceAnswer;
  daysPerWeek: number;
  weeklyKm: number;
  durationWeeks: number;
  recentPerformance?: IntakeResponses['recentPerformance'];
  goalType: 'race' | 'duration';
}): Plan {
  const result = buildLibraryPlan({
    intake: {
      goal: 'Race well',
      age: 35,
      experience: args.experience,
      daysPerWeek: args.daysPerWeek,
      weeklyKm: args.weeklyKm,
      raceDistance: args.raceDistance,
      ...(args.recentPerformance ? { recentPerformance: args.recentPerformance } : {}),
      injuries: ['none'],
    },
    goalType: args.goalType,
    durationWeeks: args.durationWeeks,
    raceDistance: args.raceDistance,
    ...(args.goalType === 'race' ? { raceDate: '2026-12-25' } : {}),
    tierAtGeneration: 'free',
  });
  if (!result.ok) throw new Error(`expected a library plan, got gap ${result.gap}`);
  return result.plan;
}

interface Verdict {
  description: string;
  hasPeak: boolean;
  peakBelowBuild: boolean;
  peakBelowBase: boolean;
  /** A plan with no peak must not have built above its base either — that is what "no peak" means. */
  noPeakButBuilt: boolean;
  peakIsOnlyRest: boolean;
  phaseStepsBack: boolean;
  deloadBandBreaches: string[];
  shareBreaches: string[];
  timeBreaches: string[];
}

function judge(plan: Plan, description: string, args: { experience: ExperienceAnswer; raceDistance: RaceDistance; recentPerformance?: IntakeResponses['recentPerformance'] }): Verdict {
  const peakMax = loadingMaxKm(plan, 'peak');
  const buildMax = loadingMaxKm(plan, 'build');
  const baseMax = loadingMaxKm(plan, 'base');
  const hasPeak = Number.isFinite(peakMax);
  const peakWeeks = plan.weeks.filter((week) => week.phase === 'peak');

  let phaseStepsBack = false;
  for (let index = 1; index < plan.weeks.length; index += 1) {
    if (PHASE_ORDER[plan.weeks[index]!.phase] < PHASE_ORDER[plan.weeks[index - 1]!.phase]) phaseStepsBack = true;
  }

  const level = toExperienceLevel(args.experience);
  const runCount = plan.weeks[0]!.days.filter(isRun).length;
  const shareCap = longRunShareCap(level, runCount, plan.raceDate !== undefined ? args.raceDistance : undefined);
  const easyPace = deriveTrainingPaces(args.recentPerformance, level).easy?.highSecPerKm;
  const deloadBandBreaches: string[] = [];
  const shareBreaches: string[] = [];
  const timeBreaches: string[] = [];
  let lastLoadingKm = 0;
  for (const week of plan.weeks) {
    const longRun = longRunOf(week);
    const denominator = week.isDeload && isValidDeload(lastLoadingKm, week.volumeKm) ? lastLoadingKm : week.volumeKm;
    if (longRun?.distanceKm !== undefined && denominator > 0) {
      if (longRun.distanceKm > shareCap * denominator + ROUNDING_KM) {
        shareBreaches.push(`week ${week.weekNumber}: ${longRun.distanceKm} km of ${denominator} km`);
      }
      if (easyPace !== undefined && (longRun.distanceKm * easyPace) / 60 > LONG_RUN_MAX_MINUTES) {
        timeBreaches.push(`week ${week.weekNumber}: ${longRun.distanceKm} km`);
      }
    }
    if (week.isDeload && !isRaceWeek(week)) {
      if (
        lastLoadingKm > 0 &&
        (week.volumeKm < (1 - DELOAD_REDUCTION_MAX) * lastLoadingKm - ROUNDING_KM ||
          week.volumeKm > (1 - DELOAD_REDUCTION_MIN) * lastLoadingKm + ROUNDING_KM)
      ) {
        deloadBandBreaches.push(`week ${week.weekNumber}: ${week.volumeKm} km after ${lastLoadingKm} km`);
      }
    } else if (!isRaceWeek(week)) {
      lastLoadingKm = week.volumeKm;
    }
  }

  return {
    description,
    hasPeak,
    peakBelowBuild: hasPeak && Number.isFinite(buildMax) && peakMax < buildMax,
    peakBelowBase: hasPeak && Number.isFinite(baseMax) && peakMax < baseMax,
    noPeakButBuilt: !hasPeak && Number.isFinite(buildMax) && Number.isFinite(baseMax) && buildMax > baseMax,
    peakIsOnlyRest: peakWeeks.length > 0 && peakWeeks.every((week) => week.isDeload),
    phaseStepsBack,
    deloadBandBreaches,
    shareBreaches,
    timeBreaches,
  };
}

function raceMatrix(): Verdict[] {
  const verdicts: Verdict[] = [];
  for (const raceDistance of DISTANCES) {
    for (const experience of EXPERIENCES) {
      for (const daysPerWeek of DAYS) {
        for (const weeklyKm of WEEKLY_KM) {
          for (const durationWeeks of DURATIONS) {
            for (const recentPerformance of RECENT) {
              const args = { raceDistance, experience, daysPerWeek, weeklyKm, durationWeeks, recentPerformance, goalType: 'race' as const };
              const description = [raceDistance, experience, `${daysPerWeek} days`, `${weeklyKm} km/week`, `${durationWeeks} weeks`, recentPerformance ? 'recent 10K' : 'no recent time'].join(' / ');
              verdicts.push(judge(build(args), description, args));
            }
          }
        }
      }
    }
  }
  return verdicts;
}

describe('Free library — the peak phase is the highest-volume block and phases follow volume (captain, 2026-09-20)', () => {
  const verdicts = raceMatrix();

  it('sweeps the full race matrix', () => {
    expect(verdicts).toHaveLength(RACE_MATRIX_SIZE);
  });

  it('never renders a peak phase below the build phase — the sign-off pack shape, on every plan', () => {
    expect(verdicts.filter((v) => v.peakBelowBuild).map((v) => v.description)).toEqual([]);
  });

  it('never renders a peak phase below the base phase — invariant #103, as on the paid engine', () => {
    expect(verdicts.filter((v) => v.peakBelowBase).map((v) => v.description)).toEqual([]);
  });

  it('gives every plan that builds above its base a peak phase, and a peak that is never only rest weeks', () => {
    expect(verdicts.filter((v) => v.noPeakButBuilt).map((v) => v.description)).toEqual([]);
    expect(verdicts.filter((v) => v.peakIsOnlyRest).map((v) => v.description)).toEqual([]);
    expect(verdicts.filter((v) => !v.hasPeak).length).toBeLessThanOrEqual(NO_PEAK_CEILING);
  });

  it('never steps a race plan back — base → build → peak → taper, with no build between two peaks', () => {
    expect(verdicts.filter((v) => v.phaseStepsBack).map((v) => v.description)).toEqual([]);
  });

  it('keeps every rest week inside the 15–25% band while doing so', () => {
    expect(verdicts.flatMap((v) => v.deloadBandBreaches.map((b) => `${v.description}: ${b}`))).toEqual([]);
  });

  it('keeps every long run inside its share cap (R1c denominator) and under 180 minutes', () => {
    expect(verdicts.flatMap((v) => v.shareBreaches.map((b) => `${v.description}: ${b}`))).toEqual([]);
    expect(verdicts.flatMap((v) => v.timeBreaches.map((b) => `${v.description}: ${b}`))).toEqual([]);
  });

  it('reproduces the sign-off pack\'s four Free plans with their highest week in the peak phase', () => {
    // The pack's own intakes (no recent time on any of them), before: 5K week 9 build 25.3 > week 10
    // peak 24.8; 10K week 8 build 41 > week 9 peak 40.1; half week 11 build 57.6 above every peak
    // week; marathon week 13 build 70.1 > week 11 peak 66.5.
    const cases = [
      { raceDistance: '5k' as const, experience: 'some' as const, daysPerWeek: 4, weeklyKm: 20, durationWeeks: 12 },
      { raceDistance: '10k' as const, experience: 'regular' as const, daysPerWeek: 4, weeklyKm: 30, durationWeeks: 12 },
      { raceDistance: 'half' as const, experience: 'experienced' as const, daysPerWeek: 5, weeklyKm: 40, durationWeeks: 14 },
      { raceDistance: 'marathon' as const, experience: 'experienced' as const, daysPerWeek: 5, weeklyKm: 50, durationWeeks: 16 },
    ];
    for (const item of cases) {
      const plan = build({ ...item, goalType: 'race' });
      const highest = Math.max(...loadingWeeks(plan).map((week) => week.volumeKm));
      expect(loadingWeeks(plan).find((week) => week.volumeKm === highest)?.phase).toBe('peak');
      expect(loadingMaxKm(plan, 'peak')).toBe(highest);
    }
  });

  it('holds the HOLD week at the volume of the loading week it follows, exactly', () => {
    // § 5's `HOLD` at the top of its 95–100% band, and `buildWeek`'s exact reconciliation of the
    // seven days: the 12-week 5K's week 10 renders the same total as week 9, not 2.5% under it.
    const plan = build({ raceDistance: '5k', experience: 'regular', daysPerWeek: 4, weeklyKm: 30, durationWeeks: 12, goalType: 'race' });
    expect(plan.weeks[9]!.volumeKm).toBe(plan.weeks[8]!.volumeKm);
    expect(plan.weeks.slice(8, 10).map((week) => week.phase)).toEqual(['peak', 'peak']);
  });
});

describe('Free library — a dateless plan longer than the base/build portion cycles it, labelled per cycle', () => {
  it('labels each cycle on its own and gives a peak only to a cycle that reaches the plan high', () => {
    // 24 weeks of 5K base: the ten-week base/build portion twice, then its first four weeks (the
    // last of them swapped for a loading week — "finish on a loading or consolidation week").
    const plan = build({ raceDistance: '5k', experience: 'regular', daysPerWeek: 4, weeklyKm: 30, durationWeeks: 24, goalType: 'duration' });
    const phases = plan.weeks.map((week) => week.phase);
    expect(phases.slice(0, 10)).toEqual(['base', 'base', 'base', 'base', 'build', 'build', 'build', 'build', 'peak', 'peak']);
    expect(phases.slice(10, 20)).toEqual(phases.slice(0, 10));
    expect(phases.slice(20)).toEqual(['base', 'base', 'base', 'base']);
    expect(phases).not.toContain('taper');
    const highest = Math.max(...loadingWeeks(plan).map((week) => week.volumeKm));
    for (const week of loadingWeeks(plan)) {
      if (week.phase !== 'peak') expect(week.volumeKm).toBeLessThan(highest);
    }
  });
});
