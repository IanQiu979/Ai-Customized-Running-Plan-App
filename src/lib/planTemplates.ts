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
  maxSingleRunKm as distanceAwareMaxSingleRunKm,
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
  type Performance,
  type Phase,
  type Plan,
  type RaceDistance,
  type ReadinessPath,
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

/** Source §20's required disclosure for the limited-preparation fixed point created by applying
 * the captain's 35% marathon long-run cap to a non-beginner three-day race plan. */
const THREE_DAY_MARATHON_DISCLAIMER =
  "With three running days, the 35% long-run cap limits this plan's long-run progression. " +
  'Add a fourth running day for fuller marathon preparation.';

/**
 * Why a race plan took the first-timer path, in the runner's own numbers. The research's
 * selection model (`plan-blueprint-examples.md`) picks the path from demonstrated capacity —
 * current weekly volume and, for marathon, evidence of the long-run base — and its § 20 order
 * ends with "disclaimers and limited-preparation disclosure … never silently relabel a reduced
 * plan as full preparation". The path changes the plan (more aerobic foundation before
 * race-specific work, and the level's own long-run ceiling kept in force), so the runner is told
 * which of the two capacity checks sent them there. Nothing here is coaching content: the numbers
 * are the engine's own thresholds and the intake the runner typed.
 */
function firstTimerDisclosure(intake: IntakeResponses, raceDistance: RaceDistance): string {
  const label = distanceLabel(raceDistance);
  const reasons: string[] = [];
  const threshold = READINESS_WEEKLY_KM_THRESHOLD[raceDistance];
  if (intake.weeklyKm < threshold) {
    reasons.push(
      `your current ${intake.weeklyKm} km/week is below the ${threshold} km/week a prepared ` +
        `${label} block assumes`,
    );
  }
  if (raceDistance === 'marathon' && !hasMarathonLongRunEvidence(intake.recentPerformance)) {
    reasons.push(
      'no recent result at 10K or longer shows the long-run base a marathon block assumes',
    );
  }
  return (
    'This plan takes the first-timer path — a longer aerobic foundation before race-specific ' +
    `work, with long runs held to your level's ceiling — because ${reasons.join(', and ')}.`
  );
}

/** § 8 "Shorter race date", rules 3–4, for a first-timer whose runway is under the research's
 * minimum for the distance. Full preparation is not claimed and fitness is not compressed. */
function limitedPreparationDisclosure(durationWeeks: number, raceDistance: RaceDistance): string {
  const label = distanceLabel(raceDistance);
  const minimum = FIRST_TIMER_MIN_WEEKS[raceDistance];
  return (
    `With ${durationWeeks} weeks to race day, under the ${minimum} weeks a first-timer ${label} ` +
    'build normally needs, this is a safe completion plan rather than full preparation. It keeps ' +
    'the taper and race week and does not try to compress fitness into the time available.'
  );
}

/** Ian-approved 12-week 5K load shape, normalized to the 35 km worked-example baseline. Read by
 * `buildCanonicalFiveKWeek` only — that path is byte-pinned to the fixture and owns its own
 * recovery weeks (4 and 8) by reading these dips directly. */
const FIVE_K_WEEKLY_LOAD = [34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28] as const;
const FIVE_K_LONG_RUNS = [10, 11, 12, 8, 13, 14, 15, 10, 14, 15, 12] as const;

/**
 * The same 12-week shape — same 34 km baseline, same 48 km peak, same 40/28 taper tail — with the
 * interior recovery dips at indices 3 and 7 smoothed into a monotonic ramp, for the generic path.
 *
 * `buildGenericWeek` serves every 5K plan that is not the byte-pinned 12-week/4-day fixture, and
 * every no-race/duration plan (`curvesForDistance` returns the 5K shape for `undefined` too). That
 * path derives recovery weeks from `deloadEveryWeeks` and sizes them with `deloadVolume`, so a
 * dip encoded at a fixed array position collides with it exactly as it did for the other three
 * distances: the dip lands on a week that is not flagged `isDeload`, becomes `lastLoadingWeekKm`,
 * and throttles every week after it off an artificially low base. Same defect, same fix as
 * `TEN_K_/HALF_/MARATHON_WEEKLY_LOAD`; `FIVE_K_WEEKLY_LOAD` above is left untouched because the
 * golden path reads its dips deliberately and is pinned to them.
 */
const FIVE_K_WEEKLY_LOAD_GENERIC = [34, 35, 37, 38, 40, 41, 43, 44, 46, 48, 40, 28] as const;

