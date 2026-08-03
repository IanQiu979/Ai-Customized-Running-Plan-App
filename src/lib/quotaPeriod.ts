/**
 * `currentPeriod(anchorDate, now)` — the one pure shared function that computes a quota period.
 *
 * `docs/reference/plan-generation.md` "Quotas": periods are **not** calendar months. They are
 * computed **arithmetically at read time** from the purchase-day anchor (e.g. May 26 → June 26,
 * clamped at month end: Jan 31 → Feb 28 → Mar 31), "by one pure shared function
 * `currentPeriod(anchorDate, now)` used by both `generate-plan` and `quota-status`. No cron, no
 * rollover write."
 *
 * That "one shared function" is the whole point of this file: two implementations of the same
 * anniversary arithmetic would eventually disagree, and a `quota-status` that disagrees with
 * `generate-plan` shows the user a number the server will not honour.
 *
 * Like `planTypes.ts` and `tierLimits.ts`, this module stays pure — no React, no Node, no
 * Cloudflare Workers globals — because the Expo app and `workers/src/` both import it.
 *
 * **All arithmetic is UTC.** A period boundary must not move because the runner flew to another
 * timezone, and the server has no business guessing a local calendar.
 */

/** A half-open interval `[periodStart, periodEnd)`. ISO-8601 UTC, D1's storage format. */
export interface QuotaPeriod {
  periodStart: string;
  periodEnd: string;
  /**
   * How many whole anniversary months have elapsed since the anchor. `0` is the first period.
   * Exposed mostly so tests and logs can assert *which* period was chosen, not just its bounds.
   */
  periodIndex: number;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The anchor advanced by `months`, with the day clamped into short months.
 *
 * The clamp is applied to the **original anchor day** every time, never to the previous boundary's
 * already-clamped day. That is what makes the documented Jan 31 → Feb 28 → **Mar 31** sequence
 * come out right: a naive "advance the previous boundary" implementation would stick at the 28th
 * forever once February clamped it.
 */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const absoluteMonth = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInUtcMonth(year, month));

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`currentPeriod: invalid date ${JSON.stringify(value)}`);
  }
  return date;
}

/**
 * The quota period containing `now`, anchored on the purchase day.
 *
 * `now` earlier than the anchor is treated as the **first** period rather than a negative one.
 * That is a clock-skew or bad-row case, and the safe reading of "this user is inside period −2" is
 * that they are inside their first — it can only ever be stricter, never a free extra allowance.
 */
export function currentPeriod(anchorDate: Date | string, now: Date | string): QuotaPeriod {
  const anchor = toDate(anchorDate);
  const at = toDate(now);

  // Whole-month difference is the right starting guess; the two loops below correct the
  // off-by-one that the day-of-month and the short-month clamp can each introduce.
  let index =
    (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - anchor.getUTCMonth());

  while (index > 0 && addMonthsClamped(anchor, index).getTime() > at.getTime()) {
    index -= 1;
  }
  while (addMonthsClamped(anchor, index + 1).getTime() <= at.getTime()) {
    index += 1;
  }
  if (index < 0) {
    index = 0;
  }

  return {
    periodStart: addMonthsClamped(anchor, index).toISOString(),
    periodEnd: addMonthsClamped(anchor, index + 1).toISOString(),
    periodIndex: index,
  };
}
