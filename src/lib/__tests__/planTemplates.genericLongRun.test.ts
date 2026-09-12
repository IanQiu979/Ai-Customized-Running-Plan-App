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
 * intermediate/advanced marathoners. Their separate kilometre ceiling is lifted (`Infinity`) only
 * for a prepared runner whose pace makes the 180-minute time cap enforceable — a runner with no
 * recent time keeps the level's own cap, since nothing else could bound them in kilometres
 * (`planTemplates.noRecentTime.test.ts`) — while `LONG_RUN_SPIKE_MULTIPLE` continues to apply
 * throughout. Beginner marathoners keep both their run-count-scaled share ladder and 14 km ceiling.
 */

import { buildTemplatePlan, deriveReadinessPath } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import {
  clampLongRun,
  DELOAD_REDUCTION_MIN,
  isValidDeload,
  longRunShareCap,
  LONG_RUN_MAX_MINUTES,
  LONG_RUN_SPIKE_MULTIPLE,
  maxSingleRunKm,
  toExperienceLevel,
} from '../loadRules';
import { deriveTrainingPaces } from '../paceDerivation';
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
  // B and K (prepared, with a pace) have their kilometre ceiling lifted in favour of the
  // 180-minute time cap, while G (first-timer by volume) and I (advanced, so no easy pace) keep
  // the level cap — the spike guard is active for all four.
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

/**
 * The same evidence `buildGenericWeek` hands `maxSingleRunKm`: the readiness verdict and whether
 * a pace exists to enforce the time cap. `buildFor` always supplies a 10K result, so readiness is
 * the volume test alone, and advanced runners never get an easy pace (`deriveTrainingPaces`).
 */