/**
 * Distance-specific canonical shapes for 10K, half marathon, and marathon — replacing the bug
 * fixed here (core-purpose audit, `v22-distance-specific-plans`): every distance except the
 * byte-pinned golden 5K fixture read `FIVE_K_WEEKLY_LOAD`/`FIVE_K_LONG_RUNS`, scaled by the
 * runner's own weekly km. A 50 km/week marathon runner was never asked to run beyond ~21 km
 * (`15 × 50/35`, `FIVE_K_LONG_RUNS`'s own peak) because there was no marathon curve — only a 5K
 * curve wearing a marathon's phase weights.
 *
 * Each array is normalized to the same 35 km/week reference runner as the 5K arrays above — not a
 * distance-specific baseline — so `targetVolumeKm`/`targetLongRunKm`'s existing
 * `canonical * (startingWeeklyKm / 35)` scaling needs no second parameter. What actually
 * distinguishes a distance is the *shape*: canonical week count (12/14/16/24, `plan-blueprint-
 * examples.md` § "Resolved for the V1 library"), and — the part that fixes the bug — the long
 * run's share of weekly volume at its peak, which the research's long-run ladder
 * (`plan-blueprint-examples.md` § 9) and worked Examples B/C/D put at roughly 33% (10K), 40%
 * (half), and over 50% (marathon), climbing well past the 5K fixture's own ~31%. That share is
 * intentionally above what `loadRules.ts`'s level-based `LONG_RUN_SHARE_CAP`/`MAX_SINGLE_RUN_KM`
 * were originally calibrated for — those ceilings were level-based only, not distance-based, and
 * this file does not loosen them itself (CLAUDE.md: "do not undo the caps"). The curve sets an
 * honest, distance-appropriate *target*; `clampLongRun` still has the final word, exactly as it
 * already does for the 5K curve. The distance-vs-level ceiling gap this surfaced (a marathon long
 * run capped below even the pre-fix stretched-5K-curve output at common run counts) is fixed at
 * the `loadRules.ts` layer, not here — see `longRunShareCap`'s and `maxSingleRunKm`'s own comments
 * for the distance-aware mechanism and the captain's resulting 35% share ruling. The separate
 * absolute-distance calibration remains pending there.
 *
 * The week-type/position architecture below (ENTRY, LOAD-1/2/3, HOLD, TAPER, RACE-WEEK) follows
 * `plan-blueprint-examples.md` §§ 5, 11–14's already-resolved canonical durations. RECOVERY is
 * deliberately NOT among them: these three weekly-volume curves carry no recovery dips of their
 * own, because the generic path already derives recovery weeks independently from
 * `deloadEveryWeeks` and sizes them with `deloadVolume`. A second, fixed-cadence dip pattern
 * inside the curve collided with that whenever a runner's real cadence (3 weeks for advanced and
 * for 50+, 4 otherwise) did not line up with the array's positions — the dip landed on a week
 * that was not flagged `isDeload`, became the growth base, and throttled the rest of the plan.
 * The LONG_RUN arrays keep their dips: there is no separate deload formula for the long run the
 * way `deloadVolume` is one for weekly volume. The exact per-week
 * *workout content* in that same document (§§ 11–14's Q1/Q2 dose tables) is explicitly NOT
 * implemented here — that document's own status line marks it "coach-review source... not yet
 * application behavior" with Ian's review and "translation into code" both still unchecked. Only
 * the volume/long-run shape is taken from it; workout selection still comes from this file's
 * existing phase-based tempo/interval logic, unchanged.
 */
const TEN_K_WEEKLY_LOAD = [30, 32, 34, 36, 38, 40, 42, 43, 44, 45, 46, 47, 36, 26] as const;
/** No entry for week 14 (race week has no scheduled long run) — same convention as `FIVE_K_LONG_RUNS`. */
const TEN_K_LONG_RUNS = [9, 10, 11, 8, 12, 13, 14, 10, 14, 16, 17, 12, 11] as const;

const HALF_WEEKLY_LOAD = [30, 32, 34, 36, 38, 40, 41, 43, 44, 45, 46, 47, 48, 49, 37, 27] as const;
const HALF_LONG_RUNS = [10, 11, 12, 9, 13, 14, 15, 11, 16, 17, 18, 14, 19, 20, 15] as const;

const MARATHON_WEEKLY_LOAD = [
  29, 30, 32, 33, 34, 36, 37, 38, 40, 41, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 40, 32, 24,
] as const;
/**
 * `MARATHON_LONG_RUNS`' peak sits in a several-week-wide plateau (weeks 17–21, indices 16–20:
 * 22/23/24/22/25) rather than a single spike. `interpolateCanonical` linearly samples this array
 * at whatever position a plan's actual `durationWeeks` maps to — a race date can produce anything
 * from a handful of weeks to well over 24 — and a single-week spike is a near-miss for almost
 * every duration except the canonical one itself. A wide plateau means a compressed or stretched
 * plan still lands its final long runs inside the genuinely-marathon-specific range instead of
 * skimming past it. (An earlier revision of this file used single-week spikes for all three new
 * long-run curves and shipped a 16-week/50 km-a-week marathon plan whose peak long run undercut
 * even the 5K curve it was replacing — caught before merge by generating and inspecting real plan
 * output, not by the unit tests alone; see `docs/change_log.md`.)
 */
