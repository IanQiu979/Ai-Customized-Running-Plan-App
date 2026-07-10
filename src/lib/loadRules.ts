/**
 * Deterministic coaching safety arithmetic.
 *
 * Ported from `docs/reference/coaching/load-rules.md` and `training-zones.md`, which
 * are themselves a filtered port of Ian's McMillan-based coaching library. Every
 * number here traces to that source. **Do not invent or tune these values.**
 *
 * Used twice: the free engine builds within these bounds, and paid tiers clamp the
 * model's output against them. A model must not be able to emit an unsafe week.
 *
 * Pure module — imported by the app and by the Deno edge functions. No runtime deps.
 */

import type { ExperienceAnswer, ExperienceLevel, HrZone } from './planTypes';

// ---------------------------------------------------------------------------
// Rule 1 — weekly volume
// ---------------------------------------------------------------------------

/** Above this, a proposed week is rejected. Coaching convention, not evidence of injury prevention. */
export const WEEKLY_INCREASE_REJECT_ABOVE = 0.15;

/** What a rejected week is recalculated at. */
export const WEEKLY_INCREASE_RECALC_AT = 0.10;

/** Deload reduction band. Ian's decision, superseding the source's 20–30% table. */
export const DELOAD_REDUCTION_MIN = 0.35;
export const DELOAD_REDUCTION_MAX = 0.45;

/** No long run may exceed this multiple of the plan's own previous longest. */
export const LONG_RUN_SPIKE_MULTIPLE = 1.10;

/** Daniels' time ceiling on a long run, regardless of its share of weekly volume. */
export const LONG_RUN_MAX_MINUTES = 180;

// ---------------------------------------------------------------------------
// Rule 4 — safety thresholds by level
// ---------------------------------------------------------------------------

export const MAX_WEEKLY_KM: Record<ExperienceLevel, number> = {
  beginner: 40,
  intermediate: 70,
  advanced: 110,
};

export const MAX_SINGLE_RUN_KM: Record<ExperienceLevel, number> = {
  beginner: 14,
  intermediate: 25,
  advanced: 35,
};

export const MAX_HARD_SESSIONS_PER_WEEK: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/** Upper bound of the source's per-level long-run band, since this is a cap. */
export const LONG_RUN_SHARE_CAP: Record<ExperienceLevel, number> = {
  beginner: 0.25,
  intermediate: 0.30,
  advanced: 0.30,
};

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

/** Fractions of estimated max HR. */
export const HR_ZONE_BOUNDS: Record<HrZone, readonly [number, number]> = {
  1: [0.60, 0.70],
  2: [0.70, 0.80],
  3: [0.80, 0.87],
  4: [0.87, 0.95],
  5: [0.95, 1.0],
};

/**
 * Known to be the least accurate of the common formulas (Tanaka 2001, ±10–12 bpm).
 * Retained by Ian's informed decision: it is the only estimate available for a runner
 * the app meets exactly once. Plans must carry the source's field-test caveat.
 */
export function estimateMaxHr(age: number): number {
  return 220 - age;
}

