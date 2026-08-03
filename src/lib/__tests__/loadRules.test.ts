import {
  clampLongRun,
  clampWeeklyVolume,
  deloadEveryWeeks,
  deloadVolume,
  estimateMaxHr,
  hasDeclaredInjury,
  hasRedFlagInjury,
  hrZoneBpm,
  injuryVolumeReductionPct,
  INJURY_VOLUME_REDUCTION_PCT,
  isValidDeload,
  LONG_RUN_SHARE_CAP,
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
  it('tightens with experience — Ian 2026-08-03: pro runners = 3 weeks, beginners = 4', () => {
    expect(deloadEveryWeeks('beginner', 30)).toBe(4);
    expect(deloadEveryWeeks('intermediate', 30)).toBe(4);
    expect(deloadEveryWeeks('advanced', 30)).toBe(3);
  });

  it('keeps intermediate at 4 — the source gives "every 3–4 weeks" and the ruling only touches the extremes', () => {
    expect(deloadEveryWeeks('intermediate', 30)).toBe(4);
    expect(deloadEveryWeeks('intermediate', 49)).toBe(4);
  });

  it('forces a 3-week cadence at 50+, overriding every experience level', () => {
    expect(deloadEveryWeeks('beginner', 50)).toBe(3);
    expect(deloadEveryWeeks('intermediate', 50)).toBe(3);
    expect(deloadEveryWeeks('advanced', 50)).toBe(3);
    expect(deloadEveryWeeks('beginner', 62)).toBe(3);
    expect(deloadEveryWeeks('advanced', 62)).toBe(3);
  });
});

describe('weekly volume', () => {
  it('recalculates an over-aggressive week at 10%, not merely trimming it to 15%', () => {
    // 40 km -> a 50 km proposal is +25%; the rule rejects and rebuilds at +10%.
    expect(
      clampWeeklyVolume({ lastLoadingWeekKm: 40, proposedKm: 50, level: 'intermediate' }),
    ).toBeCloseTo(44);
  });

  it('leaves a compliant increase alone', () => {
    expect(
      clampWeeklyVolume({ lastLoadingWeekKm: 40, proposedKm: 44, level: 'intermediate' }),
    ).toBeCloseTo(44);
  });

  it('never exceeds the level ceiling, even after recalculation', () => {
    // Beginner recalc would give 41.8, but the absolute beginner ceiling is 40.
    expect(
      clampWeeklyVolume({ lastLoadingWeekKm: 38, proposedKm: 45, level: 'beginner' }),
    ).toBe(40);
  });

  it('handles a first week, where there is no previous volume to grow from', () => {
    expect(
      clampWeeklyVolume({ lastLoadingWeekKm: 0, proposedKm: 25, level: 'beginner' }),
    ).toBe(25);
    expect(
      clampWeeklyVolume({ lastLoadingWeekKm: 0, proposedKm: 60, level: 'beginner' }),
    ).toBe(40);
  });

  it('compares a post-deload proposal against the last loading week, not the deload week', () => {
    expect(
      clampWeeklyVolume({
        lastLoadingWeekKm: 38,
        proposedKm: 41,
        level: 'intermediate',
      }),
    ).toBe(41);
    expect(
      clampWeeklyVolume({
        lastLoadingWeekKm: 48,
        proposedKm: 45,
        level: 'intermediate',
      }),
    ).toBe(45);
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

  it('pins the cap ladder exactly (guards against a silent ladder mutation slipping past every other assertion)', () => {
    expect(LONG_RUN_SHARE_CAP).toEqual({ beginner: 0.25, intermediate: 0.32, advanced: 0.35 });
  });

  it('caps at the level share of weekly volume (doc example: 50 km week -> 16 km, issue #34 ruling R1a\'s 0.32 intermediate cap)', () => {
    const { km, limitedBy } = clampLongRun({
      ...intermediate,
      proposedKm: 20,
      weeklyKm: 50,
    });
    expect(km).toBeCloseTo(16);
    expect(limitedBy).toBe('weekly-share');
  });

  it('caps at the beginner share of weekly volume (0.25) when the beginner ceiling is the actually-binding one', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'beginner',
      proposedKm: 13,
      weeklyKm: 40, // 0.25 * 40 = 10 km, tighter than the 13 km proposal and the 14 km absolute cap
      previousLongestKm: 0,
    });
    expect(km).toBeCloseTo(10);
    expect(limitedBy).toBe('weekly-share');
  });

  it('caps at the advanced share of weekly volume (0.35) when the advanced ceiling is the actually-binding one', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'advanced',
      proposedKm: 34,
      weeklyKm: 90, // 0.35 * 90 = 31.5 km, tighter than the 34 km proposal and the 35 km absolute cap
      previousLongestKm: 0,
    });
    expect(km).toBeCloseTo(31.5);
    expect(limitedBy).toBe('weekly-share');
  });

  it('caps a single-run spike at 110% of the plan its own previous longest', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 14,
      weeklyKm: 60, // share cap 19.2 km (0.32), so the spike cap must bind first
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

describe('long run — deload weekly-share ceiling measured against the last loading week (issue #34 ruling R1c, closes the R1b HIGH-severity hole)', () => {
  it('would be clamped by the weekly-share cap in a loading week', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 8,
      weeklyKm: 23, // 8/23 = 34.8%, above the 32% intermediate cap
      previousLongestKm: 0,
    });
    expect(km).toBeCloseTo(7.36);
    expect(limitedBy).toBe('weekly-share');
  });

  it('isDeload alone no longer exempts anything — with no lastLoadingWeekKm, the ceiling falls ' +
    'back to weeklyKm and still binds. This is the R1b hole: a model emitting isDeload: true ' +
    'must not be able to disable its own safety ceiling', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 8,
      weeklyKm: 23,
      previousLongestKm: 0,
      isDeload: true,
    });
    expect(km).toBeCloseTo(7.36);
    expect(limitedBy).toBe('weekly-share');
  });

  it('falls back to weeklyKm when lastLoadingWeekKm fails isValidDeload against it — an ' +
    'unsubstantiated isDeload claim gains the caller nothing', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 8,
      weeklyKm: 23,
      previousLongestKm: 0,
      isDeload: true,
      lastLoadingWeekKm: 23, // 0% reduction off itself — fails isValidDeload
    });
    expect(km).toBeCloseTo(7.36);
    expect(limitedBy).toBe('weekly-share');
  });

  it("measures the ceiling against lastLoadingWeekKm for a genuine deload — the golden week-4 " +
    'shape: 23 km deload week, 38 km last loading week, a 39.5% reduction inside the 35-45% ' +
    "band, so the 8 km long run (21.1% of 38) sits well under the 32% cap (12.16 km)", () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 8,
      weeklyKm: 23,
      previousLongestKm: 0,
      isDeload: true,
      lastLoadingWeekKm: 38,
    });
    expect(km).toBe(8);
    expect(limitedBy).toBe('none');
  });

  it('still registers the weekly-share ceiling for a genuine deload — the denominator changes, ' +
    'the ceiling itself never disappears', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 13,
      weeklyKm: 23,
      previousLongestKm: 0,
      isDeload: true,
      lastLoadingWeekKm: 38, // valid deload; share cap = 0.32 * 38 = 12.16, tighter than 13
    });
    expect(km).toBeCloseTo(12.16);
    expect(limitedBy).toBe('weekly-share');
  });

  it('still enforces the spike cap on a deload long run, even when the share cap is measured ' +
    'against the last loading week', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 8,
      weeklyKm: 23,
      previousLongestKm: 6, // spike cap: 6 * 1.10 = 6.6, tighter than the proposed 8
      isDeload: true,
      lastLoadingWeekKm: 38,
    });
    expect(km).toBeCloseTo(6.6);
    expect(limitedBy).toBe('spike');
  });

  it('still enforces the absolute single-run cap on a deload long run', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'beginner',
      proposedKm: 20,
      weeklyKm: 36,
      previousLongestKm: 0,
      isDeload: true,
      lastLoadingWeekKm: 60, // valid deload: (60-36)/60 = 40%; share cap = 0.25 * 60 = 15,
      // looser than the beginner absolute cap (14), so absolute binds instead
    });
    expect(km).toBe(14); // beginner absolute cap
    expect(limitedBy).toBe('absolute');
  });

  it('still enforces the 3-hour time cap on a deload long run when a pace is known', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'advanced',
      proposedKm: 30,
      weeklyKm: 50,
      previousLongestKm: 0,
      isDeload: true,
      lastLoadingWeekKm: 90, // valid deload: (90-50)/90 = 44.4%; share cap = 0.35 * 90 = 31.5
      easyPaceSecPerKm: 400, // 3 h at 6:40/km = 27 km
    });
    expect(km).toBeCloseTo(27);
    expect(limitedBy).toBe('time');
  });
});

