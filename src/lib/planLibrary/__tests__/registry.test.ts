/**
 * The register itself — § 1 and § 4 of `planning/research/plan-blueprint-examples.md`.
 *
 * These pin the ported tables against the source document. A failure here means the port drifted
 * from Ian's coaching source, not that the engine misbehaved.
 */

import {
  CANONICAL_WEEKS,
  DOSE_LADDER,
  EXPERIENCE_LIMITS,
  EXPERIENCE_TRACKS,
  LIBRARY_DISTANCES,
  LIBRARY_PLAN_IDS,
  LONG_RUN_LADDER,
  PLACEMENT_LAYOUTS,
  RUNNER_PROFILES,
  VOLUME_STATE_TARGETS,
} from '../registry';
import { LIBRARY_CALENDARS } from '../calendars';
import { DELOAD_REDUCTION_MAX, DELOAD_REDUCTION_MIN } from '../../loadRules';

describe('the 40-plan register (§ 1)', () => {
  it('registers exactly 40 unique plan IDs', () => {
    expect(LIBRARY_PLAN_IDS).toHaveLength(40);
    expect(new Set(LIBRARY_PLAN_IDS).size).toBe(40);
  });

  it('is 5 experience answers × 2 runner profiles × 4 distances', () => {
    expect(EXPERIENCE_TRACKS).toHaveLength(5);
    expect(RUNNER_PROFILES).toHaveLength(2);
    expect(LIBRARY_DISTANCES).toHaveLength(4);
    for (const distance of LIBRARY_DISTANCES) {
      for (const track of EXPERIENCE_TRACKS) {
        for (const profile of RUNNER_PROFILES) {
          expect(LIBRARY_PLAN_IDS).toContain(`${distance}-${track}-${profile}`);
        }
      }
    }
  });
});

describe('the canonical calendars (§ 8, § 11–14)', () => {
  it('uses the canonical lengths 12 / 14 / 16 / 24', () => {
    expect(CANONICAL_WEEKS).toEqual({ '5K': 12, '10K': 14, HM: 16, M: 24 });
  });

  it('has exactly one row per canonical week, numbered in order', () => {
    for (const distance of LIBRARY_DISTANCES) {
      const calendar = LIBRARY_CALENDARS[distance];
      expect(calendar).toHaveLength(CANONICAL_WEEKS[distance]);
      calendar.forEach((week, index) => expect(week.week).toBe(index + 1));
    }
  });

  it('ends every calendar on a race week whose Day 7 is the race (§ 2 rule 5)', () => {
    for (const distance of LIBRARY_DISTANCES) {
      const calendar = LIBRARY_CALENDARS[distance];
      const last = calendar[calendar.length - 1]!;
      expect(last.state).toBe('RACE-WEEK');
      expect(last.longRun).toBe('RACE');
    }
  });

  it('gives 5K, 10K and half one taper week and the marathon two (§ 8 resolution 6)', () => {
    const taperCount = (distance: keyof typeof LIBRARY_CALENDARS): number =>
      LIBRARY_CALENDARS[distance].filter(
        (week) => week.state === 'TAPER-1' || week.state === 'TAPER-2',
      ).length;
    expect(taperCount('5K')).toBe(1);
    expect(taperCount('10K')).toBe(1);
    expect(taperCount('HM')).toBe(1);
    expect(taperCount('M')).toBe(2);
  });

  it('never prescribes a demanding session in weeks 1–3 (§ 2 rule 2)', () => {
    const demanding = new Set(['T', 'CR', 'I', 'RP5', 'RP10', 'HMP', 'MP', 'TU', 'FF']);
    for (const distance of LIBRARY_DISTANCES) {
      for (const week of LIBRARY_CALENDARS[distance].slice(0, 3)) {
        for (const lane of [week.spd, week.end]) {
          expect(demanding.has(lane.q1?.code ?? '')).toBe(false);
          expect(demanding.has(lane.q2?.code ?? '')).toBe(false);
        }
        expect(week.longRunQuality).toBeUndefined();
      }
    }
  });
});

