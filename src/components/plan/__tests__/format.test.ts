import { examplePlan } from '../../../lib/fixtures/examplePlan';
import type { Day, Pace, Workout } from '../../../lib/planTypes';
import { composeWorkoutLabel, describeDays, formatPace, formatPlanDate } from '../format';

/**
 * Unit tests for `src/components/plan/format.ts`.
 *
 * Two regression guards live here, both about a pace or a day reaching the runner wrong:
 *
 * - `formatPace`'s carry boundary (issue #28): seconds must be derived from an already-rounded
 *   total, never rounded independently of the minutes, or a fractional pace like 359.6 s/km
 *   renders as "5:60/km" instead of "6:00/km". The arithmetic now lives in `formatSecPerKm`
 *   (`src/lib/notation.ts`), shared with the spoken readout so the two cannot drift.
 * - The screen-reader gaps (issue #31): a race day must announce as "race day" rather than its
 *   `effort`, or a VoiceOver user never hears the week contains the race; and a pace band must
 *   be spoken in words — including one embedded in a structure string, which is where every
 *   interval and race-pace session carries it.
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

  it('renders the range the plan view actually shows ("4:41–4:54/km")', () => {
    const pace: Pace = { lowSecPerKm: 281, highSecPerKm: 294 };
    expect(formatPace(pace)).toBe('4:41–4:54/km');
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

  it("does not shift by a day regardless of the runner's local timezone (UTC parse)", () => {
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

  it('announces a race day as "race day", not its effort (issue #31 finding 2)', () => {
    // examplePlan week 12 (index 11), Day 7 (index 6): a normal `kind: 'run'` Workout with
    // `effort: 'interval'` and `label: 'Race Day'` — the label is the only signal that this is
    // the race and not another interval session.
    const raceDay = examplePlan.weeks[11].days[6];
    expect(raceDay.kind).toBe('run');
    expect((raceDay as { label?: string }).label).toBe('Race Day');
    expect((raceDay as { effort?: string }).effort).toBe('interval');

    expect(describeDays([raceDay])).toBe('Day 1 race day');
  });

  it('distinguishes the race day from a plain interval session in the same week', () => {
    const raceDayWorkout: Workout = {
      kind: 'run',
      effort: 'interval',
      label: 'Race Day',
      distanceKm: 10,
      effortDescription: 'The event itself.',
    };
    const days: readonly Day[] = [restDay, intervalWorkout, raceDayWorkout];
    expect(describeDays(days)).toBe('Day 1 rest, Day 2 interval, Day 3 race day');
  });
});

describe('composeWorkoutLabel', () => {
  it("speaks the structure string's embedded pace band in words, not raw en-dash/slash notation", () => {
    // examplePlan week 9 (index 8), Day 5 (index 4): structure
    // 'WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km'. One assertion pins both
    // halves of the pace fix — `day.pace` spoken in words, and the same band embedded in
    // `day.structure` spoken in words too. The row is flattened into this single label, so
    // leaving either raw would speak the same band correctly once and broken once.
    const week9Int = examplePlan.weeks[8].days[4] as Workout;
    const label = composeWorkoutLabel(5, week9Int);

    expect(label).toBe(
      'Day 5, Intervals, 11 kilometers, 4:22 to 4:30 per kilometer, heart rate zone 4, ' +
        'Hard, controlled effort with full recovery between reps., ' +
        'warm-up 2 km, 8 times 600 m @ 4:22 to 4:30 per kilometer with 300 m jog, cool-down 2 km',
    );
    expect(label).toContain('4:22 to 4:30 per kilometer');
    expect(label).not.toContain('–');
    expect(label).not.toContain('/km');
  });

  it('speaks rpe as "perceived effort N out of 10" — the under-18 substitute for hrZone', () => {
    const youthTempo: Workout = {
      kind: 'run',
      effort: 'tempo',
      label: 'TR',
      distanceKm: 8,
      effortDescription: 'Comfortably hard, sustained effort.',
      rpe: 7,
    };
    const label = composeWorkoutLabel(3, youthTempo);
    expect(label).toContain('perceived effort 7 out of 10');
    expect(label).not.toContain('heart rate zone');
  });
});
