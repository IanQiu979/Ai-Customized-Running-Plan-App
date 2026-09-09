/**
 * The Free-tier library engine — § 20's resolution order, § 8's duration adaptation, § 16–18's
 * injury gate, and § 22's mandatory disclaimers.
 *
 * Section references are to `planning/research/plan-blueprint-examples.md`.
 */

import { DELOAD_REDUCTION_MAX, DELOAD_REDUCTION_MIN, MAX_WEEKLY_KM } from '../../loadRules';
import type { ExperienceAnswer, IntakeResponses, InjuryFlag, RaceDistance } from '../../planTypes';
import { LIBRARY_CALENDARS } from '../calendars';
import {
  adaptCalendar,
  buildLibraryPlan,
  deriveInjuryState,
  LIBRARY_GENERAL_DISCLAIMER,
  LIBRARY_H4_DISCLAIMER,
  LIBRARY_INJURY_DISCLAIMER,
  resolveDeloadCadence,
  resolveLayoutDays,
  type LibraryPlanResult,
} from '../engine';
import { composeInjuryEffect, highestInjuryState, INJURY_MODULES } from '../injury';
import {
  DEFAULT_RUNNER_PROFILE,
  LIBRARY_DECISIONS,
  SPD_MATERIALLY_STRONGER_PCT,
  TWO_QUALITY_TRACKS,
} from '../openQuestions';
import { CANONICAL_WEEKS, EXPERIENCE_TRACKS } from '../registry';

function intake(overrides: Partial<IntakeResponses> = {}): IntakeResponses {
  return {
    goal: 'Run a strong race',
    age: 32,
    experience: 'regular',
    daysPerWeek: 5,
    weeklyKm: 40,
    raceDistance: '10k',
    recentPerformance: { distance: '10k', timeSec: 2700 },
    injuries: [],
    ...overrides,
  };
}

function build(
  overrides: Partial<IntakeResponses> = {},
  params: { weeks?: number; distance?: RaceDistance; goalType?: 'race' | 'duration' } = {},
): LibraryPlanResult {
  const distance = params.distance ?? overrides.raceDistance ?? '10k';
  return buildLibraryPlan({
    intake: intake({ ...overrides, raceDistance: distance }),
    goalType: params.goalType ?? 'race',
    durationWeeks: params.weeks ?? 14,
    raceDistance: distance,
    raceDate: '2027-01-01',
    tierAtGeneration: 'free',
  });
}

