/**
 * `currentPeriod()` — the purchase-day-anchored quota window.
 *
 * Two properties carry the weight here. First, the documented month-end clamp really is
 * Jan 31 → Feb 28 → **Mar 31** and not Jan 31 → Feb 28 → Feb 28 forever, which is what a naive
 * "advance the previous boundary" implementation produces. Second, periods tile without gaps or
 * overlaps: every instant belongs to exactly one, because a gap is a free plan and an overlap is a
 * stolen one.
 */

import { addMonthsClamped, currentPeriod } from '../quotaPeriod';

describe('currentPeriod', () => {
  it('runs from the purchase day to the same day next month', () => {
    // The documented example: May 26 → June 26.
    const period = currentPeriod('2026-05-26T09:00:00.000Z', '2026-06-10T00:00:00.000Z');

    expect(period.periodStart).toBe('2026-05-26T09:00:00.000Z');
    expect(period.periodEnd).toBe('2026-06-26T09:00:00.000Z');
    expect(period.periodIndex).toBe(0);
  });

  it('is half-open: the boundary instant starts the next period, it does not end the last', () => {
    const anchor = '2026-05-26T09:00:00.000Z';

    const justBefore = currentPeriod(anchor, '2026-06-26T08:59:59.999Z');
    const exactly = currentPeriod(anchor, '2026-06-26T09:00:00.000Z');

    expect(justBefore.periodIndex).toBe(0);
    expect(exactly.periodIndex).toBe(1);
    expect(exactly.periodStart).toBe(justBefore.periodEnd);
  });

  it('clamps into short months without sticking there', () => {
    // Jan 31 → Feb 28 → Mar 31, exactly as documented. The third boundary recovering to the 31st is
    // the part a naive implementation gets wrong.
    const anchor = new Date('2026-01-31T00:00:00.000Z');

    expect(addMonthsClamped(anchor, 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addMonthsClamped(anchor, 2).toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(addMonthsClamped(anchor, 3).toISOString()).toBe('2026-04-30T00:00:00.000Z');
    expect(addMonthsClamped(anchor, 4).toISOString()).toBe('2026-05-31T00:00:00.000Z');
  });

  it('handles February in a leap year', () => {
    expect(addMonthsClamped(new Date('2028-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z'
    );
  });

  it('crosses a year boundary', () => {
    const period = currentPeriod('2026-12-15T00:00:00.000Z', '2027-01-20T00:00:00.000Z');

    expect(period.periodStart).toBe('2027-01-15T00:00:00.000Z');
    expect(period.periodEnd).toBe('2027-02-15T00:00:00.000Z');
    expect(period.periodIndex).toBe(1);
  });

  it('tiles time with no gaps and no overlaps', () => {
    // Walked day by day across two years from a 31st anchor — the worst case for the clamp. Every
    // instant must land inside exactly one period, and consecutive periods must abut exactly.
    const anchor = '2026-01-31T12:00:00.000Z';
    const start = Date.parse(anchor);

    for (let day = 0; day < 730; day += 1) {
      const at = new Date(start + day * 24 * 60 * 60 * 1000).toISOString();
      const period = currentPeriod(anchor, at);

      expect(Date.parse(period.periodStart)).toBeLessThanOrEqual(Date.parse(at));
      expect(Date.parse(period.periodEnd)).toBeGreaterThan(Date.parse(at));
      // The next period starts exactly where this one ends.
      expect(currentPeriod(anchor, period.periodEnd).periodStart).toBe(period.periodEnd);
    }
  });

  it('treats a clock earlier than the anchor as the first period, never a negative one', () => {
    // Clock skew or a bad row. Falling back to period 0 can only ever be stricter than the truth;
    // a negative index would hand out an extra allowance.
    const period = currentPeriod('2026-05-26T09:00:00.000Z', '2026-03-01T00:00:00.000Z');

    expect(period.periodIndex).toBe(0);
    expect(period.periodStart).toBe('2026-05-26T09:00:00.000Z');
  });

  it('accepts Date objects as well as ISO strings', () => {
    const fromStrings = currentPeriod('2026-05-26T09:00:00.000Z', '2026-06-10T00:00:00.000Z');
    const fromDates = currentPeriod(
      new Date('2026-05-26T09:00:00.000Z'),
      new Date('2026-06-10T00:00:00.000Z')
    );

    expect(fromDates).toEqual(fromStrings);
  });

  it('throws on an unparseable date rather than silently returning an Invalid Date window', () => {
    expect(() => currentPeriod('not-a-date', '2026-06-10T00:00:00.000Z')).toThrow(TypeError);
  });
});
