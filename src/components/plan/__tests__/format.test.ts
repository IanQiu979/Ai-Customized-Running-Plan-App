import { describeDays, formatPace, formatPlanDate } from '../format';
import type { Day, Pace, Workout } from '@/lib/planTypes';

/**
 * Unit tests for `src/components/plan/format.ts`.
 *
 * The `formatPace` carry-boundary cases are a regression guard (GitHub issue #28): seconds
 * must be derived from an already-rounded total, never rounded independently of minutes, or
 * a fractional pace like 359.6 s/km renders as "5:60/km" instead of "6:00/km".
 */

describe('formatPace', () => {
  it('renders a fixed target ("4:30/km") when low === high', () => {
    const pace: Pace = { lowSecPerKm: 270, highSecPerKm: 270 };
    expect(formatPace(pace)).toBe('4:30/km');
  });

  it('renders a genuine range with an en dash ("4:00–4:15/km")', () => {
    const pace: Pace = { lowSecPerKm: 240, highSecPerKm: 255 };
    expect(formatPace(pace)).toBe('4:00–4:15/km');
  });

  it('zero-pads seconds under 10 ("5:05/km")', () => {
    const pace: Pace = { lowSecPerKm: 305, highSecPerKm: 305 };
    expect(formatPace(pace)).toBe('5:05/km');
  });

  it('rounds a value just below the carry boundary down, not up (359.4 -> "5:59/km")', () => {
    const pace: Pace = { lowSecPerKm: 359.4, highSecPerKm: 359.4 };
    expect(formatPace(pace)).toBe('5:59/km');
  });

  it('carries fractional seconds >= 59.5 into the next minute (359.6 -> "6:00/km", not "5:60/km")', () => {
    const pace: Pace = { lowSecPerKm: 359.6, highSecPerKm: 359.6 };
    expect(formatPace(pace)).toBe('6:00/km');
  });

  it('carries only the end of a range that crosses the boundary, leaving the other end untouched', () => {
    // low (359.6 s/km) crosses the boundary and must carry to 6:00; high (380 s/km) does not.
    const pace: Pace = { lowSecPerKm: 359.6, highSecPerKm: 380 };
    expect(formatPace(pace)).toBe('6:00–6:20/km');
  });
});

describe('formatPlanDate', () => {
  it('formats an ISO date as "MON DD, YYYY" in upper case', () => {
    expect(formatPlanDate('2026-09-26')).toBe('SEP 26, 2026');
  });

  it('does not shift by a day regardless of the runner\'s local timezone (UTC parse)', () => {
    const originalTZ = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14 — would roll a naive local parse forward
      expect(formatPlanDate('2026-09-26')).toBe('SEP 26, 2026');

      process.env.TZ = 'Pacific/Niue'; // UTC-11 — would roll a naive local parse backward
      expect(formatPlanDate('2026-09-26')).toBe('SEP 26, 2026');
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});

describe('describeDays', () => {
  const easyWorkout: Workout = {
    kind: 'run',
    effort: 'easy',
    label: 'ER',
    distanceKm: 8,
    effortDescription: 'Conversational effort',
  };

  const restDay: Day = { kind: 'rest' };

  const intervalWorkout: Workout = {
    kind: 'run',
    effort: 'interval',
    label: 'INT',
    distanceKm: 10,
    effortDescription: 'Hard, repeated efforts with recovery',
  };

  it('labels each day with its 1-based Day N position', () => {
    const days: readonly Day[] = [easyWorkout, restDay, intervalWorkout];
    expect(describeDays(days)).toBe('Day 1 easy, Day 2 rest, Day 3 interval');
  });

  it('includes rest days as real slots rather than omitting them', () => {
    const days: readonly Day[] = [restDay, restDay];
    const result = describeDays(days);
    expect(result).toBe('Day 1 rest, Day 2 rest');
    expect(result.split(', ')).toHaveLength(2);
  });

  it('never emits weekday names (Mon–Sun) — days are unnamed in this product', () => {
    const days: readonly Day[] = [easyWorkout, restDay, intervalWorkout, easyWorkout, restDay, easyWorkout, restDay];
    const result = describeDays(days);
    const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const weekday of weekdayNames) {
      expect(result).not.toContain(weekday);
    }
  });
});
