/**
 * A runner who gives NO recent race time, and the readiness path that decision feeds.
 *
 * The research (`planning/research/plan-blueprint-examples.md` § 3 "Effort hierarchy when no
 * recent performance exists", § 2 rule 1, § 19) is explicit: training pace comes from a recent
 * performance, never from the desired goal time; without one, no numeric pace is emitted and the
 * prescription is time-and-effort (zone) only, initialised from demonstrated capacity — the
 * runner's current weekly volume and days — not ambition.
 *
 * The consequence for the long run is the part the captain named as this branch's ship gate. The
 * 180-minute ceiling needs a pace to be enforced, so for a runner with none the kilometre
 * ceilings are the only bounds: the level's absolute single-run cap (§ 4 "Experience-specific
 * operating limits": ≤14 / ≤25 / ≤35 km), the distance-aware weekly-share cap (the captain's 35%
 * marathon ruling), and the spike guard. An advanced marathoner with no recent time must
 * therefore receive a BOUNDED long run, with the 35% cap actually binding — not merely a diff
 * that looks right while the cap never fires on that profile.
 */

import { buildTemplatePlan, deriveReadinessPath, FIRST_TIMER_MIN_WEEKS } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  isValidDeload,
  longRunShareCap,
  MARATHON_LONG_RUN_SHARE_CAP,
  maxSingleRunKm,
  MAX_SINGLE_RUN_KM,
} from '../loadRules';
import type { Day, IntakeResponses, Plan, Week, Workout } from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function findLongRun(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((day) => day.isLongRun === true);
}

function allWorkouts(plan: Plan): Workout[] {
  return plan.weeks.flatMap((week) => week.days.filter(isWorkout));
}

/** The ship-gate profile: advanced, marathon, no recent race time. */
const ADVANCED_NO_RECENT: IntakeResponses = {
  goal: 'Marathon',
  age: 30,
  experience: 'competitive',
  daysPerWeek: 5,
  weeklyKm: 60,
  raceDistance: 'marathon',
  injuries: ['none'],
};

function marathonParams(intake: IntakeResponses, durationWeeks = 16): TemplatePlanParams {
  return {
    intake,
    goalType: 'race',
    durationWeeks,
    raceDistance: 'marathon',
    tierAtGeneration: 'pro',
    density: 'paid',
  };
}

/**
 * The share denominator `clampLongRun` itself uses: a valid deload measures its long run against
 * the last loading week (Ian's R1c ruling), every other week against its own rendered volume.
 */
function shareDenominators(plan: Plan): Map<number, number> {
  const denominators = new Map<number, number>();
  let lastLoadingWeekKm = 0;
  for (const week of plan.weeks) {
    const useLastLoading =
      week.isDeload && lastLoadingWeekKm > 0 && isValidDeload(lastLoadingWeekKm, week.volumeKm);
    denominators.set(week.weekNumber, useLastLoading ? lastLoadingWeekKm : week.volumeKm);
    if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
  }
  return denominators;
}

