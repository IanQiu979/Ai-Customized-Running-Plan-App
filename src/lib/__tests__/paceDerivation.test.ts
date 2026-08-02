/**
 * Pace-derivation contract for the plan engine (GitHub issue #3).
 *
 * This began as a red-first TDD suite and was un-quarantined when
 * `src/lib/paceDerivation.ts` landed. Its expectations pin every current coaching ruling.
 */

import { RACE_DISTANCE_KM } from '../planTypes';
import type { Performance } from '../planTypes';
import {
  GOAL_AMBITIOUS_THRESHOLD_PCT,
  GOAL_IMPLAUSIBLE_THRESHOLD_PCT,
  RIEGEL_EXPONENT,
  assessGoalRealism,
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

/**
 * The capped time an implausible goal is pinned to: the recent-equivalent improved by
 * exactly the implausible threshold. Derived from the constant rather than written as a
 * literal 0.85, so moving the threshold moves every expectation below with it instead of
 * leaving them silently asserting a retired cap. The threshold *values* themselves are
 * pinned once, in the "ruled thresholds" block below — that is what stops this from
 * merely re-deriving whatever the implementation happens to say.
 */
function cappedExpected(equivalentTimeSec: number): number {
  return Math.round(
    equivalentTimeSec * (1 - GOAL_IMPLAUSIBLE_THRESHOLD_PCT / 100),
  );
}

describe('goal-realism thresholds', () => {
  // Ian's ruling, 2026-07-12 (docs/superpowers/specs/2026-07-12-goal-realism-design.md).
  // The coaching source has no goal-realism rule to port — `COMPLETENESS.md` lists it under
  // what the library is missing — so these two numbers are his, and nothing but his ruling
  // may change them. Pinned literally here, and only here; every other expectation in this
  // file derives from them.
  it('warns above 10% implied improvement and caps above 15%', () => {
    expect(GOAL_AMBITIOUS_THRESHOLD_PCT).toBe(10);
    expect(GOAL_IMPLAUSIBLE_THRESHOLD_PCT).toBe(15);
  });
});

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
  // retired in favour of an `it.todo` naming the open question below. RESOLVED 2026-07-12 by
  // the goal-realism ruling (`docs/superpowers/specs/2026-07-12-goal-realism-design.md`): the
  // `it.todo` below is replaced with real tests, and `assessGoalRealism()` is the answer.

  it("anchors to goal pace even when the goal implies a large improvement over recent form (ruling 3 — fixture: 20:00 goal vs 22:30 recent, an 11.1% implied improvement, the exact case the old gate fired on)", () => {
    const target = deriveRacePaceTarget({
      goalTimeSec: 1200,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    const equivalentTimeSec = riegelExpected(1350, 5, 5);
    const impliedImprovementPct =
      ((equivalentTimeSec - 1200) / equivalentTimeSec) * 100;
    expect(target).toEqual({
      pace: { lowSecPerKm: 240, highSecPerKm: 240 },
      source: 'goal',
      realism: 'ambitious',
      impliedImprovementPct,
    });
  });

  it('uses the goal pace when the goal is slower than the recent-equivalent time', () => {
    const target = deriveRacePaceTarget({
      goalTimeSec: 1400,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    const equivalentTimeSec = riegelExpected(1350, 5, 5);
    const impliedImprovementPct =
      ((equivalentTimeSec - 1400) / equivalentTimeSec) * 100;
    expect(target).toEqual({
      pace: { lowSecPerKm: paceSecPerKm(1400, 5), highSecPerKm: paceSecPerKm(1400, 5) },
      source: 'goal',
      realism: 'realistic',
      impliedImprovementPct,
    });
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

  it("caps the RP anchor and reports source: 'capped' for an implausible goal (declared 18:00 vs 22:30 recent, a 20% implied improvement)", () => {
    const target = deriveRacePaceTarget({
      goalTimeSec: 1080,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    const equivalentTimeSec = riegelExpected(1350, 5, 5);
    const impliedImprovementPct =
      ((equivalentTimeSec - 1080) / equivalentTimeSec) * 100;
    const cappedTimeSec = cappedExpected(equivalentTimeSec);
    const cappedPace = paceSecPerKm(cappedTimeSec, 5);
    expect(target).toEqual({
      pace: { lowSecPerKm: cappedPace, highSecPerKm: cappedPace },
      source: 'capped',
      realism: 'implausible',
      impliedImprovementPct,
    });
  });

  // The two tests below guard the seam between `assessGoalRealism` (which decides the
  // verdict) and `deriveRacePaceTarget` (which picks the anchor). The spec's whole safety
  // claim is that these cannot disagree, because both read the same function. Nothing
  // enforces that unless a test sits exactly on the boundary — so these do.

  it("does not cap a goal sitting exactly on the implausible threshold — 15.0% is still 'ambitious', so the anchor is the raw goal pace", () => {
    // A 33:20 recent 5K makes the 15% boundary land on a whole second (2000 -> 1700), which
    // is what lets this test address the boundary exactly. An implementation that caps on
    // `>= 15` instead of `> 15` returns source 'capped' here and fails — which is the entire
    // point of the test.
    const recent: Performance = { distance: '5k', timeSec: 2000 };
    const goalTimeSec = 2000 * (1 - GOAL_IMPLAUSIBLE_THRESHOLD_PCT / 100);
    const target = deriveRacePaceTarget({
      goalTimeSec,
      raceDistance: '5k',
      recent,
    });
    const goalPace = paceSecPerKm(goalTimeSec, RACE_DISTANCE_KM['5k']);
    expect(target).toEqual({
      pace: { lowSecPerKm: goalPace, highSecPerKm: goalPace },
      source: 'goal',
      realism: 'ambitious',
      impliedImprovementPct: ((2000 - goalTimeSec) / 2000) * 100,
    });
  });

  it('crosses the cap without a cliff: one second of extra ambition flips the anchor from goal to capped but must not move the prescribed rep pace', () => {
    // The fixture runner is the one that makes this real: 1350 x 0.85 = 1147.5, a NON-integer,
    // so `Math.round` in the cap is live rather than a no-op. Straddle it with integer goal
    // times — the only kind a runner can enter.
    const justUnder = deriveRacePaceTarget({
      goalTimeSec: 1148, // 14.96% — ambitious, anchored at the raw goal pace
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    const justOver = deriveRacePaceTarget({
      goalTimeSec: 1147, // 15.04% — implausible, anchored at the cap
      raceDistance: '5k',
      recent: RECENT_5K,
    });

    expect(justUnder?.source).toBe('goal');
    expect(justOver?.source).toBe('capped');

    // Both land on 3:50/km — the pace the ruling names by hand for this runner. Shaving one
    // second off the goal must not visibly move the session, or the cap reads as a bug.
    expect(justUnder?.pace).toEqual({ lowSecPerKm: 230, highSecPerKm: 230 });
    expect(justOver?.pace).toEqual({ lowSecPerKm: 230, highSecPerKm: 230 });
  });
});

describe('assessGoalRealism', () => {
  // `impliedImprovementPct` is asserted with `toEqual` — bit-exact float equality — so it
  // must be computed as the ruling spells it, literally:
  //
  //     (equivalentSec - goalTimeSec) / equivalentSec * 100
  //
  // A mathematically identical rewrite does NOT pass. `(1 - goal/equiv) * 100` yields
  // 9.999999999999998 where this expects 10, and would fail every case here while being
  // behaviourally correct. Keep the spelling.
  //
  // Distinct from the fixture runner (RECENT_5K), used only so the exact-percent
  // boundary math below lands on whole-second goal times. Goal and recent share a
  // distance, so the Riegel equivalent equals the recent time directly (see
  // "returns the input time unchanged..." in the `riegelEquivalentSec` block above).
  const BOUNDARY_RECENT: Performance = { distance: '5k', timeSec: 2000 };

  it('is realistic when the goal is slower than the recent-equivalent time (negative implied improvement)', () => {
    const assessment = assessGoalRealism({
      goalTimeSec: 2100,
      raceDistance: '5k',
      recent: BOUNDARY_RECENT,
    });
    const impliedImprovementPct = ((2000 - 2100) / 2000) * 100;
    expect(assessment).toEqual({
      realism: 'realistic',
      impliedImprovementPct,
      equivalentTimeSec: 2000,
    });
  });

  it('is realistic within the 0%-10% band', () => {
    const assessment = assessGoalRealism({
      goalTimeSec: 1900,
      raceDistance: '5k',
      recent: BOUNDARY_RECENT,
    });
    const impliedImprovementPct = ((2000 - 1900) / 2000) * 100;
    expect(assessment).toEqual({
      realism: 'realistic',
      impliedImprovementPct,
      equivalentTimeSec: 2000,
    });
  });

  it('is realistic at exactly the ambitious threshold (inclusive at the top of the realistic band)', () => {
    const goalTimeSec = 2000 * (1 - GOAL_AMBITIOUS_THRESHOLD_PCT / 100);
    const assessment = assessGoalRealism({
      goalTimeSec,
      raceDistance: '5k',
      recent: BOUNDARY_RECENT,
    });
    const impliedImprovementPct = ((2000 - goalTimeSec) / 2000) * 100;
    expect(assessment).toEqual({
      realism: 'realistic',
      impliedImprovementPct,
      equivalentTimeSec: 2000,
    });
  });

  it('is ambitious between the two thresholds (ruling-3 fixture: 11.1% implied improvement)', () => {
    const assessment = assessGoalRealism({
      goalTimeSec: 1200,
      raceDistance: '5k',
      recent: RECENT_5K,
    });
    const equivalentTimeSec = riegelExpected(1350, 5, 5);
    const impliedImprovementPct =
      ((equivalentTimeSec - 1200) / equivalentTimeSec) * 100;
    expect(assessment).toEqual({
      realism: 'ambitious',
      impliedImprovementPct,
      equivalentTimeSec,
    });
  });

  it('is ambitious at exactly the implausible threshold — the cap does not engage yet', () => {
    const goalTimeSec = 2000 * (1 - GOAL_IMPLAUSIBLE_THRESHOLD_PCT / 100);
    const assessment = assessGoalRealism({
      goalTimeSec,
      raceDistance: '5k',
      recent: BOUNDARY_RECENT,
    });
    const impliedImprovementPct = ((2000 - goalTimeSec) / 2000) * 100;
    expect(assessment).toEqual({
      realism: 'ambitious',
      impliedImprovementPct,
      equivalentTimeSec: 2000,
    });
  });

  it('is implausible and capped strictly above the implausible threshold', () => {
    const thresholdGoalTimeSec = 2000 * (1 - GOAL_IMPLAUSIBLE_THRESHOLD_PCT / 100);
    const goalTimeSec = thresholdGoalTimeSec - 1;
    const assessment = assessGoalRealism({
      goalTimeSec,
      raceDistance: '5k',
      recent: BOUNDARY_RECENT,
    });
    const impliedImprovementPct = ((2000 - goalTimeSec) / 2000) * 100;
    const cappedTimeSec = cappedExpected(2000);
    expect(assessment).toEqual({
      realism: 'implausible',
      impliedImprovementPct,
      equivalentTimeSec: 2000,
      cappedTimeSec,
    });
  });

  it('returns undefined without a recent performance, even with a goal time', () => {
    expect(
      assessGoalRealism({ goalTimeSec: 1200, raceDistance: '5k' }),
    ).toBeUndefined();
  });

  it('caps the canonical fantasy case (25:00 5K recent -> sub-3:00 marathon goal, 24.93% implied improvement)', () => {
    const recent: Performance = { distance: '5k', timeSec: 1500 };
    const assessment = assessGoalRealism({
      goalTimeSec: 10800,
      raceDistance: 'marathon',
      recent,
    });
    const equivalentTimeSec = riegelExpected(1500, 5, RACE_DISTANCE_KM.marathon);
    const impliedImprovementPct =
      ((equivalentTimeSec - 10800) / equivalentTimeSec) * 100;
    const cappedTimeSec = cappedExpected(equivalentTimeSec);
    expect(assessment).toEqual({
      realism: 'implausible',
      impliedImprovementPct,
      equivalentTimeSec,
      cappedTimeSec,
    });
  });
});
