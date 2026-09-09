/**
 * The Free tier's plan engine — § 20's resolution order, run over the library in `registry.ts`,
 * `calendars.ts` and `injury.ts`.
 *
 * Captain's ruling, 2026-09-06: the V2.2 plan engine splits by tier. **Free users get the 40-plan
 * deterministic library as their entire product**; paying users get the AI curve generator. The
 * library is not a fallback for the generator and not a parameter source for it.
 *
 * Everything numeric here is either a direct read of
 * `planning/research/plan-blueprint-examples.md`, a clamp from `loadRules.ts` (the authoritative
 * safety arithmetic), or one of the six decisions Ian ruled on 2026-09-10, isolated in
 * `openQuestions.ts`. Nothing else. If you need a coaching number that is in none of those three
 * places, it does not exist yet — ask Ian, don't pick one.
 *
 * § 20's own tie-break governs the whole file: "If two rules conflict, the earlier safety decision
 * in this resolution order wins. The output must never silently drop a warning or relabel a
 * reduced plan as full preparation."
 */

import {
  clampLongRun,
  clampWeeklyVolume,
  deloadVolume,
  isUnder18,
  longRunShareCap,
  maxSingleRunKm,
  MAX_WEEKLY_KM,
  toExperienceLevel,
} from '../loadRules';
import { deriveTrainingPaces } from '../paceDerivation';
import { deriveReadinessPath } from '../planTemplates';
import {
  RACE_DISTANCE_KM,
  type Day,
  type GoalType,
  type IntakeResponses,
  type Phase,
  type Plan,
  type RaceDistance,
  type ReadinessPath,
  type RestDay,
  type Tier,
  type Week,
  type Week7,
  type Workout,
} from '../planTypes';
import { LIBRARY_CALENDARS, type LibraryWeek, type QualitySpec } from './calendars';
import {
  composeInjuryEffect,
  declaredInjuries,
  H1_WEEK_1_BASELINE_SHARE,
  H2_RUN_DAYS,
  type InjuryState,
} from './injury';
import {
  bandMidpoint,
  CODE_PRESENTATION,
  INJURY_STATE_WITH_DECLARED_INJURY,
  DEFAULT_RUNNER_PROFILE,
  TWO_QUALITY_TRACKS,
  type LibraryCoverageGap,
} from './openQuestions';
import {
  AGE_FORCING_THREE_WEEK_CADENCE,
  CANONICAL_WEEKS,
  COMPRESSION_FLOOR_WEEKS,
  DOSE_LADDER,
  EXPERIENCE_LIMITS,
  EXPERIENCE_TRACK_FOR_ANSWER,
  EXP_HIGHER_VOLUME_KM,
  LIBRARY_DISTANCE,
  LOAD_3_NEW_MULTIPLIER,
  LONG_RUN_LADDER,
  LONG_RUN_LADDER_FRACTION,
  LONG_RUN_RECOVERY_SHARE,
  PLACEMENT_LAYOUTS,
  REG_LAYOUT_CEILING_WITHOUT_STABILITY_EVIDENCE,
  VOLUME_STATE_TARGETS,
  libraryPlanId,
  type ExperienceTrack,
  type LayoutDays,
  type LibraryDistance,
  type LibraryPlanId,
  type RunnerProfile,
  type VolumeState,
  type WorkoutCode,
} from './registry';

const REST: RestDay = { kind: 'rest' };

// ---------------------------------------------------------------------------
// § 22. Required disclaimers — verbatim, and mandatory on every plan
// ---------------------------------------------------------------------------

/** § 22: "Every plan displays:". Never conditional, never trimmed. */
export const LIBRARY_GENERAL_DISCLAIMER =
  'This is not medical advice. Consult a doctor before starting any training program or if you ' +
  'experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. PACE ' +
  'provides coaching guidance, not medical diagnosis or treatment.';

/** § 22: "Every H1–H4 plan additionally displays:". */
export const LIBRARY_INJURY_DISCLAIMER =
  'If you are experiencing significant pain, swelling, or symptoms that concern you, please seek ' +
  'assessment from a qualified sports medicine professional or physiotherapist before continuing ' +
  'training.';

/** § 16's `H4` output: "Display professional-assessment guidance and preserve the race plan only
 * as inactive future context." */
export const LIBRARY_H4_DISCLAIMER =
  'Your answers describe symptoms that should be assessed before you run again, so this plan ' +
  'contains no running. It is kept as future context only. Seek assessment from a qualified sports ' +
  'medicine professional or physiotherapist, and return through a symptom-free walk and run/walk ' +
  'progression once you are cleared.';

/** § 13's half-marathon completion rules, and § 14's marathon fueling weeks. The template names no
 * products and gives no nutrition advice — § 13 forbids both. */
export const LIBRARY_FUELING_NOTE =
  'Selected long runs are marked for fueling practice: rehearse drinking and eating on the move at ' +
  'the effort you expect on race day. This plan names no products and gives no nutrition advice.';

