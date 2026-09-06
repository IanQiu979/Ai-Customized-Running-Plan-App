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
 * whenever they conflicted. The ruling: the cap always wins, and the ordinary level cap scales
 * by run count (`longRunShareCap`) instead of staying flat. The assertions below call that
 * distance-aware helper: non-marathon plans and beginner marathon plans use the scaled ladder,
 * while intermediate/advanced marathon plans use the separate final 35% ceiling. The flat
 * `LONG_RUN_SHARE_CAP` table remains correct only for the byte-pinned golden 4-day 5K fixture —
 * see `longRunShareCap`'s own comment in `loadRules.ts`.
 *
 * The distance-specific curve fix (`v22-distance-specific-plans`, 2026-09-06) surfaced a third
 * problem: the run-count-scaled share cap and flat `MAX_SINGLE_RUN_KM` ceiling were calibrated
 * without marathon-length long runs in mind. The captain's final ruling
 * (`[key=marathon-longrun-share-cap]`) sets a distance-specific 35% weekly-share ceiling for
 * intermediate/advanced marathoners. Their separate kilometre ceiling remains non-binding
 * (`Infinity`), while the unchanged 180-minute time cap and `LONG_RUN_SPIKE_MULTIPLE` continue to
 * apply. Beginner marathoners keep both their run-count-scaled share ladder and 14 km ceiling.
 */

import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  clampLongRun,
  longRunShareCap,
  LONG_RUN_SPIKE_MULTIPLE,
  maxSingleRunKm,
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
  // L and M are the low-volume/high-frequency corner this list had no profile for: a runner whose
  // race day is most of their biggest week, training often enough that the pre-race budget cannot
  // give every requested day a real shakeout. Every race-week invariant below (the >= 2 km
  // pre-race floor especially) was previously unfalsifiable because no profile could reach the
  // regime where the budget and the day count actually conflict.
  { name: 'L — 5K, 12 km/wk, 6 days, 10 weeks', experience: 'some', age: 34, daysPerWeek: 6, weeklyKm: 12, durationWeeks: 10, raceDistance: '5k', goalType: 'race' },
  { name: 'M — 5K, 9 km/wk, 6 days, 10 weeks', experience: 'new', age: 45, daysPerWeek: 6, weeklyKm: 9, durationWeeks: 10, raceDistance: '5k', goalType: 'race' },
  // N exercises the beginner-only marathon ceilings: the run-count-scaled share ladder and 14 km
  // absolute ceiling. Profiles B, G, I and K exercise the captain's final 35% marathon share cap;
  // their separate kilometre ceiling remains intentionally non-binding (`Infinity`), with the
  // 180-minute time cap and spike guard still active.
  { name: 'N — beginner marathon, 30 km/wk, 20 weeks', experience: 'new', age: 33, daysPerWeek: 4, weeklyKm: 30, durationWeeks: 20, raceDistance: 'marathon', goalType: 'race' },
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
      const shareCap = longRunShareCap(level, runCountFor(profile.daysPerWeek), profile.raceDistance);
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
            maxSingleRunKmOverride: maxSingleRunKm(level, profile.raceDistance),
          });
          expect(Math.floor(km)).toBeGreaterThanOrEqual(longRun.distanceKm ?? 0);
          previousLongestKm = Math.max(previousLongestKm, longRun.distanceKm ?? 0);
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
    },
  );

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    "holds %s inside its weekly-share cap on every loading week, including marathon's final 35% ceiling",
    (_name, profile) => {
      const plan = buildFor(profile);
      const cap = longRunShareCap(
        toExperienceLevel(profile.experience),
        runCountFor(profile.daysPerWeek),
        profile.raceDistance,
      );
      let checkedLoadingLongRuns = 0;
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun || week.isDeload) continue;
        checkedLoadingLongRuns += 1;
        expect((longRun.distanceKm ?? 0) / week.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
      }
      expect(checkedLoadingLongRuns).toBeGreaterThan(0);
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
    'keeps every long run of %s under its distance-aware absolute kilometre ceiling (still non-binding for marathon intermediate/advanced; the 180-minute cap remains separate)',
    (_name, profile) => {
      const plan = buildFor(profile);
      const ceiling = maxSingleRunKm(toExperienceLevel(profile.experience), profile.raceDistance);
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
    const cap = longRunShareCap(
      toExperienceLevel(profileC.experience),
      runCountFor(profileC.daysPerWeek),
      profileC.raceDistance,
    );
    // Audit: "week 7: LR 34 km in a 64 km week = 53% (advanced cap 35%)". 35% was always the wrong
    // reference for a 6-run week (see `longRunShareCap`) — the real cap here is ~23.3%.
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
    expect(week5Long).toBeLessThanOrEqual(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE + 1e-9);
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