const MARATHON_LONG_RUNS = [
  10, 11, 12, 9, 13, 14, 15, 11, 16, 17, 18, 14, 19, 20, 21, 16, 22, 23, 24, 22, 25, 18, 14,
] as const;

/**
 * Picks the canonical shape for a distance. Absent distance (no target named at all) keeps the
 * shape that is closest to what existed before this file — the 5K curve.
 *
 * `goldenFiveKShape` distinguishes the only two callers that pass `'5k'`: `buildCanonicalFiveKWeek`
 * (true) needs the byte-pinned, dipped `FIVE_K_WEEKLY_LOAD`, while `buildGenericWeek` (false, the
 * default) needs the de-dipped generic curve because it owns recovery through `deloadEveryWeeks`.
 * The distance argument alone cannot tell them apart — both pass `'5k'`.
 */
function curvesForDistance(
  raceDistance: RaceDistance | undefined,
  goldenFiveKShape = false,
): {
  weeklyLoad: readonly number[];
  longRuns: readonly number[];
} {
  switch (raceDistance) {
    case '10k':
      return { weeklyLoad: TEN_K_WEEKLY_LOAD, longRuns: TEN_K_LONG_RUNS };
    case 'half':
      return { weeklyLoad: HALF_WEEKLY_LOAD, longRuns: HALF_LONG_RUNS };
    case 'marathon':
      return { weeklyLoad: MARATHON_WEEKLY_LOAD, longRuns: MARATHON_LONG_RUNS };
    case '5k':
    case undefined:
      return {
        weeklyLoad: goldenFiveKShape ? FIVE_K_WEEKLY_LOAD : FIVE_K_WEEKLY_LOAD_GENERIC,
        longRuns: FIVE_K_LONG_RUNS,
      };
  }
}
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
 * Both paths use it. At the golden fixture's own 35 km baseline the share and the old subtraction
 * agree exactly (28 - 10 = 18 = 28 × 18/28), so that byte-locked plan is unchanged — but away from
 * that baseline the subtraction bit `buildCanonicalFiveKWeek` too, and the claim that a 5K race day
 * is small enough for it never to matter was simply wrong: a 12 km/wk beginner's 5K race week
 * rendered `1 km | 1 km | 1 km | Race Day 10 km`, the same 1 km-filler signature the audit reported
 * for the marathon. The share is what makes the fixture's own race week reproducible at every other
 * declared volume instead of only at 35 km.
 *
 * The ratio alone is not enough for a long race, because it is read off a race-*inclusive* 5K
 * total and the race day is then stacked on top of it uncounted: a marathon's 47 km race day is
 * larger than the whole scaled race-week entry, so the assembled week outgrew the block it is
 * meant to taper from. `preRaceBudgetKm` below is the bound that actually holds that line —
 * the pre-race training budget is additionally capped at the plan's own peak training week minus
 * race day. Where that leaves too little for every planned pre-race day to get a real shakeout,
 * days are dropped to rest rather than shrunk into filler; see `preRaceSchedule`, which also
 * documents the single exception where the peak bound yields to one 2 km shakeout.
 */
const RACE_WEEK_PRE_RACE_SHARE =
  (FIVE_K_WEEKLY_LOAD[FIVE_K_WEEKLY_LOAD.length - 1] -
    (RACE_DISTANCE_KM['5k'] + RACE_DAY_PADDING_KM)) /
  FIVE_K_WEEKLY_LOAD[FIVE_K_WEEKLY_LOAD.length - 1];

/** Shortest distance that still reads as a real shakeout rather than `distributeDistance` filler. */
const MIN_PRE_RACE_RUN_KM = 2;

/**
 * The pre-race training budget: the smaller of what the taper curve prescribes and what the
 * plan's own peak training week leaves once race day is paid for. Race day is a fixed cost the
 * runner cannot shrink, so it is subtracted from the peak first and the tapered training
 * component takes what is left. Both bounds are hard — the result never exceeds either — so race
 * week's total can only exceed the peak by race day itself, never by training the engine added.
 *
 * `peakTrainingWeekKm` is the largest week the plan has already assembled; race week is always
 * the plan's last week, so by the time this runs it is the true peak. It is 0 only for a
 * one-week plan, where there is no peak to measure against and the ratio governs alone.
 *
 * There is deliberately no per-day floor raising this number. An earlier revision had one, to
 * avoid the 1 km filler days the §1.4 race-week bug produced — but a floor that scales with the
 * requested day count and outranks the peak bound is just the peak bound not holding.
 * `preRaceSchedule` resolves the same problem from the other side, by dropping pre-race *days*
 * to rest until the days that remain can each take a real shakeout.
 */
function preRaceBudgetKm(args: {
  desiredVolumeKm: number;
  raceDayKm: number;
  peakTrainingWeekKm: number;
}): number {
  const { desiredVolumeKm, raceDayKm, peakTrainingWeekKm } = args;
  const ratioKm = Math.round(desiredVolumeKm * RACE_WEEK_PRE_RACE_SHARE);
  const headroomKm = peakTrainingWeekKm > 0 ? peakTrainingWeekKm - raceDayKm : ratioKm;
  return Math.max(0, Math.min(ratioKm, headroomKm));
}