// ---------------------------------------------------------------------------
// Q4 — arithmetic distribution weights (not coaching doses)
// ---------------------------------------------------------------------------

/**
 * How the week's non-Day-7 kilometres are shared out. These are distribution arithmetic, not
 * physiological doses: § 6 says "All unused weekly distance is distributed across `E/REC`; it never
 * enlarges the physiological dose of Q1 or Q2", and § 3 says `REC` is "shorter than an easy run"
 * and `MLR` is "longer than ordinary easy, shorter than Day 7". The weights below are the smallest
 * encoding of exactly those two orderings. See `openQuestions.ts` Q4.
 */
const SLOT_WEIGHT = { REC: 0.7, E: 1, Q: 1, MLR: 1.4 } as const;

/** § 12/§ 14 race week: "Two or three short easy runs". */
const RACE_WEEK_MAX_SHAKEOUTS = 3;

/** A race-week shakeout is half an ordinary easy run of the preceding week — derived from the plan
 * itself rather than a new number, and what makes "short easy runs" short. */
const RACE_WEEK_SHAKEOUT_SHARE = 0.5;

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface LibraryPlanParams {
  intake: IntakeResponses;
  goalType: GoalType;
  durationWeeks: number;
  raceDistance?: RaceDistance;
  raceDate?: string;
  tierAtGeneration: Tier;
}

/** Every § 20 decision, exposed so a test can assert the order rather than only the output. */
export interface LibraryResolution {
  planId: LibraryPlanId;
  distance: LibraryDistance;
  track: ExperienceTrack;
  profile: RunnerProfile;
  layoutDays: LayoutDays;
  injuryState: InjuryState;
  readiness: ReadinessPath;
  /** Canonical week numbers, in order, one per generated week. § 8's adaptation output. */
  calendarWeeks: readonly number[];
  canonicalWeeks: number;
  isRacePlan: boolean;
  /** § 8 rule 4's floor fired: fewer than four weeks to race day. */
  compressed: boolean;
  /** § 8/§ 9: preparation is reported as limited rather than disguised. */
  limitedPreparation: boolean;
  deloadCadenceWeeks: number;
}

export type LibraryPlanResult =
  | { ok: true; plan: Plan; resolution: LibraryResolution }
  | { ok: false; gap: LibraryCoverageGap };

// ---------------------------------------------------------------------------
// § 20 step 4/5/6 — track, layout, profile
// ---------------------------------------------------------------------------

/**
 * § 6's per-track layout rules. "`NEW` uses only the 3- or 4-day layouts. A higher availability
 * answer creates rest days, not extra running." `REG` requesting six is Q4's clamp.
 */
export function resolveLayoutDays(track: ExperienceTrack, requested: number): LayoutDays {
  const rounded = Math.round(requested);
  const ceiling: number =
    track === 'NEW' ? 4 : track === 'SOME' ? 5 : track === 'REG'
      ? REG_LAYOUT_CEILING_WITHOUT_STABILITY_EVIDENCE
      : track === 'EXP' ? 6 : 7;
  const clamped = Math.min(ceiling, Math.max(3, rounded));
  return clamped as LayoutDays;
}

/** § 10's recovery-cadence overlay. */
export function resolveDeloadCadence(
  track: ExperienceTrack,
  age: number,
  weeklyKm: number,
): number {
  if (age >= AGE_FORCING_THREE_WEEK_CADENCE) return 3;
  if (track === 'COMP') return 3;
  if (track === 'EXP' && weeklyKm >= EXP_HIGHER_VOLUME_KM) return 3;
  return EXPERIENCE_LIMITS[track].defaultDeloadWeeks;
}

/** § 4's quality policy, read through Q4's ruling that "eligible" is `EXP` and `COMP` only. */
function allowsTwoQuality(track: ExperienceTrack): boolean {
  return TWO_QUALITY_TRACKS.includes(track);
}

function meetsFloor(track: ExperienceTrack, floor: ExperienceTrack): boolean {
  const order: ExperienceTrack[] = ['NEW', 'SOME', 'REG', 'EXP', 'COMP'];
  return order.indexOf(track) >= order.indexOf(floor);
}

// ---------------------------------------------------------------------------
// § 20 step 3 — duration adaptation (§ 8)
// ---------------------------------------------------------------------------

/**
 * Maps the requested plan length onto an ordered list of canonical week numbers.
 *
 * § 8's rules, in the document's own order. The one judgement it does not make — what counts as
 * "already demonstrates the required base" — is Q3's provisional resolution: `deriveReadinessPath`'s
 * captain-approved `prepared` verdict.
 */
