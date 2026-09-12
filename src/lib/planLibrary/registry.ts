/**
 * The V1 deterministic 40-plan library — register, doses, operating limits, placement layouts,
 * weekly-volume state machine, long-run ladder, and recovery cadence.
 *
 * **This file is a port, not an authorship.** Every table below is a direct read of
 * `planning/research/plan-blueprint-examples.md` (the captain's coaching source of truth,
 * "V1 deterministic template library — 40 complete plan definitions"). Section numbers in the
 * comments are that document's own. Never change a number here without a coaching ruling from
 * Ian; never add a row the document does not state. Anything the document leaves open lives in
 * `openQuestions.ts`, never inlined here as a guess.
 *
 * Like `planTypes.ts` this module stays pure — types and const literals only. It is imported by
 * both the Expo app and `workers/`.
 */

import { DELOAD_LONG_RUN_SHARE_MAX, DELOAD_LONG_RUN_SHARE_MIN } from '../loadRules';
import type { ExperienceAnswer, RaceDistance } from '../planTypes';

// ---------------------------------------------------------------------------
// § 1. The complete 40-plan register
// ---------------------------------------------------------------------------

/** The library's own distance keys. `RaceDistance` is the app's; `LIBRARY_DISTANCE` maps them. */
export type LibraryDistance = '5K' | '10K' | 'HM' | 'M';

/** The five visible intake experience answers, in the library's own notation. */
export type ExperienceTrack = 'NEW' | 'SOME' | 'REG' | 'EXP' | 'COMP';

/**
 * § 1: "The suffix describes the **runner**, not the workouts they already enjoy."
 * `SPD` — speed-leaning runner, receives the stamina-oriented lane.
 * `END` — endurance-leaning runner, receives the speed/economy-oriented lane.
 */
export type RunnerProfile = 'SPD' | 'END';

export type LibraryPlanId = `${LibraryDistance}-${ExperienceTrack}-${RunnerProfile}`;

export const LIBRARY_DISTANCES: readonly LibraryDistance[] = ['5K', '10K', 'HM', 'M'] as const;

export const EXPERIENCE_TRACKS: readonly ExperienceTrack[] = [
  'NEW',
  'SOME',
  'REG',
  'EXP',
  'COMP',
] as const;

export const RUNNER_PROFILES: readonly RunnerProfile[] = ['SPD', 'END'] as const;

/** `RaceDistance` (the app's intake vocabulary) → the library's distance key. */
export const LIBRARY_DISTANCE: Record<RaceDistance, LibraryDistance> = {
  '5k': '5K',
  '10k': '10K',
  half: 'HM',
  marathon: 'M',
};

/** Intake's five experience answers → the library's five dose tracks. One-to-one, § 1's table. */
export const EXPERIENCE_TRACK_FOR_ANSWER: Record<ExperienceAnswer, ExperienceTrack> = {
  new: 'NEW',
  some: 'SOME',
  regular: 'REG',
  experienced: 'EXP',
  competitive: 'COMP',
};

export function libraryPlanId(
  distance: LibraryDistance,
  track: ExperienceTrack,
  profile: RunnerProfile,
): LibraryPlanId {
  return `${distance}-${track}-${profile}`;
}

/**
 * All 40 plan IDs, in the register's own reading order (experience rows × distance columns ×
 * profile). `5 experience answers × 2 runner profiles × 4 distances = 40 complete core plans`.
 */
export const LIBRARY_PLAN_IDS: readonly LibraryPlanId[] = EXPERIENCE_TRACKS.flatMap((track) =>
  LIBRARY_DISTANCES.flatMap((distance) =>
    RUNNER_PROFILES.map((profile) => libraryPlanId(distance, track, profile)),
  ),
);

// ---------------------------------------------------------------------------
// § 3. Workout vocabulary
// ---------------------------------------------------------------------------

/** § 3's code column, verbatim and closed. */
export type WorkoutCode =
  | 'REST'
  | 'REC'
  | 'E'
  | 'AER'
  | 'LR'
  | 'ST'
  | 'HS'
  | 'F'
  | 'H'
  | 'T'
  | 'CR'
  | 'I'
  | 'RP5'
  | 'RP10'
  | 'HMP'
  | 'MP'
  | 'MLR'
  | 'FF'
  | 'TU'
  | 'RACE';