/**
 * Turns the budget into a day count and the volume those days actually share.
 *
 * A sub-2 km run the day before a race is noise with a distance attached, not training — it is
 * the exact signature the §1.4 race-week bug left behind, and `planTemplates.genericLongRun.
 * test.ts` treats it as a defect. So when the budget cannot give every requested pre-race day a
 * real shakeout, the surplus days become genuine rest instead of filler runs: a 12 km/week runner
 * training six days a week has a 5 km pre-race budget (their 15 km peak training week minus a
 * 10 km race day), which affords `floor(5 / 2) = 2` days, so they get runs of 3 km and 2 km and
 * four rest days before their 5K, not five runs of `[2, 1, 1, 1, 1]`.
 *
 * **The one place the peak bound yields.** If the budget cannot fund even a single 2 km shakeout,
 * one is scheduled anyway. That regime is a runner whose race day alone already meets or exceeds
 * their biggest training week — a 10 km/week beginner's first 5K, where race day plus warm-up and
 * cool-down is 10 km — and for them the alternative is a race week containing no running but the
 * race itself, which is not a taper, it is an omission. The overshoot is bounded at exactly one
 * `MIN_PRE_RACE_RUN_KM` run and cannot grow with day count; every other pre-race day is still
 * dropped to rest. Above that regime the peak bound is absolute.
 */
function preRaceSchedule(
  budgetKm: number,
  requestedEasyCount: number,
): { dayCount: number; budgetKm: number } {
  if (requestedEasyCount <= 0) return { dayCount: 0, budgetKm: 0 };
  const affordableDays = Math.floor(budgetKm / MIN_PRE_RACE_RUN_KM);
  if (affordableDays < 1) return { dayCount: 1, budgetKm: MIN_PRE_RACE_RUN_KM };
  const dayCount = Math.min(requestedEasyCount, affordableDays);
  return { dayCount, budgetKm };
}

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

/** Re-export so callers can reach the type from the engine; it lives in `planTypes.ts` so
 * `loadRules.ts` stays pure. */
export type { ReadinessPath } from './planTypes';

/**
 * The research's two race-entry paths (`report-source.md`'s Executive Answer): a first-timer
 * needs more aerobic foundation before race-specific work, a prepared runner can spend more of
 * the same block on it. `racePhaseWeights` is already tuned against Examples A–D, each an
 * explicitly "prepared intermediate" runner — so `prepared` leaves it untouched, and only
 * `first-timer` reallocates weight from `peak` into `base`. The 0.4 shift factor is this file's
 * own reasonable read of "extend the foundation" (the research gives no exact figure), not a
 * sourced coaching number. Filed for the captain's ruling as GitHub issue #100.
 */
function readinessAdjustedWeights(weights: number[], readiness: ReadinessPath): number[] {
  if (readiness === 'prepared') return weights;
  const [base, build, peak, taper] = weights;
  const shift = peak * 0.4;
  return [base + shift, build, peak - shift, taper];
}

/**
 * Whether the runner has already demonstrated what the research's "prepared runner entering a
 * race-specific block" examples assume (Examples A–D's illustrative intakes), or needs the
 * longer "first timer / base not yet established" path instead. Driven only by current
 * demonstrated capacity — `weeklyKm` and, for marathon, whether `recentPerformance` shows a
 * distance that implies the long-run base a marathon block assumes (Example D: "longest run in
 * the last 30 days at least 16–20 km"; intake has no dedicated longest-run field, so a recent
 * performance at 10K or longer is this file's best available proxy for it) — **never
 * `goalTimeSec`**, per this task's explicit requirement (mirrors `deriveTrainingPaces` already
 * reading capacity, never ambition, for pace). The exact km thresholds are this implementation's
 * own reasonable read of Examples A–D's illustrative intake ranges, not a sourced coaching
 * number — the research gives ranges, not cutoffs.
 */
export const READINESS_WEEKLY_KM_THRESHOLD: Record<RaceDistance, number> = {
  '5k': 15,
  '10k': 25,
  half: 35,
  marathon: 45,
};

/**
 * The lower end of the research's first-timer duration ranges (`plan-blueprint-examples.md`
 * § "Research duration ranges behind the examples": 12–16 weeks for 5K/10K, 16–20 for half and
 * marathon). A first-timer whose runway is shorter than this cannot be given full preparation, and
 * § 8's "Shorter race date" rules say what the plan must do instead: keep the taper and race week,
 * retain preparation rather than compress fitness, and say so — "the plan becomes a safe
 * completion/tune-up plan rather than pretending full preparation is possible."
 */
export const FIRST_TIMER_MIN_WEEKS: Record<RaceDistance, number> = {
  '5k': 12,
  '10k': 12,
  half: 16,
  marathon: 16,
};