function ok(result: LibraryPlanResult): Extract<LibraryPlanResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected a library plan, got gap ${result.gap}`);
  return result;
}

// ---------------------------------------------------------------------------

describe('§ 20 resolution order', () => {
  it('resolves a plan ID from distance, experience track, and runner profile', () => {
    const { resolution } = ok(build({ experience: 'experienced' }));
    expect(resolution.planId).toBe('10K-EXP-END');
    expect(resolution.canonicalWeeks).toBe(14);
  });

  it('maps each of the five intake answers to its own track', () => {
    const answers: ExperienceAnswer[] = ['new', 'some', 'regular', 'experienced', 'competitive'];
    const tracks = answers.map((experience) => ok(build({ experience })).resolution.track);
    expect(tracks).toEqual([...EXPERIENCE_TRACKS]);
  });

  it('takes § 7’s conservative END default, because intake carries at most one result', () => {
    for (const experience of ['new', 'competitive'] as ExperienceAnswer[]) {
      expect(ok(build({ experience })).resolution.profile).toBe('END');
    }
  });

  it('evaluates the injury gate before ambition: H4 removes every run, race or not', () => {
    const plan = ok(
      buildLibraryPlan({
        intake: intake({ injuries: ['knee'] }),
        goalType: 'race',
        durationWeeks: 14,
        raceDistance: '10k',
        tierAtGeneration: 'free',
      }),
    ).plan;
    // The live derivation cannot reach H4 (Q5), so the branch is proved directly.
    expect(deriveInjuryState(['knee'])).toBe('H1');
    expect(highestInjuryState(['H1', 'H4', 'H2'])).toBe('H4');
    expect(plan.weeks.every((week) => week.days.some((day) => day.kind === 'run'))).toBe(true);
  });

  it('reports the gap rather than inventing a distance when intake named none (Q1)', () => {
    const result = buildLibraryPlan({
      intake: { ...intake(), raceDistance: undefined },
      goalType: 'duration',
      durationWeeks: 12,
      tierAtGeneration: 'free',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.gap).toBe('no-race-distance');
  });
});

describe("Ian's six rulings, 2026-09-10", () => {
  it('records all six as settled, none still open', () => {
    expect(Object.keys(LIBRARY_DECISIONS)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
    for (const decision of Object.values(LIBRARY_DECISIONS)) {
      expect(decision.ruling.length).toBeGreaterThan(0);
    }
  });

  it('Q2: banks the 5% Riegel margin, still unreachable until intake takes two results', () => {
    // Ian set the threshold ahead of the intake work so it is not re-litigated later. Nothing
    // consumes it yet, and that is deliberate — `SPD` cannot be selected from one performance.
    expect(SPD_MATERIALLY_STRONGER_PCT).toBe(0.05);
    expect(DEFAULT_RUNNER_PROFILE).toBe('END');
  });

  it('Q4: a second hard session is EXP/COMP only', () => {
    expect([...TWO_QUALITY_TRACKS]).toEqual(['EXP', 'COMP']);
    const reg = ok(build({ experience: 'regular', daysPerWeek: 5 })).plan;
    const exp = ok(build({ experience: 'experienced', daysPerWeek: 5 })).plan;
    const hardDays = (plan: typeof reg): number =>
      Math.max(
        ...plan.weeks.map(
          (week) =>
            week.days.filter(
              (day) =>
                day.kind === 'run' &&
                day.isLongRun !== true &&
                (day.effort === 'tempo' || day.effort === 'interval'),
            ).length,
        ),
      );
    expect(hardDays(reg)).toBe(1);
    expect(hardDays(exp)).toBe(2);
  });

  it('Q6: renders MP as steady and RP10 as interval, minting no new abbreviation', () => {
    const known = new Set(['ER', 'RR', 'TR', 'INT', 'RP', 'LR', 'SR', 'ER + Strides', 'Race Day', 'Rest']);
    for (const distance of ['5k', '10k', 'half', 'marathon'] as RaceDistance[]) {
      const { plan } = ok(build({ experience: 'experienced' }, { distance, weeks: 24 }));
      for (const week of plan.weeks) {
        for (const day of week.days) {
          if (day.kind === 'run') expect(known.has(day.label)).toBe(true);
        }
      }
    }
  });
});

describe('§ 6 run-frequency layouts', () => {
  it('gives NEW rest days rather than extra running when they ask for six', () => {
    expect(resolveLayoutDays('NEW', 6)).toBe(4);
    expect(resolveLayoutDays('SOME', 7)).toBe(5);
    expect(resolveLayoutDays('EXP', 7)).toBe(6);
    expect(resolveLayoutDays('COMP', 7)).toBe(7);
  });

  it('reserves the 7-day layout for COMP and never drops below three days', () => {
    expect(resolveLayoutDays('EXP', 1)).toBe(3);
    expect(resolveLayoutDays('REG', 6)).toBe(5);
  });

  it('places exactly the layout’s number of running days each non-race week', () => {
    const { plan, resolution } = ok(build({ experience: 'experienced', daysPerWeek: 6 }));
    expect(resolution.layoutDays).toBe(6);
    for (const week of plan.weeks.slice(0, -1)) {
      expect(week.days.filter((day) => day.kind === 'run')).toHaveLength(6);
    }
  });

  it('fixes Day 7 as the long run in every training week (§ 2 rule 5)', () => {
    const { plan } = ok(build());
    for (const week of plan.weeks.slice(0, -1)) {
      const day7 = week.days[6];
      expect(day7.kind).toBe('run');
      if (day7.kind === 'run') expect(day7.isLongRun).toBe(true);
    }
  });
});

describe('§ 10 recovery cadence', () => {
  it('forces a three-week rhythm at 50+ and for COMP', () => {
    expect(resolveDeloadCadence('REG', 52, 40)).toBe(3);
    expect(resolveDeloadCadence('COMP', 30, 60)).toBe(3);
  });

  it('uses three weeks for a higher-volume EXP runner and four otherwise', () => {
    expect(resolveDeloadCadence('EXP', 30, 45)).toBe(3);
    expect(resolveDeloadCadence('EXP', 30, 25)).toBe(4);
    expect(resolveDeloadCadence('NEW', 30, 20)).toBe(4);
  });
});

describe('§ 5 weekly-volume state machine', () => {
  it('opens at 90% of the runner’s current volume and never exceeds the level ceiling', () => {
    const { plan } = ok(build({ weeklyKm: 40, experience: 'regular' }));
    expect(plan.weeklyLoad[0]).toBeCloseTo(36, 0);
    for (const km of plan.weeklyLoad) {
      expect(km).toBeLessThanOrEqual(MAX_WEEKLY_KM.intermediate);
    }
  });

  it('cuts every recovery week 15–25% below the preceding loading week (captain 2026-09-06)', () => {
    const { plan, resolution } = ok(build({ experience: 'experienced' }));
    const calendar = LIBRARY_CALENDARS[resolution.distance];
    let lastLoading = 0;
    resolution.calendarWeeks.forEach((canonicalWeek, index) => {
      const state = calendar[canonicalWeek - 1]!.state;
      const km = plan.weeklyLoad[index]!;
      if (state === 'RECOVERY') {
        const reduction = (lastLoading - km) / lastLoading;
        expect(reduction).toBeGreaterThanOrEqual(DELOAD_REDUCTION_MIN - 1e-6);
        expect(reduction).toBeLessThanOrEqual(DELOAD_REDUCTION_MAX + 1e-6);
      } else if (calendar[canonicalWeek - 1]!.longRun !== 'RACE') {
        lastLoading = km;
      }
    });
  });

  it('marks recovery weeks as deloads and no other week', () => {
    const { plan, resolution } = ok(build());
    const calendar = LIBRARY_CALENDARS[resolution.distance];
    resolution.calendarWeeks.forEach((canonicalWeek, index) => {
      expect(plan.weeks[index]!.isDeload).toBe(calendar[canonicalWeek - 1]!.state === 'RECOVERY');
    });
  });

  it('reports the race’s own distance in race week rather than hiding it', () => {
    const { plan } = ok(build({}, { distance: '10k' }));
    const raceWeek = plan.weeks[plan.weeks.length - 1]!;
    const day7 = raceWeek.days[6];
    expect(day7.kind).toBe('run');
    if (day7.kind === 'run') expect(day7.distanceKm).toBeCloseTo(10, 5);
    expect(raceWeek.volumeKm).toBeGreaterThan(10);
  });
});

describe('§ 8 duration adaptation', () => {
  it('runs the canonical calendar unchanged at the canonical length', () => {
    const { calendarWeeks } = adaptCalendar({
      distance: 'HM',
      weeks: 16,
      isRacePlan: true,
      readiness: 'prepared',
    });
    expect(calendarWeeks).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('never deletes race week or the final taper exposure when shortening (rule 1)', () => {
    for (const weeks of [5, 8, 11]) {
      const { calendarWeeks } = adaptCalendar({
        distance: 'HM',
        weeks,
        isRacePlan: true,
        readiness: 'prepared',
      });
      expect(calendarWeeks).toHaveLength(weeks);
      expect(calendarWeeks).toContain(16);
      expect(calendarWeeks).toContain(15);
    }
  });

  it('drops early loading weeks for a prepared runner and later ambitious weeks for a first-timer', () => {
    const prepared = adaptCalendar({
      distance: 'HM',
      weeks: 10,
      isRacePlan: true,
      readiness: 'prepared',
    }).calendarWeeks;
    const firstTimer = adaptCalendar({
      distance: 'HM',
      weeks: 10,
      isRacePlan: true,
      readiness: 'first-timer',
    }).calendarWeeks;
    expect(prepared).not.toContain(1);
    expect(firstTimer).toContain(1);
    expect(firstTimer).not.toContain(14);
    expect(prepared).toContain(14);
  });

  it('refuses to compress fitness under four weeks (rule 4)', () => {
    const { calendarWeeks, compressed } = adaptCalendar({
      distance: 'M',
      weeks: 3,
      isRacePlan: true,
      readiness: 'prepared',
    });
    expect(compressed).toBe(true);
    expect(calendarWeeks).toHaveLength(3);
    expect(calendarWeeks[calendarWeeks.length - 1]).toBe(24);
    // Only the ENTRY week is repeated ahead of the taper/race tail — never a peak week.
    expect(calendarWeeks.slice(0, -2).every((week) => week === 1)).toBe(true);
  });

  it('extends by repeating base cycles only, never peak or taper (longer race date)', () => {
    const { calendarWeeks } = adaptCalendar({
      distance: '5K',
      weeks: 18,
      isRacePlan: true,
      readiness: 'prepared',
    });
    expect(calendarWeeks).toHaveLength(18);
    expect(calendarWeeks.slice(6)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(calendarWeeks.slice(0, 6).every((week) => week <= 4)).toBe(true);
  });

  it('omits RACE and the race-week taper with no target race date, ending on a loading week', () => {
    const { calendarWeeks } = adaptCalendar({
      distance: '10K',
      weeks: 9,
      isRacePlan: false,
      readiness: 'prepared',
    });
    const calendar = LIBRARY_CALENDARS['10K'];
    expect(calendarWeeks).toHaveLength(9);
    for (const week of calendarWeeks) {
      expect(['TAPER-1', 'TAPER-2', 'RACE-WEEK']).not.toContain(calendar[week - 1]!.state);
    }
    expect(calendar[calendarWeeks[calendarWeeks.length - 1]! - 1]!.state).not.toBe('RECOVERY');
  });

  it('builds a no-race plan with no race day anywhere in it', () => {
    const { plan } = ok(build({}, { weeks: 9, goalType: 'duration' }));
    expect(plan.goalType).toBe('duration');
    expect(plan.raceDate).toBeUndefined();
    for (const week of plan.weeks) {
      for (const day of week.days) {
        if (day.kind === 'run') expect(day.label).not.toBe('Race Day');
      }
    }
  });

  it('generates exactly the requested number of weeks at every length', () => {
    for (const weeks of [2, 6, 14, 20]) {
      const { plan } = ok(build({}, { weeks }));
      expect(plan.weeks).toHaveLength(weeks);
      expect(plan.durationWeeks).toBe(weeks);
      plan.weeks.forEach((week, index) => {
        expect(week.weekNumber).toBe(index + 1);
        expect(week.totalWeeks).toBe(weeks);
      });
    }
  });
});

describe('§ 22 disclaimers', () => {
  it('carries the general disclaimer on every plan, whatever the intake', () => {
    const cases: Partial<IntakeResponses>[] = [
      {},
      { experience: 'new', daysPerWeek: 3, weeklyKm: 15 },
      { experience: 'competitive', daysPerWeek: 7, weeklyKm: 90 },
      { age: 16 },
      { age: 61 },
      { injuries: ['knee', 'plantar_arch'] },
      { recentPerformance: undefined },
    ];
    for (const distance of ['5k', '10k', 'half', 'marathon'] as RaceDistance[]) {
      for (const override of cases) {
        const { plan } = ok(build(override, { distance }));
        expect(plan.disclaimers).toContain(LIBRARY_GENERAL_DISCLAIMER);
        expect(plan.disclaimers.length).toBeGreaterThan(0);
      }
    }
  });

  it('adds the H1–H4 disclaimer whenever an injury is declared, and not otherwise', () => {
    expect(ok(build({ injuries: [] })).plan.disclaimers).not.toContain(LIBRARY_INJURY_DISCLAIMER);
    expect(ok(build({ injuries: ['it_band'] })).plan.disclaimers).toContain(
      LIBRARY_INJURY_DISCLAIMER,
    );
  });

  it('shows each injury location’s own escalation warning, without merging them', () => {
    const { plan } = ok(build({ injuries: ['knee', 'lower_back'] }));
    expect(plan.disclaimers.some((line) => line.startsWith(INJURY_MODULES.knee.title))).toBe(true);
    expect(plan.disclaimers.some((line) => line.startsWith(INJURY_MODULES.lower_back.title))).toBe(
      true,
    );
  });

  it('reports limited preparation instead of pretending, and never compresses to hide it', () => {
    const short = ok(build({ weeklyKm: 12, experience: 'new' }, { distance: 'marathon', weeks: 3 }));
    expect(short.resolution.limitedPreparation).toBe(true);
    expect(short.resolution.compressed).toBe(true);
    expect(short.plan.disclaimers.some((line) => line.includes('limited') || line.includes('does not try to create fitness'))).toBe(true);
  });

  it('reports limited preparation for a NEW/SOME marathon completion track (§ 9)', () => {
    const { resolution, plan } = ok(build({ experience: 'some' }, { distance: 'marathon', weeks: 24 }));
    expect(resolution.limitedPreparation).toBe(true);
    expect(plan.disclaimers.some((line) => line.includes('limited preparation'))).toBe(true);
  });

  it('names fueling practice on the marathon weeks the library marks for it', () => {
    const { plan } = ok(build({ experience: 'experienced' }, { distance: 'marathon', weeks: 24 }));
    expect(plan.disclaimers.some((line) => line.includes('fueling practice'))).toBe(true);
  });
});

describe('§ 16–18 injury gate', () => {
  it('takes the single largest reduction across injuries, never the sum (§ 18 rule 3)', () => {
    const effect = composeInjuryEffect('H1', ['knee', 'hip_glute']);
    expect(effect.volumeReductionPct).toBeCloseTo(0.2, 10);
  });

  it('applies the union of workout removals (§ 18 rule 4)', () => {
    const effect = composeInjuryEffect('H2', ['it_band', 'ankle_achilles']);
    expect(effect.removedCodes.has('ST')).toBe(true);
    expect(effect.removedCodes.has('H')).toBe(true);
    expect(effect.removedCodes.has('FF')).toBe(true);
  });

  it('escalates to the highest state, never an average (§ 18 rule 2)', () => {
    expect(highestInjuryState(['H0', 'H3', 'H1'])).toBe('H3');
    expect(highestInjuryState([])).toBe('H0');
  });

  it('ships all seven modules with their disclaimers', () => {
    const flags: Exclude<InjuryFlag, 'none'>[] = [
      'knee',
      'ankle_achilles',
      'shin_splints',
      'it_band',
      'hip_glute',
      'lower_back',
      'plantar_arch',
    ];
    expect(Object.keys(INJURY_MODULES).sort()).toEqual([...flags].sort());
    for (const flag of flags) {
      const { plan } = ok(build({ injuries: [flag] }));
      expect(plan.disclaimers).toContain(LIBRARY_INJURY_DISCLAIMER);
      expect(plan.disclaimers).toContain(LIBRARY_GENERAL_DISCLAIMER);
    }
  });

  it('reduces the opening week to 90% of an already-reduced baseline at H1', () => {
    const healthy = ok(build({ injuries: [] })).plan.weeklyLoad[0]!;
    const injured = ok(build({ injuries: ['hip_glute'] })).plan.weeklyLoad[0]!;
    expect(injured).toBeLessThan(healthy);
  });

  it('leaves no running at all at H4, and says why', () => {
    // H4 is unreachable from live intake (Q5); the branch is exercised through its own constants.
    expect(LIBRARY_H4_DISCLAIMER).toContain('contains no running');
    expect(CANONICAL_WEEKS.M).toBe(24);
  });
});

describe('§ 11–14 stride exposures', () => {
  const labels = (result: LibraryPlanResult, week: number): string[] =>
    ok(result).plan.weeks[week - 1]!.days.map((day) =>
      day.kind === 'run' ? `${day.label}${day.structure !== undefined ? `[${day.structure}]` : ''}` : 'Rest',
    );

  it('rides the week’s stride exposure on Day 1’s easy run, never as its own session', () => {
    const result = build({ experience: 'regular' });
    expect(labels(result, 1)[0]).toBe('ER + Strides[6 × 15 sec]');
    expect(labels(result, 1).filter((label) => label.includes('Strides'))).toHaveLength(1);
  });

  it('gives REG+ the END lane’s second ST-A, on a later easy day (§ 12 week 2)', () => {
    expect(labels(build({ experience: 'regular' }), 2).filter((l) => l.includes('Strides'))).toHaveLength(2);
    expect(labels(build({ experience: 'some' }), 2).filter((l) => l.includes('Strides'))).toHaveLength(1);
  });

  it('scales the stride dose to the experience track (§ 4)', () => {
    expect(labels(build({ experience: 'new', daysPerWeek: 4 }), 1)[0]).toContain('4 × 12 sec');
    expect(labels(build({ experience: 'competitive' }), 1)[0]).toContain('8 × 15 sec');
  });

  it('drops strides entirely when an injury module removes them (§ 17 INJ-2)', () => {
    const injured = labels(build({ experience: 'regular', injuries: ['ankle_achilles'] }), 1);
    expect(injured.some((label) => label.includes('Strides'))).toBe(false);
  });
});

describe('§ 9 long-run ladder', () => {
  const longRuns = (result: LibraryPlanResult): number[] =>
    ok(result).plan.weeks.map((week) => {
      const day7 = week.days[6];
      return day7.kind === 'run' ? (day7.distanceKm ?? 0) : 0;
    });

  it('still produces a real, growing long run when the runner gave no recent time', () => {
    // No performance means no pace, so § 9's minute ladder cannot be converted to kilometres. The
    // level's share of weekly volume is the ceiling that remains; the ladder still supplies the
    // shape. Regression: an earlier reading scaled the share cap by the ladder *fraction*, which
    // put a 50 km/week half-marathoner's opening long run at 2.5 km.
    const runs = longRuns(build({ recentPerformance: undefined }, { distance: 'half', weeks: 16 }));
    expect(runs[0]).toBeGreaterThan(6);
    expect(Math.max(...runs.slice(0, -1))).toBeGreaterThan(runs[0]!);
  });

  it('never exceeds the track’s own kilometre ceiling (§ 4 operating limits)', () => {
    const comp = longRuns(
      build(
        { experience: 'competitive', daysPerWeek: 7, weeklyKm: 80 },
        { distance: 'marathon', weeks: 24 },
      ),
    ).slice(0, -1);
    expect(Math.max(...comp)).toBeLessThanOrEqual(35);

    const beginner = longRuns(
      build({ experience: 'new', daysPerWeek: 3, weeklyKm: 15 }, { distance: 'marathon', weeks: 24 }),
    ).slice(0, -1);
    expect(Math.max(...beginner)).toBeLessThanOrEqual(14);
  });

  it('keeps every long run inside its own week’s volume', () => {
    for (const distance of ['5k', 'half', 'marathon'] as RaceDistance[]) {
      const result = build({ experience: 'experienced', weeklyKm: 50 }, { distance, weeks: 12 });
      const plan = ok(result).plan;
      plan.weeks.slice(0, -1).forEach((week, index) => {
        expect(longRuns(result)[index]).toBeLessThanOrEqual(week.volumeKm);
      });
    }
  });

  it('shortens Day 7 on every recovery week', () => {
    const result = build({ experience: 'experienced' }, { distance: 'half', weeks: 16 });
    const runs = longRuns(result);
    const calendar = LIBRARY_CALENDARS.HM;
    ok(result).resolution.calendarWeeks.forEach((canonicalWeek, index) => {
      if (calendar[canonicalWeek - 1]!.state !== 'RECOVERY') return;
      expect(runs[index]).toBeLessThan(runs[index - 1]!);
    });
  });
});

describe('every plan is internally consistent', () => {
  it('reports a weekly load that equals the sum of its own days (§ 2 rule 9)', () => {
    const { plan } = ok(build({ experience: 'competitive', daysPerWeek: 7, weeklyKm: 70 }));
    plan.weeks.forEach((week, index) => {
      const summed = week.days.reduce(
        (total, day) => total + (day.kind === 'run' ? (day.distanceKm ?? 0) : 0),
        0,
      );
      expect(week.volumeKm).toBeCloseTo(summed, 1);
      expect(plan.weeklyLoad[index]).toBe(week.volumeKm);
    });
  });

  it('never emits a pace or HR zone on a Free plan — effort language only', () => {
    const { plan } = ok(build());
    for (const week of plan.weeks) {
      for (const day of week.days) {
        if (day.kind !== 'run') continue;
        expect(day.pace).toBeUndefined();
        expect(day.hrZone).toBeUndefined();
        expect(day.rpe).toBeUndefined();
        expect(day.why).toBeUndefined();
        expect(day.effortDescription.length).toBeGreaterThan(0);
      }
    }
    expect(plan.coachIntro).toBeUndefined();
    expect(plan.extras).toHaveLength(0);
  });

  it('is stamped as a template plan, never an AI one', () => {
    const { plan } = ok(build());
    expect(plan.engine).toBe('template');
    expect(plan.isFallback).toBe(false);
    expect(plan.tierAtGeneration).toBe('free');
  });
});
