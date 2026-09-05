/**
 * Deterministic template-plan engine.
 *
 * Templates are the Free engine and the non-AI fallback for paid tiers. They
 * contain coaching structure and arithmetic only: never model-authored `why`
 * copy or a `coachIntro`.
 */

import {
  clampLongRun,
  clampWeeklyVolume,
  deloadEveryWeeks,
  deloadVolume,
  hasDeclaredInjury,
  hasRedFlagInjury,
  injuryVolumeReductionPct,
  isUnder18,
  longRunShareCap,
  MAX_SINGLE_RUN_KM,
  redFlagVolumeReductionPct,
  rpeForZone,
  toExperienceLevel,
} from './loadRules';
import {
  assessGoalRealism,
  deriveRacePaceTarget,
  deriveTrainingPaces,
} from './paceDerivation';
import {
  RACE_DISTANCE_KM,
  type Day,
  type ExperienceLevel,
  type GoalType,
  type HrZone,
  type IntakeResponses,
  type Pace,
  type Phase,
  type Plan,
  type RaceDistance,
  type RestDay,
  type Tier,
  type Week,
  type Week7,
  type Workout,
} from './planTypes';

export type TemplateDensity = 'free' | 'paid';

export interface TemplatePlanParams {
  intake: IntakeResponses;
  goalType: GoalType;
  durationWeeks: number;
  raceDistance?: RaceDistance;
  raceDate?: string;
  tierAtGeneration: Tier;
  density: TemplateDensity;
}

const REST: RestDay = { kind: 'rest' };

const EASY_DESCRIPTION = 'Easy, conversational pace.';
// Not "the week's longest run": the long-run share cap can now put this session below a quality
// session in the same week (captain's ruling on `longrun-share-cap-floor`, 2026-09-05) — see
// `docs/reference/coaching/load-rules.md`. Keep this copy in sync with `notation.ts`'s LR entry.
const LONG_DESCRIPTION = 'Easy, conversational pace — your endurance-building run for the week.';
const TEMPO_DESCRIPTION = 'Comfortably hard, sustained effort — at or just below threshold.';
const INTERVAL_DESCRIPTION = 'Hard, controlled effort with full recovery between reps.';
const RACE_PACE_DESCRIPTION = 'Controlled speed at your goal race pace — not an all-out effort.';
const SHAKEOUT_DESCRIPTION =
  'Very light jog to keep the legs loose. Nothing here should feel like work.';
const RACE_DESCRIPTION = 'Race effort — give what the plan built.';

const GENERAL_DISCLAIMER =
  'This is not medical advice. Consult a doctor before starting any training program or if ' +
  'you experience pain, persistent soreness, dizziness, chest discomfort, or any health ' +
  'concern. PACE provides coaching guidance, not medical diagnosis or treatment.';

/** Rule 10, injury-related output disclaimer — exact string,
 * `docs/reference/coaching/load-rules.md:265-267`. Attached whenever `injuries` is declared. */
const INJURY_DISCLAIMER =
  'If you are experiencing significant pain, swelling, or symptoms that concern you, please ' +
  'seek assessment from a qualified sports medicine professional or physiotherapist before ' +
  'continuing training.';

/**
 * Strengthened professional-evaluation language for a red-flag injury (`loadRules.ts`'s
 * `RED_FLAG_INJURIES`) — captain ruling 2026-08-03 (see `plan-structure.md`): the plan itself
 * stays a normal, volume-adjusted plan (Ruling 1), but the recommendation to see a professional
 * must be visibly stronger than the standard injury disclaimer. Adapted, not invented, from the
 * source's own language for this pattern: "worsens quickly when pushed through", "stop", "pain
 * is above 3/10", "does not improve in 5-7 days" (`injury_flags.md:109`), plus Rule 10's own
 * "qualified sports medicine professional or physiotherapist" phrase reused verbatim.
 */
const RED_FLAG_INJURY_DISCLAIMER =
  'You declared an injury the coaching library treats as high-priority — it can worsen ' +
  'quickly if pushed through. Please see a qualified sports medicine professional or ' +
  'physiotherapist for an evaluation before continuing training. If pain is above 3/10 or ' +
  'does not improve within 5–7 days, stop running and seek assessment.';

/** Captain's exact sign-off text (2026-08-06) — verbatim, do not paraphrase. Appended whenever
 * `intake.age` is under 18, alongside the HR-zone→RPE substitution (§6-A,
 * `v22-youth-policy-research-s1` report). */
const UNDER_18_DISCLAIMER =
  'This plan is generated for a runner under 18. It does not replace a pre-participation ' +
  'medical evaluation - check with a doctor before starting, especially around growth-plate ' +
  'and bone-health considerations at this age. A parent or guardian should stay aware of ' +
  'training load and has the right to pause or stop the plan at any time. This plan does not ' +
  "account for individual medical history, injuries, or a coach's in-person supervision.";

/** Ian-approved 12-week 5K load shape, normalized to the 35 km worked-example baseline. */
const FIVE_K_WEEKLY_LOAD = [34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28] as const;
const FIVE_K_LONG_RUNS = [10, 11, 12, 8, 13, 14, 15, 10, 14, 15, 12] as const;
const FIVE_K_TEMPO_KM: Record<number, number> = {
  1: 8,
  2: 8,
  3: 8,
  5: 8,
  6: 9,
  7: 9,
  9: 9,
  10: 10,
};
const FIVE_K_TEMPO_MIN: Record<number, number> = {
  1: 20,
  2: 20,
  3: 20,
  5: 20,
  6: 22,
  7: 24,
  9: 24,
  10: 29,
};

function distanceLabel(distance: RaceDistance): string {
  switch (distance) {
    case '5k':
      return '5K';
    case '10k':
      return '10K';
    case 'half':
      return 'Half Marathon';
    case 'marathon':
      return 'Marathon';
  }
}

function raceDistanceText(distance: RaceDistance): string {
  switch (distance) {
    case '5k':
      return '5 km';
    case '10k':
      return '10 km';
    case 'half':
      return '21.0975 km';
    case 'marathon':
      return '42.195 km';
  }
}

