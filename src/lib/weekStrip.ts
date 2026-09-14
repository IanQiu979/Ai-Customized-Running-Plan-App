/**
 * The week strip's data shape, and how a real `Week` becomes one.
 *
 * A strip is seven slots — Day 1 … Day 7, never Mon–Sun (`CLAUDE.md`, coaching domain) — each
 * either empty (a rest day) or a block: a session tile with a magnitude, a two-letter code and
 * one of the two V22 session tones. Every strip in the app, animated or static, renders this one
 * shape, so the onboarding hero, the survey intro, the My Plans hero, the plan-detail strips and
 * the list rows' miniatures all agree on what a week looks like.
 *
 * Bar height is proportional to distance, as the pages draw it. V22-01's fixed hero week uses
 * the page's own fractions ("10 km = 0.7 of slot"); a real week is normalised so its longest
 * session fills 90% of the track, the rule V22-05 was drawn to (14 km → 0.9, 8 km → 0.5, 6 km →
 * 0.38). A time-based session is measured in minutes against the week's longest time-based one.
 *
 * Pure: no React, no Reanimated. Reads only from the shared plan vocabulary.
 */

import { RACE_DAY_LABEL } from './notation';
import type { EffortLevel, Week, Week7 } from './planTypes';
import { EFFORT_ORDINAL } from './planTypes';

export type StripTone = 'easy' | 'hard';

export interface StripBlock {
  /** Bar height as a fraction of the track, 0..1. */
  h: number;
  /** The headline number printed above the bar (`8`, `14`). */
  value: number;
  /** `km` for distance sessions, `min` for time-based ones. */
  unit: 'km' | 'min';
  /** The run-type code printed beside the number (`ER`, `LR`, `TR`). */
  code: string;
  tone: StripTone;
}

/** A strip week: one entry per unnamed day, `null` for a rest day. */
export type StripWeek = Week7<StripBlock | null>;

/** The share of the track a real week's longest session fills. */
export const REAL_WEEK_MAX_SHARE = 0.9;
/** The floor for a very short session, so a 2 km shakeout is still a visible block. */
export const MIN_BLOCK_SHARE = 0.12;

/**
 * Which of the two tones an effort is drawn in. Easy and recovery (and the long run, which is
 * an easy-effort session) take the easy tone; steady, tempo and intervals the hard one. Same
 * rule as `theme.ts`'s `sessionToneFor`, restated here so this module stays free of React
 * Native imports.
 */
export function toneForEffort(effort: EffortLevel): StripTone {
  return EFFORT_ORDINAL[effort] <= EFFORT_ORDINAL.easy ? 'easy' : 'hard';
}

/**
 * The code printed beside a bar's number. Labels are already abbreviated (`notation.ts`), but
 * a strip slot is 36pt wide, so a compound label keeps only its first term ("ER + Strides" →
 * "ER") and the one always-spelled-out label, Race Day, becomes "RACE".
 */
export function stripCodeFor(label: string): string {
  if (label === RACE_DAY_LABEL) return 'RACE';
  const head = label.split(/\s*\+\s*/)[0]?.trim() ?? label;
  return head.toUpperCase();
}

/** A real week as a strip. Heights are normalised within the week, per unit: kilometres
 * against the week's longest distance session, minutes against its longest time-based one, so a
 * 30-minute run never towers over a 14 km one because 30 is the bigger number. */
export function stripFromWeek(week: Pick<Week, 'days'>): StripWeek {
  const measured = week.days.map((day) => {
    if (day.kind !== 'run') return null;
    if (day.distanceKm !== undefined) return { unit: 'km' as const, magnitude: day.distanceKm };
    return { unit: 'min' as const, magnitude: day.durationMin ?? 0 };
  });
  const max = { km: 0, min: 0 };
  for (const entry of measured) {
    if (entry) max[entry.unit] = Math.max(max[entry.unit], entry.magnitude);
  }
  return week.days.map((day, index): StripBlock | null => {
    const entry = measured[index];
    if (day.kind !== 'run' || !entry) return null;
    const { unit, magnitude } = entry;
    const longest = max[unit];
    const share = longest > 0 ? (magnitude / longest) * REAL_WEEK_MAX_SHARE : MIN_BLOCK_SHARE;
    return {
      h: Math.max(MIN_BLOCK_SHARE, Math.min(1, share)),
      value: roundHeadline(magnitude),
      unit,
      code: stripCodeFor(day.label),
      tone: toneForEffort(day.effort),
    };
  }) as unknown as StripWeek;
}

/** A headline number never shows a float tail: 10.5 km → 10.5, 8.25 km → 8.3, 8.0 → 8. */
function roundHeadline(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The kilometres a strip week adds up to — what a hero's counting number lands on. */
export function stripTotalKm(week: StripWeek): number {
  return week.reduce((sum, block) => sum + (block && block.unit === 'km' ? block.value : 0), 0);
}

/** How many blocks (run days) a strip week has. */
export function stripRunCount(week: StripWeek): number {
  return week.filter((block) => block !== null).length;
}

/** A week with no runs at all — the shape Home's empty state and a not-yet-loaded row draw. */
export const EMPTY_STRIP_WEEK: StripWeek = [null, null, null, null, null, null, null];

// --- The pages' fixed weeks ------------------------------------------------------------------
//
// These are the pages' own numbers, verbatim. They are illustrations of the product's shape,
// not coaching content: the hero shows *a* week, the survey intro shows weeks stacking, and
// neither is ever presented to the runner as their plan.

function block(h: number, value: number, code: string, tone: StripTone): StripBlock {
  return { h, value, unit: 'km', code, tone };
}

/** V22-01's week (and V22-02 step 03's, and V22-03's week 1): Easy 8 · Rest · Rest · Tempo 7 ·
 * Rest · Long 10 · Rest, 25 km. */
export const HERO_WEEK: StripWeek = [
  block(0.56, 8, 'ER', 'easy'),
  null,
  null,
  block(0.49, 7, 'TR', 'hard'),
  null,
  block(0.7, 10, 'LR', 'easy'),
  null,
];
export const HERO_WEEK_TOTAL_KM = 25;

/** V22-03's weeks 2–6: a realistic progression stacking beneath week 1, heights only. */
export const SURVEY_WEEKS: readonly StripWeek[] = [
  [block(0.56, 0, '', 'easy'), null, block(0.42, 0, '', 'easy'), block(0.52, 0, '', 'hard'), null, block(0.78, 0, '', 'easy'), null],
  [block(0.6, 0, '', 'easy'), null, block(0.45, 0, '', 'easy'), block(0.56, 0, '', 'hard'), null, block(0.85, 0, '', 'easy'), null],
  [block(0.42, 0, '', 'easy'), null, block(0.42, 0, '', 'easy'), null, block(0.35, 0, '', 'easy'), block(0.6, 0, '', 'easy'), null],
  [block(0.64, 0, '', 'easy'), null, block(0.5, 0, '', 'hard'), block(0.5, 0, '', 'easy'), null, block(0.95, 0, '', 'easy'), null],
  [block(0.68, 0, '', 'easy'), null, block(0.52, 0, '', 'hard'), block(0.52, 0, '', 'easy'), null, block(1.0, 0, '', 'easy'), null],
];

/** V22-02 step 02's three candidate tiles: the engine "picks" the middle one. */
export const ENGINE_CANDIDATES = [
  { code: 'RR', value: 5, tone: 'easy' as const },
  { code: 'ER', value: 8, tone: 'easy' as const },
  { code: 'TR', value: 7, tone: 'hard' as const },
] as const;
export const ENGINE_PICK_INDEX = 1;
