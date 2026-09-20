/**
 * Renders the coach sign-off grid — four representative intakes × Free / paid — from both plan
 * engines, offline, so the captain can diff a plan-engine change before and after.
 *
 * Run it through its launcher, which teaches Node to load this repo's TypeScript with the
 * `typescript` package already in `devDependencies` (no new dependency, no bundler):
 *
 *     node scripts/render-coach-pack.js               # summary table on stdout
 *     node scripts/render-coach-pack.js <out-dir>     # + one Markdown file per plan
 *
 * No AI call is made: paid plans come straight off `buildTemplatePlan`'s skeleton, and the prose
 * the personalizer would add (`coachIntro`, each week's `why`) is left as a `[coach prose here]`
 * placeholder. Free plans come off `buildLibraryPlan`. Both engines are pure, synchronous
 * functions, so nothing here needs a Worker, a key, or a device.
 *
 * The intakes are the ones the 2026-09-20 coach sign-off pack used, kept identical so its
 * findings (`docs/change_log.md`, 2026-09-20) can be re-checked against the same runners.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DELOAD_REDUCTION_MAX,
  DELOAD_REDUCTION_MIN,
  isValidDeload,
  LONG_RUN_MAX_MINUTES,
  longRunShareCap,
  toExperienceLevel,
} from '../src/lib/loadRules';
import { deriveTrainingPaces } from '../src/lib/paceDerivation';
import { buildLibraryPlan } from '../src/lib/planLibrary/engine';
import { buildTemplatePlan } from '../src/lib/planTemplates';
import type { Day, IntakeResponses, Plan, RaceDistance, Week, Workout } from '../src/lib/planTypes';

interface CoachPackCase {
  slug: string;
  raceDistance: RaceDistance;
  durationWeeks: number;
  intake: IntakeResponses;
  describe: string;
}

/**
 * The pack's four runners, one per distance; the same intake feeds the Free and paid cell. None
 * gave a recent time — that is what reproduces the pack's numbers exactly (its prose named recent
 * times its intakes did not carry), and it is why every pace reads as effort and the 180-minute
 * check reports "no pace".
 */
export const COACH_PACK_CASES: readonly CoachPackCase[] = [
  {
    slug: '5k',
    raceDistance: '5k',
    durationWeeks: 12,
    intake: {
      goal: 'Run a 5K',
      age: 30,
      experience: 'some',
      daysPerWeek: 4,
      weeklyKm: 20,
      raceDistance: '5k',
      injuries: ['none'],
    },
    describe: '30-year-old, some experience, 4 days/week, ~20 km/week, no recent time, race in 12 weeks, no injury',
  },
  {
    slug: '10k',
    raceDistance: '10k',
    durationWeeks: 12,
    intake: {
      goal: 'Run a 10K',
      age: 33,
      experience: 'regular',
      daysPerWeek: 4,
      weeklyKm: 30,
      raceDistance: '10k',
      injuries: ['none'],
    },
    describe: '33-year-old, regular experience, 4 days/week, ~30 km/week, no recent time, race in 12 weeks, no injury',
  },
  {
    slug: 'half',
    raceDistance: 'half',
    durationWeeks: 14,
    intake: {
      goal: 'Run a half marathon',
      age: 36,
      experience: 'experienced',
      daysPerWeek: 5,
      weeklyKm: 40,
      raceDistance: 'half',
      injuries: ['none'],
    },
    describe: '36-year-old, experienced, 5 days/week, ~40 km/week, no recent time, race in 14 weeks, no injury',
  },
  {
    slug: 'marathon',
    raceDistance: 'marathon',
    durationWeeks: 16,
    intake: {
      goal: 'Run a marathon',
      age: 38,
      experience: 'experienced',
      daysPerWeek: 5,
      weeklyKm: 50,
      raceDistance: 'marathon',
      injuries: ['none'],
    },
    describe: '38-year-old, experienced, 5 days/week, ~50 km/week, no recent time (first-timer path: no result at 10K or longer), race in 16 weeks, no injury',
  },
];

export type CoachPackTier = 'free' | 'paid';

export function renderCoachPackPlan(item: CoachPackCase, tier: CoachPackTier): Plan {
  if (tier === 'free') {
    const result = buildLibraryPlan({
      intake: item.intake,
      goalType: 'race',
      durationWeeks: item.durationWeeks,
      raceDistance: item.raceDistance,
      raceDate: '2026-12-25',
      tierAtGeneration: 'free',
    });
    if (!result.ok) throw new Error(`Free ${item.slug}: library gap ${result.gap}`);
    return result.plan;
  }
  return buildTemplatePlan({
    intake: item.intake,
    goalType: 'race',
    durationWeeks: item.durationWeeks,
    raceDistance: item.raceDistance,
    raceDate: '2026-12-25',
    tierAtGeneration: 'pro',
    density: 'paid',
  });
}

// ---------------------------------------------------------------------------
// Summary — the numbers a coach scans first
// ---------------------------------------------------------------------------

function isRun(day: Day): day is Workout {
  return day.kind === 'run';
}

