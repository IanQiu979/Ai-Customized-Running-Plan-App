/**
 * Captain-approved youth policy (§6-A/E, `v22-youth-policy-research-s1` report, 2026-08-06):
 * under-18 plans never carry `hrZone` on any tier, substitute the coaching library's own
 * ported RPE scale instead (`loadRules.ts`'s `rpeForZone`), and carry an additional,
 * verbatim disclaimer. Adult plans are provably unaffected by any of this.
 */
import { buildTemplatePlan } from '../planTemplates';
import type { Day, IntakeResponses, Workout } from '../planTypes';

const BASE_INTAKE: IntakeResponses = {
  goal: 'Build fitness',
  age: 35,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 35,
  raceDistance: '5k',
  goalTimeSec: 1200,
  recentPerformance: { distance: '5k', timeSec: 1350 },
  injuries: ['none'],
};

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function paidPlanAt(age: number) {
  return buildTemplatePlan({
    intake: { ...BASE_INTAKE, age },
    goalType: 'race',
    durationWeeks: 12,
    raceDistance: '5k',
    raceDate: '2026-10-02',
    tierAtGeneration: 'pro',
    density: 'paid',
  });
}

function allWorkouts(plan: ReturnType<typeof paidPlanAt>): Workout[] {
  return plan.weeks.flatMap((week) => week.days.filter(isWorkout));
}

const UNDER_18_DISCLAIMER =
  'This plan is generated for a runner under 18. It does not replace a pre-participation ' +
  'medical evaluation - check with a doctor before starting, especially around growth-plate ' +
  'and bone-health considerations at this age. A parent or guardian should stay aware of ' +
  'training load and has the right to pause or stop the plan at any time. This plan does not ' +
  "account for individual medical history, injuries, or a coach's in-person supervision.";

describe('under-18 paid plans substitute RPE for hrZone', () => {
  it('never emits hrZone on any workout for a 16-year-old', () => {
    const workouts = allWorkouts(paidPlanAt(16));
    expect(workouts.some((day) => day.hrZone !== undefined)).toBe(false);
  });

  it('emits rpe wherever an adult plan would have emitted hrZone, using the sourced mapping', () => {
    const youthWorkouts = allWorkouts(paidPlanAt(16));
    const rpeValues = new Set(youthWorkouts.map((day) => day.rpe).filter(Boolean));
    // The template engine only ever hardcodes zones 1 (easy/long), 3 (tempo), 4 (interval) —
    // their sourced RPE substitutes are 3, 7, 8 (loadRules.test.ts covers the full mapping).
    expect(rpeValues.size).toBeGreaterThan(0);
    for (const rpe of rpeValues) {
      expect([3, 7, 8]).toContain(rpe);
    }
  });

  it('17 is still under-18 (strict boundary), 18 is treated as adult', () => {
    expect(allWorkouts(paidPlanAt(17)).some((day) => day.hrZone !== undefined)).toBe(false);
    expect(allWorkouts(paidPlanAt(18)).some((day) => day.rpe !== undefined)).toBe(false);
  });

  it('leaves adult (18+) plans exactly as before — hrZone present, rpe never set', () => {
    const workouts = allWorkouts(paidPlanAt(35));
    const zoned = workouts.filter((day) => day.hrZone !== undefined);
    expect(zoned.length).toBeGreaterThan(0);
    expect(workouts.some((day) => day.rpe !== undefined)).toBe(false);
  });

  it('free-tier under-18 plans still emit neither field, same as free-tier adult plans', () => {
    const plan = buildTemplatePlan({
      intake: { ...BASE_INTAKE, age: 15 },
      goalType: 'race',
      durationWeeks: 12,
      raceDistance: '5k',
      raceDate: '2026-10-02',
      tierAtGeneration: 'free',
      density: 'free',
    });
    const workouts = allWorkouts(plan);
    expect(workouts.some((day) => day.hrZone !== undefined || day.rpe !== undefined)).toBe(false);
  });
});

describe('under-18 disclaimer', () => {
  it('is appended verbatim for a 16-year-old, alongside the general disclaimer', () => {
    const plan = paidPlanAt(16);
    expect(plan.disclaimers).toContain(UNDER_18_DISCLAIMER);
    expect(plan.disclaimers.length).toBe(2); // general + under-18, no injuries declared
  });

  it('is absent for an adult plan', () => {
    const plan = paidPlanAt(35);
    expect(plan.disclaimers).not.toContain(UNDER_18_DISCLAIMER);
    expect(plan.disclaimers.length).toBe(1); // general only
  });

  it('is absent at exactly 18', () => {
    const plan = paidPlanAt(18);
    expect(plan.disclaimers).not.toContain(UNDER_18_DISCLAIMER);
  });
});