function formatPace(secPerKm: number): string {
  const minutes = Math.floor(secPerKm / 60);
  const seconds = secPerKm % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** `hrZone` for adults, `rpe` for under-18 — never both. See `loadRules.ts`'s `isUnder18`
 * and `rpeForZone` (captain-approved youth policy §6-A). */
function paidFields(
  density: TemplateDensity,
  pace: Pace | undefined,
  hrZone: HrZone | undefined,
  age: number,
): Pick<Workout, 'pace' | 'hrZone' | 'rpe'> {
  if (density !== 'paid') return {};
  return {
    ...(pace ? { pace } : {}),
    ...(hrZone ? (isUnder18(age) ? { rpe: rpeForZone(hrZone) } : { hrZone }) : {}),
  };
}

function easyRun(args: {
  distanceKm: number;
  pace?: Pace;
  density: TemplateDensity;
  age: number;
  structure?: string;
  strides?: boolean;
}): Workout {
  return {
    kind: 'run',
    effort: 'easy',
    label: args.strides ? 'ER + Strides' : 'ER',
    distanceKm: args.distanceKm,
    effortDescription: EASY_DESCRIPTION,
    ...paidFields(args.density, args.pace, 1, args.age),
    ...(args.structure ? { structure: args.structure } : {}),
  };
}

function longRun(
  distanceKm: number,
  pace: Pace | undefined,
  density: TemplateDensity,
  age: number,
): Workout {
  return {
    kind: 'run',
    effort: 'easy',
    label: 'LR',
    distanceKm,
    effortDescription: LONG_DESCRIPTION,
    ...paidFields(density, pace, 1, age),
    isLongRun: true,
  };
}

function tempoRun(args: {
  distanceKm: number;
  durationMin: number;
  pace?: Pace;
  density: TemplateDensity;
  age: number;
}): Workout {
  return {
    kind: 'run',
    effort: 'tempo',
    label: 'TR',
    distanceKm: Math.min(args.distanceKm, 10),
    effortDescription: TEMPO_DESCRIPTION,
    ...paidFields(args.density, args.pace, 3, args.age),
    structure: `WU 2 km · ${args.durationMin} min @ tempo · CD 2 km`,
  };
}

function intervalRun(args: {
  distanceKm: number;
  structure: string;
  pace?: Pace;
  density: TemplateDensity;
  age: number;
  racePace?: boolean;
}): Workout {
  return {
    kind: 'run',
    effort: 'interval',
    label: args.racePace ? 'RP' : 'INT',
    distanceKm: Math.min(args.distanceKm, 11),
    effortDescription: args.racePace ? RACE_PACE_DESCRIPTION : INTERVAL_DESCRIPTION,
    ...paidFields(args.density, args.pace, 4, args.age),
    structure: args.structure,
  };
}

function shakeoutRun(
  distanceKm: number,
  density: TemplateDensity,
  age: number,
  structure: string,
): Workout {
  return {
    kind: 'run',
    effort: 'recovery',
    label: 'SR',
    distanceKm,
    effortDescription: SHAKEOUT_DESCRIPTION,
    ...paidFields(density, undefined, 1, age),
    structure,
  };
}

/** Warm-up + cool-down `raceDayWorkout` adds around the race itself (3 km WU, 2 km CD). */
const RACE_DAY_PADDING_KM = 5;

/**
 * How much of race week is *running the runner does before the start line*, as a share of the
 * race-week volume the canonical curve prescribes.
 *
 * Read straight off the approved 12-week 5K fixture, no new coaching content: its race week is
 * `FIVE_K_WEEKLY_LOAD`'s last entry (28 km), a total that already contains its own race day
 * (5 km race + `RACE_DAY_PADDING_KM`), leaving 18 km of pre-race running across three days.
 * 18/28 is that fixture's own answer to "how much do I still run in race week", expressed as a
 * ratio so it scales to any baseline — the same "scale the captain-approved curve" idiom as
 * `targetVolumeKm` and `scaleQualityDistanceKm`.
 *
 * It replaces `desiredVolumeKm - race.distanceKm` on the generic path, which assembled race week
 * backwards: it charged the race itself against the week's volume budget, so for anything longer
 * than a 5K the race alone exhausted the budget and the days before it collapsed to
 * `distributeDistance`'s 1 km floor — a marathon race week of three 1 km runs and a 47 km "race
 * day", reported as the second-biggest week of the taper. Sizing the pre-race days from the
 * taper instead, and letting race day sit on top of them, is what a taper week actually is.
 *
 * At the golden fixture's own 35 km baseline the two agree exactly (28 - 10 = 18 = 28 × 18/28),
 * which is why `buildCanonicalFiveKWeek` is deliberately left on the subtraction: that path is
 * byte-locked to the fixture, and a 5K race day is small enough that the bug never bites there.
 */
const RACE_WEEK_PRE_RACE_SHARE =
  (FIVE_K_WEEKLY_LOAD[FIVE_K_WEEKLY_LOAD.length - 1] -
    (RACE_DISTANCE_KM['5k'] + RACE_DAY_PADDING_KM)) /
  FIVE_K_WEEKLY_LOAD[FIVE_K_WEEKLY_LOAD.length - 1];

function raceDayWorkout(distance: RaceDistance): Workout {
  const raceKm = RACE_DISTANCE_KM[distance];
  // `raceKm` itself is fractional for half/full marathon (21.1 / 42.195), so the padded total
  // needs rounding — the exact race distance is still spelled out in `structure` below, this is
  // only the summary number shown next to the workout.
  return {
    kind: 'run',
    effort: 'interval',
    label: 'Race Day',
    distanceKm: Math.round(raceKm + RACE_DAY_PADDING_KM),
    effortDescription: RACE_DESCRIPTION,
    structure: `WU 3 km · ${raceDistanceText(distance)} race · CD 2 km`,
  };
}

/**
 * Phase weights for a plan that IS aimed at a race: aerobic base → structured work →
 * race-specific → taper, scaled to distance. The 12-week 5K weights reproduce
 * base×4/build×4/peak×2/taper×2.
 */
function racePhaseWeights(raceDistance: RaceDistance): number[] {
  switch (raceDistance) {
    case '5k':
      return [4, 4, 2, 2];
    case '10k':
      return [5, 5, 4, 2];
    case 'half':
      return [6, 6, 4, 2];
    case 'marathon':
      return [9, 9, 8, 4];
    default: {
      // Exhaustive by type. Reached only if an unvalidated value gets this far, which used to fall
      // through a chained ternary and hand out marathon periodization silently; both boundaries
      // (`validateRequest` and `validateIntake` in `workers/`) reject it before here.
      const unreachable: never = raceDistance;
      throw new Error(`Unknown race distance: ${String(unreachable)}`);
    }
  }
}

/**
 * Phase weights for a plan with **no race**. A taper is by definition the wind-down into a race
 * day, so a plan without one has no taper to allocate — this returns three weights (base / build /
 * peak) and `phasesForPlan` never emits a fourth phase for these plans. Nothing is invented here:
 *
 * - When the runner named a target distance in intake but is generating an open-ended block
 *   (no race date), the distance's own first three weights are reused verbatim, minus the taper.
 * - When no distance is known at all, the weights are equal thirds — a direct read of
 *   `training_zones.md § McMillan Periodization Cycles` as ported in
 *   `docs/reference/coaching/plan-structure.md`, whose general macrocycle runs weeks 1–6 build,
 *   7–12 progressive, 13–18 race-specific, i.e. equal thirds once the race-defined taper is
 *   dropped. Guessing a race distance in order to reach a distance-specific weighting is exactly
 *   the silent assumption this replaced.
 */
function generalPhaseWeights(raceDistance: RaceDistance | undefined): number[] {
  if (!raceDistance) return [1, 1, 1];
  return racePhaseWeights(raceDistance).slice(0, 3);
}

function allocatePhaseCounts(
  durationWeeks: number,
  raceDistance: RaceDistance | undefined,
  isRacePlan: boolean,
): number[] {
  const weights = isRacePlan && raceDistance
    ? racePhaseWeights(raceDistance)
    : generalPhaseWeights(raceDistance);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);

  if (durationWeeks < 4) {
    // Short-runway plans keep the sharp end of the progression rather than refuse. A race plan
    // still lands its taper on race week; a no-race plan has no taper to land, so every week it
    // has goes to `peak`.
    return isRacePlan
      ? [0, 0, Math.max(0, durationWeeks - 1), Math.min(1, durationWeeks)]
      : [0, 0, durationWeeks];
  }

  const raw = weights.map((weight) => (durationWeeks * weight) / totalWeight);
  const counts = raw.map((value) => Math.max(1, Math.floor(value)));
  let assigned = counts.reduce((sum, value) => sum + value, 0);

  while (assigned < durationWeeks) {
    let bestIndex = 0;
    let bestRemainder = -Infinity;
    raw.forEach((value, index) => {
      const remainder = value - Math.floor(value);
      if (remainder > bestRemainder) {
        bestRemainder = remainder;
        bestIndex = index;
      }
    });
    counts[bestIndex] += 1;
    raw[bestIndex] = Math.floor(raw[bestIndex]);
    assigned += 1;
  }
  while (assigned > durationWeeks) {
    let bestIndex = 0;
    for (let index = 1; index < counts.length; index += 1) {
      if (counts[index] > counts[bestIndex]) bestIndex = index;
    }
    counts[bestIndex] -= 1;
    assigned -= 1;
  }
  return counts;
}

