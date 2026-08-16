import { buildTemplatePlan } from '../planTemplates';
import type { Day, IntakeResponses, Phase, Plan, Workout } from '../planTypes';

/**
 * The no-race path.
 *
 * Before 2026-08-15 `buildTemplatePlan` ended with `params.raceDistance ?? params.intake
 * .raceDistance ?? '5k'`, so a runner who had named no race silently got 5K periodization, and the
 * plan still ran out through a `taper` — a two-week wind-down into a race day that did not exist.
 * Confirmed against the running `wrangler dev` backend before the fix: a 12-week duration plan
 * came back `base×4 build×4 peak×2 taper×2` with its last two weeks falling to 40 then 28 km off a
 * 35 km baseline.
 *
 * These tests pin both halves of the fix: no distance is ever invented, and a plan with no race
 * has no taper.
 */

const NO_RACE_INTAKE: IntakeResponses = {
  goal: 'Get fitter',
  age: 34,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 35,
  injuries: ['none'],
};

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function phasesOf(plan: Plan): Phase[] {
  return plan.weeks.map((week) => week.phase);
}

function buildNoRace(overrides: Partial<Parameters<typeof buildTemplatePlan>[0]> = {}): Plan {
  return buildTemplatePlan({
    intake: NO_RACE_INTAKE,
    goalType: 'duration',
    durationWeeks: 12,
    tierAtGeneration: 'free',
    density: 'free',
    ...overrides,
  });
}

