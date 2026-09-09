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
const TASK_ONE_BASELINE_OFFENDER_COUNT = 770;
// This is an exact membership baseline, not a model of the production rules: the 770 legacy
// offenders are sparse across the matrix. Task 2 may remove any of them, but must not add one.
// Matrix order is distance → experience → days/week → weekly km → duration → recent performance.
const TASK_ONE_PRE_PEAK_BASELINE_MASK =
  'AAD//////////////////////////wAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAA' +
    'AAAAAAAAAAAAAAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAP//////////////////////////AAAMAAwAAAAAAAAAAAAAAAAA' +
    'AAAAAAAADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAwADADMAMwAwADAAMAAwADAAMAAAAAMAAwADAAMAAAAAAAAAAAAAAAAAAAADAAMAAwADAAAAAAA' +
    'AAAAAAAAAAAAAAwADAAMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAMAMwAzADAAMAAwADAAMAAwAAA' +
    'AAwADAAMAAwAAAAAAAAAAAAAAAAAAAAMAAwADAAMAAAAAAAAAAAAAAAAAAAADAAMAAwADAAAAAAAAAAAAAAAAAAAAAAAAADAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAADAAMAAwADAAMAAwADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
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
      longRunKm: 8,
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

  it('pins the 24-week witness before retained-quality correction', () => {
    const plan = buildRegularFiveKPlan(24, 20);
    const peakWeeks = plan.weeks.filter((week) => week.phase === 'peak' && !week.isDeload);

    expect(peakWeeks.map((week) => week.weekNumber)).toEqual([17, 18, 19]);
    expect(peakWeeks.map((week) => week.volumeKm)).toEqual([23, 24, 24]);
    expect(peakWeeks.map(longRunKm)).toEqual([9, 9, 9]);
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
  });
});
