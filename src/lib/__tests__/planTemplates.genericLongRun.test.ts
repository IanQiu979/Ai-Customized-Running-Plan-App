/**
 * Regression coverage for the core-purpose audit's §1.2 and §1.4 — the two findings that enforce
 * rules the project already owns, on the code path that serves almost every runner.
 *
 * §1.2 — `clampLongRun()` was called only from `buildCanonicalFiveKWeek`. `buildGenericWeek`, which
 * builds every 10K, half, marathon and general-fitness plan (and every 5K that is not the
 * 12-week/4-day golden shape), computed its long run from the curve and the volume budget and never
 * clamped it. The documented share / spike / time caps were therefore unenforced for everyone off
 * the golden path: the audit reproduced a 34 km long run inside a 64 km week (53% against an
 * advanced cap of 35%) and an 18 → 30 km week-on-week jump (+67% against a +10% spike cap).
 *
 * §1.4 — race week was assembled backwards. `raceDayWorkout`'s distance (race + warm-up/cool-down,
 * 47 km for a marathon) was charged against the race week's volume budget; once it exhausted that
 * budget the surrounding days fell to `distributeDistance`'s 1 km floor, producing a marathon race
 * week of three 1 km runs plus a "47 km" race day, displayed as the second-biggest week of the
 * taper.
 *
 * The long-run suite here mirrors `planTemplates.longRunCap.test.ts`'s oracle technique — replay
 * every generated long run back through `clampLongRun` and demand it comes out unchanged — but
 * aims it at the generic path across the audit's own runner profiles.
 */

import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  clampLongRun,
  LONG_RUN_SHARE_CAP,
  LONG_RUN_SPIKE_MULTIPLE,
  MAX_SINGLE_RUN_KM,
  toExperienceLevel,
} from '../loadRules';
import type {
  Day,
  ExperienceAnswer,
  GoalType,
  IntakeResponses,
  Plan,
  RaceDistance,
  Week,
  Workout,
} from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function findLongRun(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((day) => day.isLongRun === true);
}

function findRaceDay(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((day) => day.label === 'Race Day');
}

interface Profile {
  name: string;
  experience: ExperienceAnswer;
  age: number;
  daysPerWeek: number;
  weeklyKm: number;
  durationWeeks: number;
  raceDistance?: RaceDistance;
  goalType: GoalType;
  injuries?: IntakeResponses['injuries'];
}

/**
 * The audit's own runner profiles, minus D (the golden 12-week/4-day 5K, which is a different code
 * path and already covered by `planTemplates.longRunCap.test.ts` and the fixture suites). Every
 * profile here therefore lands in `buildGenericWeek`.
 */
const PROFILES: Profile[] = [
  { name: 'A — beginner, first 5K, 10 km/wk, 10 weeks', experience: 'new', age: 28, daysPerWeek: 3, weeklyKm: 10, durationWeeks: 10, raceDistance: '5k', goalType: 'race' },
  { name: 'B — marathon, 50 km/wk, 16 weeks', experience: 'experienced', age: 35, daysPerWeek: 5, weeklyKm: 50, durationWeeks: 16, raceDistance: 'marathon', goalType: 'race' },
  { name: 'C — half, 80 km/wk, 12 weeks', experience: 'competitive', age: 30, daysPerWeek: 6, weeklyKm: 80, durationWeeks: 12, raceDistance: 'half', goalType: 'race' },
  { name: 'E — general fitness, 55 y/o, 30 km/wk, 12 weeks', experience: 'regular', age: 55, daysPerWeek: 4, weeklyKm: 30, durationWeeks: 12, goalType: 'duration' },
  { name: 'F — 10K, 20 km/wk, 8 weeks', experience: 'some', age: 22, daysPerWeek: 4, weeklyKm: 20, durationWeeks: 8, raceDistance: '10k', goalType: 'race' },
  { name: 'G — marathon, 40 km/wk, 18 weeks, knee flag', experience: 'regular', age: 42, daysPerWeek: 4, weeklyKm: 40, durationWeeks: 18, raceDistance: 'marathon', goalType: 'race', injuries: ['knee'] },
  { name: 'H — 10K, 40 km/wk, 12 weeks', experience: 'regular', age: 31, daysPerWeek: 5, weeklyKm: 40, durationWeeks: 12, raceDistance: '10k', goalType: 'race' },
  { name: 'I — marathon, 100 km/wk, 20 weeks', experience: 'competitive', age: 29, daysPerWeek: 6, weeklyKm: 100, durationWeeks: 20, raceDistance: 'marathon', goalType: 'race' },
  { name: 'J — 5K, 15 km/wk, 6 weeks', experience: 'some', age: 40, daysPerWeek: 3, weeklyKm: 15, durationWeeks: 6, raceDistance: '5k', goalType: 'race' },
  { name: 'K — marathon, 60 km/wk, 16 weeks', experience: 'experienced', age: 38, daysPerWeek: 5, weeklyKm: 60, durationWeeks: 16, raceDistance: 'marathon', goalType: 'race' },
];