export function adaptCalendar(args: {
  distance: LibraryDistance;
  weeks: number;
  isRacePlan: boolean;
  readiness: ReadinessPath;
}): { calendarWeeks: number[]; compressed: boolean } {
  const calendar = LIBRARY_CALENDARS[args.distance];
  const canonical = CANONICAL_WEEKS[args.distance];
  const weeks = Math.max(1, Math.round(args.weeks));

  // § 8 "No target race date": the base/build portion only, no `RACE`, no race-week taper.
  if (!args.isRacePlan) {
    const pool = calendar
      .filter((week) => week.state !== 'TAPER-1' && week.state !== 'TAPER-2' && week.state !== 'RACE-WEEK')
      .map((week) => week.week);
    const chosen: number[] = [];
    for (let i = 0; i < weeks; i += 1) chosen.push(pool[i % pool.length]!);
    // "finish on a loading or consolidation week rather than a recovery week"
    let last = chosen.length - 1;
    while (last >= 0 && calendar[chosen[last]! - 1]!.state === 'RECOVERY') {
      const replacement = pool
        .slice(0, pool.indexOf(chosen[last]!))
        .reverse()
        .find((weekNumber) => calendar[weekNumber - 1]!.state !== 'RECOVERY');
      if (replacement === undefined) break;
      chosen[last] = replacement;
      last -= 1;
    }
    return { calendarWeeks: chosen, compressed: false };
  }

  const raceWeek = canonical;
  const taperWeeks = calendar
    .filter((week) => week.state === 'TAPER-1' || week.state === 'TAPER-2')
    .map((week) => week.week);

  if (weeks === canonical) {
    return { calendarWeeks: calendar.map((week) => week.week), compressed: false };
  }

  // § 8 "Shorter race date" rule 4: under four weeks, easy running, one brief event-specific
  // reminder if already tolerated, and taper/race. No compression of fitness.
  if (weeks < COMPRESSION_FLOOR_WEEKS) {
    const tail = [taperWeeks[taperWeeks.length - 1]!, raceWeek].slice(-Math.min(2, weeks));
    const head: number[] = [];
    for (let i = 0; i < weeks - tail.length; i += 1) head.push(1);
    return { calendarWeeks: [...head, ...tail], compressed: true };
  }

  if (weeks < canonical) {
    // Rules 1–3: never delete race week or the final taper exposure. A `prepared` runner loses the
    // early repeated loading weeks; a `first-timer` keeps preparation and loses the later ambitious
    // weeks instead, so the plan becomes a safe completion plan rather than a pretend one.
    const protectedWeeks = new Set<number>([raceWeek, ...taperWeeks]);
    const removable = calendar
      .map((week) => week.week)
      .filter((weekNumber) => !protectedWeeks.has(weekNumber));
    const order =
      args.readiness === 'prepared'
        ? removable
        : [...removable].reverse();
    const drop = new Set(order.slice(0, canonical - weeks));
    return {
      calendarWeeks: calendar.map((w) => w.week).filter((weekNumber) => !drop.has(weekNumber)),
      compressed: false,
    };
  }

  // § 8 "Longer race date": prepend `ENTRY/LOAD/RECOVERY` base cycles before canonical Week 1.
  // Only aerobic foundation weeks are repeated — never peak or taper.
  const baseCycle = calendar
    .filter((week) => week.week <= 4)
    .map((week) => week.week);
  const extra = weeks - canonical;
  const prefix: number[] = [];
  for (let i = 0; i < extra; i += 1) {
    prefix.push(baseCycle[(baseCycle.length - 1 - (i % baseCycle.length)) % baseCycle.length]!);
  }
  prefix.reverse();
  return { calendarWeeks: [...prefix, ...calendar.map((week) => week.week)], compressed: false };
}

// ---------------------------------------------------------------------------
// § 20 step 9 — weekly-volume state machine (§ 5)
// ---------------------------------------------------------------------------

function targetForState(args: {
  state: VolumeState;
  track: ExperienceTrack;
  baselineKm: number;
  lastLoadingKm: number;
  peakLoadingKm: number;
}): number {
  const { state, baselineKm, lastLoadingKm, peakLoadingKm } = args;
  const spec = VOLUME_STATE_TARGETS[state];
  const previous = lastLoadingKm > 0 ? lastLoadingKm : baselineKm;
  const peak = peakLoadingKm > 0 ? peakLoadingKm : previous;

  switch (state) {
    case 'ENTRY':
    case 'LOAD-1':
      return baselineKm * (spec.target ?? 1);
    case 'LOAD-2':
      return previous * (spec.target ?? 1.08);
    case 'LOAD-3':
      return previous * (args.track === 'NEW' ? LOAD_3_NEW_MULTIPLIER : (spec.target ?? 1.08));
    case 'HOLD':
      return previous * bandMidpoint(spec.previousLoadingMultiplier ?? [0.95, 1]);
    case 'RECOVERY':
      // Captain 2026-09-06: 15–25% down, target 20%. `deloadVolume` is that same midpoint, and it
      // is the authoritative one — `loadRules.ts` owns the band, not this library.
      return deloadVolume(previous);
    case 'TAPER-1':
    case 'TAPER-2':
    case 'RACE-WEEK':
      return peak * bandMidpoint(spec.peakMultiplier ?? [0.5, 0.5]);
  }
}

// ---------------------------------------------------------------------------
// § 20 step 11 — long-run ladder (§ 9)
// ---------------------------------------------------------------------------

