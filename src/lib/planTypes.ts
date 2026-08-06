/**
 * Shared plan vocabulary. Imported by both the Expo app and the Supabase edge
 * functions (Deno), so this module must stay pure: types and const literals only.
 * No React, no Deno, no Node, no AsyncStorage. A runtime-specific import here
 * breaks one of the two consumers.
 *
 * Coaching semantics come from `docs/reference/coaching/`. Do not invent values.
 */

export type Tier = 'free' | 'pro' | 'elite';

/**
 * How a plan was produced. `template` never calls the model.
 *
 * `'ai'` is never emitted in v1 — all paid (Pro/Elite) plans are skeleton-constrained `'hybrid'`.
 * An earlier "unconstrained Elite" design, where the top tier would drop the template skeleton
 * entirely, was corrected 2026-07-10 (see `docs/change_log.md`): the skeleton and its
 * deterministic `loadRules.ts` clamp apply identically to every tier. Never branch Elite
 * off-skeleton, and never have any code path emit `engine: 'ai'`.
 */
export type Engine = 'template' | 'hybrid' | 'ai';

export type GoalType = 'race' | 'duration';

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon';

export const RACE_DISTANCE_KM: Record<RaceDistance, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
};

/**
 * Effort is the plan's primary information channel. The five levels are ordered
 * by intensity; that order is load-bearing — the UI encodes it as both colour and
 * bar height so the plan stays readable without colour vision.
 */
export type EffortLevel = 'recovery' | 'easy' | 'steady' | 'tempo' | 'interval';

export const EFFORT_LEVELS: readonly EffortLevel[] = [
  'recovery',
  'easy',
  'steady',
  'tempo',
  'interval',
] as const;

/** 0-based position in the intensity ramp. Presentation layers derive from this. */
export const EFFORT_ORDINAL: Record<EffortLevel, number> = {
  recovery: 0,
  easy: 1,
  steady: 2,
  tempo: 3,
  interval: 4,
};

/** Zones 1–5, from `docs/reference/coaching/training-zones.md`. Adults (age ≥ 18) only — see
 * `RpeValue`. */
export type HrZone = 1 | 2 | 3 | 4 | 5;

/** 1–10, Borg-derived. `docs/reference/coaching/training-zones.md` § RPE scale, ported verbatim.
 * Under-18 substitute for `HrZone` (captain-approved youth policy §6-A,
 * `v22-youth-policy-research-s1` report, 2026-08-06) — self-reported effort, never computed from
 * age, so it carries none of `estimateMaxHr`'s youth-inaccuracy problem. */
export type RpeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Phase = 'base' | 'build' | 'peak' | 'taper';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Intake's five answers collapse to the three levels the load rules are written against. */
export type ExperienceAnswer =
  | 'new'
  | 'some'
  | 'regular'
  | 'experienced'
  | 'competitive';

/** Closed set. Only these drive the deterministic injury rules; free text never does. */
export type InjuryFlag =
  | 'knee'
  | 'ankle_achilles'
  | 'shin_splints'
  | 'it_band'
  | 'hip_glute'
  | 'lower_back'
  | 'plantar_arch'
  | 'none';

// ---------------------------------------------------------------------------
// Performances and paces
// ---------------------------------------------------------------------------

/** A time over a known distance. Seconds, so no float drift on arithmetic. */
export interface Performance {
  distance: RaceDistance;
  timeSec: number;
}

/** An inclusive pace band, seconds per kilometre. */
export interface Pace {
  lowSecPerKm: number;
  highSecPerKm: number;
}

// ---------------------------------------------------------------------------
// Goal realism
// ---------------------------------------------------------------------------

/**
 * `realistic` never warns. `ambitious` warns but still anchors race-pace reps at the
 * declared goal pace — ruling 3 holds. `implausible` warns and caps the anchor instead
 * of prescribing a pace the runner cannot hold. See the goal-realism ruling
 * (2026-07-12) for the exact thresholds and worked cases.
 */
export type GoalRealism = 'realistic' | 'ambitious' | 'implausible';

/**
 * The verdict on a declared goal, measured against what the runner's recent-equivalent
 * performance predicts. A fantasy goal (e.g. a 25-minute 5K runner declaring a sub-3
 * marathon) must never reach the runner as an uncapped race-pace prescription — this is
 * the one place that guard lives. Training paces (easy/tempo/interval) are never touched
 * by this; they derive from the recent performance unconditionally, at any goal size.
 */
