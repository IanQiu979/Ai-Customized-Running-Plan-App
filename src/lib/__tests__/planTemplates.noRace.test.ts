import { deloadLongRun } from '../loadRules';
import { buildTemplatePlan, peakBelowBuildSpike } from '../planTemplates';
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

  it('still reads the taper tail, not the loading peak, for a one-week race plan', () => {
    // Same runner, same degenerate length, but a race plan reads the full curve, whose last entry
    // is the taper's 28 km race week — the number that distinguishes the two curves. On the sliced
    // curve the last entry is the 48 km peak, which the baseline clamp would then show as 35, so
    // asserting "at or below baseline" here would pass on either curve and prove nothing.
    const plan = buildTemplatePlan({
      intake: { ...NO_RACE_INTAKE, raceDistance: '5k' },
      goalType: 'race',
      durationWeeks: 1,
      raceDistance: '5k',
      raceDate: '2026-12-05',
      tierAtGeneration: 'free',
      density: 'free',
    });
    // 23, not 28, since the captain's 2026-09-20 race-day ruling: the curve entry is still the
    // fixture's 28 km, but the race day it contains reads the bare 5 km rather than 10.
    expect(plan.weeklyLoad).toEqual([23]);
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

  it('keeps the distance on the plan as a base block, never as a booked race', () => {
    // Issue #76 (captain's ruling, 2026-09-19): the periodization is shaped to the distance, so
    // the plan records it and is titled as a Base Plan — mirroring `buildLibraryPlan`. A race is
    // booked only when `raceDate` is set; that is the field every reader must test.
    const plan = buildTemplatePlan({
      intake: withDistance,
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(plan.raceDistance).toBe('marathon');
    expect(plan.raceDate).toBeUndefined();
    expect(plan.title).toBe('12-Week Marathon Base Plan');
    // Race-only fields stay off: no readiness verdict, no goal realism, no taper, no race day.
    expect(plan.readinessPath).toBeUndefined();
    expect(plan.goalRealism).toBeUndefined();
    expect(phasesOf(plan)).not.toContain('taper');
    expect(
      plan.weeks
        .flatMap((week) => week.days.filter(isWorkout))
        .some((workout) => workout.label === 'Race Day' || workout.label === 'RP'),
    ).toBe(false);
  });

  it('titles a base block by its distance for every distance, and a race by its race', () => {
    const cases = [
      ['5k', '8-Week 5K Base Plan'],
      ['10k', '8-Week 10K Base Plan'],
      ['half', '8-Week Half Marathon Base Plan'],
      ['marathon', '8-Week Marathon Base Plan'],
    ] as const;
    for (const [raceDistance, title] of cases) {
      const plan = buildTemplatePlan({
        intake: { ...NO_RACE_INTAKE, raceDistance },
        goalType: 'duration',
        durationWeeks: 8,
        tierAtGeneration: 'pro',
        density: 'paid',
      });
      expect(plan.title).toBe(title);
      expect(plan.raceDistance).toBe(raceDistance);
      expect(plan.raceDate).toBeUndefined();
    }
  });

  it('ends a no-race 10K block on its peak long run, not on a recovery dip', () => {
    // The captain's "a no-race plan never ends on a deload" ruling reaches the long run too. The
    // 10K long-run curve's 4-week recovery cadence puts a dip on the last entry before its taper,
    // where the other three distances put their peak — so a duration plan built on it wound the
    // long run down in its final week while the volume curve was still rising.
    const plan = buildTemplatePlan({
      intake: { ...NO_RACE_INTAKE, raceDistance: '10k', daysPerWeek: 5, weeklyKm: 50 },
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'free',
      density: 'free',
    });
    const longRunKm = plan.weeks.map(
      (week) => week.days.filter(isWorkout).find((workout) => workout.isLongRun)?.distanceKm ?? 0,
    );
    const finalLongRunKm = longRunKm[longRunKm.length - 1];
    expect(finalLongRunKm).toBe(Math.max(...longRunKm));
    expect(finalLongRunKm).toBeGreaterThanOrEqual(longRunKm[longRunKm.length - 2]);
    // Only the final week moves. The substitution keeps the curve at its full pre-taper length,
    // so every sample position stays put and the loading weeks around each deload keep climbing;
    // a shorter curve would re-scale the whole block instead. The deload weeks themselves no
    // longer read the curve at all: since 2026-09-12 a rest week's long run is `deloadLongRun` of
    // the preceding loading week's (§ 9's 60–70%), so they are asserted against that rule, not
    // against the curve's dip positions.
    const deloadWeeks = plan.weeks.filter((week) => week.isDeload).map((week) => week.weekNumber);
    expect(deloadWeeks).toEqual([4, 8]);
    expect(longRunKm[2]).toBeLessThan(longRunKm[4]);
    expect(longRunKm[6]).toBeLessThan(longRunKm[8]);
    expect(longRunKm[3]).toBe(Math.round(deloadLongRun(longRunKm[2])));
    expect(longRunKm[7]).toBe(Math.round(deloadLongRun(longRunKm[6])));
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

describe('the build-spike disclosure names the highest week, and a race only when one is booked', () => {
  // Issue #103's tolerance flag fires only when a build-phase loading spike is the plan's highest
  // loading week and the peak sits below it. Its race clause is gated on `isRacePlan`, never on
  // `raceDistance` presence: a dateless Base Plan carries a distance too, and `raceDate` is the
  // only signal that a race is booked (#76).
  // 5K / regular / 4 days / 40 km / 12 weeks: as a race plan, build week 7 is the highest loading
  // week (51 km, above the 48 km peak and the 42 km base high), so it discloses.
  const spikeIntake: IntakeResponses = {
    goal: 'Run a 5K',
    age: 34,
    experience: 'regular',
    daysPerWeek: 4,
    weeklyKm: 40,
    injuries: ['none'],
    raceDistance: '5k',
  };
  const disclosureOf = (plan: Plan) =>
    plan.disclaimers.find((line) => line.startsWith('Your highest-distance week is week '));
  const loadingMax = (plan: Plan, phase: Phase) =>
    Math.max(
      ...plan.weeks.filter((w) => !w.isDeload && w.phase === phase).map((w) => w.volumeKm),
    );

  it('keeps the approved race-specific ending on a race plan whose build spike is its highest week', () => {
    const plan = buildTemplatePlan({
      intake: spikeIntake,
      goalType: 'race',
      durationWeeks: 12,
      raceDistance: '5k',
      raceDate: '2026-12-25',
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(plan.raceDate).toBe('2026-12-25');
    const spikeKm = loadingMax(plan, 'build');
    expect(spikeKm).toBeGreaterThan(loadingMax(plan, 'peak'));
    expect(spikeKm).toBeGreaterThanOrEqual(loadingMax(plan, 'base'));
    const spikeWeek = plan.weeks.find((w) => !w.isDeload && w.volumeKm === spikeKm)!;
    expect(disclosureOf(plan)).toBe(
      `Your highest-distance week is week ${spikeWeek.weekNumber}, in the build phase; the peak ` +
        'weeks carry a little less distance and more race-specific intensity.',
    );
  });

  it('says nothing when the base phase, not the build spike, holds the highest week', () => {
    // 25, 22, 17, 14*, 14, 11, 11, 18 km: the build high (week 5, 14 km) is above the 11 km peak
    // but below the 25 km base high, so "your highest-distance week is week 5" would be false —
    // the plan carries no build-spike line at all. Until the captain's 2026-09-20 rulings this was
    // a real plan (5K / new / 3 days / 30 km / 8 weeks, a Family A residual offender of #103);
    // the beginner share margin of 1.2 removed that family, and the 22,000-plan sweep now has no
    // base-high plan at all, so the guard is exercised on the shape directly.
    const restDay = { kind: 'rest' } as const;
    const week = (weekNumber: number, phase: Phase, volumeKm: number, isDeload = false): Plan['weeks'][number] => ({
      weekNumber,
      totalWeeks: 8,
      phase,
      isDeload,
      volumeKm,
      days: [restDay, restDay, restDay, restDay, restDay, restDay, restDay],
    });
    const weeks = [
      week(1, 'base', 25),
      week(2, 'base', 22),
      week(3, 'base', 17),
      week(4, 'base', 14, true),
      week(5, 'build', 14),
      week(6, 'peak', 11),
      week(7, 'peak', 11),
      week(8, 'taper', 18),
    ];
    expect(peakBelowBuildSpike(weeks)).toBeUndefined();
    // The same shape with the base high below the spike is the tolerated, disclosed one.
    expect(
      peakBelowBuildSpike([week(1, 'base', 13), week(2, 'base', 12), week(3, 'base', 11), ...weeks.slice(3)])
        ?.weekNumber,
    ).toBe(5);
  });

  it('never frames a dateless Base Plan as a race build', () => {
    // The same runner with no race booked. A no-race block never tapers and never ends on a
    // deload, so on the current curves its peak is its own highest week and there is no spike to
    // disclose; either way, nothing in its disclaimers may describe it as a race. Were a Base
    // Plan ever to disclose, the sentence ends "more quality intensity", the same shape minus the
    // race clause.
    for (const durationWeeks of [8, 12, 16] as const) {
      const plan = buildTemplatePlan({
        intake: spikeIntake,
        goalType: 'duration',
        durationWeeks,
        tierAtGeneration: 'pro',
        density: 'paid',
      });
      expect(plan.raceDate).toBeUndefined();
      expect(plan.title).toBe(`${durationWeeks}-Week 5K Base Plan`);
      expect(loadingMax(plan, 'peak')).toBeGreaterThanOrEqual(loadingMax(plan, 'build'));
      const disclosure = disclosureOf(plan);
      if (disclosure !== undefined) {
        expect(disclosure).toMatch(/and more quality intensity\.$/);
      }
      expect(plan.disclaimers.some((line) => /\brace/i.test(line))).toBe(false);
    }
  });
});
