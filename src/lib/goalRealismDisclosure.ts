import type { GoalRealismAssessment } from '@/lib/planTypes';

export interface GoalRealismNoticeCopy {
  title: string;
  body: string;
}

/** Realistic goals stay silent; both warned outcomes must explain themselves on the plan. */
export function shouldShowGoalRealismNotice(
  assessment: GoalRealismAssessment | undefined
): assessment is GoalRealismAssessment {
  return assessment !== undefined && assessment.realism !== 'realistic';
}

/** Copy for the immutable plan's realism disclosure. */
export function getGoalRealismNoticeCopy(
  assessment: GoalRealismAssessment
): GoalRealismNoticeCopy | null {
  const improvementPct = Math.round(assessment.impliedImprovementPct);

  if (assessment.realism === 'realistic') {
    return null;
  }

  if (assessment.realism === 'implausible') {
    return {
      title: 'Your goal pace was adjusted.',
      body: `Based on your recent performance, a ${improvementPct}% improvement isn't realistic to build a plan around — this plan targets a more sustainable finish time instead.`,
    };
  }

  return {
    title: 'Your goal is ambitious.',
    body: `Based on your recent performance, that's roughly a ${improvementPct}% improvement — an ambitious target. This plan keeps the goal pace you entered; it has not been capped.`,
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