function ceilingContextFor(profile: Profile) {
  const level = toExperienceLevel(profile.experience);
  const readiness = profile.raceDistance
    ? deriveReadinessPath(
        { goal: profile.name, age: profile.age, experience: profile.experience, daysPerWeek: profile.daysPerWeek, weeklyKm: profile.weeklyKm, raceDistance: profile.raceDistance, recentPerformance: { distance: '10k', timeSec: 2700 }, injuries: profile.injuries ?? ['none'] },
        profile.raceDistance,
      )
    : 'prepared';
  const easyPaceSecPerKm = deriveTrainingPaces({ distance: '10k', timeSec: 2700 }, level).easy?.highSecPerKm;
  return { readiness, easyPaceSecPerKm } as const;
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
            roundSpikeCeilingUp: true,
            maxSingleRunKmOverride: maxSingleRunKm(level, profile.raceDistance, ceilingContextFor(profile)),
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
          // Whole kilometres: the ceiling the engine can actually render is the rounded-up one.
          expect(km).toBeLessThanOrEqual(Math.ceil(previousLongestKm * LONG_RUN_SPIKE_MULTIPLE));
        }
        previousLongestKm = Math.max(previousLongestKm, km);
      }
    },
  );

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'keeps every long run of %s under its distance-aware absolute kilometre ceiling (lifted only for a prepared marathoner with a pace; the 180-minute cap remains separate)',
    (_name, profile) => {
      const plan = buildFor(profile);
      const ceiling = maxSingleRunKm(
        toExperienceLevel(profile.experience),
        profile.raceDistance,
        ceilingContextFor(profile),
      );
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun) continue;
        expect(longRun.distanceKm ?? 0).toBeLessThanOrEqual(ceiling);
      }
    },
  );

  it('keeps a pace-known, high-volume marathon long run within the three-hour ceiling', () => {
    const recentPerformance = { distance: '10k', timeSec: 7200 } as const;
    const level = toExperienceLevel('regular');
    const easyPace = deriveTrainingPaces(recentPerformance, level).easy;
    expect(easyPace).toBeDefined();
    const easyPaceSecPerKm = easyPace!.highSecPerKm;

    const plan = buildTemplatePlan({
      intake: {
        goal: 'Finish a marathon',
        age: 35,
        experience: 'regular',
        daysPerWeek: 5,
        weeklyKm: 110,
        raceDistance: 'marathon',
        recentPerformance,
        injuries: ['none'],
      },
      goalType: 'race',
      durationWeeks: 20,
      raceDistance: 'marathon',
      tierAtGeneration: 'pro',
      density: 'paid',
    });

    let previousLongestKm = 0;
    let lastLoadingWeekKm = 0;
    let timeCeilingWitness: Workout | undefined;
    for (const week of plan.weeks) {
      const longRun = findLongRun(week);
      if (longRun) {
        const distanceKm = longRun.distanceKm ?? 0;
        const { km } = clampLongRun({
          proposedKm: distanceKm,
          weeklyKm: week.volumeKm,
          level,
          previousLongestKm,
          easyPaceSecPerKm,
          isDeload: week.isDeload,
          lastLoadingWeekKm,
          shareCapOverride: longRunShareCap(level, 5),
          roundSpikeCeilingUp: true,
        });
        expect(Math.floor(km)).toBeGreaterThanOrEqual(distanceKm);

        const durationMinutes = (distanceKm * easyPaceSecPerKm) / 60;
        expect(durationMinutes).toBeLessThanOrEqual(LONG_RUN_MAX_MINUTES);
        if (
          ((distanceKm + 1) * easyPaceSecPerKm) / 60 >
          LONG_RUN_MAX_MINUTES
        ) {
          timeCeilingWitness = longRun;
        }
        previousLongestKm = Math.max(previousLongestKm, distanceKm);
      }
      if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    }
    expect(timeCeilingWitness).toBeDefined();
  });

  it('pins the two exact breaches the audit reported for profile C (half, 80 km/wk)', () => {
    const profileC = PROFILES.find((p) => p.name.startsWith('C'))!;
    const plan = buildFor(profileC);
    const cap = longRunShareCap(
      toExperienceLevel(profileC.experience),
      runCountFor(profileC.daysPerWeek),
      profileC.raceDistance,
    );
    // Audit: "week 7: LR 34 km in a 64 km week = 53% (advanced cap 35%)". The ladder is floored at
    // the flat table (and marathon's own cap is 35% too), so a 6-run advanced week is still
    // governed by exactly that 35%.
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
  function longRunSeries(
    profile: Profile,
  ): { weekNumber: number; volumeKm: number; longRunKm: number; isDeload: boolean }[] {
    return buildFor(profile)
      .weeks.map((week) => ({
        weekNumber: week.weekNumber,
        volumeKm: week.volumeKm,
        longRunKm: findLongRun(week)?.distanceKm ?? 0,
        isDeload: week.isDeload,
      }))
      .filter((point) => point.longRunKm > 0);
  }

  it('lets profile F (10K, 20 km/wk, 4 days) raise its long run at least once instead of freezing', () => {
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('F'))!);
    const rises = series.filter((point, index) => index > 0 && point.longRunKm > series[index - 1].longRunKm);
    expect(rises.length).toBeGreaterThan(0);
  });

  it('pins profile F to the trajectory the share cap actually allows it', () => {
    // A beginner running 20 km across 4 days is share-capped at 0.275, so F's long run tracks the
    // 10K curve's own volume (17, 19, 21, 17d, 23, 26, 26) and never exceeds floor(0.275 × week).
    // On the stretched-5K curve this plan used to read, F peaked at 5 km and ended where it began;
    // the 10K curve climbs through the block, so the long run climbs with it. Pinned so a change
    // that breaks this correct behaviour still fails something. Week 4 is the deload: since
    // 2026-09-12 a rest week's long run is `deloadLongRun` of the preceding loading week's
    // (0.65 × 5 → 3), not a point on the curve.
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('F'))!);
    expect(series.map((point) => point.longRunKm)).toEqual([4, 5, 5, 3, 6, 7, 7]);
    const cap = longRunShareCap('beginner', 4, '10k');
    for (const point of series.filter((p) => !p.isDeload)) {
      expect(point.longRunKm).toBeLessThanOrEqual(Math.floor(cap * point.volumeKm));
    }
  });

  it('pins profile J to the trajectory the share cap actually allows it', () => {
    // Same shape as F: a 3-day beginner at 15 km/wk sits on the 0.3667 cap at a flat 11 km week,
    // so a flat 4 km long run is the cap holding it, not the spike ceiling freezing it. Week 4 is
    // the deload — `deloadLongRun(4)` = 2.6 → 3 — and is the one entry the cap does not set.
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('J'))!);
    expect(series.map((point) => point.longRunKm)).toEqual([4, 4, 4, 3, 4]);
    const cap = longRunShareCap('beginner', 3);
    for (const point of series.filter((p) => !p.isDeload)) {
      expect(point.longRunKm).toBe(Math.floor(cap * point.volumeKm));
    }
  });

  it('finishes profile E (general fitness, 30 km/wk, 4 days) on a longer long run than it started with', () => {
    // The regression witness for the whole-kilometre spike ceiling: with the raw fractional
    // ceiling E closes on the same 9 km long run it opened with, twelve weeks later.
    const series = longRunSeries(PROFILES.find((p) => p.name.startsWith('E'))!);
    expect(series[series.length - 1].longRunKm).toBeGreaterThan(series[0].longRunKm);
  });

  /**
   * Window of three weeks, i.e. two consecutive volume rises. A four-week window (three rises) was
   * vacuous for four of the ten profiles — deloads and the post-deload dip break every window —
   * so it could not have failed on them however frozen the long run got. `RISING_WINDOW_PROFILES`
   * is asserted below rather than assumed, so this can never quietly go vacuous again; A and J are
   * genuinely outside it (their volume never rises twice running) and are covered instead by the
   * cap-bound trajectory pins above. L and N (added with the distance-specific curves) both rise
   * twice running and so are inside it; L's long run is cap-bound across its rising window, which
   * the stall check below distinguishes from a freeze.
   */
  const RISING_WINDOW_PROFILES = ['B', 'C', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'N'];

  function risingWindows(series: ReturnType<typeof longRunSeries>) {
    const windows: (typeof series)[] = [];
    for (let i = 0; i + 2 < series.length; i += 1) {
      const window = series.slice(i, i + 3);
      if (window.every((point, index) => index === 0 || point.volumeKm > window[index - 1].volumeKm)) {
        windows.push(window);
      }
    }
    return windows;
  }

  it('keeps the anti-freeze check non-vacuous on exactly the profiles it claims to cover', () => {
    const covered = PROFILES.filter((profile) => risingWindows(longRunSeries(profile)).length > 0).map(
      (profile) => profile.name[0],
    );
    expect(covered).toEqual(RISING_WINDOW_PROFILES);
  });

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'never holds %s long run flat across two consecutive weeks of rising volume',
    (_name, profile) => {
      const series = longRunSeries(profile);
      const cap = longRunShareCap(
        toExperienceLevel(profile.experience),
        runCountFor(profile.daysPerWeek),
        profile.raceDistance,
      );
      const stalls: string[] = [];
      for (const window of risingWindows(series)) {
        // A flat long run is a freeze only if the share cap would have let it grow. When every
        // point already sits on floor(cap × volume) — L's 3 km at 14 and 15 km, both under a 25%
        // beginner cap — the cap is holding it, exactly as J's pin above documents, not the spike
        // ceiling freezing it.
        const capBound = window.every(
          (point) => point.longRunKm >= Math.floor(cap * point.volumeKm),
        );
        if (!capBound && window.every((point) => point.longRunKm === window[0].longRunKm)) {
          stalls.push(
            `weeks ${window[0].weekNumber}-${window[window.length - 1].weekNumber}: long run stuck at ` +
              `${window[0].longRunKm} km while volume rose ${window.map((point) => point.volumeKm).join(' -> ')} km`,
          );
        }
      }
      expect(stalls).toEqual([]);
    },
  );
});

