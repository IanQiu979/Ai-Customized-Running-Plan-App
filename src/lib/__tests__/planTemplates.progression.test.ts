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
const TASK_ONE_MATRIX_SIZE = 22_000;
const TASK_ONE_BASELINE_OFFENDER_COUNT = 758;
// This is an exact membership baseline, not a model of the production rules: the legacy
// offenders are sparse across the matrix. A change may remove any of them, but must not add one.
// Matrix order is distance → experience → days/week → weekly km → duration → recent performance.
//
// Re-encoded exactly once, under the captain's `golden-cadence3-route` ruling (2026-09-16, audit
// §1.3): routing the under-50 advanced runner's 3-week cadence off the golden 12-week/4-day 5K
// path moved all 22 of its matrix intakes (5k / competitive / 4 days / 12 weeks, 10–110 km,
// both recent-time variants) onto the generic curve. That removed the 14 golden offenders at
// 50–110 km (whose flagged "rest" weeks had been the curve's loading weeks) and ADDED the two
// named below, which the ruling accepted by name — 770 → 758. Any other addition is still a
// regression; do not re-encode this mask to make one pass.
const POST_BASELINE_NAMED_OFFENDERS = [
  // The generic path's #103-class shape at this one baseline: week 8's long run dips 17 → 11 km
  // and the peak phase tops out at 47 km against a 49 km week 7. Pre-existing on the generic
  // path for the same reason issue #103 catalogues, captain-scoped out there too.
  '5k / competitive / 4 days / 40 km/week / 12 weeks / no recent time',
  '5k / competitive / 4 days / 40 km/week / 12 weeks / recent 10K',
] as const;
const TASK_ONE_PRE_PEAK_BASELINE_MASK =
  'AAD//////////////////////////wAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAA' +
    'AAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAP//////////////////////////AAAMAAwAAAAAAAAAAAAAAAAA' +
    'AAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAwADADMAMwAwADAAMAAwADAAMAAAAAMAAwADAAMAAAAAAAAAAAAAAAAAAAADAAMAAwADAAAAAAA' +
    'AAAAAAAAAAAAAAwADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAMAMwAzADAAMAAwADAAMAAwAAA' +
    'AAwADAAMAAwAAAAAAAAAAAAAAAAAAAAMAAwADAAMAAAAAAAAAAAAAAAAAAAADAAMAAwADAAAAAAAAAAAAAAAAAAAAAAAAADAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAA' +
    'AAAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAADAA' +
    'MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AwADAAAAAAAAAAAAAAAAAAAAAAADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAwADAAMAAAAAAAAAAAAAAAAAAAAAAAMAAwADAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAMAAwADAAAAAAAAAAAAAAAAAAAA' +
    'AAADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAwADAAMAAAAAAAAAAAAAAAAAAAAAAAMAAwAzAAAAAAAAAAAAAAAAAAAAAAADAAMAAzAA' +
    'MAAAAAAAAAAAAAAAAAAAAwADAAMwADAAAAAAAAAAAAAAAAAAAAMAAwADMAAwAAAAAAAAAAAAAAAAAAADAAMAAzAAMAAAAAAAAAAA' +
    'AAAAAAAAAwADADMAAAAAAAAAAAAAAAAAAAAAAAMAAwADMAAwAAAAAAAAAAAAAAAAAAADAAMAAzAAMAAAAAAAAAAAAAAAAAAAAwAD' +
    'AAMwADAAAAAAAAAAAAAAAAAAAAMAAwADMAAwAAAAAAAAAAAAAAAAAAADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAwADAAMAAAAAAAAA' +
    'AAAAAAAAAAAAAAMAAwADAAAAAAAAAAAAAAAAAAAAAAADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAwADAAMAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAADAAMAAwABAAAAAAAAAAAAAAAAAAAAAwADAAMAAQAAAAAAAAAAAAAAAAAAAAMAAwADAAEAAAAAAA' +
    'AAAAAAAAAAAAADAAMAAwABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwADAAEAAAAAAAAAAAAAAAAAAA' +
    'ADAAMAAwABAAAAAAAAAAAAAAAAAAAAAwADAAMAAQAAAAAAAAAAAAAAAAAAAAMAAwADAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function isPeakBelowPrePeakLoading(plan: Plan): boolean {
  const peakWeeks = plan.weeks.filter((week) => !week.isDeload && week.phase === 'peak');
  const firstPeakWeekNumber = peakWeeks[0]?.weekNumber;
  if (firstPeakWeekNumber === undefined) return false;
  const prePeakLoadingWeeks = plan.weeks.filter(
    (week) => !week.isDeload && week.weekNumber < firstPeakWeekNumber,
  );
  if (prePeakLoadingWeeks.length === 0) return false;
  return (
    Math.max(...peakWeeks.map((week) => week.volumeKm)) <
    Math.max(...prePeakLoadingWeeks.map((week) => week.volumeKm))
  );
}