export interface GoalRealismAssessment {
  realism: GoalRealism;
  /**
   * Positive means the goal is faster than the Riegel equivalent. An unrounded float —
   * the presentation layer rounds it for copy, tests compare against the computed value.
   */
  impliedImprovementPct: number;
  /** The recent performance, Riegel-equivalented to the goal distance. */
  equivalentTimeSec: number;
  /**
   * Set only when `realism === 'implausible'`. The race-pace anchor pins here — the
   * equivalent improved by exactly 15% — instead of at the declared goal pace.
   */
  cappedTimeSec?: number;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/**
 * Rest is not an `EffortLevel`. It is the absence of stimulus, and keeping it
 * outside the enum is what lets the week ribbon render it as a gap rather than as
 * a very-low-intensity bar.
 */
export interface RestDay {
  kind: 'rest';
}

/** Plans are running-only: no strength, cross-training, or mobility sessions. */
export interface Workout {
  kind: 'run';
  effort: EffortLevel;
  /**
   * Abbreviated run-type code — "ER", "INT", "LR", "ER + Strides" — never a spelled-out name
   * except the entries `notation.md` marks as always-spelled-out ("Strides", "Race Day").
   * Canonical abbreviation set and grammar: `docs/reference/coaching/notation.md`; code
   * counterpart (glossary data, `expandLabel` for accessibility): `src/lib/notation.ts`. Always
   * paired with `effort` — colour is never the only signal.
   */
  label: string;
  /** Exactly one of these is set. */
  distanceKm?: number;
  durationMin?: number;
  /** Always present. On Free this is the only pace signal a runner gets. */
  effortDescription: string;
  /** Measured. Requires a recent performance to derive from; absent otherwise. */
  pace?: Pace;
  /** Measured. Requires `age`. Paid tiers only. Adults (age ≥ 18) only — under-18 plans populate
   * `rpe` instead, never both. See `loadRules.ts`'s `isUnder18`. */
  hrZone?: HrZone;
  /** Under-18 substitute for `hrZone`. Paid tiers only. Self-reported effort (1–10), never
   * computed from age — captain-approved youth policy §6-A. */
  rpe?: RpeValue;
  /** "1 km easy, 3 km steady, 1 km easy". */
  structure?: string;
  /** Coach's reasoning. Paid tiers only; a template genuinely has none. */
  why?: string;
  isLongRun?: boolean;
}

export type Day = RestDay | Workout;

export type Week7<T> = readonly [T, T, T, T, T, T, T];

/**
 * A week is a 7-day cycle with unnamed days — Day 1 … Day 7, never Mon–Sun. The
 * runner places them on a calendar themselves. Rest days are real slots.
 */
export interface Week {
  weekNumber: number;
  totalWeeks: number;
  phase: Phase;
  isDeload: boolean;
  /** Total running kilometres this week. Also the wave's data point. */
  volumeKm: number;
  days: Week7<Day>;
  /** Coach's reasoning for the week. Paid tiers only. */
  why?: string;
}

/** Additive only. Never makes a plan mutable. Elite's confirmed extras land here. */
export interface PlanSection {
  type: string;
  title: string;
  body: string;
}

export interface Plan {
  title: string;
  goalType: GoalType;
  raceDistance?: RaceDistance;
  /** ISO date. Present when `goalType === 'race'`. */
  raceDate?: string;
  durationWeeks: number;

  /**
   * The tier the plan was *built at*, not the user's current tier. A plan renders
   * at its own density forever, so a downgrade never retroactively strips content
   * from a plan the user already paid for.
   */
  tierAtGeneration: Tier;
  engine: Engine;
  /** True when AI output failed structural validation twice and a template was served. */
  isFallback: boolean;

  /** One entry per week. Present for every tier, including Free — the wave charts real volume. */
  weeklyLoad: number[];
  weeks: Week[];
  extras: PlanSection[];
  /** Paid tiers only. */
  coachIntro?: string;
  /** Rule 10. Legally required; never empty. */
  disclaimers: string[];
  /** Present only when a goal time and a recent performance both exist. */
  goalRealism?: GoalRealismAssessment;
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export interface IntakeResponses {
  goal: string;
  age: number;
  experience: ExperienceAnswer;
  daysPerWeek: number;
  weeklyKm: number;

  raceDistance?: RaceDistance;
  raceDate?: string;
  /** The runner's target. Drives race-pace sessions only — never everyday training paces. */
  goalTimeSec?: number;
  /** Drives every training pace. Without it, the plan emits effort language and no numbers. */
  recentPerformance?: Performance;

  /** Closed set. These, and only these, drive the deterministic injury rules. */
  injuries: InjuryFlag[];
  /** Context for the model on paid tiers. Must never gate a safety decision. */
  injuryNotes?: string;
}

/** What `generate-plan` accepts. Per-generation, distinct from the intake profile. */
export interface GeneratePlanRequest {
  goalType: GoalType;
  raceDistance?: RaceDistance;
  raceDate?: string;
  durationWeeks?: number;
  notes?: string;
  /** Minted when the configure modal opens; dedupes a retried request. */
  idempotencyKey: string;
}

export interface GeneratePlanResponse {
  plan: Plan;
  planId: string;
  isFallback: boolean;
}

export interface QuotaStatus {
  tier: Tier;
  used: number;
  limit: number;
  /** ISO date. Anchored to the purchase day, not the calendar month. */
  periodEnd: string;
}