describe('generic path — no run outgrows the week\'s safety-clamped long run', () => {
  // The share cap bounds the week's longest *run*, not the session carrying the `LR` label. An
  // earlier revision froze the easy-run ceiling at the pre-clamp long-run candidate and reused it
  // for the final distribution, so the easy days stayed bounded by a long run that never shipped:
  // a 3-day beginner at 15 km/wk drew `ER 5 | TR 3 | LR 4` — a 5 km easy day at 41.7% of a 12 km
  // week, over its 36.7% cap, and the week's longest run by a kilometre.
  //
  // On a rest week the bound is the *last loading week's* long run, not the rest week's own: a
  // rest week deliberately shortens Day 7 to 60–70% of the preceding long run (2026-09-12,
  // `deloadLongRun`), and at three runs a week the 80% total cannot be covered by three runs of
  // that size — bounding the easy days by it would cut the week below the deload band, from the
  // easy runs the rule says to keep. R1c already measures a genuine deload's share cap against the
  // last loading week, so its long run — a distance already run inside every ceiling — is the run
  // no rest-week easy day may outgrow.
  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'keeps every easy run of %s at or under that week\'s long run',
    (_name, profile) => {
      const plan = buildFor(profile);
      const breaches: string[] = [];
      let lastLoadingLongRunKm = 0;
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (!longRun) continue;
        const boundKm = week.isDeload && lastLoadingLongRunKm > 0 ? lastLoadingLongRunKm : (longRun.distanceKm ?? 0);
        for (const day of week.days.filter(isWorkout)) {
          if (day === longRun || !(day.label ?? '').startsWith('ER')) continue;
          if ((day.distanceKm ?? 0) > boundKm) {
            breaches.push(
              `week ${week.weekNumber}: ${day.label} ${day.distanceKm} km against a ${boundKm} km ${week.isDeload ? 'last-loading-week' : ''} long run`,
            );
          }
        }
        if (!week.isDeload) lastLoadingLongRunKm = longRun.distanceKm ?? 0;
      }
      expect(breaches).toEqual([]);
    },
  );

  it('holds the 3-day beginner week the ceiling was frozen on inside its cap', () => {
    const profileJ = PROFILES.find((p) => p.name.startsWith('J'))!;
    const plan = buildFor(profileJ);
    const cap = longRunShareCap('beginner', 3);
    for (const week of plan.weeks) {
      const runs = week.days.filter(isWorkout).filter((day) => (day.label ?? '').startsWith('ER'));
      for (const run of runs) {
        expect((run.distanceKm ?? 0) / week.volumeKm).toBeLessThanOrEqual(cap + 1e-9);
      }
    }
  });
});