describe('ship gate — an advanced marathoner with no recent race time gets a bounded long run', () => {
  const plan = buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT));
  const denominators = shareDenominators(plan);

  it('is the profile the gate names: advanced, marathon, first-timer path, no pace anywhere', () => {
    expect(plan.raceDistance).toBe('marathon');
    expect(plan.readinessPath).toBe('first-timer');
    expect(allWorkouts(plan).every((workout) => workout.pace === undefined)).toBe(true);
  });

  it('holds every long run at or under 35% of its share denominator', () => {
    const breaches: string[] = [];
    for (const week of plan.weeks) {
      const longRun = findLongRun(week);
      if (!longRun) continue;
      const denominator = denominators.get(week.weekNumber)!;
      const share = (longRun.distanceKm ?? 0) / denominator;
      // The literal captain-owned number, deliberately not read back from `longRunShareCap`, so a
      // regression in the ladder cannot make this assertion agree with itself.
      if (share > 0.35 + 1e-9) {
        breaches.push(`week ${week.weekNumber}: ${longRun.distanceKm} km of ${denominator} km`);
      }
    }
    expect(breaches).toEqual([]);
  });

  it('the 35% cap actually binds: loading weeks sit exactly on floor(0.35 × volume)', () => {
    // A cap that is satisfied only because the curve never asks for more is not a cap that
    // "binds". The marathon curve's raw long-run targets climb past 35% of weekly volume (that is
    // why the ruling exists), so on a loading week the rendered long run should be the clamped
    // value itself. Recorded in the PR body: for this profile the peak loading week renders a
    // 31 km long run in a 91 km week (cap 31.85 km) — 34.1%.
    const boundWeeks = plan.weeks.filter((week) => {
      const longRun = findLongRun(week);
      if (!longRun || week.isDeload || week.phase === 'taper') return false;
      return longRun.distanceKm === Math.floor(0.35 * week.volumeKm);
    });
    expect(boundWeeks.length).toBeGreaterThanOrEqual(6);
    const peak = plan.weeks.filter((week) => !week.isDeload && week.phase === 'peak').at(-1)!;
    expect(peak.volumeKm).toBe(91);
    expect(findLongRun(peak)?.distanceKm).toBe(31);
  });

  it('is the cap doing the bounding: with the share cap removed the same plan breaches 35%', () => {
    // Proof that the assertion above can fail. Rebuild the plan in an isolated module registry
    // where `longRunShareCap` is non-binding; the marathon curve then pushes the long run past 35%.
    let unbounded: Plan | undefined;
    jest.isolateModules(() => {
      jest.doMock('../loadRules', () => {
        const actual = jest.requireActual<typeof import('../loadRules')>('../loadRules');
        return { ...actual, longRunShareCap: () => Infinity };
      });
      const isolated = jest.requireActual<typeof import('../planTemplates')>('../planTemplates');
      unbounded = isolated.buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT));
    });
    jest.dontMock('../loadRules');
    const worstShare = Math.max(
      ...unbounded!.weeks
        .filter((week) => !week.isDeload && week.phase !== 'taper')
        .map((week) => (findLongRun(week)?.distanceKm ?? 0) / week.volumeKm),
    );
    expect(worstShare).toBeGreaterThan(0.35);
  });

  it('never exceeds the level absolute ceiling either, because no pace can enforce the time cap', () => {
    // 110 km/week is the advanced weekly ceiling, where 35% of volume (38.5 km) is above the
    // level's 35 km single-run cap (§ 4 `COMP` ≤35 km). Before this fix the marathon bypass set
    // that cap to `Infinity` on the premise that the 180-minute ceiling governs instead — a
    // premise that is false for a runner with no pace, so the plan rendered a 38 km long run.
    const highVolume = buildTemplatePlan(
      marathonParams({ ...ADVANCED_NO_RECENT, weeklyKm: 110, daysPerWeek: 6 }),
    );
    const longest = Math.max(
      ...highVolume.weeks.map((week) => findLongRun(week)?.distanceKm ?? 0),
    );
    expect(longest).toBe(MAX_SINGLE_RUN_KM.advanced);
    expect(longest).toBe(35);
  });
});

describe('no recent race time — a time-and-effort prescription from demonstrated capacity', () => {
  it('emits no numeric pace on any workout, even when a goal time was declared', () => {
    // § 2 rule 1: goal pace never becomes a training pace. Without a recent performance there is
    // nothing to derive a pace from, so a declared goal must not leak into RP sessions either.
    const plan = buildTemplatePlan(
      marathonParams({ ...ADVANCED_NO_RECENT, experience: 'experienced', goalTimeSec: 3 * 3600 }),
    );
    expect(plan.goalRealism).toBeUndefined();
    expect(allWorkouts(plan).filter((workout) => workout.pace !== undefined)).toEqual([]);
  });

  it('still carries a zone on the paid tier and effort language on every workout', () => {
    const plan = buildTemplatePlan(
      marathonParams({ ...ADVANCED_NO_RECENT, experience: 'experienced', age: 40 }),
    );
    const workouts = allWorkouts(plan);
    expect(workouts.every((workout) => workout.effortDescription.length > 0)).toBe(true);
    expect(workouts.filter((workout) => workout.hrZone !== undefined).length).toBeGreaterThan(0);
    expect(findLongRun(plan.weeks[0])?.hrZone).toBe(1);
  });

  it('keeps the level absolute ceiling for a marathoner whose pace is unknown', () => {
    // The bypass is legitimate only where the time cap can take its place: a prepared runner
    // with a pace. No pace (or no demonstrated base) keeps the blueprint's own ≤25 / ≤35 km.
    expect(maxSingleRunKm('advanced', 'marathon')).toBe(35);
    expect(maxSingleRunKm('intermediate', 'marathon')).toBe(25);
    expect(maxSingleRunKm('intermediate', 'marathon', { readiness: 'first-timer', easyPaceSecPerKm: 360 })).toBe(25);
    expect(maxSingleRunKm('intermediate', 'marathon', { readiness: 'prepared' })).toBe(25);
    expect(maxSingleRunKm('intermediate', 'marathon', { readiness: 'prepared', easyPaceSecPerKm: 360 })).toBe(Infinity);
    expect(maxSingleRunKm('advanced', 'marathon', { readiness: 'prepared', easyPaceSecPerKm: 300 })).toBe(Infinity);
    expect(maxSingleRunKm('beginner', 'marathon', { readiness: 'prepared', easyPaceSecPerKm: 360 })).toBe(14);
  });

  it('still lets the 35% marathon share cap govern the share, independent of the absolute ceiling', () => {
    expect(longRunShareCap('advanced', 5, 'marathon')).toBe(MARATHON_LONG_RUN_SHARE_CAP);
    expect(longRunShareCap('intermediate', 6, 'marathon')).toBe(MARATHON_LONG_RUN_SHARE_CAP);
    expect(MARATHON_LONG_RUN_SHARE_CAP).toBe(0.35);
  });
});