/** § 3's "Meaning" and "Intensity / construction" columns, verbatim. */
export const WORKOUT_VOCABULARY: Record<WorkoutCode, { meaning: string; construction: string }> = {
  REST: { meaning: 'No running', construction: 'A genuine rest day' },
  REC: { meaning: 'Recovery run', construction: 'RPE 2–3, shorter than an easy run' },
  E: { meaning: 'Easy run', construction: 'Conversational, RPE 3–4' },
  AER: {
    meaning: 'Aerobic/steady support',
    construction: 'RPE 4–5; never allowed to drift into threshold',
  },
  LR: { meaning: 'Easy long run', construction: 'RPE 3–4; Day 7' },
  ST: {
    meaning: 'Relaxed strides',
    construction:
      'Gradual acceleration, relaxed fast running, full walking/jog recovery; never all-out',
  },
  HS: {
    meaning: 'Short relaxed hill sprints',
    construction: '8–10 seconds, full walk-back; only after an easy warm-up and only when already tolerated',
  },
  F: { meaning: 'Fartlek', construction: 'Controlled timed efforts with easy float recoveries' },
  H: {
    meaning: 'Aerobic hill repetitions',
    construction: 'Controlled strength/economy work, not sprinting',
  },
  T: { meaning: 'Tempo/threshold', construction: 'Comfortably hard, even, never a time trial' },
  CR: {
    meaning: 'Cruise intervals',
    construction: 'Broken threshold with short easy recoveries',
  },
  I: { meaning: 'Interval work', construction: 'Current-fitness VO2/5K effort; even repetitions' },
  RP5: { meaning: '5K race-pace repetitions', construction: 'Realistic 5K goal pace, late cycle' },
  RP10: {
    meaning: '10K race-pace repetitions',
    construction: 'Realistic 10K goal pace, late cycle',
  },
  HMP: { meaning: 'Half-marathon pace', construction: 'Realistic HM effort, continuous or broken' },
  MP: {
    meaning: 'Marathon pace',
    construction: 'Realistic marathon effort; also practices pacing/fueling',
  },
  MLR: {
    meaning: 'Medium-long aerobic run',
    construction: 'Longer than ordinary easy, shorter than Day 7',
  },
  FF: {
    meaning: 'Fast-finish long run',
    construction: 'Final portion controlled; makes Day 7 a quality session',
  },
  TU: {
    meaning: 'Tune-up',
    construction: 'Controlled race or time trial; never paired with another hard workout that week',
  },
  RACE: { meaning: 'Goal race', construction: 'Replaces Day 7 long run in the final week' },
};

// ---------------------------------------------------------------------------
// § 4. Exact experience-dose ladder
// ---------------------------------------------------------------------------

/** § 4's row keys. The calendar names the workout family; this supplies its dose. */
export type DoseKey =
  | 'ST-A'
  | 'ST-B'
  | 'HS-A'
  | 'F-A'
  | 'H-A'
  | 'T-A'
  | 'T-B'
  | 'CR-A'
  | 'I-A'
  | 'I-B'
  | 'RP5-A'
  | 'RP10-A'
  | 'HMP-A'
  | 'MP-A'
  | 'FF-A';

/**
 * § 4's table, verbatim. `WU/CD` are easy and included in the stated total. "When the prescribed
 * total would breach a weekly or single-run cap, reduce repetitions/work minutes first — never
 * the warm-up or cool-down."
 *
 * `null` means the document's "Not used" cell (`HS-A` for `NEW`).
 */
