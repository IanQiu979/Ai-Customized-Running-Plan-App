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

import type { ExperienceAnswer, ExperienceLevel, HrZone, InjuryFlag, RpeValue } from './planTypes';

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

/**
 * Upper bound of the source's per-level long-run band, since this is a cap. Ian's issue #34
 * ruling (R1a): intermediate rises to 0.32 and advanced to 0.35 (both were 0.30) — chosen
 * explicitly to keep the ladder monotonic, since an intermediate cap of 0.32 would otherwise
 * exceed the advanced level's old 0.30 cap. Beginner is unchanged.
 */
export const LONG_RUN_SHARE_CAP: Record<ExperienceLevel, number> = {
  beginner: 0.25,
  intermediate: 0.32,
  advanced: 0.35,
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
// Youth (under-18) — RPE replaces HR zones
// ---------------------------------------------------------------------------

/**
 * Age-predicted max-HR formulas (`estimateMaxHr`, `220 − age`) are unreliable in youth by a wider
 * margin than in adults — Mahon et al. 2010 (n=52, ages 7–17): ±10±8 bpm error; Carli et al. 2023
 * (systematic review + meta-analysis): "all equations were found to be unsatisfactory," r = 0.229
 * for Fox's 220 − age specifically. The definitive youth-running consensus (Krabak et al. 2021,
 * Br J Sports Med) prescribes zero HR-zone training of any kind. This also resolves the standing
 * contradiction between `training-zones.md` (builds every zone on 220 − age) and
 * `ECHO_Framework_CORRECTED.md:47` ("DO NOT use age-predicted zones") for the population where it
 * matters most — Ian's own library already argued against this rule.
 *
 * Captain-approved policy (§6-A, `v22-youth-policy-research-s1` report, 2026-08-06): for
 * `age < 18`, never emit `hrZone` on any tier. `rpeForZone` substitutes the RPE the coaching
 * library already maps to the same zone (`training-zones.md` § RPE scale, ported verbatim from
 * `training_zones.md`) — no new coaching content invented, and RPE needs no HR monitor, which a
 * youth runner is less likely to have than an adult.
 */
export function isUnder18(age: number): boolean {
  return age < 18;
}

/**
 * `training-zones.md` § RPE scale, ported verbatim. Only the RPE values that map to exactly one
 * zone (not a transitional "Z1–Z2" row) are usable as a single-number substitute; each zone the
 * template engine actually prescribes today (1, 3, 4) has one.
 */
export const RPE_FOR_ZONE: Record<HrZone, RpeValue> = {
  1: 3,
  2: 5,
  3: 7,
  4: 8,
  5: 10,
};

export function rpeForZone(zone: HrZone): RpeValue {
  return RPE_FOR_ZONE[zone];
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
 * Ian's ruling, 2026-08-03: "pro runners = 3 weeks, beginners = 4" — the deload cadence is
 * driven by experience level. `advanced` (competitive) deloads every 3 weeks; `beginner`
 * every 4. `intermediate` is unspecified by the ruling; the source's "every 3–4 weeks"
 * (`docs/reference/coaching/load-rules.md` Deload trigger) is resolved to 4 so the cadence
 * tightens monotonically with experience (beginner 4, intermediate 4, advanced 3).
 * The 50+ rule (also 3 weeks, mandatory) overrides the experience dimension entirely: a
 * 50+ runner of any level still gets the mandatory 3-week cadence. This is the single
 * source of truth for the composition; `planTemplates.ts` calls through here.
 */
export function deloadEveryWeeks(level: ExperienceLevel, age: number): number {
  if (age >= 50) return 3; // mandatory, overrides level
  return level === 'advanced' ? 3 : 4;
}

// ---------------------------------------------------------------------------
// Weekly volume
// ---------------------------------------------------------------------------

/** Explicit input prevents callers from accidentally passing the literal deload week. */
export interface WeeklyVolumeClampInput {
  /** The most recent non-deload week, not necessarily the immediately preceding week. */
  lastLoadingWeekKm: number;
  proposedKm: number;
  level: ExperienceLevel;
}

/**
 * Clamps a proposed week against the last loading week and the level's absolute ceiling.
 * A deload week is skipped as the growth reference. A proposal above the reject threshold is
 * recalculated at the lower rate, per `load-rules.md § Rule 1 › Enforcement` — it is not merely
 * trimmed to the threshold.
 */
export function clampWeeklyVolume({
  lastLoadingWeekKm,
  proposedKm,
  level,
}: WeeklyVolumeClampInput): number {
  const ceiling = MAX_WEEKLY_KM[level];
  if (lastLoadingWeekKm <= 0) return Math.min(proposedKm, ceiling);

  const growth = (proposedKm - lastLoadingWeekKm) / lastLoadingWeekKm;
  const allowed =
    growth > WEEKLY_INCREASE_REJECT_ABOVE
      ? lastLoadingWeekKm * (1 + WEEKLY_INCREASE_RECALC_AT)
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
 *
 * The weekly-share ceiling is NEVER omitted — there is no code path that drops it from the
 * ceiling list. A prior version (R1b) exempted deload weeks from it entirely; a code review
 * flagged that as a HIGH-severity hole, since `Week.isDeload` is a field the AI model emits on
 * paid tiers, handing the model a switch that disabled its own safety ceiling (CLAUDE.md: "A
 * model must not be able to prescribe an unsafe week"), and it was also the plan's only
 * volume-relative ceiling — the spike cap needs `previousLongestKm > 0` and the time cap needs a
 * pace the intake makes optional, so stripping the share cap left some deload weeks bounded only
 * by the non-volume-relative absolute cap.
 *
 * Ian's follow-up ruling (R1c, 2026-07-12, issue #34) closes the hole by changing the
 * denominator instead of dropping the ceiling: a deload cuts the week's total while largely
 * preserving the long run, so measuring the long run's share against that shrunken total
 * measures the wrong thing — so it's measured against the right thing (the last loading week's
 * volume), not against nothing. The denominator is `lastLoadingWeekKm` only if all three hold:
 * `isDeload === true`, `lastLoadingWeekKm > 0`, and `isValidDeload(lastLoadingWeekKm, weeklyKm)`
 * (a week that claims to be a deload but isn't 35-45% down off the last loading week is not
 * one). Otherwise the denominator is the ordinary `weeklyKm` — the conservative fallback, so an
 * unsubstantiated `isDeload: true` claim gains the caller nothing. `limitedBy` still reports
 * `'weekly-share'` in both cases; there is no separate ceiling name for the deload case.
 *
 * Trust boundary: `lastLoadingWeekKm` must be derived by the caller from the plan's own
 * preceding weeks (deterministic engine state) — never taken from model output.
 */
export function clampLongRun(args: {
  proposedKm: number;
  weeklyKm: number;
  level: ExperienceLevel;
  previousLongestKm: number;
  easyPaceSecPerKm?: number;
  isDeload?: boolean;
  lastLoadingWeekKm?: number;
}): LongRunClamp {
  const {
    proposedKm,
    weeklyKm,
    level,
    previousLongestKm,
    easyPaceSecPerKm,
    isDeload,
    lastLoadingWeekKm,
  } = args;

  const shareDenominatorKm =
    isDeload === true &&
    lastLoadingWeekKm !== undefined &&
    lastLoadingWeekKm > 0 &&
    isValidDeload(lastLoadingWeekKm, weeklyKm)
      ? lastLoadingWeekKm
      : weeklyKm;

  const ceilings: readonly (readonly [number, LongRunLimit])[] = [
    [shareDenominatorKm * LONG_RUN_SHARE_CAP[level], 'weekly-share'],
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

// ---------------------------------------------------------------------------
// Rule 5 / Rule 6 — declared-injury volume adjustment
// ---------------------------------------------------------------------------

/**
 * "This week" volume cut applied when a closed-set injury is declared at intake — this app's
 * only encounter with the runner, so "this week" (`injury_flags.md`'s per-pattern coaching
 * responses) means the plan's first generated week. Sourced per flag:
 *
 * - `knee` — `injury_flags.md:29`, `load_rules.md:206`: "reduce volume 15%".
 * - `shin_splints` — `injury_flags.md:49`, `load_rules.md:217`: "reduce volume 15%".
 * - `plantar_arch` — `injury_flags.md:69`: "Reduce volume 20% this week" (Ian's ruling,
 *   2026-08-03: add a dedicated flag for this pattern — see `plan-structure.md`).
 * - `ankle_achilles`, `it_band`, `hip_glute`, `lower_back` — none of these has its own
 *   pattern-specific *volume-percentage* figure in the source: Achilles (`injury_flags.md:109`)
 *   only says "immediate volume reduction" with no number; IT band (`injury_flags.md:89`) gives
 *   "reduce hard sessions by 50%", a session-count metric, not a weekly-volume one; hip/glute and
 *   lower back have no dedicated injury pattern in the source at all. Each falls back to Rule 5's
 *   own generic "Reduce Volume Triggers" tier response — "reducing your training volume by 20%
 *   this week" (`load_rules.md:185`, restated at `:189`) — the source's own number for a
 *   declared, non-emergency injury lacking a body-specific one. Flagged for captain review in
 *   `plan-structure.md`.
 */
export const INJURY_VOLUME_REDUCTION_PCT: Record<InjuryFlag, number> = {
  knee: 0.15,
  shin_splints: 0.15,
  plantar_arch: 0.2,
  ankle_achilles: 0.2,
  it_band: 0.2,
  hip_glute: 0.2,
  lower_back: 0.2,
  none: 0,
};

/**
 * Closed-set flags the source treats with materially higher urgency than the rest of the set.
 * `injury_flags.md` labels exactly one of the app's covered patterns "(HIGH PRIORITY)" —
 * Achilles (`injury_flags.md:107-109`): the only one of these patterns whose coaching response
 * includes an explicit stop-and-rest branch and "worsens quickly when pushed through" language,
 * one tier below the source's own "HIGHEST PRIORITY"/"STOP RUNNING" stress-fracture pattern
 * (which the closed set has no equivalent flag for — bone pain is out of scope for a body-
 * location picker). No other closed-set flag carries a priority label in the source. This is an
 * interpretive judgment call, not a literal "RED FLAG" label on the pattern itself — flagged for
 * captain review in `plan-structure.md`.
 */
export const RED_FLAG_INJURIES: ReadonlySet<InjuryFlag> = new Set<InjuryFlag>(['ankle_achilles']);

/** Most conservative combination when multiple injuries are declared at once — not itself a
 * sourced coaching number, just how the app combines several sourced ones safely. */
export function injuryVolumeReductionPct(injuries: readonly InjuryFlag[]): number {
  return injuries.reduce((max, flag) => Math.max(max, INJURY_VOLUME_REDUCTION_PCT[flag]), 0);
}

export function hasDeclaredInjury(injuries: readonly InjuryFlag[]): boolean {
  return injuries.some((flag) => flag !== 'none');
}

export function hasRedFlagInjury(injuries: readonly InjuryFlag[]): boolean {
  return injuries.some((flag) => RED_FLAG_INJURIES.has(flag));
}

/**
 * A red-flag injury's volume cut applies for the whole plan, not just the first week — captain
 * ruling (`red-flag-injury-plan-shape`, `workout-v22-plan-accuracy-s1` report): still a normal,
 * volume-adjusted plan (Ruling 1, `plan-structure.md`), never a separate return-to-running
 * protocol, but a pattern serious enough to be red-flagged needs the reduction to hold
 * throughout rather than fade after week 1 like an ordinary declared flag. 15% matches the
 * source's own knee/shin-splints figure (`injury_flags.md:29,49`, `INJURY_VOLUME_REDUCTION_PCT`
 * above) rather than the generic 20% fallback tier the red-flag pattern (`ankle_achilles`) would
 * otherwise use under Rule 5 — duration, not per-week magnitude, is the conservative axis here.
 */
export const RED_FLAG_VOLUME_REDUCTION_PCT = 0.15;

export function redFlagVolumeReductionPct(injuries: readonly InjuryFlag[]): number {
  return hasRedFlagInjury(injuries) ? RED_FLAG_VOLUME_REDUCTION_PCT : 0;
}