describe('the dose ladder (§ 4)', () => {
  it('supplies a dose for every track on every row except NEW’s hill sprints', () => {
    for (const [key, row] of Object.entries(DOSE_LADDER)) {
      for (const track of EXPERIENCE_TRACKS) {
        if (key === 'HS-A' && track === 'NEW') {
          expect(row[track]).toBeNull();
          continue;
        }
        expect(row[track]).toBeTruthy();
      }
    }
  });

  it('never lets a track’s quality allowance exceed its stated maximum (§ 2 rule 4)', () => {
    expect(EXPERIENCE_LIMITS.NEW.maxQualitySessions).toBe(1);
    expect(EXPERIENCE_LIMITS.SOME.maxQualitySessions).toBe(1);
    expect(EXPERIENCE_LIMITS.COMP.maxQualitySessions).toBe(3);
    for (const track of EXPERIENCE_TRACKS) {
      const limits = EXPERIENCE_LIMITS[track];
      expect(limits.normalQualitySessions).toBeLessThanOrEqual(limits.maxQualitySessions);
    }
  });

  it('keeps the long-run ladder monotonic across tracks and rising with distance (§ 9)', () => {
    for (const distance of LIBRARY_DISTANCES) {
      const ladder = LONG_RUN_LADDER[distance];
      let previousLow = 0;
      let previousHigh = 0;
      for (const track of EXPERIENCE_TRACKS) {
        const [low, high] = ladder[track];
        expect(low).toBeLessThan(high);
        expect(low).toBeGreaterThan(previousLow);
        expect(high).toBeGreaterThanOrEqual(previousHigh);
        previousLow = low;
        previousHigh = high;
      }
    }
    expect(LONG_RUN_LADDER.M.COMP[1]).toBe(180);
  });
});

describe('the placement layouts (§ 6)', () => {
  it('fixes Day 7 as the long run or the race in every layout (§ 2 rule 5)', () => {
    for (const layout of Object.values(PLACEMENT_LAYOUTS)) {
      expect(layout[6]).toBe('LR/RACE');
    }
  });

  it('has exactly as many running slots as its own day count', () => {
    for (const [days, layout] of Object.entries(PLACEMENT_LAYOUTS)) {
      expect(layout.filter((slot) => slot !== 'REST')).toHaveLength(Number(days));
    }
  });

  it('separates hard days: Q1 and Q2 are never adjacent (§ 2 rule 6)', () => {
    for (const layout of Object.values(PLACEMENT_LAYOUTS)) {
      const q1 = layout.indexOf('Q1');
      const q2 = layout.indexOf('Q2/E');
      if (q1 >= 0 && q2 >= 0) expect(Math.abs(q1 - q2)).toBeGreaterThan(1);
      // Day 7 is always the long run, so Q2 must not sit on Day 6 either.
      if (q2 >= 0) expect(q2).toBeLessThan(5);
    }
  });
});

describe('the weekly-volume state machine (§ 5)', () => {
  it('uses the captain’s 15–25% recovery band, not the library’s superseded 35–45%', () => {
    const [low, high] = VOLUME_STATE_TARGETS.RECOVERY.previousLoadingMultiplier!;
    expect(1 - high).toBeCloseTo(DELOAD_REDUCTION_MIN, 10);
    expect(1 - low).toBeCloseTo(DELOAD_REDUCTION_MAX, 10);
    expect(VOLUME_STATE_TARGETS.RECOVERY.target).toBeCloseTo(0.8, 10);
  });

  it('never lets a recovery target reach a loading target', () => {
    expect(VOLUME_STATE_TARGETS.RECOVERY.target!).toBeLessThan(
      VOLUME_STATE_TARGETS.HOLD.previousLoadingMultiplier![0],
    );
  });
});