describe('readiness path — carried through to the plan the runner sees', () => {
  const PREPARED: IntakeResponses = {
    ...ADVANCED_NO_RECENT,
    experience: 'experienced',
    weeklyKm: 50,
    recentPerformance: { distance: 'half', timeSec: 6600 },
  };

  it('derives first-timer from demonstrated capacity only', () => {
    expect(deriveReadinessPath(ADVANCED_NO_RECENT, 'marathon')).toBe('first-timer');
    expect(deriveReadinessPath(PREPARED, 'marathon')).toBe('prepared');
    // Volume below the block's assumption is a first-timer regardless of any race result.
    expect(deriveReadinessPath({ ...PREPARED, weeklyKm: 30 }, 'marathon')).toBe('first-timer');
    // A goal time changes nothing — ambition is never capacity.
    expect(
      deriveReadinessPath({ ...ADVANCED_NO_RECENT, goalTimeSec: 3 * 3600 }, 'marathon'),
    ).toBe('first-timer');
  });

  it('exposes the path on a race plan and omits it from a no-race block', () => {
    expect(buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT)).readinessPath).toBe('first-timer');
    expect(buildTemplatePlan(marathonParams(PREPARED)).readinessPath).toBe('prepared');
    const duration = buildTemplatePlan({
      intake: ADVANCED_NO_RECENT,
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'pro',
      density: 'paid',
    });
    expect(duration.readinessPath).toBeUndefined();
  });

  it('tells a first-timer why their plan takes the longer path, and says nothing to a prepared runner', () => {
    const firstTimer = buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT));
    const disclosure = firstTimer.disclaimers.find((text) => text.includes('first-timer path'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('10K or longer');
    expect(disclosure).not.toContain('km/week');

    const lowVolume = buildTemplatePlan(marathonParams({ ...PREPARED, weeklyKm: 30 }));
    const volumeDisclosure = lowVolume.disclaimers.find((text) => text.includes('first-timer path'));
    expect(volumeDisclosure).toContain('30 km/week');
    expect(volumeDisclosure).toContain('45 km/week');

    const prepared = buildTemplatePlan(marathonParams(PREPARED));
    expect(prepared.disclaimers.some((text) => text.includes('first-timer path'))).toBe(false);
  });

  it('discloses limited preparation when a first-timer runway is shorter than the research minimum', () => {
    expect(FIRST_TIMER_MIN_WEEKS).toEqual({ '5k': 12, '10k': 12, half: 16, marathon: 16 });
    const short = buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT, 12));
    const disclosure = short.disclaimers.find((text) => text.includes('completion plan'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('12 weeks');
    expect(disclosure).toContain('16 weeks');

    // A full-length first-timer build, and a prepared runner on a short runway, carry no such line.
    const full = buildTemplatePlan(marathonParams(ADVANCED_NO_RECENT, 16));
    expect(full.disclaimers.some((text) => text.includes('completion plan'))).toBe(false);
    const preparedShort = buildTemplatePlan(marathonParams(PREPARED, 12));
    expect(preparedShort.disclaimers.some((text) => text.includes('completion plan'))).toBe(false);
  });

  it('feeds the long-run ceiling: a first-timer keeps the level cap even with a pace', () => {
    // Intermediate, 30 km/week (first-timer by volume) with a recent half: the time cap is
    // computable, but the base a marathon block assumes is not demonstrated, so the ≤25 km cap
    // stays. The weekly ceiling keeps intermediate long runs under 25 km anyway at every volume,
    // so this is asserted at the ceiling function, where it is not vacuous.
    expect(maxSingleRunKm('intermediate', 'marathon', { readiness: 'first-timer', easyPaceSecPerKm: 380 })).toBe(25);
  });
});
