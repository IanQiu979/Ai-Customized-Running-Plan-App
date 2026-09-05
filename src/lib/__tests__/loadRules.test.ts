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
  isUnder18,
  isValidDeload,
  LONG_RUN_SHARE_CAP,
  longRunShareCap,
  MAX_SINGLE_RUN_KM,
  redFlagVolumeReductionPct,
  RED_FLAG_VOLUME_REDUCTION_PCT,
  rpeForZone,
  RPE_FOR_ZONE,
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

describe('youth (under-18) — RPE replaces HR zones', () => {
  it('classifies under-18 by strict less-than, 18 itself counts as adult', () => {
    expect(isUnder18(17)).toBe(true);
    expect(isUnder18(18)).toBe(false);
    expect(isUnder18(10)).toBe(true);
  });

  it('maps each zone to the training-zones.md RPE scale entry that names that exact zone', () => {
    expect(rpeForZone(1)).toBe(3); // "RPE 3 | Zone 1 | Light. Easy run, fully comfortable."
    expect(rpeForZone(2)).toBe(5); // "RPE 5 | Zone 2 | Somewhat hard. Steady state."
    expect(rpeForZone(3)).toBe(7); // "RPE 7 | Zone 3 | Very hard. Threshold effort."
    expect(rpeForZone(4)).toBe(8); // "RPE 8 | Zone 4 | Very very hard. VO2 max effort."
    expect(rpeForZone(5)).toBe(10); // "RPE 10 | Zone 5 | Maximum effort. All-out sprint."
    expect(RPE_FOR_ZONE).toEqual({ 1: 3, 2: 5, 3: 7, 4: 8, 5: 10 });
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

  it('holds a first week at the baseline the runner declared', () => {
    // No previous loading week means the growth rule cannot fire, so the only other bound was the
    // level's absolute ceiling — a ceiling for a trained runner, not a one-week step for this one.
    expect(
      clampWeeklyVolume({
        lastLoadingWeekKm: 0,
        proposedKm: 48,
        level: 'intermediate',
        baselineWeeklyKm: 35,
      }),
    ).toBe(35);
    expect(
      clampWeeklyVolume({
        lastLoadingWeekKm: 0,
        proposedKm: 30,
        level: 'intermediate',
        baselineWeeklyKm: 35,
      }),
    ).toBe(30);
    // The absolute ceiling still wins over an implausible baseline.
    expect(
      clampWeeklyVolume({
        lastLoadingWeekKm: 0,
        proposedKm: 500,
        level: 'beginner',
        baselineWeeklyKm: 500,
      }),
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

  describe('the run-count ladder only ever loosens the flat cap', () => {
    const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

    // The flat table is the floor, not the reference point the ladder rotates around. A bare
    // `margin / n` also *tightened* the cap at high run counts (advanced 35% -> 23.3% at six runs
    // a week, 20.0% at seven), halving the long runs on the marathon and half plans the flat cap
    // was signed off for. Nobody asked for that; it is not what the ladder ruling authorised.
    it.each([5, 6, 7])('leaves a %i-run week on exactly the flat per-level cap', (runCount) => {
      for (const level of LEVELS) {
        expect(longRunShareCap(level, runCount)).toBeCloseTo(LONG_RUN_SHARE_CAP[level], 10);
      }
    });

    it('never returns less than the flat cap at any run count the engine can produce', () => {
      for (const level of LEVELS) {
        for (let runCount = 1; runCount <= 7; runCount += 1) {
          expect(longRunShareCap(level, runCount)).toBeGreaterThanOrEqual(
            LONG_RUN_SHARE_CAP[level] - 1e-12,
          );
        }
      }
    });

    it('raises the cap above 1/n at every run count the engine can produce, so it is satisfiable', () => {
      // The reachability argument the ruling rests on: an n-run week is n positive numbers
      // summing to a whole, so its largest entry is never below 1/n. A cap at or under 1/n is
      // unsatisfiable by arithmetic, not by unsafe coaching.
      for (const level of LEVELS) {
        for (let runCount = 3; runCount <= 7; runCount += 1) {
          expect(longRunShareCap(level, runCount)).toBeGreaterThan(1 / runCount);
        }
      }
    });

    it('keeps the level ordering monotonic at every run count', () => {
      for (let runCount = 3; runCount <= 7; runCount += 1) {
        expect(longRunShareCap('beginner', runCount)).toBeLessThan(
          longRunShareCap('intermediate', runCount),
        );
        expect(longRunShareCap('intermediate', runCount)).toBeLessThan(
          longRunShareCap('advanced', runCount),
        );
      }
    });

    it('loosens monotonically as run count falls', () => {
      for (const level of LEVELS) {
        for (let runCount = 4; runCount <= 7; runCount += 1) {
          expect(longRunShareCap(level, runCount - 1)).toBeGreaterThanOrEqual(
            longRunShareCap(level, runCount),
          );
        }
      }
    });
  });

  describe('the spike ceiling limits the rate of growth, it never forbids growth outright', () => {
    it('keeps the raw fractional ceiling by default, so the coach-authored path is untouched', () => {
      const { km, limitedBy } = clampLongRun({
        proposedKm: 6,
        weeklyKm: 100,
        level: 'intermediate',
        previousLongestKm: 5,
      });
      expect(km).toBeCloseTo(5.5);
      expect(limitedBy).toBe('spike');
    });

    // The rule is "no more than 10% over the plan's previous longest". Below 10 km a *fractional*
    // ceiling made that rule forbid every increase instead of limiting it: the engine renders whole
    // kilometres, so a previous longest of 5 km gave a 5.5 km ceiling, floored back to 5 km, and
    // the long run could never move again for the rest of the plan. The rendered distance is still
    // floored; the growth the ceiling *permits* is rounded up.
    it('lets a 5 km previous longest reach 6 km when nothing else binds', () => {
      const { km, limitedBy } = clampLongRun({
        proposedKm: 6,
        weeklyKm: 100,
        level: 'intermediate',
        previousLongestKm: 5,
        roundSpikeCeilingUp: true,
      });
      expect(km).toBe(6);
      expect(limitedBy).toBe('none');
    });

    it('still refuses a second kilometre of growth in the same step', () => {
      const { km, limitedBy } = clampLongRun({
        proposedKm: 7,
        weeklyKm: 100,
        level: 'intermediate',
        previousLongestKm: 5,
        roundSpikeCeilingUp: true,
      });
      expect(km).toBe(6);
      expect(limitedBy).toBe('spike');
    });

    it('leaves the share cap binding — the loosened spike ceiling never overrides it', () => {
      // 0.25 x 20 = 5 km, tighter than the 6 km the spike ceiling now permits.
      const { km, limitedBy } = clampLongRun({
        proposedKm: 6,
        weeklyKm: 20,
        level: 'beginner',
        previousLongestKm: 5,
        roundSpikeCeilingUp: true,
      });
      expect(km).toBe(5);
      expect(limitedBy).toBe('weekly-share');
    });

    it('leaves the absolute single-run ceiling binding too', () => {
      const { km, limitedBy } = clampLongRun({
        proposedKm: 20,
        weeklyKm: 200,
        level: 'beginner',
        previousLongestKm: 14,
        roundSpikeCeilingUp: true,
      });
      expect(km).toBe(MAX_SINGLE_RUN_KM.beginner);
      expect(limitedBy).toBe('absolute');
    });
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

  it('caps a single-run spike at 110% of the plan its own previous longest, rounded up to a whole kilometre', () => {
    const { km, limitedBy } = clampLongRun({
      level: 'intermediate',
      proposedKm: 20,
      weeklyKm: 80, // share cap 25.6 km (0.32), so the spike cap must bind first
      previousLongestKm: 12,
      roundSpikeCeilingUp: true,
    });
    // 12 x 1.10 = 13.2 km; the engine renders whole kilometres, so the ceiling is the next one up.
    expect(km).toBe(14);
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
      previousLongestKm: 6, // spike cap: ceil(6 * 1.10) = 7, tighter than the proposed 8
      isDeload: true,
      lastLoadingWeekKm: 38,
      roundSpikeCeilingUp: true,
    });
    expect(km).toBe(7);
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

  it('gives a red-flag injury its own flat 15% reduction, distinct from the per-flag table', () => {
    expect(RED_FLAG_VOLUME_REDUCTION_PCT).toBe(0.15);
    expect(redFlagVolumeReductionPct(['ankle_achilles'])).toBe(0.15);
    expect(redFlagVolumeReductionPct(['ankle_achilles', 'knee'])).toBe(0.15);
    expect(redFlagVolumeReductionPct(['knee'])).toBe(0);
    expect(redFlagVolumeReductionPct(['none'])).toBe(0);
    expect(redFlagVolumeReductionPct([])).toBe(0);
  });
});