export const DOSE_LADDER: Record<DoseKey, Record<ExperienceTrack, string | null>> = {
  'ST-A': {
    NEW: '4 × 12 sec',
    SOME: '5 × 15 sec',
    REG: '6 × 15 sec',
    EXP: '6–7 × 15 sec',
    COMP: '8 × 15 sec',
  },
  'ST-B': {
    NEW: '4 × 15 sec',
    SOME: '6 × 15 sec',
    REG: '6 × 20 sec',
    EXP: '6–8 × 20 sec',
    COMP: '8 × 20 sec',
  },
  'HS-A': {
    NEW: null,
    SOME: '4 × 8 sec if previously tolerated',
    REG: '5 × 8 sec',
    EXP: '6 × 8–10 sec',
    COMP: '8 × 10 sec',
  },
  'F-A': {
    NEW: '6 × 1 min controlled / 2 min easy',
    SOME: '6 × 90 sec / 90 sec',
    REG: '6 × 2 min / 90 sec',
    EXP: '8 × 2 min / 1 min',
    COMP: '10 × 2 min / 1 min',
  },
  'H-A': {
    NEW: '6 × 30 sec gentle incline',
    SOME: '6 × 45 sec',
    REG: '6 × 60 sec',
    EXP: '8 × 60 sec',
    COMP: '8 × 90 sec',
  },
  'T-A': {
    NEW: '3 × 4 min / 2 min easy',
    SOME: '3 × 5 min / 90 sec',
    REG: '3 × 7 min / 90 sec',
    EXP: '3 × 8 min / 90 sec',
    COMP: '3 × 10 min / 90 sec',
  },
  'T-B': {
    NEW: '2 × 6 min / 2 min easy',
    SOME: '2 × 8 min / 2 min',
    REG: '20 min continuous',
    EXP: '24–25 min continuous',
    COMP: '28–30 min continuous',
  },
  'CR-A': {
    NEW: '3 × 5 min / 2 min easy',
    SOME: '3 × 6 min / 90 sec',
    REG: '3 × 2 km / 2 min',
    EXP: '4 × 2 km / 2 min',
    COMP: '3 × 3 km / 2 min',
  },
  'I-A': {
    NEW: '6 × 1 min hard-even / 2 min easy',
    SOME: '6 × 2 min / 2 min',
    REG: '8 × 400 m / 200 m jog',
    EXP: '6 × 600 m / 300 m jog',
    COMP: '6 × 800 m / 400 m jog',
  },
  'I-B': {
    NEW: '5 × 2 min / 2 min easy',
    SOME: '6 × 2 min / 90 sec',
    REG: '6 × 600 m / 300 m',
    EXP: '5 × 800 m / 400 m',
    COMP: '5 × 1000 m / 400–600 m',
  },
  'RP5-A': {
    NEW: '6 × 1 min at realistic 5K effort',
    SOME: '5 × 400 m / 200 m',
    REG: '6 × 600 m / 300 m',
    EXP: '5 × 800 m / 400 m',
    COMP: '5 × 1000 m / 400–600 m',
  },
  'RP10-A': {
    NEW: '3 × 5 min at realistic 10K effort',
    SOME: '4 × 1 km / 2 min',
    REG: '3 × 1.6 km / 2–3 min',
    EXP: '3 × 2 km / 3 min',
    COMP: '4 × 2 km / 3 min; fifth only after a successful four',
  },
  'HMP-A': {
    NEW: '3 × 8 min steady/HM feel',
    SOME: '2 × 2 km / 3 min',
    REG: '3 × 2 km / 2 min',
    EXP: '4 × 2 km / 2 min',
    COMP: '3 × 3 km / 2 min',
  },
  'MP-A': {
    NEW: '2 × 10 min steady/MP feel',
    SOME: '2 × 3 km / 1 km easy',
    REG: '2 × 4 km / 1 km easy',
    EXP: '2 × 5 km / 1 km easy',
    COMP: '3 × 5 km / 1 km easy',
  },
  'FF-A': {
    NEW: 'Final 5 min steady',
    SOME: 'Final 10 min steady',
    REG: 'Final 15% steady',
    EXP: 'Final 20% steady or race effort',
    COMP: 'Final 20–25% at event-specific effort',
  },
};

// ---------------------------------------------------------------------------
// § 4. Experience-specific operating limits
// ---------------------------------------------------------------------------