function buildFor(profile: Profile): Plan {
  const intake: IntakeResponses = {
    goal: profile.name,
    age: profile.age,
    experience: profile.experience,
    daysPerWeek: profile.daysPerWeek,
    weeklyKm: profile.weeklyKm,
    ...(profile.raceDistance ? { raceDistance: profile.raceDistance } : {}),
    recentPerformance: { distance: '10k', timeSec: 2700 },
    injuries: profile.injuries ?? ['none'],
  };
  const params: TemplatePlanParams = {
    intake,
    goalType: profile.goalType,
    durationWeeks: profile.durationWeeks,
    ...(profile.raceDistance ? { raceDistance: profile.raceDistance } : {}),
    tierAtGeneration: 'pro',
    density: 'paid',
  };
  return buildTemplatePlan(params);
}

describe('generic path — every long-run ceiling is enforced (audit §1.2)', () => {
  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'replays every long run of %s through clampLongRun and gets it back unchanged',
    (_name, profile) => {
      const plan = buildFor(profile);
      const level = toExperienceLevel(profile.experience);
      let previousLongestKm = 0;
      let lastLoadingWeekKm = 0;

      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (longRun) {
          const { km } = clampLongRun({
            proposedKm: longRun.distanceKm ?? 0,
            weeklyKm: week.volumeKm,
            level,
            previousLongestKm,
            isDeload: week.isDeload,
            lastLoadingWeekKm,
          });
          expect(Math.floor(km)).toBeGreaterThanOrEqual(longRun.distanceKm ?? 0);
          previousLongestKm = Math.max(previousLongestKm, longRun.distanceKm ?? 0);
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
    },
  );

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'holds %s inside the weekly-share cap on every loading week',
    (_name, profile) => {
      const plan = buildFor(profile);
      const cap = LONG_RUN_SHARE_CAP[toExperienceLevel(profile.experience)];
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun || week.isDeload) continue;
        expect((longRun.distanceKm ?? 0) / week.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
      }
    },
  );

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'never lets %s spike its long run more than the spike multiple over its previous longest',
    (_name, profile) => {
      const plan = buildFor(profile);
      let previousLongestKm = 0;
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun) continue;
        const km = longRun.distanceKm ?? 0;
        if (previousLongestKm > 0) {
          expect(km).toBeLessThanOrEqual(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE + 1e-9);
        }
        previousLongestKm = Math.max(previousLongestKm, km);
      }
    },
  );

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'keeps every long run of %s under the level absolute single-run ceiling',
    (_name, profile) => {
      const plan = buildFor(profile);
      const ceiling = MAX_SINGLE_RUN_KM[toExperienceLevel(profile.experience)];
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun) continue;
        expect(longRun.distanceKm ?? 0).toBeLessThanOrEqual(ceiling);
      }
    },
  );

  it('pins the two exact breaches the audit reported for profile C (half, 80 km/wk)', () => {
    const plan = buildFor(PROFILES.find((p) => p.name.startsWith('C'))!);
    // Audit: "week 7: LR 34 km in a 64 km week = 53% (advanced cap 35%)".
    const week7 = plan.weeks[6];
    const week7Long = findLongRun(week7)?.distanceKm ?? 0;
    expect(week7Long / week7.volumeKm).toBeLessThanOrEqual(LONG_RUN_SHARE_CAP.advanced + 1e-9);
    // Audit: "week 4 → 5: long run 18 km → 30 km, a +67% spike (cap +10%)". The audit stated the
    // jump week-on-week; the implemented rule is measured differently — `clampLongRun`'s spike
    // ceiling is 1.10 × `previousLongestKm`, the plan's running maximum so far, so week 5's
    // ceiling comes off the longest of weeks 1-4 (27 km, at the week-3 deload), not off week 4's
    // 18 km. The old 30 km breached that ceiling too; assert against the rule as implemented.
    const previousLongestKm = plan.weeks
      .slice(0, 4)
      .reduce((max, week) => Math.max(max, findLongRun(week)?.distanceKm ?? 0), 0);
    const week5Long = findLongRun(plan.weeks[4])?.distanceKm ?? 0;
    expect(week5Long).toBeLessThanOrEqual(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE + 1e-9);
  });
});

