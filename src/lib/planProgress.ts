/**
 * Where a runner is in a plan, read off the calendar.
 *
 * The app logs nothing (`CLAUDE.md`: it turns intake into a plan "and does nothing else"), so
 * "completed days" — what the Home header mark fills to (V22-04) and what the plan overview
 * highlights as the current week (V22-06 A) — can only mean *elapsed* days: a plan starts the
 * day it is generated, Day 1 of Week 1 is that day, and each calendar day since is one more slot
 * filled. That is a reading of dates, not a coaching rule, and it is the only honest one
 * available without a log. Ian may replace it with a real day-marking flow later; until then
 * this module is the one place the derivation lives.
 *
 * Pure: dates in, integers out. `today` is always passed in so the tests are deterministic.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PlanProgress {
  /** 0-based index of the week in progress, clamped to the plan's length. */
  weekIndex: number;
  /** How many of the current week's seven slots have elapsed, 0..7. */
  completedDays: number;
  /** True once the plan's last week has fully elapsed. */
  finished: boolean;
}

/** Calendar days from `start` to `today`, counting `start` itself as day 0. Never negative. */
function daysSince(start: Date, today: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((todayUtc - startUtc) / MS_PER_DAY));
}

/**
 * Progress through a plan of `durationWeeks` weeks that started on `startedAt` (the plan's
 * `createdAt` — an ISO timestamp or a `Date`). An unparseable start yields week 1, day 0.
 */
export function planProgress(
  startedAt: string | Date,
  durationWeeks: number,
  today: Date
): PlanProgress {
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  if (Number.isNaN(start.getTime()) || durationWeeks <= 0) {
    return { weekIndex: 0, completedDays: 0, finished: false };
  }
  const elapsed = daysSince(start, today);
  const totalDays = durationWeeks * 7;
  if (elapsed >= totalDays) {
    return { weekIndex: durationWeeks - 1, completedDays: 7, finished: true };
  }
  return { weekIndex: Math.floor(elapsed / 7), completedDays: elapsed % 7, finished: false };
}