describe('generic path — volume reconciliation may not re-open the share cap', () => {
  // The clamp loop closed the cap against the week's *assembled* sum, which
  // `distributeDistance`'s 1 km-per-session floor can push above the target;
  // `reconcileVolumeToTarget` then trimmed the week back down and the rendered share climbed back
  // over the ceiling. This profile is not in `PROFILES` because none of those ten reach the shape:
  // it needs enough quality sessions to crowd the easy days onto their floor.
  const RECONCILE_PROFILE: Profile = {
    name: 'L — general fitness, advanced, 20 km/wk, 5 days',
    experience: 'competitive',
    age: 30,
    daysPerWeek: 5,
    weeklyKm: 20,
    durationWeeks: 6,
    goalType: 'duration',
  };

  it('keeps the rendered long run inside the share cap once the week has been trimmed to target', () => {
    // Before: week 5 settled a 7 km long run against an assembled 20 km, then rendered
    // ER 1 | TR 4 | ER 1 | INT 5 | LR 6 — a 6 km long run in a 17 km week, 35.3% of a 35.0% cap.
    const plan = buildFor(RECONCILE_PROFILE);
    const cap = longRunShareCap('advanced', 5);
    const breaches: string[] = [];
    let lastLoadingWeekKm = 0;
    for (const week of plan.weeks) {
      const longRun = findLongRun(week);
      if (longRun) {
        const useLastLoading =
          week.isDeload && lastLoadingWeekKm > 0 && isValidDeload(lastLoadingWeekKm, week.volumeKm);
        const denomKm = useLastLoading ? lastLoadingWeekKm : week.volumeKm;
        const share = (longRun.distanceKm ?? 0) / denomKm;
        if (share > cap + 1e-9) {
          breaches.push(
            `week ${week.weekNumber}: ${longRun.distanceKm} km of ${denomKm} km = ` +
              `${(share * 100).toFixed(2)}% against a ${(cap * 100).toFixed(2)}% cap`,
          );
        }
      }
      if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
    }
    expect(breaches).toEqual([]);
  });

  it('lands that week exactly on its target rather than undershooting it', () => {
    // The trim removes only the overshoot, so the week keeps the volume the growth clamp allowed
    // it rather than the smaller total an independent per-workout floor produced (19 km, not
    // 17 km, when week 5 was a curve dip; 25 km now that the generic no-race curve has no dips).
    const plan = buildFor(RECONCILE_PROFILE);
    expect(plan.weeks[4].volumeKm).toBe(25);
    expect(findLongRun(plan.weeks[4])?.distanceKm).toBe(8);
  });

  it.each(PROFILES.map((profile) => [profile.name, profile] as const))(
    'holds %s inside the share cap using clampLongRun\'s own deload denominator',
    (_name, profile) => {
      const plan = buildFor(profile);
      const cap = longRunShareCap(
        toExperienceLevel(profile.experience),
        runCountFor(profile.daysPerWeek),
        profile.raceDistance,
      );
      const breaches: string[] = [];
      let lastLoadingWeekKm = 0;
      for (const week of plan.weeks) {
        const longRun = findLongRun(week);
        if (longRun) {
          const useLastLoading =
            week.isDeload && lastLoadingWeekKm > 0 && isValidDeload(lastLoadingWeekKm, week.volumeKm);
          const denomKm = useLastLoading ? lastLoadingWeekKm : week.volumeKm;
          if ((longRun.distanceKm ?? 0) / denomKm > cap + 1e-9) {
            breaches.push(`week ${week.weekNumber}: ${longRun.distanceKm} km of ${denomKm} km`);
          }
        }
        if (!week.isDeload) lastLoadingWeekKm = week.volumeKm;
      }
      expect(breaches).toEqual([]);
    },
  );
});