describe('a plan generates with no race specified', () => {
  it('builds a full plan and never claims a race the runner did not name', () => {
    const plan = buildNoRace();
    expect(plan.weeks).toHaveLength(12);
    expect(plan.title).toBe('12-Week Running Plan');
    expect(plan.raceDistance).toBeUndefined();
    expect(plan.raceDate).toBeUndefined();
    expect(plan.goalRealism).toBeUndefined();
  });

  it('emits no taper, because there is no race day to taper into', () => {
    const phases = phasesOf(buildNoRace());
    expect(phases).not.toContain('taper');
    expect(new Set(phases)).toEqual(new Set(['base', 'build', 'peak']));
  });

  it('splits a no-distance plan into equal thirds of base, build and peak', () => {
    // Sourced from `training_zones.md § McMillan Periodization Cycles` as ported in
    // docs/reference/coaching/plan-structure.md — weeks 1-6 / 7-12 / 13-18 of the general
    // macrocycle, i.e. equal thirds once the race-defined taper is dropped. Guessing a race
    // distance to reach a distance-specific weighting is the thing this replaced.
    expect(phasesOf(buildNoRace())).toEqual([
      'base', 'base', 'base', 'base',
      'build', 'build', 'build', 'build',
      'peak', 'peak', 'peak', 'peak',
    ]);
  });

  it('does not wind the runner down at the end the way the old phantom taper did', () => {
    const plan = buildNoRace();
    const finalWeek = plan.weeks[plan.weeks.length - 1];
    // The last week is ordinary training, and it still carries quality work — the old `taper`
    // phase emitted no quality session at all for a duration plan, because every quality branch
    // was gated on base/build/peak or on a race goal type.
    expect(finalWeek.phase).toBe('peak');
    expect(
      finalWeek.days.filter(isWorkout).some((workout) => workout.label !== 'E' && !workout.isLongRun),
    ).toBe(true);
  });

  it('does not wind the volume curve down at the end either', () => {
    // The phase labels were only half of it. Every plan's volume is interpolated from
    // `FIVE_K_WEEKLY_LOAD`, whose last two entries ARE the 5K taper — so before the fix a no-race
    // plan finished at 24 km off a 35 km baseline, *below* the 34 km it opened with, and its last
    // loading week had already dropped to 40.
    //
    // This asserts the FINAL week, not merely the last loading week. Comparing loading weeks hid
    // the symptom the captain actually reported: with a 12-week plan on a 4-week cadence the last
    // week was itself a deload, so the last week he *saw* still finished below where he started.
    const plan = buildNoRace();
    const finalWeek = plan.weeks[plan.weeks.length - 1];
    expect(finalWeek.isDeload).toBe(false);
    expect(finalWeek.volumeKm).toBeGreaterThanOrEqual(plan.weeklyLoad[0]);
  });

  it.each([1, 2, 3, 4, 5, 8, 12, 16, 26])(
    'never ends a %i-week no-race plan on a deload',
    (durationWeeks) => {
      // Captain's ruling (2026-08-15, as a McMillan-certified coach): a no-race plan must never end
      // on a deload. The every-N-weeks cadence deliberately yields for the last week only.
      expect(buildNoRace({ durationWeeks }).weeks[durationWeeks - 1].isDeload).toBe(false);
    },
  );

  it.each([1, 2, 3, 5, 8, 12, 16, 26])(
    'finishes a %i-week no-race plan at or above the volume it opened with',
    (durationWeeks) => {
      const plan = buildNoRace({ durationWeeks });
      expect(plan.weeklyLoad[durationWeeks - 1]).toBeGreaterThanOrEqual(plan.weeklyLoad[0]);
    },
  );

  it('is still held back at four weeks by the ramp cap, not by a deload', () => {
    // The one duration that finishes below its opening week, and it is not the deload rule doing
    // it: week 4 is a loading week now. The canonical curve's own dip at index 3 lands on week 2 of
    // so short a plan, and `clampWeeklyVolume`'s week-on-week growth ceiling cannot climb back in
    // the two weeks left. That ceiling is a safety rule, not something to bend for a nicer number.
    const plan = buildNoRace({ durationWeeks: 4 });
    expect(plan.weeks[3].isDeload).toBe(false);
    expect(plan.weeklyLoad[3]).toBeGreaterThan(plan.weeklyLoad[2]);
  });

  it('bends the cadence for the last week only, leaving earlier deloads in place', () => {
    const plan = buildNoRace({ durationWeeks: 12 });
    const deloadWeeks = plan.weeks.filter((week) => week.isDeload).map((week) => week.weekNumber);
    expect(deloadWeeks).toContain(4);
    expect(deloadWeeks).toContain(8);
    expect(deloadWeeks).not.toContain(12);
  });

  it('peaks at the end rather than partway through', () => {
    const load = buildNoRace().weeklyLoad;
    const peak = Math.max(...load);
    // The highest-volume week is in the final third, not stranded before a phantom taper.
    expect(load.lastIndexOf(peak)).toBeGreaterThanOrEqual(Math.floor((load.length * 2) / 3));
  });

  it('never emits a race-day or race-pace session', () => {
    const workouts = buildNoRace().weeks.flatMap((week) => week.days.filter(isWorkout));
    expect(workouts.some((workout) => workout.label === 'Race Day')).toBe(false);
    expect(workouts.some((workout) => workout.label === 'RP')).toBe(false);
  });

  it('still applies the deload cadence, injury rules and disclaimers', () => {
    const plan = buildNoRace();
    expect(plan.weeks.some((week) => week.isDeload)).toBe(true);
    expect(plan.disclaimers.length).toBeGreaterThan(0);
  });

  // Dropping the taper tail moved the LAST entry of the canonical curve from the taper's 28 km to
  // the block's 48 km peak, and `interpolateCanonical` collapses to that last entry whenever a plan
  // is one week long. Week 1 has no prior loading week, so the week-on-week growth rule cannot
  // fire — a runner asking for a single week off a 35 km baseline was handed 48 km, 137% of it,
  // with no ramp at all. The first week is now held at the declared baseline in typed code
  // (`clampWeeklyVolume`'s `baselineWeeklyKm`).
  it.each([1, 2, 3, 4, 8, 12])(
    'never opens a %i-week no-race plan above the volume the runner already runs',
    (durationWeeks) => {
      const plan = buildNoRace({ durationWeeks });
      expect(plan.weeklyLoad[0]).toBeLessThanOrEqual(NO_RACE_INTAKE.weeklyKm);
    },
  );

  it('holds a one-week no-race plan at the baseline instead of the block peak', () => {
    expect(buildNoRace({ durationWeeks: 1 }).weeklyLoad).toEqual([35]);
  });

  it.each([2, 3])(
    'ramps a %i-week no-race plan within the week-on-week growth rule',
    (durationWeeks) => {
      const load = buildNoRace({ durationWeeks }).weeklyLoad;
      expect(load[0]).toBeLessThanOrEqual(NO_RACE_INTAKE.weeklyKm);
      load.slice(1).forEach((km, index) => {
        // `load-rules.md § Rule 1`: growth above 15% on the last loading week is rejected and
        // recalculated at 10%, so no step may clear the 15% threshold (bar rounding).
        expect((km - load[index]) / load[index]).toBeLessThanOrEqual(0.15 + 0.02);
      });
    },
  );

  it('leaves a race plan on the taper-inclusive curve', () => {
    // Same runner, same one-week degenerate length, but a race plan still reads the full curve,
    // whose last entry is the taper — unchanged by any of the above.
    const plan = buildTemplatePlan({
      intake: { ...NO_RACE_INTAKE, raceDistance: '5k' },
      goalType: 'race',
      durationWeeks: 1,
      raceDistance: '5k',
      raceDate: '2026-12-05',
      tierAtGeneration: 'free',
      density: 'free',
    });
    expect(plan.weeklyLoad[0]).toBeLessThanOrEqual(NO_RACE_INTAKE.weeklyKm);
  });

  it.each([1, 2, 3, 5, 8, 26])('builds a coherent %i-week plan with no race', (durationWeeks) => {
    const plan = buildNoRace({ durationWeeks });
    expect(plan.weeks).toHaveLength(durationWeeks);
    expect(phasesOf(plan)).not.toContain('taper');
    expect(plan.weeklyLoad).toHaveLength(durationWeeks);
    expect(plan.weeklyLoad.every((km) => km > 0)).toBe(true);
  });
});