export interface ExperienceLimits {
  /** "Normal runs/week", inclusive. */
  runsPerWeek: readonly [number, number];
  /** Quality sessions the track normally receives. Hard-session caps include quality long runs. */
  normalQualitySessions: number;
  /** The most the track may ever receive, § 2 rule 4. */
  maxQualitySessions: number;
  /** "Long-run training range", minutes, and the track's own kilometre ceiling. */
  longRunMinutes: readonly [number, number];
  longRunMaxKm: number;
  /** Default deload rhythm in weeks. § 10 refines it for age 50+ and for higher-volume `EXP`. */
  defaultDeloadWeeks: number;
  /** § 4's "Special interpretation" column, verbatim. */
  specialInterpretation: string;
}

/** § 4's "Experience-specific operating limits" table, verbatim. */
export const EXPERIENCE_LIMITS: Record<ExperienceTrack, ExperienceLimits> = {
  NEW: {
    runsPerWeek: [3, 4],
    normalQualitySessions: 1,
    maxQualitySessions: 1,
    longRunMinutes: [45, 75],
    longRunMaxKm: 14,
    defaultDeloadWeeks: 4,
    specialInterpretation: 'Run/walk is valid; completion goals dominate',
  },
  SOME: {
    runsPerWeek: [3, 5],
    normalQualitySessions: 1,
    maxQualitySessions: 1,
    longRunMinutes: [55, 90],
    longRunMaxKm: 14,
    defaultDeloadWeeks: 4,
    specialInterpretation: 'Strides before intervals; no two-hard-day week',
  },
  REG: {
    runsPerWeek: [4, 5],
    normalQualitySessions: 1,
    maxQualitySessions: 2,
    longRunMinutes: [70, 110],
    longRunMaxKm: 25,
    defaultDeloadWeeks: 4,
    specialInterpretation: 'Alternates quality types when lower-volume',
  },
  EXP: {
    runsPerWeek: [5, 6],
    normalQualitySessions: 2,
    maxQualitySessions: 2,
    longRunMinutes: [80, 150],
    longRunMaxKm: 25,
    defaultDeloadWeeks: 4,
    specialInterpretation: '35–45+ km/week may use both quality slots',
  },
  COMP: {
    runsPerWeek: [5, 7],
    normalQualitySessions: 2,
    maxQualitySessions: 3,
    longRunMinutes: [90, 180],
    longRunMaxKm: 35,
    defaultDeloadWeeks: 3,
    specialInterpretation: 'Requires established recovery infrastructure',
  },
};

// ---------------------------------------------------------------------------
// § 5. Weekly-volume state machine
// ---------------------------------------------------------------------------

export type VolumeState =
  | 'ENTRY'
  | 'LOAD-1'
  | 'LOAD-2'
  | 'LOAD-3'
  | 'HOLD'
  | 'RECOVERY'
  | 'TAPER-1'
  | 'TAPER-2'
  | 'RACE-WEEK';

/**
 * § 5's targets, "before deterministic clamps".
 *
 * `basisMultiplier` multiplies `B` (the runner's current normal weekly kilometres, after
 * injury/readiness validation). `previousLoadingMultiplier` multiplies the preceding loading week.
 * `peakMultiplier` multiplies peak loading volume.
 *
 * **`RECOVERY` carries the captain's 2026-09-06 supersession.** The source document's own
 * "55–65%; target 60%" (a 35–45% reduction) is STALE. Recovery-week depth is **15–25%**, so a
 * recovery week is 75–85% of the preceding loading week, targeting 80% — matching
 * `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`DELOAD_REDUCTION_MAX`, which are authoritative. See
 * `docs/change_log.md` and GitHub issue #101.
 */
export interface VolumeStateTarget {
  basisMultiplier?: readonly [number, number];
  previousLoadingMultiplier?: readonly [number, number];
  peakMultiplier?: readonly [number, number];
  /** The point inside the band the engine aims at, where the document names one. */
  target?: number;
  note: string;
}