describe('generic path — race week is a taper, not budget math around the race (audit §1.4)', () => {
  const RACE_PROFILES = PROFILES.filter((profile) => profile.raceDistance !== undefined);
  const FUNDED_RACE_PROFILES = [
    PROFILES.find((profile) => profile.name.startsWith('B'))!,
    PROFILES.find((profile) => profile.name.startsWith('C'))!,
  ];
  // Each of these runners' race day alone meets or exceeds their peak training week (a 10 km/wk
  // runner peaks around 15 km; a half is 26 km and a marathon 47 km on race day), so the
  // peak-relative pre-race bound leaves no room at all and `preRaceSchedule`'s single documented
  // exception applies: one 2 km shakeout, every other pre-race slot rest.
  const UNDERFUNDED_RACE_CASES: {
    profile: Profile;
    expectedPreRaceRuns: number;
    expectedPreRaceKm: number;
  }[] = [
    {
      profile: {
        name: 'half, 10 km/wk, 6 days',
        experience: 'regular',
        age: 35,
        daysPerWeek: 6,
        weeklyKm: 10,
        durationWeeks: 12,
        raceDistance: 'half',
        goalType: 'race',
      },
      expectedPreRaceRuns: 1,
      expectedPreRaceKm: 2,
    },
    {
      profile: {
        name: 'half, 10 km/wk, 7 days',
        experience: 'regular',
        age: 35,
        daysPerWeek: 7,
        weeklyKm: 10,
        durationWeeks: 12,
        raceDistance: 'half',
        goalType: 'race',
      },
      expectedPreRaceRuns: 1,
      expectedPreRaceKm: 2,
    },
    {
      profile: {
        name: 'marathon, 10 km/wk, 6 days',
        experience: 'regular',
        age: 35,
        daysPerWeek: 6,
        weeklyKm: 10,
        durationWeeks: 16,
        raceDistance: 'marathon',
        goalType: 'race',
      },
      expectedPreRaceRuns: 1,
      expectedPreRaceKm: 2,
    },
    {
      profile: {
        name: 'marathon, 10 km/wk, 7 days',
        experience: 'regular',
        age: 35,
        daysPerWeek: 7,
        weeklyKm: 10,
        durationWeeks: 16,
        raceDistance: 'marathon',
        goalType: 'race',
      },
      expectedPreRaceRuns: 1,
      expectedPreRaceKm: 2,
    },
  ];

  it.each(
    UNDERFUNDED_RACE_CASES.map(
      ({ profile, expectedPreRaceRuns, expectedPreRaceKm }) =>
        [profile.name, profile, expectedPreRaceRuns, expectedPreRaceKm] as const,
    ),
  )(
    'rests omitted pre-race slots instead of padding %s with 1 km filler runs',
    (_name, profile, expectedPreRaceRuns, expectedPreRaceKm) => {
      const raceWeek = buildFor(profile).weeks.at(-1)!;
      expect(raceWeek.days[6]).toMatchObject({ kind: 'run', label: 'Race Day' });

      const preRaceRuns = raceWeek.days.slice(0, 6).filter(isWorkout);
      expect(preRaceRuns).toHaveLength(expectedPreRaceRuns);
      expect(
        preRaceRuns.reduce((sum, run) => sum + (run.distanceKm ?? 0), 0),
      ).toBe(expectedPreRaceKm);
      expect(raceWeek.days.filter(isWorkout)).toHaveLength(expectedPreRaceRuns + 1);
      const fillerRuns = preRaceRuns
        .filter((run) => (run.distanceKm ?? 0) < 2)
        .map((run) => ({ label: run.label, distanceKm: run.distanceKm }));
      expect(fillerRuns).toEqual([]);
      expect(preRaceRuns.length).toBeLessThan(runCountFor(profile.daysPerWeek) - 1);
      expect(preRaceRuns.at(-1)?.label).toBe('SR');

      const baselineRestDays = 7 - runCountFor(profile.daysPerWeek);
      expect(raceWeek.days.filter((day) => day.kind === 'rest').length).toBeGreaterThan(
        baselineRestDays,
      );
    },
  );

  it.each(FUNDED_RACE_PROFILES.map((profile) => [profile.name, profile] as const))(
    'keeps all requested race-week runs for funded profile %s',
    (_name, profile) => {
      const raceWeek = buildFor(profile).weeks.at(-1)!;
      expect(raceWeek.days.filter(isWorkout)).toHaveLength(runCountFor(profile.daysPerWeek));
    },
  );

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
