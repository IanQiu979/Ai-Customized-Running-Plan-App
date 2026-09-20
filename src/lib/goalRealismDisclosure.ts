/**
 * The one owner of goal-realism disclosure copy — which realism outcome speaks, and what it says,
 * on the plan screen and beside goal entry on the intake. Classification, thresholds, and the race-pace
 * cap stay in `paceDerivation.ts`; nothing here may imply a number this module didn't get.
 *
 * The load-bearing invariant: only `'implausible'` is capped (`cappedTimeSec` set). `'ambitious'`
 * still anchors race-pace reps at the runner's declared goal, so its copy must never claim an
 * adjustment that didn't happen. Every outcome is pinned in
 * `__tests__/goalRealismDisclosure.test.ts`.
 */
import type { GoalRealismAssessment } from '@/lib/planTypes';

export interface GoalRealismNoticeCopy {
  title: string;
  body: string;
}

/** "an 8% / an 11% / an 18%" but "a 20%" — spoken form, so it keys off the leading digits. */
function articleForPercent(value: number): 'a' | 'an' {
  const digits = String(Math.abs(value));
  if (digits.startsWith('8')) return 'an';
  if (digits === '11' || digits === '18') return 'an';
  return 'a';
}

/** Realistic goals stay silent; both warned outcomes must explain themselves on the plan. */
export function shouldShowGoalRealismNotice(
  assessment: GoalRealismAssessment | undefined
): assessment is GoalRealismAssessment {
  return assessment !== undefined && assessment.realism !== 'realistic';
}

/**
 * Copy for the realism disclosure on a plan that exists. Before generation, the intake speaks
 * through `getGoalRealismIntakeCopy` instead.
 */
export function getGoalRealismNoticeCopy(
  assessment: GoalRealismAssessment
): GoalRealismNoticeCopy | null {
  const improvementPct = Math.round(assessment.impliedImprovementPct);
  const article = articleForPercent(improvementPct);

  if (assessment.realism === 'realistic') {
    return null;
  }

  if (assessment.realism === 'implausible') {
    return {
      title: 'Your goal pace was adjusted.',
      body: `Based on your recent performance, ${article} ${improvementPct}% improvement isn't realistic to build a plan around — this plan targets a more sustainable finish time instead.`,
    };
  }

  return {
    title: 'Your goal is ambitious.',
    body: `Based on your recent performance, that's roughly ${article} ${improvementPct}% improvement — an ambitious target. This plan keeps the goal pace you entered; it has not been capped.`,
  };
}

/** Short advisory copy shown beside goal entry before the runner spends a generation. */
export function getGoalRealismIntakeCopy(
  assessment: GoalRealismAssessment | undefined
): string | null {
  if (!assessment || assessment.realism === 'realistic') {
    return null;
  }

  if (assessment.realism === 'ambitious') {
    return 'Based on your recent performance, that goal is ambitious — the plan will keep your goal pace as entered, but it will be a stretch.';
  }

  return 'Based on your recent performance, that goal is implausible — the plan will target a more sustainable pace.';
}