describe('generic path — race week is a taper, not budget math around the race (audit §1.4)', () => {
  const RACE_PROFILES = PROFILES.filter((profile) => profile.raceDistance !== undefined);

  it.each(RACE_PROFILES.map((profile) => [profile.name, profile] as const))(
    'gives %s pre-race days that are real runs, never the 1 km distributeDistance floor',
    (_name, profile) => {
      const plan = buildFor(profile);
      const raceWeek = plan.weeks[plan.weeks.length - 1];
      const raceDay = findRaceDay(raceWeek);
      expect(raceDay).toBeDefined();
      const preRace = raceWeek.days
        .filter(isWorkout)
        .filter((day) => day.label !== 'Race Day');
      expect(preRace.length).toBeGreaterThan(0);
      // The bug's signature: every day before the race pinned at exactly 1 km.
      expect(preRace.every((day) => (day.distanceKm ?? 0) <= 1)).toBe(false);
      for (const day of preRace) {
        expect(day.distanceKm ?? 0).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it.each(RACE_PROFILES.map((profile) => [profile.name, profile] as const))(
    'keeps %s pre-race volume below the last training week — race week tapers down',
    (_name, profile) => {
      const plan = buildFor(profile);
      const raceWeek = plan.weeks[plan.weeks.length - 1];
      const previousWeek = plan.weeks[plan.weeks.length - 2];
      const preRaceKm = raceWeek.days
        .filter(isWorkout)
        .filter((day) => day.label !== 'Race Day')
        .reduce((sum, day) => sum + (day.distanceKm ?? 0), 0);
      expect(preRaceKm).toBeLessThan(previousWeek.volumeKm);
    },
  );

  it('sizes marathon race week from the taper, not from the 47 km race-day line item', () => {
    const plan = buildFor(PROFILES.find((p) => p.name.startsWith('B'))!);
    const raceWeek = plan.weeks[15];
    const raceDay = findRaceDay(raceWeek);
    // The race-day line item is unchanged: 42.195 km rounded up with its 5 km of warm-up/cool-down.
    expect(raceDay?.distanceKm).toBe(47);
    const preRace = raceWeek.days.filter(isWorkout).filter((day) => day.label !== 'Race Day');
    const preRaceKm = preRace.reduce((sum, day) => sum + (day.distanceKm ?? 0), 0);
    // Audit before-state: four 1 km runs (4 km of pre-race running) inside a "51 km" week.
    expect(preRaceKm).toBeGreaterThanOrEqual(20);
    expect(preRaceKm).toBeLessThanOrEqual(30);
    // The last pre-race run is still the shakeout.
    expect(preRace[preRace.length - 1].label).toBe('SR');
  });

  it('sizes half-marathon race week the same way', () => {
    const plan = buildFor(PROFILES.find((p) => p.name.startsWith('C'))!);
    const raceWeek = plan.weeks[11];
    expect(findRaceDay(raceWeek)?.distanceKm).toBe(26);
    const preRaceKm = raceWeek.days
      .filter(isWorkout)
      .filter((day) => day.label !== 'Race Day')
      .reduce((sum, day) => sum + (day.distanceKm ?? 0), 0);
    expect(preRaceKm).toBeGreaterThanOrEqual(30);
    expect(preRaceKm).toBeLessThanOrEqual(50);
  });

  it('leaves a no-race plan without a race week at all', () => {
    const plan = buildFor(PROFILES.find((p) => p.name.startsWith('E'))!);
    for (const week of plan.weeks) {
      expect(findRaceDay(week)).toBeUndefined();
    }
  });
});
