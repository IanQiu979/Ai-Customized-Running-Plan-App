import { RACE_DISTANCE_KM } from '../planTypes';
import type { Performance } from '../planTypes';
import {
  RIEGEL_EXPONENT,
  deriveRacePaceTarget,
  deriveTrainingPaces,
  paceSecPerKm,
  riegelEquivalentSec,
} from '../paceDerivation';

// Fixture runner (docs/reference/coaching/example-plan-5k-pro.md): recent 5K in 22:30.
const RECENT_5K: Performance = { distance: '5k', timeSec: 1350 };

/**
 * Riegel cross-distance equivalency computed independently of the module under
 * test, per the plan's instruction not to hand-round expected values.
 * T2 = T1 x (D2/D1)^1.06.
 */
function riegelExpected(t1Sec: number, d1Km: number, d2Km: number): number {
  return Math.round(t1Sec * Math.pow(d2Km / d1Km, RIEGEL_EXPONENT));
}

describe('riegelEquivalentSec', () => {
  it('predicts 3K time from a 5K performance', () => {
    expect(riegelEquivalentSec(RECENT_5K, 3)).toBe(riegelExpected(1350, 5, 3));
  });

  it('predicts 10K time from a 5K performance', () => {
    expect(riegelEquivalentSec(RECENT_5K, 10)).toBe(riegelExpected(1350, 5, 10));
  });

  it('predicts half-marathon time from a 5K performance', () => {
    expect(riegelEquivalentSec(RECENT_5K, RACE_DISTANCE_KM.half)).toBe(
      riegelExpected(1350, 5, RACE_DISTANCE_KM.half),
    );
  });

  it('predicts marathon time from a 5K performance', () => {
    expect(riegelEquivalentSec(RECENT_5K, RACE_DISTANCE_KM.marathon)).toBe(
      riegelExpected(1350, 5, RACE_DISTANCE_KM.marathon),
    );
  });

  it('returns the input time unchanged when the target distance equals the performance distance', () => {
    expect(riegelEquivalentSec(RECENT_5K, RACE_DISTANCE_KM['5k'])).toBe(1350);
  });
});

describe('paceSecPerKm', () => {
  it('divides time by distance and rounds to the nearest whole second', () => {
    expect(paceSecPerKm(1350, 5)).toBe(270);
  });

  it('rounds a non-integer result', () => {
    expect(paceSecPerKm(1000, 3)).toBe(Math.round(1000 / 3));
  });
});

describe('deriveTrainingPaces', () => {
  it('returns an empty object when there is no recent performance', () => {
    expect(deriveTrainingPaces(undefined, 'intermediate')).toEqual({});
  });

  it('derives the tempo band from the fixture 5K (10K-to-half pace feel, Zone 3)', () => {
    const paces = deriveTrainingPaces(RECENT_5K, 'intermediate');
    expect(paces.tempo).toEqual({ lowSecPerKm: 281, highSecPerKm: 294 });
  });

  it('derives the interval band from the fixture 5K (3K-to-5K pace feel, Zone 4)', () => {
    const paces = deriveTrainingPaces(RECENT_5K, 'intermediate');
    expect(paces.interval).toEqual({ lowSecPerKm: 262, highSecPerKm: 270 });
  });

  it('never derives a steady pace (NEEDS-IAN #2 is still open, do not invent)', () => {
    expect(deriveTrainingPaces(RECENT_5K, 'beginner').steady).toBeUndefined();
    expect(deriveTrainingPaces(RECENT_5K, 'intermediate').steady).toBeUndefined();
    expect(deriveTrainingPaces(RECENT_5K, 'advanced').steady).toBeUndefined();
  });

  it('derives a beginner easy-pace band by inverting the tempo offset (Addendum A1: +30/+45)', () => {
    const paces = deriveTrainingPaces(RECENT_5K, 'beginner');
    expect(paces.easy).toEqual({ lowSecPerKm: 281 + 30, highSecPerKm: 294 + 45 });
  });

  it('derives an intermediate easy-pace band by inverting the tempo offset (Addendum A1: +45/+60)', () => {
    const paces = deriveTrainingPaces(RECENT_5K, 'intermediate');
    expect(paces.easy).toEqual({ lowSecPerKm: 281 + 45, highSecPerKm: 294 + 60 });
  });

  it('never derives an easy pace for advanced runners (no source offset exists — HR/RPE only)', () => {
    expect(deriveTrainingPaces(RECENT_5K, 'advanced').easy).toBeUndefined();
  });
});

describe('deriveRacePaceTarget', () => {
  // RESYNCED 2026-07-11, cycle-2 correction pass. This describe block used to assert the
  // 2026-07-10 R-A addendum's >10%-goal-improvement gate: pin the race-pace target flat at
  // the recent-equivalent pace once the goal implied more than a 10% improvement. Per the
  // doc's "Pace bands" cycle-2 note, that gate behavior "contradicts ruling 3's week-11
  // prescription... (goal pace, 4:00/km = 240 s/km, directly)" and is stale, not
  // authoritative. Ruling 3 only settles *when* a session converges to goal pace (the
  // race-specific phase) — it does not answer the separate, still-open question of what to do
  // when a declared goal looks implausible in the first place (Open item 5). No threshold or
  // fallback behavior is invented here to fill that gap; the old gated-boundary test is
  // retired in favour of an `it.todo` naming the open question below.

  it("anchors to goal pace even when the goal implies a large improvement over recent form (ruling 3 — fixture: 20:00 goal vs 22:30 recent, an 11.1% implied improvement, the exact case the old gate fired on)", () => {
    const target = deriveRacePaceTarget({
      goalTimeSec: 1200,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    expect(target).toEqual({
      pace: { lowSecPerKm: 240, highSecPerKm: 240 },
      source: 'goal',
    });
  });

  it('uses the goal pace when the goal is slower than the recent-equivalent time', () => {
    const target = deriveRacePaceTarget({
      goalTimeSec: 1400,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    expect(target?.source).toBe('goal');
  });

  it('returns undefined without a recent performance, even with a goal time', () => {
    expect(
      deriveRacePaceTarget({ goalTimeSec: 1200, raceDistance: '5k' }),
    ).toBeUndefined();
  });

  it('returns undefined without a goal time, even with a recent performance', () => {
    expect(
      deriveRacePaceTarget({ raceDistance: '5k', recent: RECENT_5K }),
    ).toBeUndefined();
  });

  // docs/reference/coaching/example-plan-5k-pro.md, "Open — needs Ian", item 5: "when a
  // declared goal is implausibly faster than the runner's recent-equivalent performance ...
  // should the app warn at intake, cap the race-pace-rep target, or trust the goal outright?
  // Ruling 3 answers *when* a session converges to goal pace across a plan; it does not answer
  // what to do when the goal itself looks unrealistic. No threshold or behavior is assumed
  // here — needs Ian's call."
  it.todo(
    'goal-realism handling for an implausible goal (warn at intake vs. cap the race-pace target vs. trust it outright) — Open item 5, needs Ian before this is testable',
  );
});
