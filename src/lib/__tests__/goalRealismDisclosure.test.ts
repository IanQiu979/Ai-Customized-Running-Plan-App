import {
  getGoalRealismIntakeCopy,
  getGoalRealismNoticeCopy,
  shouldShowGoalRealismNotice,
} from '../goalRealismDisclosure';
import type { GoalRealismAssessment } from '../planTypes';

const realistic: GoalRealismAssessment = {
  realism: 'realistic',
  impliedImprovementPct: 8.4,
  equivalentTimeSec: 1350,
};

const ambitious: GoalRealismAssessment = {
  realism: 'ambitious',
  impliedImprovementPct: 11.1,
  equivalentTimeSec: 1350,
};

const implausible: GoalRealismAssessment = {
  realism: 'implausible',
  impliedImprovementPct: 20.2,
  equivalentTimeSec: 1350,
  cappedTimeSec: 1148,
};

describe('goal-realism disclosure', () => {
  it('keeps a realistic goal silent', () => {
    expect(shouldShowGoalRealismNotice(realistic)).toBe(false);
    expect(getGoalRealismNoticeCopy(realistic)).toBeNull();
    expect(getGoalRealismIntakeCopy(realistic)).toBeNull();
  });

  it('discloses that an ambitious goal was kept rather than capped', () => {
    expect(shouldShowGoalRealismNotice(ambitious)).toBe(true);
    expect(getGoalRealismNoticeCopy(ambitious)).toEqual({
      title: 'Your goal is ambitious.',
      body: "Based on your recent performance, that's roughly a 11% improvement — an ambitious target. This plan keeps the goal pace you entered; it has not been capped.",
    });
    expect(getGoalRealismIntakeCopy(ambitious)).toBe(
      'Based on your recent performance, that goal is ambitious — the plan will keep your goal pace as entered, but it will be a stretch.'
    );
  });

  it("preserves today's capped-goal disclosure for an implausible goal", () => {
    expect(shouldShowGoalRealismNotice(implausible)).toBe(true);
    expect(getGoalRealismNoticeCopy(implausible)).toEqual({
      title: 'Your goal pace was adjusted.',
      body: "Based on your recent performance, a 20% improvement isn't realistic to build a plan around — this plan targets a more sustainable finish time instead.",
    });
    expect(getGoalRealismIntakeCopy(implausible)).toBe(
      'Based on your recent performance, that goal is implausible — the plan will target a more sustainable pace.'
    );
  });

  it('does not disclose absent realism data', () => {
    expect(shouldShowGoalRealismNotice(undefined)).toBe(false);
    expect(getGoalRealismIntakeCopy(undefined)).toBeNull();
  });
});
