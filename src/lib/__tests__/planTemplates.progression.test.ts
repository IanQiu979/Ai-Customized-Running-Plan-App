import { buildTemplatePlan } from '../planTemplates';
import type { Day, ExperienceAnswer, IntakeResponses, Plan, RaceDistance, Workout } from '../planTypes';

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function buildRegularFiveKPlan(durationWeeks: number, weeklyKm: number) {
  const intake: IntakeResponses = {
    goal: 'Run a faster 5K',
    age: 35,
    experience: 'regular',
    daysPerWeek: 3,
    weeklyKm,
    raceDistance: '5k',
    injuries: ['none'],
  };
  return buildTemplatePlan({
    intake,
    goalType: 'race',
    durationWeeks,
    raceDistance: '5k',
    raceDate: '2026-12-25',
    tierAtGeneration: 'pro',
    density: 'paid',
  });
}

function longRunKm(week: Plan['weeks'][number]): number {
  return week.days.filter(isWorkout).find((workout) => workout.isLongRun === true)?.distanceKm ?? 0;
}

const MATRIX_DISTANCES: readonly (RaceDistance | undefined)[] = ['5k', '10k', 'half', 'marathon', undefined];
const MATRIX_EXPERIENCES: readonly ExperienceAnswer[] = [
  'new',
  'some',
  'regular',
  'experienced',
  'competitive',
];
const MATRIX_DAYS = [3, 4, 5, 6, 7] as const;
const MATRIX_WEEKLY_KM = Array.from({ length: 11 }, (_, index) => 10 + index * 10);
const MATRIX_DURATIONS = [6, 8, 10, 12, 14, 16, 20, 24] as const;
const MATRIX_RECENT_PERFORMANCES = [undefined, { distance: '10k', timeSec: 2700 }] as const;
const MATRIX_SIZE = 22_000;

/**
 * The product invariant, captain's ruling on issue #103 (2026-09-19): the peak phase's highest
 * loading week is never below the **base** phase's highest loading week. A peak that sits below a
 * mid-**build** loading spike is tolerated, provided the plan discloses it (`buildSpikeDisclosure`
 * in `planTemplates.ts`) — that tolerance is asserted separately below, as a property of every
 * plan, not encoded here. Until that ruling this mask encoded the stricter "below any pre-peak
 * loading week" comparison (758 offenders, 770 before the `golden-cadence3-route` ruling); under
 * the base-high rule the same sweep had 458 offenders before the taper alignment and held
 * long-run curves landed with the ruling, 348 after them — every one in two named families that
 * needed a decision above this code — and **0 since the captain's 2026-09-20 rulings on those two
 * families** (`REMAINING_OFFENDER_FAMILIES` records what they were and what he ruled).
 *
 * This is an exact membership baseline, not a model of the production rules: a change may remove
 * any of these offenders, but must not add one. Matrix order is distance → experience → days/week
 * → weekly km → duration → recent performance. Do not re-encode this mask to make a failure go
 * away — read the failing case list instead. (The mask is all-clear today; it stays so that a
 * regression fails by name rather than by count.)
 */
const BASE_HIGH_BASELINE_OFFENDER_COUNT = 0;
/**
 * Every remaining offender must belong to one of these families, and the test below asserts that
 * membership, so a new offender outside them fails by name and a fix inside them shows up as a
 * deliberate edit to this list rather than a count that drifted. The list is empty: the two
 * families the 2026-09-19 baseline pinned were both resolved by the captain on 2026-09-20 —
 *
 * - **Beginner three-day 5K plans** (`new`/`some`, 3 days, 20–110 km/week, every duration; 320 of
 *   the 348). With one quality session sized at the 5K tempo's 8 km nominal, the beginner
 *   three-run share ceiling (`longRunShareCap` = 1.1 / 3 ≈ 36.7%) and the no-easy-run-outgrows-
 *   the-long-run rule together capped the week at about 86% of its target, so the growth base
 *   decayed week on week and the peak rendered below week 1. **Remedy A1:** the beginner share
 *   margin is 1.2 (40% at three runs, 30% at four) — `loadRules.ts`'s `LONG_RUN_SHARE_MARGIN`.
 * - **The golden 12-week / 4-day 5K path at 50–110 km/week** (`regular`/`experienced`; the other
 *   28). The coach-authored curve is written at 35 km/week; scaled past ~50 km its base and build
 *   weeks pinned to the flat intermediate share cap with two easy runs while its two-quality-
 *   session peak weeks pinned to the same cap with one. **Remedy B1:** a declared
 *   `weeklyKm >= GOLDEN_FIVE_K_MAX_WEEKLY_KM` (50) is routed off the golden path onto
 *   `buildGenericWeek` — `planTemplates.ts`'s `useGoldenFiveKShape`.
 */