function phasesForPlan(
  durationWeeks: number,
  raceDistance: RaceDistance | undefined,
  isRacePlan: boolean,
): Phase[] {
  const names: Phase[] = ['base', 'build', 'peak', 'taper'];
  return allocatePhaseCounts(durationWeeks, raceDistance, isRacePlan).flatMap((count, index) =>
    Array.from({ length: count }, () => names[index]),
  );
}

function interpolateCanonical(values: readonly number[], weekIndex: number, totalWeeks: number): number {
  if (totalWeeks <= 1) return values[values.length - 1];
  const position = (weekIndex * (values.length - 1)) / (totalWeeks - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(values.length - 1, Math.ceil(position));
  const fraction = position - lowerIndex;
  return values[lowerIndex] + (values[upperIndex] - values[lowerIndex]) * fraction;
}

/**
 * `FIVE_K_WEEKLY_LOAD` and `FIVE_K_LONG_RUNS` are a **race** shape: their last two entries are the
 * 12-week 5K plan's taper, the deliberate wind-down into race day. Every plan's volume curve is
 * interpolated from them, which meant a plan with no race still wound down at the end — a runner
 * whose goal was "get fitter" finished a 12-week block at 24 km off a 35 km baseline, below where
 * they started, tapering for a start line that did not exist. (Reproduced against `wrangler dev`
 * on 2026-08-15, before and after: `[…, 45, 48, 40, 28]`.)
 *
 * Dropping the taper is not a new load progression, and no number here is invented: these are the
 * same captain-approved values with the race-defined tail excluded, exactly as `generalPhaseWeights`
 * drops the taper phase. A no-race plan interpolates across the loading block and finishes at its
 * peak; a race plan still sees the whole curve, taper included.
 */
const TAPER_ENTRIES: ReadonlyMap<readonly number[], number> = new Map<readonly number[], number>([
  // Weeks 11 and 12 of the 12-week 5K plan.
  [FIVE_K_WEEKLY_LOAD, 2],
  // The same two weeks, minus race week, which has no long run of its own.
  [FIVE_K_LONG_RUNS, 1],
]);

function taperAwareCurve(values: readonly number[], includeTaper: boolean): readonly number[] {
  if (includeTaper) return values;
  const taperEntries = TAPER_ENTRIES.get(values);
  if (taperEntries === undefined) {
    throw new Error('taperAwareCurve: no taper length registered for this canonical curve.');
  }
  return values.slice(0, values.length - taperEntries);
}

function targetVolumeKm(
  startingWeeklyKm: number,
  weekIndex: number,
  durationWeeks: number,
  includeTaper: boolean,
): number {
  const canonical = interpolateCanonical(
    taperAwareCurve(FIVE_K_WEEKLY_LOAD, includeTaper),
    weekIndex,
    durationWeeks,
  );
  return Math.max(1, Math.round(canonical * (startingWeeklyKm / 35)));
}

/**
 * A declared injury's coaching response is "reduce volume X% *this week*" — this app meets the
 * runner exactly once, at intake, so "this week" is the plan's first generated week. Weeks after
 * it are unaffected here; they still ramp off week 1's own (reduced) volume through the existing
 * `lastLoadingWeekKm` growth-cap mechanism, so the cut isn't silently re-applied or erased.
 *
 * A red-flag injury (`loadRules.ts`'s `redFlagVolumeReductionPct`) is the exception: its cut
 * applies to every week, not just the first — see that function's header. It takes over from the
 * ordinary per-flag reduction entirely rather than stacking with it.
 */
function applyInjuryVolumeAdjustment(
  desiredVolumeKm: number,
  weekNumber: number,
  injuryReductionPct: number,
  redFlagReductionPct: number,
): number {
  if (redFlagReductionPct > 0) {
    return Math.max(1, Math.round(desiredVolumeKm * (1 - redFlagReductionPct)));
  }
  if (weekNumber !== 1 || injuryReductionPct <= 0) return desiredVolumeKm;
  return Math.max(1, Math.round(desiredVolumeKm * (1 - injuryReductionPct)));
}

/**
 * Nominal quality-workout distances (tempo/interval) are written against the 35 km
 * worked-example baseline, same as `FIVE_K_WEEKLY_LOAD`. Scaling them by a volume ratio keeps
 * a hard session from single-handedly exceeding the clamp on a low-volume week or plan.
 *
 * The generic path scales by the week's own (already growth-clamped) volume. The golden path
 * scales by the runner's declared `weeklyKm` instead — the plan-wide scale factor — so the
 * captain-validated 35 km fixture is byte-identical (35/35 = 1) while sub-35 baselines shrink
 * the tempo/interval floor that otherwise pushes the long run above its curve value.
 */
function scaleQualityDistanceKm(nominalKm: number, volumeKm: number): number {
  return Math.max(3, Math.round(nominalKm * (volumeKm / 35)));
}

/**
 * Per-workout structural floors (a quality session's own minimum, the long run's "longest run
 * of the week" floor, `distributeDistance`'s 1 km/session floor) can each be individually
 * reasonable yet still stack past `targetKm`. This is the last-mile guarantee that the assembled,
 * user-visible total never exceeds the clamped target: scale every running workout down together,
 * never below 1 km each, rather than trusting the sum of independently floored pieces.
 */
function reconcileVolumeToTarget(workouts: Workout[], targetKm: number): Workout[] {
  const total = workouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  if (total <= targetKm) return workouts;
  const scale = targetKm / total;
  return workouts.map((workout) =>
    workout.distanceKm === undefined
      ? workout
      : { ...workout, distanceKm: Math.max(1, Math.floor(workout.distanceKm * scale)) },
  );
}

function targetLongRunKm(
  startingWeeklyKm: number,
  weekIndex: number,
  durationWeeks: number,
  maxSingleRunKm: number,
  includeTaper: boolean,
): number {
  // A race plan's final week is race day, so it has no scheduled long run; a no-race plan trains
  // through to the end and does.
  const scheduledLongRunWeeks = Math.max(1, includeTaper ? durationWeeks - 1 : durationWeeks);
  const longRunWeekIndex = Math.min(weekIndex, scheduledLongRunWeeks - 1);
  const canonical = interpolateCanonical(
    taperAwareCurve(FIVE_K_LONG_RUNS, includeTaper),
    longRunWeekIndex,
    scheduledLongRunWeeks,
  );
  return Math.max(1, Math.min(maxSingleRunKm, Math.round(canonical * (startingWeeklyKm / 35))));
}

function distributeDistance(totalKm: number, count: number, capKm: number): number[] {
  if (count <= 0) return [];
  const target = Math.max(count, Math.min(totalKm, Math.floor(capKm * count)));
  const base = Math.floor(target / count);
  let remainder = target - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return value;
  });
}