describe('a target distance with no race date', () => {
  // The runner named a distance in intake but has not entered a race. Their own answer shapes the
  // periodization; it still is not a race plan, so it still has no taper and no race day.
  const withDistance: IntakeResponses = { ...NO_RACE_INTAKE, raceDistance: 'marathon' };

  it('specialises the phase weighting to the distance the runner actually named', () => {
    const plan = buildTemplatePlan({
      intake: withDistance,
      goalType: 'duration',
      durationWeeks: 26,
      tierAtGeneration: 'free',
      density: 'free',
    });
    const phases = phasesOf(plan);
    // Marathon race weights are [9, 9, 8, 4]; minus the taper that is [9, 9, 8] of 26 weeks.
    expect(phases.filter((phase) => phase === 'base')).toHaveLength(9);
    expect(phases.filter((phase) => phase === 'build')).toHaveLength(9);
    expect(phases.filter((phase) => phase === 'peak')).toHaveLength(8);
    expect(phases).not.toContain('taper');
  });

  it('does not put the distance on the plan as though a race were booked', () => {
    const plan = buildTemplatePlan({
      intake: withDistance,
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'free',
      density: 'free',
    });
    expect(plan.raceDistance).toBeUndefined();
    expect(plan.title).toBe('12-Week Running Plan');
  });
});

describe('race plans are untouched by the no-race path', () => {
  const raceIntake: IntakeResponses = {
    ...NO_RACE_INTAKE,
    raceDistance: '10k',
    goalTimeSec: 2400,
    recentPerformance: { distance: '10k', timeSec: 2700 },
  };

  it('still tapers, still names the race, still assesses the goal', () => {
    const plan = buildTemplatePlan({
      intake: raceIntake,
      goalType: 'race',
      durationWeeks: 16,
      raceDistance: '10k',
      raceDate: '2026-12-05',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(phasesOf(plan)).toContain('taper');
    expect(plan.raceDistance).toBe('10k');
    expect(plan.raceDate).toBe('2026-12-05');
    expect(plan.title).toBe('16-Week 10K Plan');
    expect(plan.goalRealism).toBeDefined();
    expect(
      plan.weeks[plan.weeks.length - 1].days
        .filter(isWorkout)
        .some((workout) => workout.label === 'Race Day'),
    ).toBe(true);
  });
});
