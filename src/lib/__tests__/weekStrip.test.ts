import type { Day, Week7 } from '../planTypes';
import {
  EMPTY_STRIP_WEEK,
  HERO_WEEK,
  HERO_WEEK_TOTAL_KM,
  MIN_BLOCK_SHARE,
  REAL_WEEK_MAX_SHARE,
  SURVEY_WEEKS,
  stripCodeFor,
  stripFromWeek,
  stripRunCount,
  stripTotalKm,
  toneForEffort,
} from '../weekStrip';

const rest: Day = { kind: 'rest' };
const run = (partial: Partial<Extract<Day, { kind: 'run' }>> & { label: string }): Day => ({
  kind: 'run',
  effort: 'easy',
  distanceKm: 8,
  effortDescription: 'Conversational.',
  ...partial,
});

describe('toneForEffort — two session colours, never five', () => {
  it('draws recovery and easy in the easy tone', () => {
    expect(toneForEffort('recovery')).toBe('easy');
    expect(toneForEffort('easy')).toBe('easy');
  });
  it('draws steady, tempo and intervals in the hard tone', () => {
    expect(toneForEffort('steady')).toBe('hard');
    expect(toneForEffort('tempo')).toBe('hard');
    expect(toneForEffort('interval')).toBe('hard');
  });
});

describe('stripCodeFor', () => {
  it('keeps a plain abbreviation', () => {
    expect(stripCodeFor('ER')).toBe('ER');
    expect(stripCodeFor('INT')).toBe('INT');
  });
  it('keeps only the head of a compound label — a slot is 36pt wide', () => {
    expect(stripCodeFor('ER + Strides')).toBe('ER');
  });
  it('spells the race itself as RACE', () => {
    expect(stripCodeFor('Race Day')).toBe('RACE');
  });
});

describe('stripFromWeek', () => {
  const days: Week7<Day> = [
    run({ label: 'ER', distanceKm: 8 }),
    run({ label: 'RR', effort: 'recovery', distanceKm: 6 }),
    rest,
    run({ label: 'INT', effort: 'interval', distanceKm: 9 }),
    rest,
    run({ label: 'LR', distanceKm: 14, isLongRun: true }),
    rest,
  ];

  it('keeps rest days as real empty slots, in place', () => {
    const strip = stripFromWeek({ days });
    expect(strip.map((b) => (b ? 'block' : null))).toEqual([
      'block', 'block', null, 'block', null, 'block', null,
    ]);
    expect(stripRunCount(strip)).toBe(4);
  });

  it('normalises heights so the longest session fills 90% of the track — V22-05’s rule', () => {
    const strip = stripFromWeek({ days });
    expect(strip[5]?.h).toBeCloseTo(REAL_WEEK_MAX_SHARE, 9);
    expect(strip[0]?.h).toBeCloseTo((8 / 14) * REAL_WEEK_MAX_SHARE, 9);
    expect(strip[1]?.h).toBeCloseTo((6 / 14) * REAL_WEEK_MAX_SHARE, 9);
    expect(strip[3]?.h).toBeCloseTo((9 / 14) * REAL_WEEK_MAX_SHARE, 9);
  });

  it('carries the number, code and tone the bar is labelled with', () => {
    const strip = stripFromWeek({ days });
    expect(strip[0]).toMatchObject({ value: 8, unit: 'km', code: 'ER', tone: 'easy' });
    expect(strip[3]).toMatchObject({ value: 9, unit: 'km', code: 'INT', tone: 'hard' });
    expect(strip[5]).toMatchObject({ value: 14, unit: 'km', code: 'LR', tone: 'easy' });
  });

  it('sums the week’s kilometres for the counting number', () => {
    expect(stripTotalKm(stripFromWeek({ days }))).toBe(37);
  });

  it('measures a time-based session in minutes, against the longest time-based one', () => {
    const timed: Week7<Day> = [
      run({ label: 'ER', distanceKm: undefined, durationMin: 30 }),
      rest,
      run({ label: 'ER', distanceKm: undefined, durationMin: 45 }),
      rest,
      rest,
      run({ label: 'LR', distanceKm: undefined, durationMin: 60 }),
      rest,
    ];
    const strip = stripFromWeek({ days: timed });
    expect(strip[0]).toMatchObject({ value: 30, unit: 'min' });
    expect(strip[5]?.h).toBeCloseTo(REAL_WEEK_MAX_SHARE, 9);
    expect(strip[0]?.h).toBeCloseTo(0.5 * REAL_WEEK_MAX_SHARE, 9);
    // Minutes never count as kilometres.
    expect(stripTotalKm(strip)).toBe(0);
  });

  it('normalises each unit against its own longest session in a mixed week', () => {
    const mixed: Week7<Day> = [
      run({ label: 'ER', distanceKm: 7 }),
      run({ label: 'RR', effort: 'recovery', distanceKm: undefined, durationMin: 30 }),
      rest,
      run({ label: 'ER', distanceKm: undefined, durationMin: 45 }),
      rest,
      run({ label: 'LR', distanceKm: 14, isLongRun: true }),
      rest,
    ];
    const strip = stripFromWeek({ days: mixed });
    // Kilometres against the 14 km long run.
    expect(strip[5]?.h).toBeCloseTo(REAL_WEEK_MAX_SHARE, 9);
    expect(strip[0]?.h).toBeCloseTo((7 / 14) * REAL_WEEK_MAX_SHARE, 9);
    // Minutes against the 45-minute run — the 30-minute run is not taller than the long run.
    expect(strip[3]?.h).toBeCloseTo(REAL_WEEK_MAX_SHARE, 9);
    expect(strip[1]?.h).toBeCloseTo((30 / 45) * REAL_WEEK_MAX_SHARE, 9);
    expect(strip[1]?.h).toBeLessThan(strip[5]!.h);
    expect(strip[1]).toMatchObject({ value: 30, unit: 'min' });
    expect(stripTotalKm(strip)).toBe(21);
  });

  it('floors a tiny session so it is still a visible block', () => {
    const strip = stripFromWeek({
      days: [run({ label: 'SR', distanceKm: 1 }), rest, rest, rest, rest, run({ label: 'LR', distanceKm: 30 }), rest],
    });
    expect(strip[0]?.h).toBe(MIN_BLOCK_SHARE);
  });

  it('never shows a float tail on the headline number', () => {
    const strip = stripFromWeek({
      days: [run({ label: 'ER', distanceKm: 8.25 }), rest, rest, rest, rest, rest, rest],
    });
    expect(strip[0]?.value).toBe(8.3);
  });

  it('an all-rest week is the empty strip', () => {
    expect(stripFromWeek({ days: [rest, rest, rest, rest, rest, rest, rest] })).toEqual(EMPTY_STRIP_WEEK);
  });
});

describe('the pages’ fixed weeks', () => {
  it('V22-01’s hero week adds to 25 km across three runs', () => {
    expect(stripTotalKm(HERO_WEEK)).toBe(HERO_WEEK_TOTAL_KM);
    expect(stripRunCount(HERO_WEEK)).toBe(3);
    expect(HERO_WEEK.map((b) => b?.code ?? '·').join(' ')).toBe('ER · · TR · LR ·');
  });

  it('V22-03 stacks five weeks under week 1, every one seven slots wide', () => {
    expect(SURVEY_WEEKS).toHaveLength(5);
    for (const week of SURVEY_WEEKS) {
      expect(week).toHaveLength(7);
      for (const block of week) {
        if (block) expect(block.h).toBeLessThanOrEqual(1);
      }
    }
  });
});
