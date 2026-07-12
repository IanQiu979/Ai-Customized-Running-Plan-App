/**
 * Plain formatting helpers for the plan view — no React, no theme. Kept local to
 * `src/components/plan/` rather than `src/lib/` per the Phase 1 build's file scope.
 */

import type { Day, Pace } from '@/lib/planTypes';

/** "4:30/km" for a fixed target (low === high), "4:00–4:15/km" for a genuine range. */
export function formatPace(pace: Pace): string {
  const low = formatSecPerKm(pace.lowSecPerKm);
  if (pace.lowSecPerKm === pace.highSecPerKm) return `${low}/km`;
  return `${low}–${formatSecPerKm(pace.highSecPerKm)}/km`;
}

function formatSecPerKm(totalSec: number): string {
  const roundedTotalSec = Math.round(totalSec);
  const minutes = Math.floor(roundedTotalSec / 60);
  const seconds = roundedTotalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
 * Days are unnamed in this product; this never says Mon–Sun (Ruling 12, 2026-07-10). */
export function describeDays(days: readonly Day[]): string {
  return days.map((day, index) => `Day ${index + 1} ${day.kind === 'rest' ? 'rest' : day.effort}`).join(', ');
}