function hasMarathonLongRunEvidence(recentPerformance: Performance | undefined): boolean {
  if (!recentPerformance) return false;
  return (
    recentPerformance.distance === '10k' ||
    recentPerformance.distance === 'half' ||
    recentPerformance.distance === 'marathon'
  );
}

export function deriveReadinessPath(intake: IntakeResponses, raceDistance: RaceDistance): ReadinessPath {
  if (intake.weeklyKm < READINESS_WEEKLY_KM_THRESHOLD[raceDistance]) return 'first-timer';
  if (raceDistance === 'marathon' && !hasMarathonLongRunEvidence(intake.recentPerformance)) {
    return 'first-timer';
  }
  return 'prepared';
}

function allocatePhaseCounts(
  durationWeeks: number,
  raceDistance: RaceDistance | undefined,
  isRacePlan: boolean,
  readiness: ReadinessPath,
): number[] {
  const baseWeights = isRacePlan && raceDistance
    ? racePhaseWeights(raceDistance)
    : generalPhaseWeights(raceDistance);
  // Readiness only applies to an actual race entry — a no-race/duration block has no "entering a
  // race-specific block" decision to make, so it keeps the unadjusted weights untouched.
  const weights = isRacePlan ? readinessAdjustedWeights(baseWeights, readiness) : baseWeights;
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
  readiness: ReadinessPath,
): Phase[] {
  const names: Phase[] = ['base', 'build', 'peak', 'taper'];
  return allocatePhaseCounts(durationWeeks, raceDistance, isRacePlan, readiness).flatMap(
    (count, index) => Array.from({ length: count }, () => names[index]),
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
 * Every canonical curve in this file is a **race** shape: its last entries are that distance's
 * taper, the deliberate wind-down into race day. When `FIVE_K_WEEKLY_LOAD`/`FIVE_K_LONG_RUNS` were
 * the only curves, every plan's volume was interpolated from them, which meant a plan with no race
 * still wound down at the end — a runner
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
  // Same two weeks — the generic curve keeps the taper tail unchanged.
  [FIVE_K_WEEKLY_LOAD_GENERIC, 2],
  // The same two weeks, minus race week, which has no long run of its own.
  [FIVE_K_LONG_RUNS, 1],
  // 10K: weeks 13 (taper) and 14 (race).
  [TEN_K_WEEKLY_LOAD, 2],
  [TEN_K_LONG_RUNS, 1],
  // Half: weeks 15 (taper) and 16 (race).
  [HALF_WEEKLY_LOAD, 2],
  [HALF_LONG_RUNS, 1],
  // Marathon: weeks 22/23 (two-week disciplined taper, `plan-blueprint-examples.md` § "Resolved
  // for the V1 library") and 24 (race).
  [MARATHON_WEEKLY_LOAD, 3],
  // Both taper weeks still carry a (reduced) long run — only race week has none — so 2, not 3.
  [MARATHON_LONG_RUNS, 2],
]);

function taperAwareCurve(values: readonly number[], includeTaper: boolean): readonly number[] {
  if (includeTaper) return values;
  const taperEntries = TAPER_ENTRIES.get(values);
  if (taperEntries === undefined) {
    throw new Error('taperAwareCurve: no taper length registered for this canonical curve.');
  }
  return endOnPeak(values.slice(0, values.length - taperEntries));
}

/**
 * Dropping the taper is not enough on its own: a curve may still end on one of its own recovery
 * dips, and a no-race plan that finishes on a dip winds down for a start line that does not exist
 * — the same defect `taperAwareCurve` exists to prevent, one week earlier, and the same captain's
 * ruling (2026-08-15) that a no-race plan never ends on a deload. The weekly-load curves were
 * de-dipped by hand for it; `TEN_K_LONG_RUNS` was the one curve left whose 4-week dip cadence
 * lands on its last pre-taper entry, where the other three distances all place their peak.
 *
 * No number is invented here either: trailing entries below the block's own peak are dropped, so
 * a no-race plan interpolates across the loading block and finishes at the peak the captain
 * already approved. It is a no-op for every other canonical curve, each of which already ends on
 * its maximum once the taper tail is removed. Race plans never reach this path.
 */
function endOnPeak(values: readonly number[]): readonly number[] {
  const peak = Math.max(...values);
  let end = values.length;
  while (end > 1 && values[end - 1] < peak) end -= 1;
  return end === values.length ? values : values.slice(0, end);
}

