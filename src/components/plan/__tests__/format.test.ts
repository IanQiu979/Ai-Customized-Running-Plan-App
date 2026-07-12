import { examplePlan } from '../../../lib/fixtures/examplePlan';
import type { Day, Workout } from '../../../lib/planTypes';
import { composeWorkoutLabel, describeDays, formatPace } from '../format';

/**
 * Unit tests for `src/components/plan/format.ts`: `describeDays`, `formatPace`, and
 * `composeWorkoutLabel`. Covers GitHub issue #31 finding 2 (`describeDays`: a race day must
 * announce as "race day", not its `effort`, or a VoiceOver/TalkBack user never hears that the
 * week contains the race — see the JSDoc on `describeDays` for the full rationale) and the
 * issue #31 code-review follow-ups: the pace-band `:60` rollover fix (`formatPace`) and the
 * regression the original fix left unpinned — `composeWorkoutLabel` speaking a structure
 * string's embedded pace band in words, not raw en-dash/slash notation (`composeWorkoutLabel`).
 */

describe('describeDays', () => {
  it('announces a rest day as "rest"', () => {
    const days: readonly Day[] = [{ kind: 'rest' }];
    expect(describeDays(days)).toBe('Day 1 rest');
  });

  it('announces an ordinary run by its effort', () => {
    const days: readonly Day[] = [
      {
        kind: 'run',
        effort: 'easy',
        label: 'ER',
        distanceKm: 8,
        effortDescription: 'Comfortable, conversational pace.',
      },
    ];
    expect(describeDays(days)).toBe('Day 1 easy');
  });

  it('announces a race day as "race day", not its effort (issue #31 finding 2)', () => {
    // src/lib/fixtures/examplePlan.ts, week 12 (index 11), Day 7 (index 6): a normal
    // `kind: 'run'` Workout with `effort: 'interval'` and `label: 'Race Day'` — the label is
    // the only signal that this is the race, not another interval session.
    const raceDay = examplePlan.weeks[11].days[6];
    expect(raceDay.kind).toBe('run');
    expect((raceDay as { label?: string }).label).toBe('Race Day');
    expect((raceDay as { effort?: string }).effort).toBe('interval');

    expect(describeDays([raceDay])).toBe('Day 1 race day');
  });

  it('describes a full week in order, comma-separated, with the race day distinguished from a plain interval', () => {
    const days: readonly Day[] = [
      { kind: 'rest' },
      {
        kind: 'run',
        effort: 'interval',
        label: 'INT',
        distanceKm: 10,
        effortDescription: 'Repeated hard efforts with jog recovery.',
      },
      {
        kind: 'run',
        effort: 'interval',
        label: 'Race Day',
        distanceKm: 10,
        effortDescription: 'The event itself.',
      },
    ];
    expect(describeDays(days)).toBe('Day 1 rest, Day 2 interval, Day 3 race day');
  });
});

describe('formatPace', () => {
  it('formats a genuine range with an en dash and "/km", unchanged for normal integer input', () => {
    expect(formatPace({ lowSecPerKm: 281, highSecPerKm: 294 })).toBe('4:41–4:54/km');
  });

  it('formats a fixed target (low === high) as a single value, not a range', () => {
    expect(formatPace({ lowSecPerKm: 270, highSecPerKm: 270 })).toBe('4:30/km');
  });

  it('rounds the whole second first, so a fractional input never rolls into a ":60" (issue #31 code-review finding)', () => {
    // 299.63 sec/km: floor(4.99) = 4 min but round(59.63) = 60 sec would give "4:60/km" if
    // minutes and seconds were rounded independently instead of rounding the total first.
    expect(formatPace({ lowSecPerKm: 299.63, highSecPerKm: 299.63 })).toBe('5:00/km');
  });
});

describe('composeWorkoutLabel — GitHub issue #31 findings 1 & code-review follow-up', () => {
  it('composes the full accessibility label for the week 9 interval day, speaking the structure string\'s embedded pace band in words, not raw en-dash/slash notation', () => {
    // src/lib/fixtures/examplePlan.ts, week 9 (index 8), Day 5 (index 4):
    // structure 'WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km'. This single
    // assertion pins both the original fix (day.pace spoken in words) and the code-review
    // finding it left unpinned (the same pace band, embedded in day.structure, spoken in words
    // too) — swapping `speakPace`/`speakStructure`'s pace expansion back out would fail it.
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
});
