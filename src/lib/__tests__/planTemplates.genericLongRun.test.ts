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
 *
 * Closing §1.2 surfaced a second problem, resolved by the captain's ruling on
 * `longrun-share-cap-floor` (2026-09-05, see `docs/reference/coaching/load-rules.md`): a flat
 * per-level share cap is arithmetically impossible at low run counts (an n-run week's largest
 * entry is never below `1/n`), and an earlier revision floored the long run at that week's
 * hardest quality session instead of enforcing the cap, so the cap silently lost to the floor
 * whenever they conflicted. The ruling: the cap always wins, and it scales by run count
 * (`longRunShareCap`) instead of staying flat. Every assertion below checks against that scaled
 * cap, not the flat `LONG_RUN_SHARE_CAP` table (which remains correct only for the byte-pinned
 * golden 4-day 5K fixture — see `longRunShareCap`'s own comment in `loadRules.ts`).
 */

import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  clampLongRun,
  DELOAD_REDUCTION_MIN,
  longRunShareCap,
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

/** Mirrors `planTemplates.ts`'s private `normalizedRunCount` — not exported, so re-derived here. */
function runCountFor(daysPerWeek: number): number {
  return Math.max(3, Math.min(7, Math.round(daysPerWeek)));
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
      const shareCap = longRunShareCap(level, runCountFor(profile.daysPerWeek));
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
            shareCapOverride: shareCap,
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
      const cap = longRunShareCap(toExperienceLevel(profile.experience), runCountFor(profile.daysPerWeek));
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
          // Whole kilometres: the ceiling the engine can actually render is the rounded-up one.
          expect(km).toBeLessThanOrEqual(Math.ceil(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE));
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
    const profileC = PROFILES.find((p) => p.name.startsWith('C'))!;
    const plan = buildFor(profileC);
    const cap = longRunShareCap(toExperienceLevel(profileC.experience), runCountFor(profileC.daysPerWeek));
    // Audit: "week 7: LR 34 km in a 64 km week = 53% (advanced cap 35%)". The ladder is floored at
    // the flat table, so a 6-run advanced week is still governed by exactly that 35%.
    const week7 = plan.weeks[6];
    const week7Long = findLongRun(week7)?.distanceKm ?? 0;
    expect(week7Long / week7.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
    // Audit: "week 4 → 5: long run 18 km → 30 km, a +67% spike (cap +10%)". The audit stated the
    // jump week-on-week; the implemented rule is measured differently — `clampLongRun`'s spike
    // ceiling is 1.10 × `previousLongestKm`, the plan's running maximum so far, so week 5's
    // ceiling comes off the longest of weeks 1-4 (27 km, at the week-3 deload), not off week 4's
    // 18 km. The old 30 km breached that ceiling too; assert against the rule as implemented.
    const previousLongestKm = plan.weeks
      .slice(0, 4)
      .reduce((max, week) => Math.max(max, findLongRun(week)?.distanceKm ?? 0), 0);
    const week5Long = findLongRun(plan.weeks[4])?.distanceKm ?? 0;
    expect(week5Long).toBeLessThanOrEqual(Math.ceil(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE));
  });

  describe('captain\'s ruling on longrun-share-cap-floor (2026-09-05) — the cap wins, and it scales by run count', () => {
    it('pins profile A (3-day beginner) inside its scaled cap on every loading and deload week — unreachable under the flat 25% cap', () => {
      // Before this ruling: every loading week sat at share 0.3333 (2 km long run of a 6 km
      // week) against a flat 25% cap that no 3-run week can ever satisfy (3 positive numbers
      // summing to a whole can't all be under a third). `longRunShareCap('beginner', 3)` = 1.1/3
      // ≈ 36.7%, which 0.3333 already sits inside — proving the ladder, not the flat cap, governs.
      const profileA = PROFILES.find((p) => p.name.startsWith('A'))!;
      const plan = buildFor(profileA);
      const cap = longRunShareCap('beginner', 3);
      expect(cap).toBeGreaterThan(1 / 3);
      // R1c: a deload's long run is measured against the last *loading* week, not its own
      // (deliberately reduced) volume — matching `clampLongRun`'s own `isDeload` handling.
      let lastLoadingWeekKm = 0;
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (longRun) {
          const denomKm = week.isDeload && lastLoadingWeekKm > 0 ? lastLoadingWeekKm : week.volumeKm;
          expect((longRun.distanceKm ?? 0) / denomKm).toBeLessThanOrEqual(cap + 1e-9);
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
    });

    it('pins profile E (4-day intermediate) inside the unchanged 32% cap even where a big tempo session used to force the floor over it', () => {
      // Before this ruling: week 2's floor (tempo session 9 km + 1) pushed the long run to 10 km
      // in a 30 km week — 33.3%, over the (already-reachable-at-n=4) 32% cap — because the floor
      // was overriding the cap whenever they conflicted. The cap now wins unconditionally.
      const profileE = PROFILES.find((p) => p.name.startsWith('E'))!;
      const plan = buildFor(profileE);
      const cap = longRunShareCap('intermediate', 4);
      expect(cap).toBeCloseTo(0.32, 5);
      const week2 = plan.weeks[1];
      const week2Long = findLongRun(week2)?.distanceKm ?? 0;
      expect(week2Long / week2.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
    });
  });
});

describe('generic path — the safety clamp must not eat the week it was applied to', () => {
  // Regression for the easy-run ceiling being recomputed inside the clamp loop off the shrinking,
  // safety-clamped long run instead of being fixed once from the pre-clamp candidate. When it
  // tracked the long run, a low-volume/low-day week ratcheted down twice over — the long run
  // shrank for safety, the easy days' ceiling shrank with it, the week fell short of its target,
  // and `clampWeeklyVolume` then read that shortfall as the next week's growth base, so the plan
  // spiralled. Profile F is the observed case: a 20 km/week beginner 10K plan whose loading weeks
  // collapsed to 15, 15, 11, 6, 6, 6 km. With the ceiling fixed once per week they read
  // 19, 21, 15, 17, 19, 21 km.
  const profileF = PROFILES.find((p) => p.name.startsWith('F'))!;

  it('keeps every loading week of profile F (10K, 20 km/wk, 4 days) near the runner\'s declared volume', () => {
    const plan = buildFor(profileF);
    const floorKm = profileF.weeklyKm * 0.7;
    const loadingWeeks = plan.weeks.filter(
      (week, index) => !week.isDeload && index !== plan.weeks.length - 1,
    );
    expect(loadingWeeks.length).toBeGreaterThan(0);
    const collapsed = loadingWeeks
      .filter((week) => week.volumeKm < floorKm)
      .map((week) => `week ${week.weekNumber} = ${week.volumeKm} km`);
    expect(collapsed).toEqual([]);
  });

  it('never lets profile F shrink from one loading week to the next by more than a deload would', () => {
    // The spiral's signature was a monotonic slide, not a single short week: each shortfall became
    // the next week's growth ceiling. A loading week may dip after a deload, but it must never
    // fall to deload depth relative to the loading week before it.
    const plan = buildFor(profileF);
    let previousLoadingKm = 0;
    for (const week of plan.weeks.slice(0, -1)) {
      if (week.isDeload) continue;
      if (previousLoadingKm > 0) {
        expect(week.volumeKm).toBeGreaterThan(previousLoadingKm * (1 - DELOAD_REDUCTION_MIN));
      }
      previousLoadingKm = week.volumeKm;
    }
  });
});

describe('generic path — the long run must still be able to grow', () => {
  // The spike ceiling was a raw `previousLongest x 1.10`, and the engine renders whole kilometres,
  // so below 10 km the floored ceiling equalled the previous longest and forbade *all* growth
  // rather than limiting its rate: the long run froze at its week-1 value for the rest of the plan
  // while weekly volume kept climbing. The ceiling is rounded up now; the rendered distance is
  // still floored, and every other ceiling (share, absolute, time) binds exactly as before.
  function longRunSeries(profile: Profile): { weekNumber: number; volumeKm: number; longRunKm: number }[] {
    return buildFor(profile)
      .weeks.map((week) => ({
        weekNumber: week.weekNumber,
        volumeKm: week.volumeKm,
        longRunKm: findLongRun(week)?.distanceKm ?? 0,
      }))
      .filter((point) => point.longRunKm > 0);
  }

  it('lets profile F (10K, 20 km/wk, 4 days) raise its long run at least once instead of freezing', () => {
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('F'))!);
    const rises = series.filter((point, index) => index > 0 && point.longRunKm > series[index - 1].longRunKm);
    expect(rises.length).toBeGreaterThan(0);
  });

  it('finishes profile J (5K, 15 km/wk, 3 days) on a longer long run than it started with', () => {
    // Frozen before the fix: 3 km in week 1 and 3 km in the last training week, six weeks apart.
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('J'))!);
    expect(series[series.length - 1].longRunKm).toBeGreaterThan(series[0].longRunKm);
  });

  it('finishes profile E (general fitness, 30 km/wk, 4 days) on a longer long run than it started with', () => {
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('E'))!);
    expect(series[series.length - 1].longRunKm).toBeGreaterThan(series[0].longRunKm);
  });

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'never holds %s long run flat across three consecutive weeks of rising volume',
    (_name, profile) => {
      const series = longRunSeries(profile);
      const stalls: string[] = [];
      for (let i = 0; i + 3 < series.length; i += 1) {
        const window = series.slice(i, i + 4);
        const volumeRises = window.every((point, index) => index === 0 || point.volumeKm > window[index - 1].volumeKm);
        const longRunFlat = window.every((point) => point.longRunKm === window[0].longRunKm);
        if (volumeRises && longRunFlat) {
          stalls.push(
            `weeks ${window[0].weekNumber}-${window[3].weekNumber}: long run stuck at ${window[0].longRunKm} km ` +
              `while volume rose ${window.map((point) => point.volumeKm).join(' -> ')} km`,
          );
        }
      }
      expect(stalls).toEqual([]);
    },
  );
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