function ladderLongRunKm(args: {
  distance: LibraryDistance;
  track: ExperienceTrack;
  target: LibraryWeek['longRun'];
  easyPaceSecPerKm?: number;
  weeklyKm: number;
  shareCap: number;
  previousLongRunKm: number;
}): number {
  if (args.target === 'RACE') return 0;
  if (args.target === 'LR-recovery') {
    const share = bandMidpoint(LONG_RUN_RECOVERY_SHARE);
    return args.previousLongRunKm > 0
      ? args.previousLongRunKm * share
      : args.weeklyKm * args.shareCap * share;
  }
  const [low, high] = LONG_RUN_LADDER[args.distance][args.track];
  const minutes = low + (high - low) * LONG_RUN_LADDER_FRACTION[args.target];
  if (args.easyPaceSecPerKm !== undefined && args.easyPaceSecPerKm > 0) {
    return (minutes * 60) / args.easyPaceSecPerKm;
  }
  // § 3, "Effort hierarchy when no recent performance exists": no numeric pace exists, so the time
  // ladder cannot be converted to kilometres. The level's share of weekly volume is the ceiling
  // that remains (§ 4's operating limits say so outright), and the ladder still supplies the
  // *shape* — this week's point as a ratio of the track's own peak. That keeps `LR-low` below
  // `LR-peak` without inventing a distance the document does not state. Growth across the plan is
  // governed by `clampLongRun`'s spike ceiling, not by this proposal.
  return args.weeklyKm * args.shareCap * (minutes / high);
}

// ---------------------------------------------------------------------------
// Week construction
// ---------------------------------------------------------------------------

function phaseForState(state: VolumeState, previous: Phase): Phase {
  switch (state) {
    case 'ENTRY':
    case 'LOAD-1':
      return 'base';
    case 'LOAD-2':
    case 'LOAD-3':
      return 'build';
    case 'HOLD':
      return 'peak';
    case 'TAPER-1':
    case 'TAPER-2':
    case 'RACE-WEEK':
      return 'taper';
    case 'RECOVERY':
      return previous;
  }
}

function doseText(spec: QualitySpec, track: ExperienceTrack): string | undefined {
  if (spec.note !== undefined) return spec.note;
  if (spec.dose === undefined) return undefined;
  const text = DOSE_LADDER[spec.dose][track];
  if (text === null) return undefined;
  return spec.halfDose === true ? `Half dose: ${text}` : text;
}

/** § 3 + Q6: turn a library code into a `Workout`, keeping the § 4 dose as the structure string. */
function workoutForCode(args: {
  code: WorkoutCode;
  distanceKm: number;
  structure?: string;
  isLongRun?: boolean;
}): Workout {
  const presentation = CODE_PRESENTATION[args.code];
  return {
    kind: 'run',
    effort: presentation.effort,
    label: presentation.label,
    distanceKm: round1(args.distanceKm),
    effortDescription: presentation.effortDescription,
    ...(args.structure !== undefined ? { structure: args.structure } : {}),
    ...(args.isLongRun === true ? { isLongRun: true } : {}),
  };
}

function round1(km: number): number {
  return Math.round(km * 10) / 10;
}

/**
 * Resolves the week's Q1/Q2 after every gate that can remove them: the recovery-week overlay
 * (§ 6), the track's hard-session cap (§ 2 rule 4), the "Day 7 is quality so Day 5 is easy" rule
 * (§ 2 rule 6 / § 6), the injury removals (§ 17–18), and § 7's conservative-default dose reduction.
 */
function resolveQuality(args: {
  week: LibraryWeek;
  track: ExperienceTrack;
  profile: RunnerProfile;
  layoutDays: LayoutDays;
  injuryRemoved: ReadonlySet<WorkoutCode>;
  singleQualityOnly: boolean;
  injuryState: InjuryState;
}): { q1: QualitySpec | null; q2: QualitySpec | null } {
  const lane = args.profile === 'SPD' ? args.week.spd : args.week.end;
  const limits = EXPERIENCE_LIMITS[args.track];

  // § 16 `H2`/`H3`: easy only — "no quality, hills, strides, fast finish, or race-pace work".
  if (args.injuryState === 'H2' || args.injuryState === 'H3' || args.injuryState === 'H4') {
    return { q1: null, q2: null };
  }

  const usable = (spec: QualitySpec | null): QualitySpec | null => {
    if (spec === null) return null;
    // `HS` is "only when already tolerated"; intake reports no tolerance, so the document's own
    // fallback applies (see `calendars.ts`).
    const resolved =
      spec.requiresPriorTolerance === true && spec.fallback !== undefined ? spec.fallback : spec;
    if (args.injuryRemoved.has(resolved.code)) return null;
    if (resolved.dose !== undefined && DOSE_LADDER[resolved.dose][args.track] === null) return null;
    return resolved;
  };

  let q1 = usable(lane.q1);
  let q2 = usable(lane.q2);

  // § 11 week 8 / § 12 week 12: `REG+` may use a controlled tune-up instead of Q1.
  if (
    args.week.tuneUpInsteadOfQ1MinTrack !== undefined &&
    !meetsFloor(args.track, args.week.tuneUpInsteadOfQ1MinTrack)
  ) {
    q1 = null;
  }

  const q2Allowed =
    q2 !== null &&
    args.week.state !== 'RECOVERY' &&
    args.week.longRunQuality === undefined &&
    args.layoutDays >= 5 &&
    limits.normalQualitySessions >= 2 &&
    !args.singleQualityOnly &&
    (lane.q2Eligibility === 'twoQuality'
      ? allowsTwoQuality(args.track)
      : lane.q2Eligibility === 'REG+'
        ? meetsFloor(args.track, 'REG')
        : lane.q2Eligibility === 'EXP+'
          ? meetsFloor(args.track, 'EXP')
          : lane.q2Eligibility === 'COMP'
            ? args.track === 'COMP'
            : false);

  if (!q2Allowed) q2 = null;
  return { q1, q2 };
}