function targetVolumeKm(
  startingWeeklyKm: number,
  weekIndex: number,
  durationWeeks: number,
  includeTaper: boolean,
  raceDistance: RaceDistance | undefined,
  goldenFiveKShape = false,
): number {
  const canonical = interpolateCanonical(
    taperAwareCurve(curvesForDistance(raceDistance, goldenFiveKShape).weeklyLoad, includeTaper),
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
 * Per-workout structural floors (a quality session's own minimum, the long run's own candidate,
 * `distributeDistance`'s 1 km/session floor) can each be individually reasonable yet still stack
 * past `targetKm`. This is the last-mile attempt to bring the assembled, user-visible total back
 * to the clamped target without deleting a scheduled session.
 *
 * It must not re-open the share cap the clamp loop just closed, which a proportional rescale did:
 * flooring each workout independently overshot downward, so the week's total fell further than the
 * long run did and the long run's share of it climbed back over the ceiling (a 5-day advanced
 * 20 km/wk week rendered a 6 km long run in a 17 km week — 35.3% against a 35.0% cap). So it
 * removes whole kilometres one at a time, largest first, from everything that is not the long run,
 * and only starts on the long run once every other session is down to its 1 km floor. Removing
 * whole-kilometre overshoot normally lands the week on `targetKm` rather than under it, which is
 * what keeps the ratio the loop measured intact. If `targetKm` is smaller than the number of
 * scheduled sessions, the 1 km/session floor makes some overshoot unavoidable; the function
 * leaves those sessions at their existing floor. This preserves the established tiny-deload
 * behavior instead of silently dropping runs.
 */
function reconcileVolumeToTarget(workouts: Workout[], targetKm: number): Workout[] {
  const distances = workouts.map((workout) => workout.distanceKm ?? 0);
  let total = distances.reduce((sum, km) => sum + km, 0);
  if (total <= targetKm) return workouts;

  const trimLargest = (eligible: (index: number) => boolean): boolean => {
    let pick = -1;
    for (let i = 0; i < workouts.length; i += 1) {
      if (workouts[i].distanceKm === undefined || !eligible(i)) continue;
      if (distances[i] > 1 && (pick === -1 || distances[i] > distances[pick])) pick = i;
    }
    if (pick === -1) return false;
    distances[pick] -= 1;
    total -= 1;
    return true;
  };

  while (total > targetKm && trimLargest((i) => workouts[i].isLongRun !== true)) {
    // Non-long-run sessions absorb the overshoot first.
  }
  while (total > targetKm && trimLargest(() => true)) {
    // Only once everything else sits on its floor does the long run give ground.
  }

  return workouts.map((workout, index) =>
    workout.distanceKm === undefined ? workout : { ...workout, distanceKm: distances[index] },
  );
}

function targetLongRunKm(
  startingWeeklyKm: number,
  weekIndex: number,
  durationWeeks: number,
  maxSingleRunKm: number,
  includeTaper: boolean,
  raceDistance: RaceDistance | undefined,
  goldenFiveKShape = false,
): number {
  // A race plan's final week is race day, so it has no scheduled long run; a no-race plan trains
  // through to the end and does.
  const scheduledLongRunWeeks = Math.max(1, includeTaper ? durationWeeks - 1 : durationWeeks);
  const longRunWeekIndex = Math.min(weekIndex, scheduledLongRunWeeks - 1);
  const canonical = interpolateCanonical(
    taperAwareCurve(curvesForDistance(raceDistance, goldenFiveKShape).longRuns, includeTaper),
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
 * Per-easy-run ceiling on the generic path: the week's own safety-clamped long run, exactly.
 *
 * The share cap bounds the week's longest run as a quantity, not the session that happens to carry
 * the `LR` label, so an easy day may not outgrow the clamped long run either. Two earlier shapes
 * were both wrong. `longDistanceKm * 0.8` (still the canonical path's own literal) caps a week's
 * absorbable volume at `1.8 x longRun + quality`, so once `clampLongRun` shortens the long run the
 * week can no longer reach its target and the shortfall becomes the next week's growth base —
 * the observed spiral. Fixing that by freezing a `longDistanceKm - 1` ceiling at the *pre*-clamp
 * candidate cured the spiral but left the easy days bounded by a long run that no longer existed,
 * so they could ship longer than the one that did.
 *
 * A ceiling equal to the final long run needs neither workaround. Ties are allowed — nothing
 * requires an easy day to be strictly shorter — and the run-count ladder's own reachability
 * property (`cap x runCount > 1`) is what guarantees `runCount` runs at this ceiling can still
 * cover the week's target, so the clamp cannot chase itself downward.
 *
 * The canonical 5K path is not routed through here: that plan is coach-authored and byte-pinned,
 * so nothing here reshapes it; it is verified against the same caps instead, by
 * `planTemplates.longRunCap.test.ts`.
 */
function easyRunCapKm(longDistanceKm: number): number {
  return Math.max(1, longDistanceKm);
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

/**
 * `padMissing: false` covers the caller that deliberately schedules fewer runs than the runner
 * asked for: race week drops pre-race days to rest rather than shrink them below a real shakeout,
 * so padding the gap back out with 1 km filler would undo that day-dropping. Every other caller
 * assembles exactly `runCount` workouts and keeps the padding as a safety net.
 */
function placeWorkouts(
  workouts: Workout[],
  daysPerWeek: number,
  options: { padMissing?: boolean } = {},
): Week7<Day> {
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
  if (options.padMissing !== false) {
    while (selected.length < runCount) {
      selected.unshift({
        kind: 'run',
        effort: 'easy',
        label: 'ER',
        distanceKm: 1,
        effortDescription: EASY_DESCRIPTION,
      });
    }
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
  // Race week can deliberately contain fewer workouts than the normalized layout after
  // `preRaceSchedule` drops unaffordable runs. Keep the surviving pre-race block in order, but
  // right-align it into the latest open slots so SR remains the final workout before race day.
  const easySlots =
    raceDay && options.padMissing === false ? openSlots.slice(-easy.length) : openSlots;
  easy.forEach((workout, index) => reserve(easySlots[index], workout));
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
    targetVolumeKm(intake.weeklyKm, weekIndex, durationWeeks, true, '5k', true),
    weekNumber,
    injuryReductionPct,
    redFlagReductionPct,
  );

  if (isRaceWeek) {
    const race = raceDayWorkout('5k');
    const nonRaceKm = Math.max(3, Math.round(desiredVolumeKm * RACE_WEEK_PRE_RACE_SHARE));
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
      targetLongRunKm(intake.weeklyKm, weekIndex, durationWeeks, maxSingleRunKm, true, '5k', true),
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
  /** `deriveReadinessPath`'s verdict; `'prepared'` for a no-race block, where it is unused. */
  readiness: ReadinessPath;
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
  peakTrainingWeekKm: number;
  injuryReductionPct: number;
  redFlagReductionPct: number;
}): Week {
  const {
    weekNumber,
    durationWeeks,
    phase,
    raceDistance,
    isRacePlan,
    readiness,
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
    peakTrainingWeekKm,
    injuryReductionPct,
    redFlagReductionPct,
  } = args;
  // Distance-aware, not the flat `maxSingleRunKm` param: `Infinity` (non-binding) for a
  // *prepared* marathon intermediate/advanced runner *with a pace* — the two conditions under
  // which the 180-minute time cap and spike guard can genuinely take the absolute ceiling's place,
  // captain-pending beyond that — see `loadRules.ts`'s `maxSingleRunKm`. A runner with no recent
  // time has no pace, so for them the level's own kilometre cap stays in force: it is, with the
  // 35% share cap, what bounds their long run. Used below for the long-run ceiling specifically;
  // the race-week branch's per-easy-run cap a few lines down intentionally keeps the flat param —
  // taper-week easy runs are never marathon-length, so distance-awareness there would be a no-op
  // change. Scoped to `isRacePlan`, matching `deriveReadinessPath`: a duration/no-race block that
  // merely names marathon as an aspirational distance is not a marathon race build, so it keeps
  // the ordinary level-based ceilings.
  const ceilingDistance = isRacePlan ? raceDistance : undefined;
  const singleRunCeilingKm = distanceAwareMaxSingleRunKm(level, ceilingDistance, {
    readiness,
    easyPaceSecPerKm: easyPace?.highSecPerKm,
  });
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
  const rawVolumeKm = targetVolumeKm(
    intake.weeklyKm,
    weekNumber - 1,
    durationWeeks,
    isRacePlan,
    raceDistance,
  );
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
    // the week's budget, it is the thing the week tapers into. See `RACE_WEEK_PRE_RACE_SHARE`
    // for the ratio and `preRaceBudgetKm` for the peak-relative bound that keeps race week's
    // total from outgrowing the block it tapers from.
    const schedule = preRaceSchedule(
      preRaceBudgetKm({
        desiredVolumeKm,
        raceDayKm: race.distanceKm ?? 0,
        peakTrainingWeekKm,
      }),
      easyCount,
    );
    const easyDistances = distributeDistance(schedule.budgetKm, schedule.dayCount, maxSingleRunKm);
    const easyWorkouts = easyDistances.map((distanceKm, index) =>
      index === easyDistances.length - 1
        ? shakeoutRun(distanceKm, density, intake.age, '2 × 30 s Strides @ GP')
        : easyRun({ distanceKm, pace: easyPace, density, age: intake.age }),
    );
    const reconciledEasyWorkouts = reconcileVolumeToTarget(easyWorkouts, schedule.budgetKm);
    const days = placeWorkouts([...reconciledEasyWorkouts, race], schedule.dayCount + 1, {
      padMissing: false,
    });
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
  // Source §6: at three or four running days, keep Q1 and the long run, then spend the remaining
  // slot(s) on easy support. Q2 enters only once the runner has at least five days available.
  const retainedQuality = quality.slice(0, requestedRuns >= 5 ? requestedRuns - 2 : 1);
  const easyCount = Math.max(1, requestedRuns - retainedQuality.length - 1);
  const qualityKm = retainedQuality.reduce(
    (sum, workout) => sum + (workout.distanceKm ?? 0),
    0,
  );
  // Starting guess only — a floor here just picks a sane pre-clamp candidate (the long run
  // should, all else equal, exceed the hardest quality session). The safety loop below may still
  // shrink the result under this per the captain's ruling on `longrun-share-cap-floor`; see there.
  // Deriving this from `retainedQuality` rather than the full `quality` array is the correct
  // reading — a session that is not scheduled should not floor the long run — but it is
  // deliberately deferred to issue #99, because lowering the floor unmasks a separate pre-existing
  // 3-day progression undershoot in which a peak week can render below its own base weeks.
  const longRunStartFloor = quality.reduce(
    (max, workout) => Math.max(max, (workout.distanceKm ?? 0) + 1),
    1,
  );
  const longRunFromCurve = Math.max(
    longRunStartFloor,
    targetLongRunKm(
      intake.weeklyKm,
      weekNumber - 1,
      durationWeeks,
      singleRunCeilingKm,
      isRacePlan,
      raceDistance,
    ),
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
  // week's *rendered* volume after the final easy-run ceiling and volume reconciliation. A
  // provisional distribution can absorb more volume than the rendered one, so clamping against
  // that earlier denominator can still leave the final long-run share over its ceiling. Shrinking
  // the long run shrinks the rendered volume and can reopen the share; the integer map converges in
  // a handful of steps and exits as soon as the clamp stops moving the rendered value.
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
  const shareCap = longRunShareCap(level, requestedRuns, ceilingDistance);
  let longDistanceKm = Math.min(singleRunCeilingKm, longRunFromCurve, longRunVolumeBudget);
  // The easy ceiling tracks `longDistanceKm` on purpose: the ceiling *is* the long run, so the
  // week the loop measures is the week it will render. That is only safe because the ceiling no
  // longer subtracts a kilometre — `runCount` runs at the ceiling always clear the target, per the
  // ladder's reachability property — see `easyRunCapKm`'s own comment for the two earlier shapes
  // and why each failed.
  let reconciledWorkouts: Workout[] = [];
  for (let i = 0; i < 100; i += 1) {
    const easyDistances = distributeDistance(
      desiredVolumeKm - longDistanceKm - qualityKm,
      easyCount,
      easyRunCapKm(longDistanceKm),
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
    reconciledWorkouts = reconcileVolumeToTarget(
      [...easyWorkouts, ...retainedQuality, longRun(longDistanceKm, easyPace, density, intake.age)],
      desiredVolumeKm,
    );
    const renderedLongRun = reconciledWorkouts.find((workout) => workout.isLongRun === true);
    const renderedLongRunKm = renderedLongRun?.distanceKm ?? 0;
    const assembledVolumeKm = reconciledWorkouts.reduce(
      (sum, workout) => sum + (workout.distanceKm ?? 0),
      0,
    );
    const { km } = clampLongRun({
      proposedKm: renderedLongRunKm,
      weeklyKm: assembledVolumeKm,
      level,
      previousLongestKm,
      easyPaceSecPerKm: easyPace?.highSecPerKm,
      isDeload,
      lastLoadingWeekKm,
      shareCapOverride: shareCap,
      roundSpikeCeilingUp: true,
      maxSingleRunKmOverride: singleRunCeilingKm,
    });
    // Floored so a fractional ceiling never leaks into the rendered plan, and floored no lower
    // than 1 km — a real session, matching every other minimum in this file (`distributeDistance`,
    // `easyRunCapKm`) — never back up to `longRunStartFloor`; see the ruling above. Flooring only
    // shrinks the value, so the loop's invariant holds and it still terminates against the actual
    // rendered long run rather than the pre-reconciliation candidate.
    const flooredKm = Math.max(1, Math.floor(km));
    if (flooredKm >= renderedLongRunKm) break;
    longDistanceKm = flooredKm;
  }
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
  const readiness: ReadinessPath =
    isRacePlan && raceDistance ? deriveReadinessPath(params.intake, raceDistance) : 'prepared';
  const phases = phasesForPlan(durationWeeks, raceDistance, isRacePlan, readiness);
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
  let peakTrainingWeekKm = 0;
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
          readiness,
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
          peakTrainingWeekKm,
          injuryReductionPct,
          redFlagReductionPct,
        });
    if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    peakTrainingWeekKm = Math.max(peakTrainingWeekKm, week.volumeKm);
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
    ...(isRacePlan &&
    raceDistance === 'marathon' &&
    normalizedRunCount(params.intake.daysPerWeek) === 3 &&
    level !== 'beginner'
      ? [THREE_DAY_MARATHON_DISCLAIMER]
      : []),
    ...(isRacePlan && raceDistance && readiness === 'first-timer'
      ? [
          firstTimerDisclosure(params.intake, raceDistance),
          ...(durationWeeks < FIRST_TIMER_MIN_WEEKS[raceDistance]
            ? [limitedPreparationDisclosure(durationWeeks, raceDistance)]
            : []),
        ]
      : []),
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
    ...(isRacePlan && raceDistance ? { readinessPath: readiness } : {}),
  };
}
