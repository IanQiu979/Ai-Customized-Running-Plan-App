/**
 * What the three plan-detail screens share that is not a component: the route params they
 * read, and the derivations they all make from a plan. Pure.
 */

import { RACE_DAY_LABEL } from '@/lib/notation';
import { planProgress } from '@/lib/planProgress';
import type { Plan, Week } from '@/lib/planTypes';

/** The first value of a route param, which expo-router types as possibly an array. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The 0-based index of the week in progress, for the overview's highlight and the week
 * screen's current-day numeral.
 *
 * A `Plan` carries no creation date (only `PlanSummary` does), so the list that pushes here
 * passes it along as the optional `createdAt` param. Without it — a deep link, the example
 * plan — week 1 is highlighted, which is also what a plan generated today would show.
 */
export function currentWeekIndex(plan: Plan, createdAt: string | undefined, today = new Date()) {
  if (!createdAt) return 0;
  return planProgress(createdAt, plan.durationWeeks, today).weekIndex;
}

/** How many of the current week's slots have elapsed; `undefined` for any other week. */
export function currentDayIndex(
  plan: Plan,
  weekIndex: number,
  createdAt: string | undefined,
  today = new Date()
): number | undefined {
  if (!createdAt) return weekIndex === 0 ? 0 : undefined;
  const progress = planProgress(createdAt, plan.durationWeeks, today);
  if (progress.weekIndex !== weekIndex || progress.completedDays >= 7) return undefined;
  return progress.completedDays;
}

/** The tag beside a week row on the overview: recovery, taper, race week, or nothing. */
export function weekTag(week: Week): string {
  if (week.isDeload) return 'RECOVERY';
  if (week.phase === 'taper') return 'TAPER';
  if (week.days.some((day) => day.kind === 'run' && day.label === RACE_DAY_LABEL)) return 'RACE WEEK';
  return '';
}

/** Whole kilometres across the plan. */
export function planTotalKm(plan: Plan): number {
  return Math.round(plan.weeks.reduce((sum, week) => sum + week.volumeKm, 0));
}

/** `DAY 04` — days are unnamed in this product (Ruling 12, 2026-07-10), never Mon–Sun. The
 * approved page prints MON…SUN; the project rule wins. */
export function dayLabel(dayIndex: number): string {
  return String(dayIndex + 1).padStart(2, '0');
}