describe('declared-injury volume adjustment (scout report Bug 1 / mandated finding B)', () => {
  it('sources knee and shin splints at 15% (injury_flags.md:29,49)', () => {
    expect(INJURY_VOLUME_REDUCTION_PCT.knee).toBe(0.15);
    expect(INJURY_VOLUME_REDUCTION_PCT.shin_splints).toBe(0.15);
  });

  it('sources the new plantar_arch flag at 20% (Ruling 2; injury_flags.md:69)', () => {
    expect(INJURY_VOLUME_REDUCTION_PCT.plantar_arch).toBe(0.2);
  });

  it('gives no reduction for none', () => {
    expect(INJURY_VOLUME_REDUCTION_PCT.none).toBe(0);
  });

  it('takes the most conservative (largest) reduction across multiple declared injuries', () => {
    expect(injuryVolumeReductionPct(['knee', 'plantar_arch'])).toBeCloseTo(0.2);
    expect(injuryVolumeReductionPct(['shin_splints'])).toBeCloseTo(0.15);
    expect(injuryVolumeReductionPct(['none'])).toBe(0);
  });

  it('treats an empty or all-none injuries array as no declared injury', () => {
    expect(hasDeclaredInjury(['none'])).toBe(false);
    expect(hasDeclaredInjury([])).toBe(false);
    expect(hasDeclaredInjury(['knee'])).toBe(true);
    expect(hasDeclaredInjury(['none', 'hip_glute'])).toBe(true);
  });

  it("flags ankle_achilles as the closed set's red-flag member and nothing else as red-flag by default", () => {
    expect(hasRedFlagInjury(['ankle_achilles'])).toBe(true);
    expect(hasRedFlagInjury(['knee'])).toBe(false);
    expect(hasRedFlagInjury(['plantar_arch'])).toBe(false);
    expect(hasRedFlagInjury(['none'])).toBe(false);
  });
});