interface MatrixResult {
  caseDescription: string;
  isOffender: boolean;
}

function taskOneMatrixResults(): MatrixResult[] {
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
                isOffender: isPeakBelowPrePeakLoading(plan),
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
    throw new Error('Task 1 baseline mask is not valid base64.');
  }
  const bytes = Buffer.from(mask, 'base64');
  const expectedByteLength = Math.ceil(length / 8);
  if (bytes.length !== expectedByteLength) {
    throw new Error(
      `Task 1 baseline mask has ${bytes.length} bytes; expected ${expectedByteLength} for ${length} cases.`,
    );
  }
  return Array.from({ length }, (_, index) =>
    (bytes[Math.floor(index / 8)] & (1 << (index % 8))) !== 0,
  );
}

describe('generic peak-week capacity progression', () => {
  it('keeps a 20-week regular three-day 5K peak with no recent time at its pre-peak loading high-water mark', () => {
    const plan = buildRegularFiveKPlan(20, 20);
    const prePeakLoadingMaxKm = Math.max(
      ...plan.weeks
        .filter((week) => !week.isDeload && week.phase !== 'peak' && week.phase !== 'taper')
        .map((week) => week.volumeKm),
    );
    const peakMaxKm = Math.max(
      ...plan.weeks
        .filter((week) => !week.isDeload && week.phase === 'peak')
        .map((week) => week.volumeKm),
    );

    expect(prePeakLoadingMaxKm).toBe(21);
    expect(peakMaxKm).toBe(21);
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
      volumeKm: 15,
      // `deloadLongRun` of week 15's 8 km (2026-09-12): a rest week shortens Day 7 to § 9's 60–70%
      // of the preceding long run instead of carrying the peak long run through the rest week.
      longRunKm: 5,
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

    expect(peakWeeks.map((week) => week.weekNumber)).toEqual([17, 18, 19]);
    expect(peakWeeks.map((week) => week.volumeKm)).toEqual([23, 24, 24]);
    expect(peakWeeks.map(longRunKm)).toEqual([9, 9, 9]);
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

  it('records the exact Task 1 matrix baseline for the Task 2 zero-new-regression comparison', () => {
    const results = taskOneMatrixResults();
    expect(results).toHaveLength(TASK_ONE_MATRIX_SIZE);
    const baselineFlags = decodeFlags(TASK_ONE_PRE_PEAK_BASELINE_MASK, results.length);
    expect(baselineFlags.filter(Boolean)).toHaveLength(TASK_ONE_BASELINE_OFFENDER_COUNT);

    const newOffenderDescriptions = results.flatMap(({ caseDescription, isOffender }, index) =>
      isOffender && !baselineFlags[index] ? [caseDescription] : [],
    );
    expect(newOffenderDescriptions).toEqual([]);

    // The two 2026-09-16 additions are in the mask by name, not by accident: each must still be
    // both flagged in the baseline and an offender today, so a future fix that clears one shows up
    // here as a deliberate edit rather than a silent drift of the count.
    for (const named of POST_BASELINE_NAMED_OFFENDERS) {
      const index = results.findIndex(({ caseDescription }) => caseDescription === named);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(baselineFlags[index]).toBe(true);
      expect(results[index].isOffender).toBe(true);
    }
  });
});