function longRunOf(week: Week): Workout | undefined {
  return week.days.filter(isRun).find((workout) => workout.isLongRun === true);
}

function isRaceWeek(week: Week): boolean {
  return week.days.filter(isRun).some((workout) => workout.label === 'Race Day');
}

function km(value: number): string {
  return `${Math.round(value * 10) / 10} km`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export interface CoachPackSummary {
  weeks: number;
  startKm: number;
  peakKm: number;
  peakWeek: number;
  peakPhase: string;
  longRunMaxKm: number;
  longRunMaxWeek: number;
  longRunMaxShare: number;
  deloadWeeks: number[];
  raceWeekKm: number;
  raceDayKm: number;
  phases: string;
  /** Each invariant the sign-off pack's reading guide asks a coach to check, verdict per plan. */
  checks: Record<string, string>;
}

/**
 * The reading guide's checks, computed the way the engines enforce them (`loadRules.ts`): the
 * deload band and the long-run share are measured against the last loading week's volume, the
 * 180-minute ceiling against the runner's easy pace when one exists.
 */
export function summarize(plan: Plan, intake: IntakeResponses): CoachPackSummary {
  const loading = plan.weeks.filter((week) => !week.isDeload && !isRaceWeek(week));
  const peak = loading.reduce((best, week) => (week.volumeKm > best.volumeKm ? week : best), loading[0]!);
  let longRunMax: { km: number; week: number; share: number } = { km: 0, week: 0, share: 0 };
  const level = toExperienceLevel(intake.experience);
  const runCount = plan.weeks[0]!.days.filter(isRun).length;
  const shareCap = longRunShareCap(level, runCount, plan.raceDistance);
  const easyPace = deriveTrainingPaces(intake.recentPerformance, level).easy?.highSecPerKm;

  const failures: Record<string, string[]> = { deloadBand: [], longRunShare: [], timeCap: [] };
  let lastLoadingKm = 0;
  for (const week of plan.weeks) {
    const longRun = longRunOf(week);
    const denominator =
      week.isDeload && isValidDeload(lastLoadingKm, week.volumeKm) ? lastLoadingKm : week.volumeKm;
    if (longRun?.distanceKm !== undefined && denominator > 0) {
      const share = longRun.distanceKm / denominator;
      if (longRun.distanceKm > longRunMax.km) longRunMax = { km: longRun.distanceKm, week: week.weekNumber, share };
      // A tenth of tolerance: the library renders every session to 0.1 km, exactly as its own
      // property suites allow.
      if (longRun.distanceKm > shareCap * denominator + 0.1 + 1e-9) {
        failures.longRunShare!.push(`wk ${week.weekNumber} ${pct(share)} > ${pct(shareCap)}`);
      }
      if (easyPace !== undefined && (longRun.distanceKm * easyPace) / 60 > LONG_RUN_MAX_MINUTES + 1e-9) {
        failures.timeCap!.push(`wk ${week.weekNumber} ${km(longRun.distanceKm)}`);
      }
    }
    if (week.isDeload && !isRaceWeek(week)) {
      const cut = lastLoadingKm > 0 ? 1 - week.volumeKm / lastLoadingKm : 0;
      if (cut < DELOAD_REDUCTION_MIN - 1e-9 || cut > DELOAD_REDUCTION_MAX + 1e-9) {
        failures.deloadBand!.push(`wk ${week.weekNumber} −${pct(cut)}`);
      }
    } else if (!isRaceWeek(week)) {
      lastLoadingKm = week.volumeKm;
    }
  }

  const maxOf = (phase: string) =>
    Math.max(-Infinity, ...loading.filter((week) => week.phase === phase).map((week) => week.volumeKm));
  const peakPhaseMax = maxOf('peak');
  const peakInvariant = !Number.isFinite(peakPhaseMax)
    ? 'no loading peak week'
    : peakPhaseMax >= maxOf('build') && peakPhaseMax >= maxOf('base')
      ? 'ok'
      : `peak high ${km(peakPhaseMax)} < build ${km(maxOf('build'))} / base ${km(maxOf('base'))}`;

  const raceWeek = plan.weeks.find(isRaceWeek);
  const raceDay = raceWeek?.days.filter(isRun).find((workout) => workout.label === 'Race Day');

  return {
    weeks: plan.durationWeeks,
    startKm: plan.weeks[0]!.volumeKm,
    peakKm: peak.volumeKm,
    peakWeek: peak.weekNumber,
    peakPhase: peak.phase,
    longRunMaxKm: longRunMax.km,
    longRunMaxWeek: longRunMax.week,
    longRunMaxShare: longRunMax.share,
    deloadWeeks: plan.weeks.filter((week) => week.isDeload).map((week) => week.weekNumber),
    raceWeekKm: raceWeek?.volumeKm ?? 0,
    raceDayKm: raceDay?.distanceKm ?? 0,
    phases: plan.weeks.map((week) => `${week.phase[0]!.toUpperCase()}${week.isDeload ? '*' : ''}`).join(' '),
    checks: {
      'deload 15–25%': failures.deloadBand!.length === 0 ? 'ok' : failures.deloadBand!.join(', '),
      [`long run ≤ ${pct(shareCap)}`]: failures.longRunShare!.length === 0 ? 'ok' : failures.longRunShare!.join(', '),
      '≤ 180 min': easyPace === undefined ? 'no pace' : failures.timeCap!.length === 0 ? 'ok' : failures.timeCap!.join(', '),
      'peak ≥ build/base': peakInvariant,
    },
  };
}

export function summaryTable(): string {
  const rows: string[] = [
    '| Plan | Tier | Weeks | Start vol | Peak vol (week, phase) | Long-run max (week, % of denominator) | Deload weeks | Race-week vol (race day) | Phases (`*` = rest week) | Checks |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const item of COACH_PACK_CASES) {
    for (const tier of ['free', 'paid'] as const) {
      const summary = summarize(renderCoachPackPlan(item, tier), item.intake);
      const checks = Object.entries(summary.checks)
        .map(([name, verdict]) => `${name}: ${verdict}`)
        .join('; ');
      rows.push(
        `| ${item.slug} | ${tier} | ${summary.weeks} | ${km(summary.startKm)} | ${km(summary.peakKm)} (wk ${summary.peakWeek}, ${summary.peakPhase}) | ` +
          `${km(summary.longRunMaxKm)} (wk ${summary.longRunMaxWeek}, ${pct(summary.longRunMaxShare)}) | ${summary.deloadWeeks.join(', ') || '—'} | ` +
          `${km(summary.raceWeekKm)} (${km(summary.raceDayKm)}) | ${summary.phases} | ${checks} |`,
      );
    }
  }
  return rows.join('\n');
}

// ---------------------------------------------------------------------------
// Full plans — one Markdown file per cell, day by day
// ---------------------------------------------------------------------------

const PROSE_PLACEHOLDER = '[coach prose here]';

function paceText(workout: Workout): string {
  const parts = [workout.effortDescription];
  if (workout.pace) {
    const fmt = (secPerKm: number) => `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}`;
    parts.push(`[${fmt(workout.pace.lowSecPerKm)}–${fmt(workout.pace.highSecPerKm)}/km]`);
  }
  if (workout.hrZone !== undefined) parts.push(`[HR Z${workout.hrZone}]`);
  if (workout.rpe !== undefined) parts.push(`[RPE ${workout.rpe}]`);
  return parts.join(' ');
}

function renderWeek(week: Week, tier: CoachPackTier): string {
  const lines: string[] = [
    `**Week ${week.weekNumber}/${week.totalWeeks}** — phase: ${week.phase}${week.isDeload ? ' (DELOAD/REST WEEK)' : ''} — volume ${km(week.volumeKm)}`,
    '',
  ];
  if (tier === 'paid') lines.push(`> Coach why: ${week.why ?? PROSE_PLACEHOLDER}`, '');
  lines.push('| Day | Type | Distance | Pace/Effort target | Note |', '|---|---|---|---|---|');
  week.days.forEach((day, index) => {
    if (day.kind === 'rest') {
      lines.push(`| ${index + 1} | Rest |  |  |  |`);
      return;
    }
    const note = [day.structure, day.isLongRun ? 'LONG RUN' : undefined, tier === 'paid' ? day.why : undefined]
      .filter((text): text is string => text !== undefined)
      .join(' · ');
    lines.push(`| ${index + 1} | ${day.label} | ${day.distanceKm !== undefined ? km(day.distanceKm) : `${day.durationMin} min`} | ${paceText(day)} | ${note} |`);
  });
  lines.push('');
  return lines.join('\n');
}

export function renderPlanMarkdown(item: CoachPackCase, tier: CoachPackTier, plan: Plan): string {
  const heading =
    tier === 'free'
      ? `# ${plan.title} — Free tier (deterministic library engine)`
      : `# ${plan.title} — Paid tier (AI skeleton, density: paid; no Anthropic call — prose marked)`;
  const lines: string[] = [heading, '', `**Representative intake:** ${item.describe}.`, ''];
  if (tier === 'paid') lines.push(`> Coach intro: ${plan.coachIntro ?? PROSE_PLACEHOLDER}`, '');
  for (const week of plan.weeks) lines.push(renderWeek(week, tier));
  lines.push('## Disclaimers', '', ...plan.disclaimers.map((text) => `- ${text}`), '');
  return lines.join('\n');
}

export function main(argv: readonly string[]): void {
  const outDir = argv[0];
  if (outDir !== undefined) {
    mkdirSync(outDir, { recursive: true });
    for (const item of COACH_PACK_CASES) {
      for (const tier of ['free', 'paid'] as const) {
        const plan = renderCoachPackPlan(item, tier);
        writeFileSync(join(outDir, `${tier}-${item.slug}.md`), renderPlanMarkdown(item, tier, plan));
        writeFileSync(join(outDir, `${tier}-${item.slug}.json`), `${JSON.stringify(plan, null, 2)}\n`);
      }
    }
  }
  process.stdout.write(`${summaryTable()}\n`);
}