export const VOLUME_STATE_TARGETS: Record<VolumeState, VolumeStateTarget> = {
  ENTRY: {
    basisMultiplier: [0.9, 0.9],
    target: 0.9,
    note: '0.90 × B; never increase an already struggling or returning runner',
  },
  'LOAD-1': { basisMultiplier: [1.0, 1.0], target: 1.0, note: 'Up to 1.00 × B' },
  'LOAD-2': {
    previousLoadingMultiplier: [1.08, 1.08],
    target: 1.08,
    note: 'Up to 1.08 × the previous loading week',
  },
  'LOAD-3': {
    previousLoadingMultiplier: [1.08, 1.08],
    target: 1.08,
    note: 'Up to 1.08 × the previous loading week; use 5% for NEW',
  },
  HOLD: {
    previousLoadingMultiplier: [0.95, 1.0],
    note: '95–100% of the preceding loading week',
  },
  RECOVERY: {
    previousLoadingMultiplier: [0.75, 0.85],
    target: 0.8,
    note:
      'Captain 2026-09-06: recovery depth is 15–25% (75–85% of the preceding loading week), ' +
      'target 20% off. The library’s own 35–45% line is superseded.',
  },
  'TAPER-1': { peakMultiplier: [0.7, 0.8], note: '70–80% of peak loading volume' },
  'TAPER-2': { peakMultiplier: [0.55, 0.65], note: '55–65% of peak loading volume' },
  'RACE-WEEK': {
    peakMultiplier: [0.4, 0.6],
    note: '40–60% of peak plus the race, reconciled honestly rather than hidden',
  },
};

/** § 5 and § 10: `LOAD-3` uses 5% rather than 8% for `NEW`. */
export const LOAD_3_NEW_MULTIPLIER = 1.05;

// ---------------------------------------------------------------------------
// § 6. Exact 3–7-day placement layouts
// ---------------------------------------------------------------------------

/** A layout slot. `Q2/E` means "Q2 when the experience row and calendar permit; otherwise easy". */
export type LayoutSlot = 'E' | 'E+ST' | 'REST' | 'REC' | 'Q1' | 'Q2/E' | 'E/REC' | 'E/MLR' | 'LR/RACE';

export type LayoutDays = 3 | 4 | 5 | 6 | 7;

/** § 6's table, verbatim, Day 1 … Day 7. */
export const PLACEMENT_LAYOUTS: Record<LayoutDays, readonly [
  LayoutSlot, LayoutSlot, LayoutSlot, LayoutSlot, LayoutSlot, LayoutSlot, LayoutSlot,
]> = {
  3: ['E+ST', 'REST', 'REST', 'Q1', 'REST', 'REST', 'LR/RACE'],
  4: ['E+ST', 'REST', 'Q1', 'REST', 'E', 'REST', 'LR/RACE'],
  5: ['E', 'Q1', 'REST', 'E', 'Q2/E', 'REST', 'LR/RACE'],
  6: ['E', 'Q1', 'REC', 'REST', 'Q2/E', 'E/REC', 'LR/RACE'],
  7: ['E', 'Q1', 'REC', 'E/MLR', 'Q2/E', 'REC', 'LR/RACE'],
};

/**
 * § 6's per-track layout rules, as an allowed range of running days.
 *
 * - `NEW` uses only the 3- or 4-day layouts. A higher availability answer creates rest days.
 * - `SOME` uses 3–5 days; the fifth run remains easy.
 * - `REG` uses 4–5 days unless already stable at six.
 * - `EXP` uses 5–6 days. A 3–4-day request retains Q1 and Day 7, then removes Q2.
 * - The 7-day layout is `COMP` only.
 */
export const LAYOUT_RANGE: Record<ExperienceTrack, readonly [LayoutDays, LayoutDays]> = {
  NEW: [3, 4],
  SOME: [3, 5],
  REG: [4, 5],
  EXP: [3, 6],
  COMP: [3, 7],
};

/**
 * § 6: "`REG` uses 4–5 days **unless already stable at six**." The document does not define
 * "stable at six" numerically for a request that asks for six; `resolveLayoutDays` therefore
 * clamps `REG` to five and the extra day becomes rest, which is the conservative direction the
 * same rule takes for `NEW`.
 */
export const REG_LAYOUT_CEILING_WITHOUT_STABILITY_EVIDENCE: LayoutDays = 5;

