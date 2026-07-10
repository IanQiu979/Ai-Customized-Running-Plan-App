import {
  clampLongRun,
  clampWeeklyVolume,
  deloadEveryWeeks,
  deloadVolume,
  estimateMaxHr,
  hrZoneBpm,
  isValidDeload,
  toExperienceLevel,
} from '../loadRules';

describe('heart-rate zones', () => {
  it('estimates max HR from age', () => {
    expect(estimateMaxHr(35)).toBe(185);
  });

  it('reproduces the coaching doc worked example (age 35, zone 1 = 111-130)', () => {
    expect(hrZoneBpm(1, 35)).toEqual({ low: 111, high: 130 });
  });

  it('reproduces zone 2 for the same runner (130-148)', () => {
    expect(hrZoneBpm(2, 35)).toEqual({ low: 130, high: 148 });
  });
});

describe('experience mapping', () => {
  it('rounds down at the boundary, because a lower level means tighter caps', () => {
    expect(toExperienceLevel('new')).toBe('beginner');
    expect(toExperienceLevel('some')).toBe('beginner');
    expect(toExperienceLevel('regular')).toBe('intermediate');
    expect(toExperienceLevel('experienced')).toBe('intermediate');
    expect(toExperienceLevel('competitive')).toBe('advanced');
  });
});

describe('deload cadence', () => {
  it('tightens with experience', () => {
    expect(deloadEveryWeeks('beginner', 30)).toBe(4);
    expect(deloadEveryWeeks('intermediate', 30)).toBe(4);
    expect(deloadEveryWeeks('advanced', 30)).toBe(3);
  });

  it('forces a 3-week cadence at 50+, overriding level', () => {
    expect(deloadEveryWeeks('beginner', 50)).toBe(3);
    expect(deloadEveryWeeks('beginner', 62)).toBe(3);
  });
});

describe('weekly volume', () => {
  it('recalculates an over-aggressive week at 10%, not merely trimming it to 15%', () => {
    // 40 km -> a 50 km proposal is +25%; the rule rejects and rebuilds at +10%.
    expect(clampWeeklyVolume(40, 50, 'intermediate')).toBeCloseTo(44);
  });

  it('leaves a compliant increase alone', () => {
    expect(clampWeeklyVolume(40, 44, 'intermediate')).toBeCloseTo(44);
  });

  it('never exceeds the level ceiling, even after recalculation', () => {
    // Beginner recalc would give 41.8, but the absolute beginner ceiling is 40.
    expect(clampWeeklyVolume(38, 45, 'beginner')).toBe(40);
  });

  it('handles a first week, where there is no previous volume to grow from', () => {
    expect(clampWeeklyVolume(0, 25, 'beginner')).toBe(25);
    expect(clampWeeklyVolume(0, 60, 'beginner')).toBe(40);
  });
});

describe('deload weeks', () => {
  it('reduces by the midpoint of the 35-45% band', () => {
    expect(deloadVolume(50)).toBeCloseTo(30); // 40% off
  });

  it('accepts a reduction anywhere inside the band', () => {
    expect(isValidDeload(50, 32.5)).toBe(true); // 35%
    expect(isValidDeload(50, 27.5)).toBe(true); // 45%
  });

  it('rejects a deload that is too shallow or too deep', () => {
    expect(isValidDeload(50, 35)).toBe(false); // 30% — the old, superseded band
    expect(isValidDeload(50, 25)).toBe(false); // 50%
  });
});

describe('long run', () => {
  const intermediate = { level: 'intermediate' as const, previousLongestKm: 0 };

  it('caps at the level share of weekly volume (doc example: 50 km week -> 15 km)', () => {
    const { km, limitedBy } = clampLongRun({
      ...intermediate,
      proposedKm: 20,
      weeklyKm: 50,
    });
    expect(km).toBeCloseTo(15);
    expect(limitedBy).toBe('weekly-share');
  });

  it('caps a single-run spike at 110% of the plan its own previous longest', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 14,
      weeklyKm: 60, // share cap 18 km, so the spike cap must bind first
      previousLongestKm: 12,
    });
    expect(km).toBeCloseTo(13.2);
    expect(limitedBy).toBe('spike');
  });

  it('enforces the absolute single-run ceiling for the level', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'beginner',
      proposedKm: 30,
      weeklyKm: 100,
      previousLongestKm: 20,
    });
    expect(km).toBe(14);
    expect(limitedBy).toBe('absolute');
  });

  it('enforces the 3-hour time cap when an easy pace is known', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'advanced',
      proposedKm: 30,
      weeklyKm: 200,
      previousLongestKm: 40,
      easyPaceSecPerKm: 400, // 3 h at 6:40/km = 27 km
    });
    expect(km).toBeCloseTo(27);
    expect(limitedBy).toBe('time');
  });

  it('cannot enforce the time cap without a pace, and says so by not binding', () => {
    const { limitedBy } = clampLongRun({
      level: 'advanced',
      proposedKm: 30,
      weeklyKm: 200,
      previousLongestKm: 40,
    });
    expect(limitedBy).toBe('none');
  });

  it('leaves a compliant long run untouched', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 10,
      weeklyKm: 50,
      previousLongestKm: 12,
    });
    expect(km).toBe(10);
    expect(limitedBy).toBe('none');
  });
});