interface BuiltWeek {
  week: Week;
  longRunKm: number;
}

function buildWeek(args: {
  weekNumber: number;
  totalWeeks: number;
  source: LibraryWeek;
  distance: LibraryDistance;
  raceDistance: RaceDistance;
  isRacePlan: boolean;
  track: ExperienceTrack;
  profile: RunnerProfile;
  layoutDays: LayoutDays;
  weeklyTargetKm: number;
  longRunKm: number;
  previousEasyRunKm: number;
  injuryRemoved: ReadonlySet<WorkoutCode>;
  singleQualityOnly: boolean;
  injuryState: InjuryState;
  phase: Phase;
}): BuiltWeek {
  const layout = PLACEMENT_LAYOUTS[args.layoutDays];
  const { q1, q2 } = resolveQuality({
    week: args.source,
    track: args.track,
    profile: args.profile,
    layoutDays: args.layoutDays,
    injuryRemoved: args.injuryRemoved,
    singleQualityOnly: args.singleQualityOnly,
    injuryState: args.injuryState,
  });

  const isRaceWeek = args.source.longRun === 'RACE' && args.isRacePlan;
  const days: Day[] = [];

  if (isRaceWeek) {
    // § 12/§ 14 race week: "Two or three short easy runs" plus the race on Day 7. The race's own
    // distance is reported in the week total — § 5: "reconciled honestly rather than hidden".
    const shakeoutKm = Math.max(1, args.previousEasyRunKm * RACE_WEEK_SHAKEOUT_SHARE);
    const shakeouts = Math.min(RACE_WEEK_MAX_SHAKEOUTS, args.layoutDays - 1);
    let placed = 0;
    for (let i = 0; i < 6; i += 1) {
      const runnable = layout[i] !== 'REST';
      if (runnable && placed < shakeouts) {
        days.push(workoutForCode({ code: 'REC', distanceKm: shakeoutKm }));
        placed += 1;
      } else {
        days.push(REST);
      }
    }
    days.push({
      ...workoutForCode({ code: 'RACE', distanceKm: RACE_DISTANCE_KM[args.raceDistance] }),
      label: CODE_PRESENTATION.RACE.label,
    });
    const volumeKm = round1(
      days.reduce((sum, day) => sum + (day.kind === 'run' ? (day.distanceKm ?? 0) : 0), 0),
    );
    return {
      week: {
        weekNumber: args.weekNumber,
        totalWeeks: args.totalWeeks,
        phase: args.phase,
        isDeload: false,
        volumeKm,
        days: days as unknown as Week7<Day>,
        },
      longRunKm: 0,
    };
  }

  // Non-race weeks: Day 7 is the long run, and § 2 rule 5 fixes it there.
  const longRunCode: WorkoutCode = args.source.longRunQuality ?? 'LR';
  const longRunStructure =
    args.source.longRunQuality === 'FF'
      ? (DOSE_LADDER['FF-A'][args.track] ?? undefined)
      : args.source.longRunQuality === 'MP'
        ? (DOSE_LADDER['MP-A'][args.track] ?? undefined)
        : undefined;

  // § 16 `H2`: "Day 7 is simply the longest easy session".
  const day7 = workoutForCode({
    code: args.injuryState === 'H2' || args.injuryState === 'H3' ? 'LR' : longRunCode,
    distanceKm: args.longRunKm,
    ...(longRunStructure !== undefined && args.injuryState === 'H0' ? { structure: longRunStructure } : {}),
    isLongRun: true,
  });

  const remainingKm = Math.max(0, args.weeklyTargetKm - args.longRunKm);
  const slots: { index: number; code: WorkoutCode; weight: number; structure?: string }[] = [];
  const stridesDose = args.source.strides;
  const lane = args.profile === 'SPD' ? args.source.spd : args.source.end;
  let easyPlaced = 0;
  let secondStrideUsed = false;

  for (let i = 0; i < 6; i += 1) {
    const slot = layout[i]!;
    if (slot === 'REST') continue;
    if (slot === 'Q1') {
      if (q1 !== null) {
        slots.push({
          index: i,
          code: q1.code,
          weight: SLOT_WEIGHT.Q,
          ...(doseText(q1, args.track) !== undefined ? { structure: doseText(q1, args.track)! } : {}),
        });
      } else {
        slots.push({ index: i, code: 'E', weight: SLOT_WEIGHT.E });
      }
      continue;
    }
    if (slot === 'Q2/E') {
      if (q2 !== null) {
        slots.push({
          index: i,
          code: q2.code,
          weight: SLOT_WEIGHT.Q,
          ...(doseText(q2, args.track) !== undefined ? { structure: doseText(q2, args.track)! } : {}),
        });
      } else {
        slots.push({ index: i, code: 'E', weight: SLOT_WEIGHT.E });
      }
      continue;
    }
    if (slot === 'REC') {
      slots.push({ index: i, code: 'REC', weight: SLOT_WEIGHT.REC });
      continue;
    }
    if (slot === 'E/REC') {
      slots.push({ index: i, code: 'REC', weight: SLOT_WEIGHT.REC });
      continue;
    }
    if (slot === 'E/MLR') {
      slots.push({ index: i, code: 'MLR', weight: SLOT_WEIGHT.MLR });
      continue;
    }
    // `E` and `E + optional ST`. The stride exposure rides Day 1's easy run — Example A's own
    // week does exactly this, and strides are never a standalone session. A recovery week's
    // "optional 4 relaxed strides for `REG+`" and a lane's "second `ST-A` for `REG+`" ride the
    // same way, on Day 1 and on the next easy day respectively.
    const stridesAllowed = !args.injuryRemoved.has('ST') && args.injuryState === 'H0';
    const isFirstEasy = easyPlaced === 0;
    easyPlaced += 1;
    const dose =
      stridesDose !== undefined && (isFirstEasy || !secondStrideUsed)
        ? isFirstEasy
          ? stridesDose
          : lane.extraStridesMinTrack !== undefined && meetsFloor(args.track, lane.extraStridesMinTrack)
            ? stridesDose
            : undefined
        : isFirstEasy &&
            args.source.optionalStridesMinTrack !== undefined &&
            meetsFloor(args.track, args.source.optionalStridesMinTrack)
          ? 'ST-A'
          : undefined;
    if (dose !== undefined && !isFirstEasy) secondStrideUsed = true;
    const strideText = stridesAllowed && dose !== undefined ? DOSE_LADDER[dose][args.track] : null;
    slots.push({
      index: i,
      code: strideText !== null && strideText !== undefined ? 'ST' : 'E',
      weight: SLOT_WEIGHT.E,
      ...(strideText !== null && strideText !== undefined ? { structure: strideText } : {}),
    });
  }

  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0) || 1;
  const built: Day[] = new Array<Day>(7).fill(REST);
  for (const slot of slots) {
    built[slot.index] = workoutForCode({
      code: slot.code,
      distanceKm: (remainingKm * slot.weight) / totalWeight,
      ...(slot.structure !== undefined ? { structure: slot.structure } : {}),
    });
  }
  built[6] = day7;

  const volumeKm = round1(
    built.reduce((sum, day) => sum + (day.kind === 'run' ? (day.distanceKm ?? 0) : 0), 0),
  );

  return {
    week: {
      weekNumber: args.weekNumber,
      totalWeeks: args.totalWeeks,
      phase: args.phase,
      isDeload: args.source.state === 'RECOVERY',
      volumeKm,
      days: built as unknown as Week7<Day>,
    },
    longRunKm: args.longRunKm,
  };
}