/**
 * Per-easy-run ceiling on the generic path: one kilometre under the long run.
 *
 * Originally chosen to keep the long run the week's strictly-longest run; the captain's ruling on
 * `longrun-share-cap-floor` (2026-09-05) means that's no longer guaranteed — the safety cap can
 * now put the long run below a quality session. The ceiling stays anyway, for the reason it was
 * really added: volume preservation. The canonical 5K path keeps its own literal
 * `longDistanceKm * 0.8` and is not routed through here — that plan is coach-authored and
 * byte-pinned, so nothing here reshapes it; it is verified against the same caps instead, by
 * `planTemplates.longRunCap.test.ts`. The generic path needs the looser ceiling because it is the
 * path where the long run is clamped: 0.8 caps a week's absorbable volume at `1.8 x longRun + quality`, so once
 * `clampLongRun` shortens the long run the week can no longer reach its target at all, and the
 * shortfall is then re-read by `clampWeeklyVolume` as the next week's growth base. Letting the
 * easy days take the kilometres the long run gave up keeps the week whole and the runner's
 * declared volume intact.
 */
function easyRunCapKm(longDistanceKm: number): number {
  return Math.max(1, longDistanceKm - 1);
}

function normalizedRunCount(daysPerWeek: number): number {
  // The source maps anything below three available days to a three-run plan.
  return Math.max(3, Math.min(7, Math.round(daysPerWeek)));
}