// ---------------------------------------------------------------------------
// § 9. Long-run target ladder
// ---------------------------------------------------------------------------

/** § 9's notation for where inside the track's range a week's Day 7 sits. */
export type LongRunTarget = 'LR-low' | 'LR-mid' | 'LR-high' | 'LR-peak' | 'LR-recovery' | 'RACE';

/**
 * § 9's table — peak training-*time* targets in minutes, "not automatic entitlements". The actual
 * Day 7 prescription is the smallest allowed by this table, the level's distance cap, the level's
 * share of weekly volume, 110% of recent-longest-run capacity, and 180 minutes.
 */
export const LONG_RUN_LADDER: Record<
  LibraryDistance,
  Record<ExperienceTrack, readonly [number, number]>
> = {
  '5K': { NEW: [55, 60], SOME: [60, 70], REG: [75, 85], EXP: [85, 95], COMP: [95, 105] },
  '10K': { NEW: [60, 70], SOME: [70, 80], REG: [85, 95], EXP: [95, 110], COMP: [105, 120] },
  HM: { NEW: [70, 80], SOME: [80, 95], REG: [100, 115], EXP: [115, 135], COMP: [125, 145] },
  M: { NEW: [80, 100], SOME: [95, 120], REG: [125, 150], EXP: [145, 180], COMP: [160, 180] },
};

/**
 * § 9's calendar notation, as a fraction of the track's ladder range:
 * `LR-low` = lower quarter, `LR-mid` = midpoint, `LR-high` = upper quarter, `LR-peak` = top.
 * `LR-recovery` is handled separately — it is 60–70% of the *preceding* long run, not a point in
 * the ladder.
 */
export const LONG_RUN_LADDER_FRACTION: Record<'LR-low' | 'LR-mid' | 'LR-high' | 'LR-peak', number> = {
  'LR-low': 0.25,
  'LR-mid': 0.5,
  'LR-high': 0.75,
  'LR-peak': 1,
};

/**
 * § 9: "`LR-recovery` is 60–70% of the preceding long run." The band itself lives in
 * `loadRules.ts` (`DELOAD_LONG_RUN_SHARE_MIN`/`_MAX`) since 2026-09-12, so that this library and
 * the paid-tier skeleton in `planTemplates.ts` recover the long run by the same rule — exactly as
 * `RECOVERY`'s weekly total defers to `deloadVolume` above. Same value, one owner.
 */
export const LONG_RUN_RECOVERY_SHARE: readonly [number, number] = [
  DELOAD_LONG_RUN_SHARE_MIN,
  DELOAD_LONG_RUN_SHARE_MAX,
];

// ---------------------------------------------------------------------------
// § 8. Canonical durations
// ---------------------------------------------------------------------------

/** § 8: "12 weeks for 5K, 14 for 10K, 16 for half marathon, and 24 for marathon." */
export const CANONICAL_WEEKS: Record<LibraryDistance, number> = {
  '5K': 12,
  '10K': 14,
  HM: 16,
  M: 24,
};

/**
 * § 8, "Shorter race date", rule 4: "With fewer than four weeks, prescribe easy running, one brief
 * event-specific reminder if already tolerated, and taper/race. Do not attempt to create fitness
 * through compression."
 */
export const COMPRESSION_FLOOR_WEEKS = 4;

// ---------------------------------------------------------------------------
// § 10. Recovery-cadence overlay
// ---------------------------------------------------------------------------

/** § 10 and § 19: "Age 50+ … forces a three-week recovery rhythm." */
export const AGE_FORCING_THREE_WEEK_CADENCE = 50;

/**
 * § 10: `EXP` chooses three or four weeks; "use three for higher-volume/two-quality runners".
 * § 4 sets that volume band for `EXP` at "35–45+ km/week may use both quality slots", so 35 km/week
 * is the same threshold both rules already name.
 */
export const EXP_HIGHER_VOLUME_KM = 35;

/**
 * § 4 and § 11's completion rules: "`REG` alternates Q1 and Q2 when below roughly 35 km/week.
 * `EXP` around 35–45+ km/week may retain both."
 */
export const TWO_QUALITY_VOLUME_KM = 35;
