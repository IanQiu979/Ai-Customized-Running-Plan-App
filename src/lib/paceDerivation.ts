/**
 * Pure pace derivation shared by the template engine and the client.
 *
 * The arithmetic is specified by `docs/reference/coaching/` and the goal-realism
 * ruling. Keep this module runtime-neutral: it is also consumed by edge functions.
 */

import {
  RACE_DISTANCE_KM,
  type ExperienceLevel,
  type GoalRealismAssessment,
  type Pace,
  type Performance,
  type RaceDistance,
} from './planTypes';

export const RIEGEL_EXPONENT = 1.06;
export const GOAL_AMBITIOUS_THRESHOLD_PCT = 10;
export const GOAL_IMPLAUSIBLE_THRESHOLD_PCT = 15;

/** Riegel T2 = T1 × (D2 / D1)^1.06, rounded to the nearest whole second. */
export function riegelEquivalentSec(performance: Performance, targetDistanceKm: number): number {
  const sourceDistanceKm = RACE_DISTANCE_KM[performance.distance];
  if (sourceDistanceKm === targetDistanceKm) return performance.timeSec;
  return Math.round(
    performance.timeSec * Math.pow(targetDistanceKm / sourceDistanceKm, RIEGEL_EXPONENT),
  );
}

/** Converts a race time to seconds per kilometre. */
export function paceSecPerKm(timeSec: number, distanceKm: number): number {
  return Math.round(timeSec / distanceKm);
}

/**
 * Derives a pace at a target distance without first rounding the equivalent time.
 * The worked pace bands are defined from the continuous Riegel result; rounding the
 * intermediate equivalent can move a boundary by one second per kilometre.
 */
function equivalentPaceSecPerKm(performance: Performance, targetDistanceKm: number): number {
  const sourceDistanceKm = RACE_DISTANCE_KM[performance.distance];
  const equivalentSec =
    performance.timeSec * Math.pow(targetDistanceKm / sourceDistanceKm, RIEGEL_EXPONENT);
  return paceSecPerKm(equivalentSec, targetDistanceKm);
}

export interface TrainingPaces {
  easy?: Pace;
  steady?: Pace;
  tempo?: Pace;
  interval?: Pace;
}

/**
 * Training paces derive only from recent performance. The declared goal never
 * changes everyday easy/tempo/interval prescriptions.
 */
export function deriveTrainingPaces(
  recent: Performance | undefined,
  level: ExperienceLevel,
): TrainingPaces {
  if (!recent) return {};

  const tempo: Pace = {
    lowSecPerKm: equivalentPaceSecPerKm(recent, RACE_DISTANCE_KM['10k']),
    highSecPerKm: equivalentPaceSecPerKm(recent, RACE_DISTANCE_KM.half),
  };
  const interval: Pace = {
    lowSecPerKm: equivalentPaceSecPerKm(recent, 3),
    highSecPerKm: equivalentPaceSecPerKm(recent, RACE_DISTANCE_KM['5k']),
  };

  if (level === 'advanced') return { tempo, interval };

  const easyOffset = level === 'beginner'
    ? { low: 30, high: 45 }
    : { low: 45, high: 60 };

  return {
    easy: {
      lowSecPerKm: tempo.lowSecPerKm + easyOffset.low,
      highSecPerKm: tempo.highSecPerKm + easyOffset.high,
    },
    tempo,
    interval,
  };
}

export interface GoalPaceInput {
  goalTimeSec?: number;
  raceDistance: RaceDistance;
  recent?: Performance;
}

/**
 * Assesses the declared goal against the recent performance at the same distance.
 *
 * The spelling of `impliedImprovementPct` is intentionally load-bearing: tests
 * require bit-exact floating-point output from the ruled formula.
 */
export function assessGoalRealism(input: GoalPaceInput): GoalRealismAssessment | undefined {
  const { goalTimeSec, raceDistance, recent } = input;
  if (goalTimeSec === undefined || !recent) return undefined;

  const equivalentTimeSec = riegelEquivalentSec(recent, RACE_DISTANCE_KM[raceDistance]);
  const impliedImprovementPct =
    ((equivalentTimeSec - goalTimeSec) / equivalentTimeSec) * 100;

  if (impliedImprovementPct <= GOAL_AMBITIOUS_THRESHOLD_PCT) {
    return { realism: 'realistic', impliedImprovementPct, equivalentTimeSec };
  }
  if (impliedImprovementPct <= GOAL_IMPLAUSIBLE_THRESHOLD_PCT) {
    return { realism: 'ambitious', impliedImprovementPct, equivalentTimeSec };
  }

  return {
    realism: 'implausible',
    impliedImprovementPct,
    equivalentTimeSec,
    cappedTimeSec: Math.round(
      equivalentTimeSec * (1 - GOAL_IMPLAUSIBLE_THRESHOLD_PCT / 100),
    ),
  };
}

export interface RacePaceTarget {
  pace: Pace;
  source: 'goal' | 'capped';
  realism: GoalRealismAssessment['realism'];
  impliedImprovementPct: number;
}

/** Returns the race-specific rep anchor, capped only for an implausible goal. */
export function deriveRacePaceTarget(input: GoalPaceInput): RacePaceTarget | undefined {
  const assessment = assessGoalRealism(input);
  if (!assessment || input.goalTimeSec === undefined) return undefined;

  const source = assessment.realism === 'implausible' ? 'capped' : 'goal';
  const anchorTimeSec = assessment.cappedTimeSec ?? input.goalTimeSec;
  const paceSec = paceSecPerKm(anchorTimeSec, RACE_DISTANCE_KM[input.raceDistance]);

  return {
    pace: { lowSecPerKm: paceSec, highSecPerKm: paceSec },
    source,
    realism: assessment.realism,
    impliedImprovementPct: assessment.impliedImprovementPct,
  };
}