const REMAINING_OFFENDER_FAMILIES: readonly ((caseDescription: string) => boolean)[] = [];
/**
 * How many plans in the sweep render their peak below a build-phase loading spike that is also the
 * plan's highest loading week — tolerated, disclosed, and pinned as a ceiling so that growth in the
 * tolerated class is a visible edit. 48 until the disclosure's trigger was tightened to that
 * "highest loading week" condition on 2026-09-19 (the 16 plans that left the class had a base high
 * above their build spike), 32 until the 2026-09-20 rulings above, 4 since.
 */
const TOLERATED_BUILD_SPIKE_COUNT = 4;
/**
 * Plans whose peak phase is a single rest week: `allocatePhaseCounts` gives a 10- or 14-week 5K
 * (and an 8- or 10-week competitive half) a one-week peak, and the runner's deload cadence lands on
 * exactly that week, so the "peak" is a deload and the plan has no peak loading week at all (150 of
 * the sweep; they are outside the base-high comparison above, which needs a loading peak to
 * compare). Named in the captain's 2026-09-20 rulings (issue #103) with the fix that follows from
 * "a peak phase must be a real training block": shift the phase boundary a week earlier when the
 * allocator's sole peak week is a cadence rest week. Not done here — on this engine the phase
 * label is an input that chooses sessions (`buildGenericWeek`'s peak interval session, the
 * tempo's duration), so the fix moves coaching content and is a follow-up for the captain, not a
 * relabel. Pinned as a ceiling so the class cannot grow unnoticed.
 */
const PEAK_ONLY_REST_CEILING = 150;
const BASE_HIGH_BASELINE_MASK =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function loadingMaxKm(plan: Plan, phase: Plan['weeks'][number]['phase']): number {
  return Math.max(
    -Infinity,
    ...plan.weeks.filter((week) => !week.isDeload && week.phase === phase).map((week) => week.volumeKm),
  );
}

function isPeakBelowBaseHigh(plan: Plan): boolean {
  const peakMaxKm = loadingMaxKm(plan, 'peak');
  const baseMaxKm = loadingMaxKm(plan, 'base');
  if (!Number.isFinite(peakMaxKm) || !Number.isFinite(baseMaxKm)) return false;
  return peakMaxKm < baseMaxKm;
}

function isPeakBelowBuildSpike(plan: Plan): boolean {
  // Mirrors `peakBelowBuildSpike`: the build spike must be the plan's highest loading week — above
  // the peak high and not below the base high — for the plan to be a tolerated, disclosed shape.
  const peakMaxKm = loadingMaxKm(plan, 'peak');
  const buildMaxKm = loadingMaxKm(plan, 'build');
  if (!Number.isFinite(peakMaxKm) || !Number.isFinite(buildMaxKm)) return false;
  return peakMaxKm < buildMaxKm && buildMaxKm >= loadingMaxKm(plan, 'base');
}

function hasBuildSpikeDisclosure(plan: Plan): boolean {
  return plan.disclaimers.some((text) => text.startsWith('Your highest-distance week is week '));
}

interface MatrixResult {
  caseDescription: string;
  isOffender: boolean;
  isBuildSpike: boolean;
  isDisclosed: boolean;
  isPeakOnlyRest: boolean;
}

function isPeakOnlyRest(plan: Plan): boolean {
  const peakWeeks = plan.weeks.filter((week) => week.phase === 'peak');
  return peakWeeks.length > 0 && peakWeeks.every((week) => week.isDeload);
}

function matrixResults(): MatrixResult[] {
  const results: MatrixResult[] = [];
  for (const raceDistance of MATRIX_DISTANCES) {
    for (const experience of MATRIX_EXPERIENCES) {
      for (const daysPerWeek of MATRIX_DAYS) {
        for (const weeklyKm of MATRIX_WEEKLY_KM) {
          for (const durationWeeks of MATRIX_DURATIONS) {
            for (const recentPerformance of MATRIX_RECENT_PERFORMANCES) {
              const intake: IntakeResponses = {
                goal: raceDistance ? `Train for ${raceDistance}` : 'Get fitter',
                age: 35,
                experience,
                daysPerWeek,
                weeklyKm,
                ...(raceDistance ? { raceDistance } : {}),
                ...(recentPerformance ? { recentPerformance } : {}),
                injuries: ['none'],
              };
              const plan = buildTemplatePlan({
                intake,
                goalType: raceDistance ? 'race' : 'duration',
                durationWeeks,
                ...(raceDistance ? { raceDistance, raceDate: '2026-12-25' } : {}),
                tierAtGeneration: 'pro',
                density: 'paid',
              });
              results.push({
                caseDescription: [
                  raceDistance ?? 'no race',
                  experience,
                  `${daysPerWeek} days`,
                  `${weeklyKm} km/week`,
                  `${durationWeeks} weeks`,
                  recentPerformance ? 'recent 10K' : 'no recent time',
                ].join(' / '),
                isOffender: isPeakBelowBaseHigh(plan),
                isBuildSpike: isPeakBelowBuildSpike(plan),
                isDisclosed: hasBuildSpikeDisclosure(plan),
                isPeakOnlyRest: isPeakOnlyRest(plan),
              });
            }
          }
        }
      }
    }
  }
  return results;
}