// ---------------------------------------------------------------------------
// § 20. The resolution order
// ---------------------------------------------------------------------------

/**
 * Q5, ruled 2026-09-10: any declared injury maps to `H1` and § 15's six-field injury intake is not
 * required before Free ships. Isolated in one function so that intake, when it lands, replaces
 * exactly this. `H2`–`H4` are implemented and tested but unreachable from live intake, because
 * nothing the app currently collects can evidence them.
 */
export function deriveInjuryState(
  injuries: readonly IntakeResponses['injuries'][number][],
): InjuryState {
  return declaredInjuries(injuries).length === 0
    ? 'H0'
    : INJURY_STATE_WITH_DECLARED_INJURY;
}

export function buildLibraryPlan(params: LibraryPlanParams): LibraryPlanResult {
  // --- validate intake -------------------------------------------------------------------------
  const raceDistance = params.raceDistance ?? params.intake.raceDistance;
  if (raceDistance === undefined) {
    // Q1, ruled 2026-09-10: require a target distance before generating on Free. The register has
    // no plan for a runner who named no distance, none is invented, and the request is refused
    // rather than handed to another engine — the caller turns this into an `invalid_request`.
    return { ok: false, gap: 'no-race-distance' };
  }
  const distance = LIBRARY_DISTANCE[raceDistance];
  const isRacePlan = params.goalType === 'race';

  // --- injury state (H0–H4) --------------------------------------------------------------------
  const injuryState = deriveInjuryState(params.intake.injuries);
  const injuryEffect = composeInjuryEffect(injuryState, params.intake.injuries);

  // --- race distance and canonical/adjusted duration --------------------------------------------
  const track = EXPERIENCE_TRACK_FOR_ANSWER[params.intake.experience];
  const level = toExperienceLevel(params.intake.experience);
  const readiness: ReadinessPath = isRacePlan
    ? deriveReadinessPath(params.intake, raceDistance)
    : 'prepared';
  const durationWeeks = Math.max(1, Math.round(params.durationWeeks));
  const { calendarWeeks, compressed } = adaptCalendar({
    distance,
    weeks: durationWeeks,
    isRacePlan,
    readiness,
  });

  // --- safe run-frequency layout, then runner profile -------------------------------------------
  const layoutDays = resolveLayoutDays(track, params.intake.daysPerWeek);
  const profile: RunnerProfile = DEFAULT_RUNNER_PROFILE;

  // --- pace/effort derivation -------------------------------------------------------------------
  const paces = deriveTrainingPaces(params.intake.recentPerformance, level);
  const easyPaceSecPerKm = paces.easy?.lowSecPerKm;

  const calendar = LIBRARY_CALENDARS[distance];
  const shareCap = longRunShareCap(level, layoutDays, isRacePlan ? raceDistance : undefined);
  const absoluteSingleRunKm = Math.min(
    EXPERIENCE_LIMITS[track].longRunMaxKm,
    maxSingleRunKm(level, isRacePlan ? raceDistance : undefined, {
      readiness,
      ...(easyPaceSecPerKm !== undefined ? { easyPaceSecPerKm } : {}),
    }),
  );

  // § 16 `H1`: "Week 1 at 90% of validated baseline."
  const baselineKm = Math.max(1, params.intake.weeklyKm);
  const deloadCadenceWeeks = resolveDeloadCadence(track, params.intake.age, baselineKm);

  let lastLoadingKm = 0;
  let peakLoadingKm = 0;
  let previousLongRunKm = 0;
  let previousLongestKm = 0;
  let previousEasyRunKm = 0;
  let previousPhase: Phase = 'base';

  const weeks: Week[] = [];

  calendarWeeks.forEach((canonicalWeek, index) => {
    const source = calendar[canonicalWeek - 1]!;
    const phase = phaseForState(source.state, previousPhase);
    previousPhase = phase;

    // --- weekly-volume state ---------------------------------------------------------------
    let target = targetForState({
      state: source.state,
      track,
      baselineKm,
      lastLoadingKm,
      peakLoadingKm,
    });

    // § 5: "level maximum weekly kilometres → injury adjustment → single-session and long-run caps".
    target = Math.min(target, MAX_WEEKLY_KM[level]);
    if (injuryEffect.volumeReductionPct > 0) target *= 1 - injuryEffect.volumeReductionPct;
    if (injuryState === 'H1' && index === 0) target *= H1_WEEK_1_BASELINE_SHARE;
    if (source.state !== 'RECOVERY') {
      target = clampWeeklyVolume({
        lastLoadingWeekKm: lastLoadingKm,
        proposedKm: target,
        level,
        baselineWeeklyKm: baselineKm,
      });
    }

    // --- long-run and hard-session clamps ---------------------------------------------------
    const proposedLongRunKm = ladderLongRunKm({
      distance,
      track,
      target: injuryEffect.longRunPinnedLow && source.longRun !== 'RACE' ? 'LR-low' : source.longRun,
      ...(easyPaceSecPerKm !== undefined ? { easyPaceSecPerKm } : {}),
      weeklyKm: target,
      shareCap,
      previousLongRunKm,
    });
    const clamped = clampLongRun({
      proposedKm: proposedLongRunKm,
      weeklyKm: target,
      level,
      previousLongestKm,
      ...(easyPaceSecPerKm !== undefined ? { easyPaceSecPerKm } : {}),
      isDeload: source.state === 'RECOVERY',
      lastLoadingWeekKm: lastLoadingKm,
      shareCapOverride: shareCap,
      roundSpikeCeilingUp: true,
      maxSingleRunKmOverride: absoluteSingleRunKm,
    });

    const built = buildWeek({
      weekNumber: index + 1,
      totalWeeks: calendarWeeks.length,
      source,
      distance,
      raceDistance,
      isRacePlan,
      track,
      profile,
      layoutDays: injuryState === 'H2' ? (Math.min(layoutDays, H2_RUN_DAYS + 1) as LayoutDays) : layoutDays,
      weeklyTargetKm: target,
      longRunKm: clamped.km,
      previousEasyRunKm,
      injuryRemoved: injuryEffect.removedCodes,
      singleQualityOnly: injuryEffect.singleQualityOnly,
      injuryState,
      phase,
    });

    weeks.push(built.week);
    if (source.state !== 'RECOVERY' && source.longRun !== 'RACE') {
      lastLoadingKm = built.week.volumeKm;
      peakLoadingKm = Math.max(peakLoadingKm, built.week.volumeKm);
    }
    if (built.longRunKm > 0) {
      previousLongRunKm = built.longRunKm;
      previousLongestKm = Math.max(previousLongestKm, built.longRunKm);
    }
    const easyDay = built.week.days.find(
      (day): day is Workout => day.kind === 'run' && day.isLongRun !== true && day.effort === 'easy',
    );
    if (easyDay?.distanceKm !== undefined) previousEasyRunKm = easyDay.distanceKm;
  });

  // --- § 16 H4: no running workouts, plan preserved as inactive future context ------------------
  const finalWeeks =
    injuryState === 'H4'
      ? weeks.map((week) => ({
          ...week,
          volumeKm: 0,
          days: [REST, REST, REST, REST, REST, REST, REST] as unknown as Week7<Day>,
        }))
      : weeks;

  // --- disclaimers and limited-preparation disclosure -------------------------------------------
  const limitedPreparation =
    isRacePlan &&
    (compressed ||
      (readiness === 'first-timer' && durationWeeks < CANONICAL_WEEKS[distance]) ||
      (distance === 'M' && (track === 'NEW' || track === 'SOME')));

  const disclaimers: string[] = [LIBRARY_GENERAL_DISCLAIMER];
  if (injuryState !== 'H0') disclaimers.push(LIBRARY_INJURY_DISCLAIMER);
  if (injuryState === 'H4') disclaimers.push(LIBRARY_H4_DISCLAIMER);
  for (const warning of injuryEffect.locationWarnings) disclaimers.push(warning);
  if (limitedPreparation) {
    disclaimers.push(limitedPreparationNotice({ distance, track, weeks: durationWeeks, compressed }));
  }
  if (calendarWeeks.some((weekNumber) => calendar[weekNumber - 1]!.fuelingPractice === true)) {
    disclaimers.push(LIBRARY_FUELING_NOTE);
  }
  if (isUnder18(params.intake.age)) disclaimers.push(UNDER_18_NOTICE);

  const planId = libraryPlanId(distance, track, profile);

  return {
    ok: true,
    plan: {
      title: isRacePlan
        ? `${calendarWeeks.length}-Week ${DISTANCE_LABEL[distance]} Plan`
        : `${calendarWeeks.length}-Week ${DISTANCE_LABEL[distance]} Base Plan`,
      goalType: params.goalType,
      raceDistance,
      ...(isRacePlan && params.raceDate !== undefined ? { raceDate: params.raceDate } : {}),
      durationWeeks: calendarWeeks.length,
      tierAtGeneration: params.tierAtGeneration,
      engine: 'template',
      isFallback: false,
      weeklyLoad: finalWeeks.map((week) => week.volumeKm),
      weeks: finalWeeks,
      extras: [],
      disclaimers,
      ...(isRacePlan ? { readinessPath: readiness } : {}),
    },
    resolution: {
      planId,
      distance,
      track,
      profile,
      layoutDays,
      injuryState,
      readiness,
      calendarWeeks,
      canonicalWeeks: CANONICAL_WEEKS[distance],
      isRacePlan,
      compressed,
      limitedPreparation,
      deloadCadenceWeeks,
    },
  };
}

