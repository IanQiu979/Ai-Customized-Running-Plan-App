/**
 * Plain formatting helpers for the plan view — no React, no theme. Kept local to
 * `src/components/plan/` rather than `src/lib/` per the Phase 1 build's file scope.
 */

import { RACE_DAY_LABEL, expandLabel, formatSecPerKm, speakPace, speakStructure } from '@/lib/notation';
import type { Day, Pace, Workout } from '@/lib/planTypes';

/** "4:30/km" for a fixed target (low === high), "4:00–4:15/km" for a genuine range. The m:ss
 * arithmetic lives in `formatSecPerKm` (`src/lib/notation.ts`), shared with the spoken readout
 * (`speakPace`) so the visible and spoken paces can never drift apart. */
export function formatPace(pace: Pace): string {
  const low = formatSecPerKm(pace.lowSecPerKm);
  if (pace.lowSecPerKm === pace.highSecPerKm) return `${low}/km`;
  return `${low}–${formatSecPerKm(pace.highSecPerKm)}/km`;
}

/** "SEP 26, 2026" — parses an ISO `YYYY-MM-DD` date string as UTC so no local-timezone
 * off-by-one can shift the displayed day. */
export function formatPlanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}

/** "Day 1 easy, Day 2 rest, ..." — the composed label a screen reader gets for one ribbon row.
 * Days are unnamed in this product; this never says Mon–Sun (Ruling 12, 2026-07-10).
 *
 * Race day announces as "race day", not as its `effort`. A race day is an ordinary `Workout`
 * whose `label` is `RACE_DAY_LABEL`; its `effort` is `'interval'` only because that's the closest
 * intensity bucket, so announcing the effort alone ("Day 7 interval") hides the race completely
 * from a screen-reader user. Exact match, never `includes` — a race day is never part of a
 * composite label like "ER + Strides". */
export function describeDays(days: readonly Day[]): string {
  return days
    .map((day, index) => {
      const label = day.kind === 'rest' ? 'rest' : day.label === RACE_DAY_LABEL ? 'race day' : day.effort;
      return `Day ${index + 1} ${label}`;
    })
    .join(', ');
}

/**
 * The single flattened `accessibilityLabel` for one workout row. `WorkoutRow.tsx` marks the row
 * `accessible`, which collapses its whole subtree into this one string — so every fact a runner
 * needs must be spoken here, or it never reaches them at all. Lives here rather than in the
 * component because it is pure (day number + `Workout` in, string out, no React) and so can be
 * tested without a renderer.
 *
 * Pace is spoken in words (`speakPace`), never `formatPace`'s visible "4:41–4:54/km" — the en
 * dash and "/km" read unreliably through VoiceOver. The same applies to a pace band embedded in
 * the structure line, which `speakStructure` handles.
 */
export function composeWorkoutLabel(dayNumber: number, day: Workout): string {
  // `day.label` is an abbreviated code ("ER", "TR" ...) — read the expanded name aloud, not the
  // bare letters (`src/lib/notation.ts`, per `docs/reference/coaching/notation.md`).
  const parts = [`Day ${dayNumber}`, expandLabel(day.label)];
  if (day.distanceKm !== undefined) parts.push(`${day.distanceKm} kilometers`);
  if (day.durationMin !== undefined) parts.push(`${day.durationMin} minutes`);
  if (day.pace) parts.push(speakPace(day.pace));
  if (day.hrZone) parts.push(`heart rate zone ${day.hrZone}`);
  if (day.rpe) parts.push(`perceived effort ${day.rpe} out of 10`);
  parts.push(day.effortDescription);
  if (day.structure) parts.push(speakStructure(day.structure));
  return parts.join(', ');
}