export function hrZoneBpm(zone: HrZone, age: number): { low: number; high: number } {
  const maxHr = estimateMaxHr(age);
  const [lo, hi] = HR_ZONE_BOUNDS[zone];
  return { low: Math.round(maxHr * lo), high: Math.round(maxHr * hi) };
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/**
 * Intake offers five answers; the load rules are written against three levels.
 * Mapped conservatively — a tie rounds down, because a lower level means tighter caps.
 * NEEDS IAN: "experienced — I've trained for races before" could reasonably be advanced.
 */
export function toExperienceLevel(answer: ExperienceAnswer): ExperienceLevel {
  switch (answer) {
    case 'new':
    case 'some':
      return 'beginner';
    case 'regular':
    case 'experienced':
      return 'intermediate';
    case 'competitive':
      return 'advanced';
  }
}

/**
 * NEEDS IAN: the source gives intermediate a range of "every 3–4 weeks". 4 is used so the
 * cadence tightens monotonically with experience (beginner 4, intermediate 4, advanced 3).
 */
export function deloadEveryWeeks(level: ExperienceLevel, age: number): number {
  if (age >= 50) return 3; // mandatory, overrides level
  return level === 'advanced' ? 3 : 4;
}

// ---------------------------------------------------------------------------
// Weekly volume
// ---------------------------------------------------------------------------

/**
 * Clamps a proposed week against the previous week and the level's absolute ceiling.
 * A proposal above the reject threshold is recalculated at the lower rate, per
 * `load-rules.md § Rule 1 › Enforcement` — it is not merely trimmed to the threshold.
 */
export function clampWeeklyVolume(
  previousKm: number,
  proposedKm: number,
  level: ExperienceLevel,
): number {
  const ceiling = MAX_WEEKLY_KM[level];
  if (previousKm <= 0) return Math.min(proposedKm, ceiling);

  const growth = (proposedKm - previousKm) / previousKm;
  const allowed =
    growth > WEEKLY_INCREASE_REJECT_ABOVE
      ? previousKm * (1 + WEEKLY_INCREASE_RECALC_AT)
      : proposedKm;

  return Math.min(allowed, ceiling);
}

/** Midpoint of the deload band. */
export function deloadVolume(previousKm: number): number {
  const midpoint = (DELOAD_REDUCTION_MIN + DELOAD_REDUCTION_MAX) / 2;
  return previousKm * (1 - midpoint);
}

/** Whether a proposed deload week sits inside the band. Used to clamp model output. */
export function isValidDeload(previousKm: number, proposedKm: number): boolean {
  if (previousKm <= 0) return false;
  const reduction = (previousKm - proposedKm) / previousKm;
  return reduction >= DELOAD_REDUCTION_MIN && reduction <= DELOAD_REDUCTION_MAX;
}

// ---------------------------------------------------------------------------
// The long run — where the evidence actually points
// ---------------------------------------------------------------------------

export type LongRunLimit = 'none' | 'weekly-share' | 'spike' | 'time' | 'absolute';

export interface LongRunClamp {
  km: number;
  limitedBy: LongRunLimit;
}

/**
 * Applies every long-run ceiling and reports which one bound.
 *
 * The spike cap is the evidence-backed one: a 2025 BJSM cohort found weekly volume
 * change was a poor injury predictor, while a single run exceeding ~10% of the
 * runner's recent longest raised overuse-injury rates.
 *
 * `easyPaceSecPerKm` is optional because the time cap cannot be enforced without a
 * pace, and a pace requires a recent performance the runner may not have given.
 */
export function clampLongRun(args: {
  proposedKm: number;
  weeklyKm: number;
  level: ExperienceLevel;
  previousLongestKm: number;
  easyPaceSecPerKm?: number;
}): LongRunClamp {
  const { proposedKm, weeklyKm, level, previousLongestKm, easyPaceSecPerKm } = args;

  const ceilings: readonly (readonly [number, LongRunLimit])[] = [
    [weeklyKm * LONG_RUN_SHARE_CAP[level], 'weekly-share'],
    [MAX_SINGLE_RUN_KM[level], 'absolute'],
    ...(previousLongestKm > 0
      ? ([[previousLongestKm * LONG_RUN_SPIKE_MULTIPLE, 'spike']] as const)
      : []),
    ...(easyPaceSecPerKm && easyPaceSecPerKm > 0
      ? ([[(LONG_RUN_MAX_MINUTES * 60) / easyPaceSecPerKm, 'time']] as const)
      : []),
  ];

  let km = proposedKm;
  let limitedBy: LongRunLimit = 'none';
  for (const [ceiling, reason] of ceilings) {
    if (ceiling < km) {
      km = ceiling;
      limitedBy = reason;
    }
  }
  return { km, limitedBy };
}