const DISTANCE_LABEL: Record<LibraryDistance, string> = {
  '5K': '5K',
  '10K': '10K',
  HM: 'Half Marathon',
  M: 'Marathon',
};

/** § 8 rules 3–4 and § 9's marathon paragraph: say so, never disguise it. */
function limitedPreparationNotice(args: {
  distance: LibraryDistance;
  track: ExperienceTrack;
  weeks: number;
  compressed: boolean;
}): string {
  const label = DISTANCE_LABEL[args.distance];
  const canonical = CANONICAL_WEEKS[args.distance];
  if (args.compressed) {
    return (
      `With ${args.weeks} week${args.weeks === 1 ? '' : 's'} to race day — under the four weeks ` +
      'below which no real preparation is possible — this plan is easy running, one brief ' +
      'event-specific reminder, and a taper into the race. It does not try to create fitness ' +
      'through compression.'
    );
  }
  if (args.distance === 'M' && (args.track === 'NEW' || args.track === 'SOME')) {
    return (
      'This is a conservative completion track. Your long runs stay inside the ceiling your ' +
      'experience level allows, which is well short of the race distance, so this plan reports ' +
      'limited preparation rather than claiming a full marathon build.'
    );
  }
  return (
    `With ${args.weeks} weeks to race day, under the ${canonical} weeks a full ${label} build ` +
    'uses, this is a safe completion plan rather than full preparation. It keeps the taper and ' +
    'race week and does not compress fitness into the time available.'
  );
}

/** The captain-approved youth policy (§ 6-A) and § 19's "Under 18" row: effort, never HR zones. */
export const UNDER_18_NOTICE =
  'Because you are under 18, this plan describes effort rather than heart-rate zones — an ' +
  'age-predicted maximum heart rate is unreliable for younger runners.';