function placeWorkoutsInOrder(workouts: Workout[], daysPerWeek: number): Week7<Day> {
  const runCount = normalizedRunCount(daysPerWeek);
  const slotsByRunCount: Record<number, number[]> = {
    3: [0, 3, 5],
    4: [0, 2, 4, 5],
    5: [0, 1, 3, 4, 6],
    6: [0, 1, 2, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const days: Day[] = Array.from({ length: 7 }, () => REST);
  slotsByRunCount[runCount].forEach((slot, index) => {
    const workout = workouts[index];
    if (workout) days[slot] = workout;
  });
  return days as unknown as Week7<Day>;
}

function placeWorkouts(workouts: Workout[], daysPerWeek: number): Week7<Day> {
  const runCount = normalizedRunCount(daysPerWeek);
  const layouts: Record<number, {
    runSlots: number[];
    hardSlots: number[];
    longSlot: number;
    raceSlot: number;
  }> = {
    3: { runSlots: [0, 3, 5], hardSlots: [3], longSlot: 5, raceSlot: 6 },
    4: { runSlots: [0, 2, 4, 5], hardSlots: [2, 4], longSlot: 5, raceSlot: 6 },
    5: { runSlots: [0, 1, 3, 4, 6], hardSlots: [1, 4], longSlot: 6, raceSlot: 6 },
    6: { runSlots: [0, 1, 2, 4, 5, 6], hardSlots: [1, 4], longSlot: 6, raceSlot: 6 },
    7: { runSlots: [0, 1, 2, 3, 4, 5, 6], hardSlots: [2, 4], longSlot: 6, raceSlot: 6 },
  };
  const layout = layouts[runCount];
  const selected = workouts.slice(0, runCount);
  while (selected.length < runCount) {
    selected.unshift({
      kind: 'run',
      effort: 'easy',
      label: 'ER',
      distanceKm: 1,
      effortDescription: EASY_DESCRIPTION,
    });
  }

  const days: Day[] = Array.from({ length: 7 }, () => REST);
  const raceDay = selected.find((workout) => workout.label === 'Race Day');
  const long = selected.find((workout) => workout.isLongRun === true);
  const hard = selected.filter(
    (workout) =>
      workout.label !== 'Race Day' &&
      workout.isLongRun !== true &&
      (workout.effort === 'tempo' || workout.effort === 'interval'),
  );
  const easy = selected.filter(
    (workout) => workout !== raceDay && workout !== long && !hard.includes(workout),
  );

  const reserve = (slot: number, workout: Workout | undefined): void => {
    if (workout && days[slot].kind === 'rest') days[slot] = workout;
  };
  reserve(layout.raceSlot, raceDay);
  reserve(layout.longSlot, long);
  hard.forEach((workout, index) => reserve(layout.hardSlots[index], workout));

  const openSlots = layout.runSlots.filter((slot) => days[slot].kind === 'rest');
  easy.forEach((workout, index) => reserve(openSlots[index], workout));
  return days as unknown as Week7<Day>;
}

function buildCanonicalFiveKWeek(args: {
  weekNumber: number;
  durationWeeks: number;
  phase: Phase;
  intake: IntakeResponses;
  density: TemplateDensity;
  easyPace?: Pace;
  tempoPace?: Pace;
  intervalPace?: Pace;
  racePace?: Pace;
  maxSingleRunKm: number;
  level: ExperienceLevel;
  previousLongestKm: number;
  lastLoadingWeekKm: number;
  deloadCadence: number;
  injuryReductionPct: number;
  redFlagReductionPct: number;
}): Week {
  const {
    weekNumber,
    durationWeeks,
    phase,
    intake,
    density,
    easyPace,
    tempoPace,
    intervalPace,
    racePace,
    maxSingleRunKm,
    level,
    previousLongestKm,
    lastLoadingWeekKm,
    deloadCadence,
    injuryReductionPct,
    redFlagReductionPct,
  } = args;
  const weekIndex = weekNumber - 1;
  const isRaceWeek = weekNumber === durationWeeks;
  // 50+ runners on this golden 12-week 5K path get deload weeks 4, 8 and 12 specifically
  // (captain ruling, `fifty-plus-golden-deload-weeks`, `workout-v22-plan-accuracy-s1` report) —
  // not the generic every-`deloadCadence`-weeks modulo, which for a 3-week cadence would land on
  // 3/6/9 instead and miss the natural volume dips `FIVE_K_WEEKLY_LOAD` already has at 4 and 8.
  // Week 12 is also the race week; for 50+ it is flagged as a deload on top of that, not instead.
  // This fully replaces the modulo cadence for 50+ on this path — weeks 3/6/9 (what a 3-week
  // cadence would otherwise produce) are deliberately NOT deload here, only 4/8/12 are.
  const isDeload = intake.age >= 50
    ? [4, 8, 12].includes(weekNumber)
    : !isRaceWeek && phase !== 'taper' && weekNumber % deloadCadence === 0;
  const desiredVolumeKm = applyInjuryVolumeAdjustment(
    targetVolumeKm(intake.weeklyKm, weekIndex, durationWeeks, true),
    weekNumber,
    injuryReductionPct,
    redFlagReductionPct,
  );

  if (isRaceWeek) {
    const race = raceDayWorkout('5k');
    const nonRaceKm = Math.max(3, desiredVolumeKm - (race.distanceKm ?? 0));
    const easyDistances = distributeDistance(nonRaceKm, 3, Math.max(1, nonRaceKm));
    const workouts = [
      easyRun({ distanceKm: easyDistances[0], pace: easyPace, density, age: intake.age }),
      easyRun({
        distanceKm: easyDistances[1],
        pace: easyPace,
        density,
        age: intake.age,
        strides: true,
        structure: '4 × 20 s Strides @ GP',
      }),
      shakeoutRun(easyDistances[2], density, intake.age, '2 × 30 s Strides @ GP'),
      race,
    ];
    const days: Week7<Day> = [workouts[0], REST, workouts[1], REST, workouts[2], REST, workouts[3]];
    const volumeKm = workouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
    return { weekNumber, totalWeeks: durationWeeks, phase, isDeload, volumeKm, days };
  }

  const quality: Workout[] = [];
  if (!isDeload) {
    const tempoKm = FIVE_K_TEMPO_KM[weekNumber];
    if (tempoKm !== undefined) {
      quality.push(
        tempoRun({
          distanceKm: scaleQualityDistanceKm(tempoKm, intake.weeklyKm),
          durationMin: FIVE_K_TEMPO_MIN[weekNumber],
          pace: tempoPace,
          density,
          age: intake.age,
        }),
      );
    }
    if (weekNumber === 9) {
      const paceText = intervalPace
        ? `${formatPace(intervalPace.lowSecPerKm)}–${formatPace(intervalPace.highSecPerKm)}/km`
        : 'current-fitness interval effort';
      quality.push(
        intervalRun({
          distanceKm: scaleQualityDistanceKm(11, intake.weeklyKm),
          structure: `WU 2 km · 8 × 600 m @ ${paceText} w/ 300 m jog · CD 2 km`,
          pace: intervalPace,
          density,
          age: intake.age,
        }),
      );
    } else if (weekNumber === 10) {
      const paceText = intervalPace
        ? `${formatPace(intervalPace.lowSecPerKm)}–${formatPace(intervalPace.highSecPerKm)}/km`
        : 'current-fitness interval effort';
      quality.push(
        intervalRun({
          distanceKm: scaleQualityDistanceKm(11, intake.weeklyKm),
          structure: `WU 2 km · 5 × 1000 m @ ${paceText} w/ 400 m jog · CD 2 km`,
          pace: intervalPace,
          density,
          age: intake.age,
        }),
      );
    } else if (weekNumber === 11) {
      quality.push(
        intervalRun({
          distanceKm: scaleQualityDistanceKm(10, intake.weeklyKm),
          structure: 'WU 2 km · 3 × 1600 m @ GP w/ ~400 m jog · CD 2 km',
          pace: racePace,
          density,
          age: intake.age,
          racePace: true,
        }),
      );
    }
  }

  const minimumLongRunKm = quality.reduce(
    (max, workout) => Math.max(max, (workout.distanceKm ?? 0) + 1),
    1,
  );
  const proposedLongDistanceKm = Math.min(
    maxSingleRunKm,
    Math.max(
      minimumLongRunKm,
      targetLongRunKm(intake.weeklyKm, weekIndex, durationWeeks, maxSingleRunKm, true),
    ),
  );

  const requestedRuns = normalizedRunCount(intake.daysPerWeek);
  const retainedQuality = quality.slice(0, Math.max(1, requestedRuns - 2));
  const easyCount = Math.max(1, requestedRuns - retainedQuality.length - 1);
  const qualityKm = retainedQuality.reduce(
    (sum, workout) => sum + (workout.distanceKm ?? 0),
    0,
  );

  // Every ceiling in `clampLongRun` must be enforced here — the scout's issue #2 finding was
  // that this golden path bypassed them entirely. The weekly-share ceiling is measured against
  // the week's *assembled* volume, which can run below `desiredVolumeKm` (an easy run may not
  // exceed 80% of the long run, so a two-quality-session week can't always absorb its full
  // budget). Clamp against the assembled volume and iterate: the clamp shrinks the long run,
  // which shrinks the assembled volume, which can reopen the share. The map is a contraction
  // (derivative < 1), so this converges to the fixed point in a handful of steps; the loop
  // exits the moment the clamp reports the current value unchanged.
  let longDistanceKm = proposedLongDistanceKm;
  for (let i = 0; i < 100; i += 1) {
    const easyTotalKm = distributeDistance(
      desiredVolumeKm - longDistanceKm - qualityKm,
      easyCount,
      longDistanceKm * 0.8,
    ).reduce((sum, distanceKm) => sum + distanceKm, 0);
    const assembledVolumeKm = longDistanceKm + qualityKm + easyTotalKm;
    const { km } = clampLongRun({
      proposedKm: longDistanceKm,
      weeklyKm: assembledVolumeKm,
      level,
      previousLongestKm,
      easyPaceSecPerKm: easyPace?.highSecPerKm,
      isDeload,
      lastLoadingWeekKm,
    });
    // Floored, not the raw fraction `clampLongRun` returns: a share-cap ceiling like
    // `weeklyKm * LONG_RUN_SHARE_CAP[level]` is rarely a whole number, and the unrounded value
    // was leaking straight into the rendered plan (e.g. "5.666666666666667 km"). Flooring only
    // ever shrinks the value, so it can never push the long run back over the ceiling that just
    // produced it — the convergence loop's own invariant is preserved.
    const flooredKm = Math.floor(km);
    if (flooredKm >= longDistanceKm) break;
    longDistanceKm = flooredKm;
  }
  const long = longRun(longDistanceKm, easyPace, density, intake.age);

  const remainingKm = desiredVolumeKm - longDistanceKm - qualityKm;
  const easyDistances = distributeDistance(remainingKm, easyCount, longDistanceKm * 0.8);
  const easyWorkouts = easyDistances.map((distanceKm, index) => {
    const loadingTwoEasyGoldenWeek = [1, 2, 3, 5, 6, 7].includes(weekNumber);
    const peakStrideWeek = [9, 10].includes(weekNumber) && index === 0;
    const taperStrideDay = weekNumber === 11 && index === easyDistances.length - 1;
    const strides = !isDeload && (loadingTwoEasyGoldenWeek || peakStrideWeek || taperStrideDay);
    return easyRun({
      distanceKm,
      pace: easyPace,
      density,
      age: intake.age,
      strides,
      ...(strides
        ? { structure: taperStrideDay ? '4 × 30 s Strides @ GP' : '4 × 30 s Strides' }
        : {}),
    });
  });

  let workouts: Workout[];
  if (isDeload) {
    workouts = [...easyWorkouts, long];
  } else if (weekNumber === 11 && easyWorkouts.length >= 2) {
    workouts = [easyWorkouts[0], ...retainedQuality, ...easyWorkouts.slice(1), long];
  } else {
    workouts = [...easyWorkouts, ...retainedQuality, long];
  }

  const days = placeWorkoutsInOrder(workouts, requestedRuns);
  const volumeKm = days
    .filter((day): day is Workout => day.kind === 'run')
    .reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  return { weekNumber, totalWeeks: durationWeeks, phase, isDeload, volumeKm, days };
}

function buildGenericWeek(args: {
  weekNumber: number;
  durationWeeks: number;
  phase: Phase;
  /** Absent when the runner named no target distance anywhere. Never defaulted — see
   * `buildTemplatePlan`'s note on the removed `?? '5k'`. */
  raceDistance?: RaceDistance;
  /** True only for a race goal type that also has a distance to aim at. Gates race week, the
   * race-pace taper session, and everything else that presumes a start line exists. */
  isRacePlan: boolean;
  intake: IntakeResponses;
  density: TemplateDensity;
  easyPace?: Pace;
  tempoPace?: Pace;
  intervalPace?: Pace;
  racePace?: Pace;
  maxSingleRunKm: number;
  deloadCadence: number;
  level: ExperienceLevel;
  previousLongestKm: number;
  lastLoadingWeekKm: number;
  injuryReductionPct: number;
  redFlagReductionPct: number;
}): Week {
  const {
    weekNumber,
    durationWeeks,
    phase,
    raceDistance,
    isRacePlan,
    intake,
    density,
    easyPace,
    tempoPace,
    intervalPace,
    racePace,
    maxSingleRunKm,
    deloadCadence,
    level,
    previousLongestKm,
    lastLoadingWeekKm,
    injuryReductionPct,
    redFlagReductionPct,
  } = args;
  const isRaceWeek = isRacePlan && raceDistance !== undefined && weekNumber === durationWeeks;
  // A no-race plan must never end on a deload (captain ruling, 2026-08-15, as a McMillan-certified
  // coach): its last week is the last week the runner sees, and finishing on a recovery week leaves
  // them at or below the volume they started at — the visible symptom behind the original report.
  // The every-`deloadCadence`-weeks rule yields to that for the final week only; nothing else about
  // the cadence changes, and a race plan's final week is race week or taper, so it is untouched.
  const endsOnForcedLoadingWeek = !isRacePlan && weekNumber === durationWeeks;
  const isDeload =
    !isRaceWeek &&
    !endsOnForcedLoadingWeek &&
    phase !== 'taper' &&
    weekNumber % deloadCadence === 0;
  const rawVolumeKm = targetVolumeKm(intake.weeklyKm, weekNumber - 1, durationWeeks, isRacePlan);
  const desiredVolumeKm = applyInjuryVolumeAdjustment(
    isDeload
      ? lastLoadingWeekKm > 0
        ? Math.max(1, Math.round(deloadVolume(lastLoadingWeekKm)))
        : rawVolumeKm
      : Math.max(
          1,
          Math.round(
            clampWeeklyVolume({
              lastLoadingWeekKm,
              proposedKm: rawVolumeKm,
              level,
              baselineWeeklyKm: intake.weeklyKm,
            }),
          ),
        ),
    weekNumber,
    injuryReductionPct,
    redFlagReductionPct,
  );

  if (isRaceWeek) {
    const race = raceDayWorkout(raceDistance);
    const requestedRuns = normalizedRunCount(intake.daysPerWeek);
    const easyCount = Math.max(0, requestedRuns - 1);
    // Not `desiredVolumeKm - race.distanceKm`: the race is not a training session competing for
    // the week's budget, it is the thing the week tapers into. See `RACE_WEEK_PRE_RACE_SHARE`.
    const easyBudgetKm = Math.max(easyCount, Math.round(desiredVolumeKm * RACE_WEEK_PRE_RACE_SHARE));
    const easyDistances = distributeDistance(easyBudgetKm, easyCount, maxSingleRunKm);
    const easyWorkouts = easyDistances.map((distanceKm, index) =>
      index === easyDistances.length - 1
        ? shakeoutRun(distanceKm, density, intake.age, '2 × 30 s Strides @ GP')
        : easyRun({ distanceKm, pace: easyPace, density, age: intake.age }),
    );
    const reconciledEasyWorkouts = reconcileVolumeToTarget(easyWorkouts, easyBudgetKm);
    const days = placeWorkouts([...reconciledEasyWorkouts, race], requestedRuns);
    const volumeKm = days
      .filter((day): day is Workout => day.kind === 'run')
      .reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
    return { weekNumber, totalWeeks: durationWeeks, phase, isDeload: false, volumeKm, days };
  }

  const quality: Workout[] = [];
  if (!isDeload && (phase === 'base' || phase === 'build' || phase === 'peak')) {
    quality.push(
      tempoRun({
        distanceKm: scaleQualityDistanceKm(raceDistance === '5k' ? 8 : 10, desiredVolumeKm),
        durationMin: phase === 'base' ? 20 : phase === 'build' ? 24 : 29,
        pace: tempoPace,
        density,
        age: intake.age,
      }),
    );
  }
  if (!isDeload && phase === 'peak') {
    quality.push(
      intervalRun({
        distanceKm: scaleQualityDistanceKm(11, desiredVolumeKm),
        structure: 'WU 2 km · 5 × 1000 m @ current-fitness interval effort w/ 400 m jog · CD 2 km',
        pace: intervalPace,
        density,
        age: intake.age,
      }),
    );
  }
  if (!isDeload && isRacePlan && phase === 'taper') {
    quality.push(
      intervalRun({
        distanceKm: scaleQualityDistanceKm(10, desiredVolumeKm),
        structure: 'WU 2 km · 3 × 1600 m @ GP w/ ~400 m jog · CD 2 km',
        pace: racePace,
        density,
        age: intake.age,
        racePace: true,
      }),
    );
  }

  const requestedRuns = normalizedRunCount(intake.daysPerWeek);
  const retainedQuality = quality.slice(0, Math.max(1, requestedRuns - 2));
  const easyCount = Math.max(1, requestedRuns - retainedQuality.length - 1);
  const qualityKm = retainedQuality.reduce(
    (sum, workout) => sum + (workout.distanceKm ?? 0),
    0,
  );
  // Starting guess only — a floor here just picks a sane pre-clamp candidate (the long run
  // should, all else equal, exceed the hardest quality session). The safety loop below may still
  // shrink the result under this per the captain's ruling on `longrun-share-cap-floor`; see there.
  const longRunStartFloor = quality.reduce(
    (max, workout) => Math.max(max, (workout.distanceKm ?? 0) + 1),
    1,
  );
  const longRunFromCurve = Math.max(
    longRunStartFloor,
    targetLongRunKm(intake.weeklyKm, weekNumber - 1, durationWeeks, maxSingleRunKm, isRacePlan),
  );
  const longRunVolumeBudget = Math.max(
    longRunStartFloor,
    desiredVolumeKm - qualityKm - easyCount,
  );

  // Every ceiling in `clampLongRun` must be enforced here too. `buildCanonicalFiveKWeek` has run
  // this loop since 2026-08-03; this path — which serves every runner who is not on the golden
  // 12-week/4-day/5K shape, i.e. every 10K, half, marathon and general-fitness plan — never called
  // `clampLongRun` at all, so the share, spike and time caps were documented but unenforced for
  // almost everyone (e.g. a 34 km long run inside a 64 km week, 53% against an advanced cap of
  // 35%). The mismatch that produced it: the long run follows the canonical curve scaled by the
  // runner's *declared* `weeklyKm`, while the week's volume is separately growth-clamped by
  // `clampWeeklyVolume`, so the two can drift apart with nothing reconciling them.
  //
  // Same convergence argument as the canonical path: the share ceiling is measured against the
  // week's *assembled* volume (easy runs are capped per `easyRunCapKm`, so a week cannot always
  // absorb its full budget), and shrinking the long run shrinks the assembled volume, which can
  // reopen the share. The map is a contraction, so it converges in a handful of steps and the loop
  // exits as soon as the clamp stops moving the value.
  //
  // Captain's ruling on core-purpose-audit finding §1.2 / issue `longrun-share-cap-floor`,
  // 2026-09-05: the safety cap always wins, even where that means the long run is no longer this
  // week's longest run (an earlier revision floored the result at `longRunStartFloor` to preserve
  // that instead, which is why 15 of this file's own regression tests failed — the floor was
  // silently overriding the documented cap). The share cap itself moves to
  // `longRunShareCap(level, requestedRuns)` — see that function's own comment — specifically
  // because a *flat* per-level cap is arithmetically impossible at low run counts (an n-run week's
  // largest entry is never below `1/n`), which is why the audit's beginner and 3-day profiles
  // breached on every loading week regardless of this loop. The run-count-scaled cap is
  // satisfiable at every `normalizedRunCount` output (3–7) by construction, so — unlike the
  // flat-cap revision this replaces — the loop never chases an unreachable target and needs no
  // "skip the clamp" guard.
  const shareCap = longRunShareCap(level, requestedRuns);
  let longDistanceKm = Math.min(maxSingleRunKm, longRunFromCurve, longRunVolumeBudget);
  // Fixed at the pre-clamp candidate, not recomputed each iteration off the shrinking
  // `longDistanceKm`: otherwise a low-volume/low-day week where the safety cap needs several
  // iterations to bind (e.g. a 4-day beginner week) ratchets down twice over — the long run
  // shrinks for safety, then the easy days' own ceiling shrinks with it, so the week can no
  // longer absorb the volume the long run gave up, `clampWeeklyVolume` reads the shortfall as the
  // next week's growth base, and the plan spirals (a 20 km/wk beginner 10K plan was observed
  // collapsing to two consecutive 6 km weeks). The ceiling only needs to be *a* reasonable bound,
  // not one that tracks the final long run — see `easyRunCapKm`'s own comment.
  const easyCeilingKm = easyRunCapKm(longDistanceKm);
  for (let i = 0; i < 100; i += 1) {
    const easyTotalKm = distributeDistance(
      desiredVolumeKm - longDistanceKm - qualityKm,
      easyCount,
      easyCeilingKm,
    ).reduce((sum, distanceKm) => sum + distanceKm, 0);
    const assembledVolumeKm = longDistanceKm + qualityKm + easyTotalKm;
    const { km } = clampLongRun({
      proposedKm: longDistanceKm,
      weeklyKm: assembledVolumeKm,
      level,
      previousLongestKm,
      easyPaceSecPerKm: easyPace?.highSecPerKm,
      isDeload,
      lastLoadingWeekKm,
      shareCapOverride: shareCap,
    });
    // Floored so a fractional ceiling never leaks into the rendered plan, and floored no lower
    // than 1 km — a real session, matching every other minimum in this file (`distributeDistance`,
    // `easyRunCapKm`) — never back up to `longRunStartFloor`; see the ruling above. Flooring only
    // shrinks the value, so the loop's invariant holds and it still terminates:
    // `flooredKm >= longDistanceKm` breaks the moment the clamp stops biting.
    const flooredKm = Math.max(1, Math.floor(km));
    if (flooredKm >= longDistanceKm) break;
    longDistanceKm = flooredKm;
  }
  const long = longRun(longDistanceKm, easyPace, density, intake.age);
  const easyDistances = distributeDistance(
    desiredVolumeKm - longDistanceKm - qualityKm,
    easyCount,
    easyCeilingKm,
  );
  const easyWorkouts = easyDistances.map((distanceKm) =>
    easyRun({
      distanceKm,
      pace: easyPace,
      density,
      age: intake.age,
      strides: !isDeload,
      ...(!isDeload ? { structure: '4 × 30 s Strides' } : {}),
    }),
  );
  const reconciledWorkouts = reconcileVolumeToTarget(
    [...easyWorkouts, ...retainedQuality, long],
    desiredVolumeKm,
  );
  const days = placeWorkouts(reconciledWorkouts, requestedRuns);
  const volumeKm = days
    .filter((day): day is Workout => day.kind === 'run')
    .reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  return { weekNumber, totalWeeks: durationWeeks, phase, isDeload, volumeKm, days };
}

/** Builds a deterministic, runtime-independent template plan. */
export function buildTemplatePlan(params: TemplatePlanParams): Plan {
  const durationWeeks = Math.max(1, Math.round(params.durationWeeks));
  // No `?? '5k'`. A runner who named no race must never have one invented for them — the captain's
  // standing rule against silently overriding a stated goal (`docs/change_log.md`, PR #75) applies
  // just as much to a goal they deliberately left blank. `raceDistance` stays `undefined` all the
  // way through, and every race-specific branch below is gated on `isRacePlan`, which requires
  // both a race goal type AND a distance to aim it at.
  const raceDistance = params.raceDistance ?? params.intake.raceDistance;
  const isRacePlan = params.goalType === 'race' && raceDistance !== undefined;
  const level = toExperienceLevel(params.intake.experience);
  const trainingPaces = deriveTrainingPaces(params.intake.recentPerformance, level);
  const racePaceTarget =
    isRacePlan && raceDistance && params.intake.goalTimeSec !== undefined
      ? deriveRacePaceTarget({
          goalTimeSec: params.intake.goalTimeSec,
          raceDistance,
          recent: params.intake.recentPerformance,
        })
      : undefined;
  const phases = phasesForPlan(durationWeeks, raceDistance, isRacePlan);
  const maxSingleRunKm = MAX_SINGLE_RUN_KM[level];
  const deloadCadence = deloadEveryWeeks(level, params.intake.age);
  const injuryReductionPct = injuryVolumeReductionPct(params.intake.injuries);
  const redFlagReductionPct = redFlagVolumeReductionPct(params.intake.injuries);

  const useGoldenFiveKShape =
    isRacePlan &&
    raceDistance === '5k' &&
    durationWeeks === 12 &&
    normalizedRunCount(params.intake.daysPerWeek) === 4;
  let lastLoadingWeekKm = 0;
  let previousLongestKm = 0;
  const weeks = phases.map((phase, index) => {
    const week = useGoldenFiveKShape
      ? buildCanonicalFiveKWeek({
          weekNumber: index + 1,
          durationWeeks,
          phase,
          intake: params.intake,
          density: params.density,
          easyPace: trainingPaces.easy,
          tempoPace: trainingPaces.tempo,
          intervalPace: trainingPaces.interval,
          racePace: racePaceTarget?.pace,
          maxSingleRunKm,
          level,
          previousLongestKm,
          lastLoadingWeekKm,
          deloadCadence,
          injuryReductionPct,
          redFlagReductionPct,
        })
      : buildGenericWeek({
          weekNumber: index + 1,
          durationWeeks,
          phase,
          raceDistance,
          isRacePlan,
          intake: params.intake,
          density: params.density,
          easyPace: trainingPaces.easy,
          tempoPace: trainingPaces.tempo,
          intervalPace: trainingPaces.interval,
          racePace: racePaceTarget?.pace,
          maxSingleRunKm,
          deloadCadence,
          level,
          previousLongestKm,
          lastLoadingWeekKm,
          injuryReductionPct,
          redFlagReductionPct,
        });
    if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    previousLongestKm = Math.max(
      previousLongestKm,
      week.days
        .filter((day): day is Workout => day.kind === 'run')
        .filter((day) => day.isLongRun === true)
        .reduce((max, day) => Math.max(max, day.distanceKm ?? 0), 0),
    );
    return week;
  });

  const goalRealism =
    isRacePlan && raceDistance && params.intake.goalTimeSec !== undefined
      ? assessGoalRealism({
          goalTimeSec: params.intake.goalTimeSec,
          raceDistance,
          recent: params.intake.recentPerformance,
        })
      : undefined;

  const disclaimers = [
    GENERAL_DISCLAIMER,
    ...(isUnder18(params.intake.age) ? [UNDER_18_DISCLAIMER] : []),
    ...(hasDeclaredInjury(params.intake.injuries) ? [INJURY_DISCLAIMER] : []),
    ...(hasRedFlagInjury(params.intake.injuries) ? [RED_FLAG_INJURY_DISCLAIMER] : []),
  ];

  return {
    title:
      isRacePlan && raceDistance
        ? `${durationWeeks}-Week ${distanceLabel(raceDistance)} Plan`
        : `${durationWeeks}-Week Running Plan`,
    goalType: params.goalType,
    ...(isRacePlan && raceDistance ? { raceDistance } : {}),
    ...(isRacePlan && params.raceDate ? { raceDate: params.raceDate } : {}),
    durationWeeks,
    tierAtGeneration: params.tierAtGeneration,
    engine: 'template',
    isFallback: false,
    weeklyLoad: weeks.map((week) => week.volumeKm),
    weeks,
    extras: [],
    disclaimers,
    ...(goalRealism ? { goalRealism } : {}),
  };
}