function decodeFlags(mask: string, length: number): boolean[] {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(mask) || mask.length % 4 !== 0) {
    throw new Error('Baseline mask is not valid base64.');
  }
  const bytes = Buffer.from(mask, 'base64');
  const expectedByteLength = Math.ceil(length / 8);
  if (bytes.length !== expectedByteLength) {
    throw new Error(
      `Baseline mask has ${bytes.length} bytes; expected ${expectedByteLength} for ${length} cases.`,
    );
  }
  return Array.from({ length }, (_, index) =>
    (bytes[Math.floor(index / 8)] & (1 << (index % 8))) !== 0,
  );
}

describe('generic peak-week capacity progression', () => {
  it('keeps a 20-week regular three-day 5K peak with no recent time at its pre-peak loading high-water mark', () => {
    // 21 / 21 before 2026-09-19. Sampling the loading block across the plan's 17 non-taper weeks
    // and reading the held long-run curve (no recovery dip on a loading week) lets this 3-day
    // intermediate reach the curve's own high: 16 → 19 → 21 → 24 km, peak 24 = pre-peak high 24,
    // above the 19 km base high, with no build spike to disclose.
    const plan = buildRegularFiveKPlan(20, 20);

    expect(loadingMaxKm(plan, 'base')).toBe(19);
    expect(loadingMaxKm(plan, 'build')).toBe(24);
    expect(loadingMaxKm(plan, 'peak')).toBe(24);
    expect(hasBuildSpikeDisclosure(plan)).toBe(false);
  });

  it('carries the rendered peak state into the downstream peak deload and taper', () => {
    const plan = buildRegularFiveKPlan(20, 20);
    const peakDeload = plan.weeks[15];
    const taper = plan.weeks[17];
    const taperRacePace = taper.days
      .filter(isWorkout)
      .find((workout) => workout.label === 'RP');

    expect({
      weekNumber: peakDeload.weekNumber,
      phase: peakDeload.phase,
      isDeload: peakDeload.isDeload,
      volumeKm: peakDeload.volumeKm,
      longRunKm: longRunKm(peakDeload),
    }).toEqual({
      weekNumber: 16,
      phase: 'peak',
      isDeload: true,
      // `deloadVolume` of week 15's 24 km (15 before 2026-09-19, off a 19 km week 15).
      volumeKm: 19,
      // `deloadLongRun` of week 15's 9 km (2026-09-12): a rest week shortens Day 7 to § 9's 60–70%
      // of the preceding long run instead of carrying the peak long run through the rest week.
      longRunKm: 6,
    });
    expect({
      weekNumber: taper.weekNumber,
      phase: taper.phase,
      isDeload: taper.isDeload,
      volumeKm: taper.volumeKm,
      racePaceKm: taperRacePace?.distanceKm,
    }).toEqual({
      weekNumber: 18,
      phase: 'taper',
      isDeload: false,
      volumeKm: 23,
      racePaceKm: 7,
    });
  });

  it('holds the 24-week witness across the retained-quality floor correction', () => {
    const plan = buildRegularFiveKPlan(24, 20);
    const peakWeeks = plan.weeks.filter((week) => week.phase === 'peak' && !week.isDeload);

    // 23 / 24 / 24 km before 2026-09-19; the taper alignment samples the loading block across the
    // plan's 20 non-taper weeks, so all three peak weeks now read its top and sit at the plan's
    // own high-water mark.
    expect(peakWeeks.map((week) => week.weekNumber)).toEqual([17, 18, 19]);
    expect(peakWeeks.map((week) => week.volumeKm)).toEqual([24, 24, 24]);
    expect(peakWeeks.map(longRunKm)).toEqual([9, 9, 9]);
    expect(loadingMaxKm(plan, 'peak')).toBe(
      Math.max(...plan.weeks.filter((week) => !week.isDeload).map((week) => week.volumeKm)),
    );
  });

  it('floors a three-day long run against the quality session the week actually schedules', () => {
    // At three running days only Q1 is retained (source §6), so the long run must be floored
    // against that session and never against the interval workout the layout drops. Before this
    // correction the floor read the full `quality` array and produced a 5 km long run inside an
    // 11 km week here — a session the runner never sees, setting the week's hardest distance.
    const plan = buildRegularFiveKPlan(6, 10);
    const peakWeek = plan.weeks[4];
    const scheduledLabels = peakWeek.days.filter(isWorkout).map((workout) => workout.label);

    expect(peakWeek.phase).toBe('peak');
    expect(scheduledLabels).toEqual(['ER + Strides', 'TR', 'LR']);
    expect(longRunKm(peakWeek)).toBe(4);
    expect(peakWeek.volumeKm).toBe(11);
  });

  it('keeps that three-day peak at its own base high-water mark after the floor correction', () => {
    const plan = buildRegularFiveKPlan(6, 10);
    const baseMaxKm = Math.max(
      ...plan.weeks.filter((week) => !week.isDeload && week.phase === 'base').map((week) => week.volumeKm),
    );
    const peakMaxKm = Math.max(
      ...plan.weeks.filter((week) => !week.isDeload && week.phase === 'peak').map((week) => week.volumeKm),
    );

    expect(peakMaxKm).toBeGreaterThanOrEqual(baseMaxKm);
  });

  it('records the exact base-high baseline of the 22,000-plan sweep and admits no new offender', () => {
    const results = matrixResults();
    expect(results).toHaveLength(MATRIX_SIZE);
    const baselineFlags = decodeFlags(BASE_HIGH_BASELINE_MASK, results.length);
    expect(baselineFlags.filter(Boolean)).toHaveLength(BASE_HIGH_BASELINE_OFFENDER_COUNT);

    const newOffenderDescriptions = results.flatMap(({ caseDescription, isOffender }, index) =>
      isOffender && !baselineFlags[index] ? [caseDescription] : [],
    );
    expect(newOffenderDescriptions).toEqual([]);

    // Every remaining offender is in one of the two named families — a fix inside a family is a
    // deliberate edit to this list, a new offender outside them fails here by name.
    const outsideFamilies = results.flatMap(({ caseDescription, isOffender }) =>
      isOffender && !REMAINING_OFFENDER_FAMILIES.some((matches) => matches(caseDescription))
        ? [caseDescription]
        : [],
    );
    expect(outsideFamilies).toEqual([]);
  });

  it('discloses every peak that sits below a build-phase loading spike, and nothing else', () => {
    // The tolerance half of the #103 ruling: a peak below a mid-build spike is allowed only when
    // the plan says so, in the standing one-sentence flag style.
    const results = matrixResults();
    const undisclosedSpikes = results.flatMap(({ caseDescription, isBuildSpike, isDisclosed }) =>
      isBuildSpike && !isDisclosed ? [caseDescription] : [],
    );
    const disclosedWithoutSpike = results.flatMap(({ caseDescription, isBuildSpike, isDisclosed }) =>
      isDisclosed && !isBuildSpike ? [caseDescription] : [],
    );
    expect(undisclosedSpikes).toEqual([]);
    expect(disclosedWithoutSpike).toEqual([]);
    expect(results.filter(({ isBuildSpike }) => isBuildSpike).length).toBeLessThanOrEqual(
      TOLERATED_BUILD_SPIKE_COUNT,
    );
  });

  it('pins the plans whose peak phase is a single rest week as a ceiling, pending the captain\'s follow-up', () => {
    const results = matrixResults();
    const peakOnlyRest = results.filter(({ isPeakOnlyRest }) => isPeakOnlyRest);
    expect(peakOnlyRest.length).toBeLessThanOrEqual(PEAK_ONLY_REST_CEILING);
    // The class is exactly the allocator's one-week peaks: 10- and 14-week 5Ks on every level, and
    // 8- and 10-week competitive halves — a new member outside those shapes fails here by name.
    const outside = peakOnlyRest
      .map(({ caseDescription }) => caseDescription)
      .filter(
        (description) =>
          !/^5k \/ [a-z]+ \/ \d days \/ \d+ km\/week \/ (10|14) weeks \//.test(description) &&
          !/^half \/ competitive \/ \d days \/ \d+ km\/week \/ (8|10) weeks \//.test(description),
      );
    expect(outside).toEqual([]);
  });
});
