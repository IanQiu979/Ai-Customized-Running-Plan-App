import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import type { Day, IntakeResponses, Plan, Week, Workout } from '../planTypes';
import { hrZoneBpm, MAX_SINGLE_RUN_KM } from '../loadRules';

/**
 * Golden fixture — docs/reference/coaching/example-plan-5k-pro.md, age 25 / 35 km-week /
 * 4 days / 5K goal / 12 weeks / goal 20:00 / recent 5K 22:30 / Pro tier / paid density.
 *
 * REBUILT 2026-07-11 against the doc's own 2026-07-11 revision (Ian scored the prior render
 * 3/10 and issued five rulings: session sizing keyed to race distance not weekly volume; reps
 * as distance × count; race-pace-rep anchoring converges current-fitness → goal pace;
 * abbreviated run-type labels (`notation.md`); HR zones/volume-adherence praised, unchanged).
 * Full account: `docs/change_log.md`, 2026-07-11 entry.
 *
 * Supersession history — two corrections from the 2026-07-10 Addendum, both no longer asserted
 * here, in favour of the rebuilt doc's own numbers:
 *  - A3 (SUPERSEDED by ruling 3): the Addendum had week 11's race-pace reps flat at the
 *    recent-equivalent pace (270 s/km), reasoning the fixture doc's 4:00/km goal pace was
 *    "stale." Ruling 3 settles it the other way — early-plan interval sessions (weeks 9-10)
 *    stay at the current-fitness band (262-270 s/km), covering the overtraining concern the
 *    Addendum was guarding against, but week 11's race-pace reps, now in the race-specific
 *    phase, converge to goal pace directly: 240 s/km (4:00/km) flat. Asserted at 240 below.
 *  - A4 (MOOT, not superseded by a ruling — the arithmetic itself changed): the Addendum had
 *    trimmed the week 4 and week 8 deload long runs to a clamp-clean 7 km / 9 km, because the
 *    old, pre-rebuild volume table's 8 km / 10 km deload long runs landed outside a strict
 *    35-45%-deload reading once checked against that table's higher loading weeks. The rebuild's
 *    new, lower loading weeks (session sizing no longer inflates tempo/interval to fill volume)
 *    put the doc's own 8 km / 10 km cleanly back inside the 35-45% band without adjustment
 *    (week 4: 23 km total is 39.5% off week 3's 38 km; week 8: 30 km total is 37.5% off week 7's
 *    48 km). Asserted at the doc's own 8 km / 10 km below, not the Addendum's 7/9.
 *
 * RESYNCED 2026-07-11, cycle-2 correction pass (same-day code-review + doc fix; see the doc's
 * own "Cycle-2 correction pass" blockquote at its top). Two changes:
 *  - Week 9's INT recovery jog moves from 200 m to 300 m per rep, to sit inside
 *    `workout-library.md`'s 40-67%-of-rep-distance recovery menu for 600 m reps (the plan Ian
 *    first scored used 200 m, outside that menu — a 400 m-rep recovery, not a 600 m one). The
 *    corrected day total (WU 2 + 4.8 quality + 2.1 recovery + CD 2 ≈ 10.9, rounded to 11 km)
 *    moves week 9's own volumeKm, and weeklyLoad[8], from 44 to **45**.
 *  - **Strides extend to one easy day per loading week** (cycle-2 addition, research-sourced,
 *    flagged in the doc for Ian's sign-off, not yet a ruling — Open item 7): weeks 1, 2, 3, 5,
 *    6, 7 (the second easy day, Day 3), weeks 9 and 10 (Day 1, that week's only easy day), and
 *    week 11 (Day 5, which also carries a `@ GP` reference since it's already the race-specific
 *    phase) all now carry `ER + Strides`. Deload weeks 4 and 8 stay strides-free by the doc's
 *    own explicit choice. Strides add no headline distance, so no other volume-table arithmetic
 *    changes from this dimension.
 */
const FIXTURE_INTAKE: IntakeResponses = {
  goal: 'Run a fast 5K',
  age: 25,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 35,
  raceDistance: '5k',
  raceDate: '2026-10-02',
  goalTimeSec: 1200, // 20:00
  recentPerformance: { distance: '5k', timeSec: 1350 }, // 22:30
  injuries: ['none'],
};

const FIXTURE_PARAMS: TemplatePlanParams = {
  intake: FIXTURE_INTAKE,
  goalType: 'race',
  durationWeeks: 12,
  raceDistance: '5k',
  raceDate: FIXTURE_INTAKE.raceDate,
  tierAtGeneration: 'pro',
  density: 'paid',
};

const INTERMEDIATE_MAX_SINGLE_RUN_KM = MAX_SINGLE_RUN_KM.intermediate; // 25

// Full weekday names/abbreviations must never appear anywhere in a plan — days are
// unnamed (Day 1 ... Day 7), the runner places them on a calendar themselves.
const DAY_NAME_PATTERN =
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Weds|Thu|Thur|Thurs|Fri|Sat|Sun)\b/i;

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function findLongRun(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((d) => d.isLongRun === true);
}

describe('buildTemplatePlan — 5K golden fixture', () => {
  let plan: Plan;

  beforeAll(() => {
    plan = buildTemplatePlan(FIXTURE_PARAMS);
  });

  it('never contains a day-name string anywhere in the plan', () => {
    expect(DAY_NAME_PATTERN.test(JSON.stringify(plan))).toBe(false);
  });

  it('is deterministic — identical params produce a deep-equal plan', () => {
    const again = buildTemplatePlan(FIXTURE_PARAMS);
    expect(again).toEqual(plan);
  });

  it('passes through the request fields untouched', () => {
    expect(plan.goalType).toBe('race');
    expect(plan.raceDistance).toBe('5k');
    expect(plan.raceDate).toBe('2026-10-02');
    expect(plan.durationWeeks).toBe(12);
    expect(plan.tierAtGeneration).toBe('pro');
    expect(plan.isFallback).toBe(false);
  });

  it('always uses the template engine, never "ai"', () => {
    expect(plan.engine).toBe('template');
  });

  it('titles the plan from the duration and race distance', () => {
    expect(plan.title).toBe('12-Week 5K Plan');
  });

  it('allocates phases exactly base x4, build x4, peak x2, taper x2', () => {
    expect(plan.weeks.map((w) => w.phase)).toEqual([
      'base', 'base', 'base', 'base',
      'build', 'build', 'build', 'build',
      'peak', 'peak',
      'taper', 'taper',
    ]);
  });

  it('numbers weeks 1..12 against a total of 12', () => {
    plan.weeks.forEach((w, i) => {
      expect(w.weekNumber).toBe(i + 1);
      expect(w.totalWeeks).toBe(12);
    });
  });

  it('deloads only at weeks 4 and 8', () => {
    expect(plan.weeks.map((w) => w.isDeload)).toEqual([
      false, false, false, true,
      false, false, false, true,
      false, false,
      false, false,
    ]);
  });

  it('reproduces the fixture volume schedule for weeks 1-11 exactly', () => {
    // docs/reference/coaching/example-plan-5k-pro.md § "Volume plan" table, Volume column,
    // weeks 1-11 (rebuilt 2026-07-11: session sizing no longer inflates tempo/interval to fill
    // weekly volume, so the whole table — and its peak, 48 km not the old 52-54 km — is lower;
    // week 9 is the cycle-2-corrected 45, not the cycle-1 44 — see header):
    // 34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40.
    const expected = [34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40];
    plan.weeks.slice(0, 11).forEach((w, i) => {
      expect(w.volumeKm).toBe(expected[i]);
    });
  });

  it('derives week 12 (race week) volume from its sessions, landing near the fixture ~28 km', () => {
    // Sessions-derived, not asserted to the fixture cell — see the invariant loop below
    // for the exact sessions-sum-to-volumeKm check that actually pins this number down.
    expect(plan.weeks[11].volumeKm).toBeGreaterThanOrEqual(24);
    expect(plan.weeks[11].volumeKm).toBeLessThanOrEqual(32);
  });

  it('mirrors weeklyLoad against each week volumeKm', () => {
    expect(plan.weeklyLoad).toEqual(plan.weeks.map((w) => w.volumeKm));
  });

  it('reproduces the fixture long-run schedule for weeks 1-11, with weeks 4/8 at the rebuilt doc\'s own 8/10 km (the 2026-07-10 Addendum A4\'s 7/9 km is moot — see header)', () => {
    // docs/reference/coaching/example-plan-5k-pro.md § "Volume plan" table, Long run column,
    // weeks 1-11: 10, 11, 12, 8, 13, 14, 15, 10, 14, 15, 12.
    const expected = [10, 11, 12, 8, 13, 14, 15, 10, 14, 15, 12];
    plan.weeks.slice(0, 11).forEach((w, i) => {
      const longRun = findLongRun(w);
      expect(longRun?.distanceKm).toBe(expected[i]);
    });
  });

  it('has no designated long run in the final race week', () => {
    expect(findLongRun(plan.weeks[11])).toBeUndefined();
  });

  it('reproduces the week-1 day layout: ER, rest, ER + Strides, rest, TR, LR, rest', () => {
    const [d1, d2, d3, d4, d5, d6, d7] = plan.weeks[0].days;

    expect(d1.kind).toBe('run');
    expect((d1 as Workout).effort).toBe('easy');
    expect((d1 as Workout).label).toBe('ER');

    expect(d2).toEqual({ kind: 'rest' });

    expect(d3.kind).toBe('run');
    expect((d3 as Workout).effort).toBe('easy');
    // notation.md: run-type labels are abbreviated except Strides, always spelled out.
    expect((d3 as Workout).label).toBe('ER + Strides');
    expect((d3 as Workout).structure ?? '').toMatch(/stride/i);
    expect((d3 as Workout).structure ?? '').not.toMatch(/\bST\b/);

    expect(d4).toEqual({ kind: 'rest' });

    expect(d5.kind).toBe('run');
    expect((d5 as Workout).effort).toBe('tempo');
    expect((d5 as Workout).label).toBe('TR');

    expect(d6.kind).toBe('run');
    expect((d6 as Workout).isLongRun).toBe(true);
    expect((d6 as Workout).label).toBe('LR');

    expect(d7).toEqual({ kind: 'rest' });
  });

  it('carries a derivable pace band on the week-1 tempo run (paid density)', () => {
    const tempoDay = plan.weeks[0].days[4] as Workout;
    expect(tempoDay.pace).toEqual({ lowSecPerKm: 281, highSecPerKm: 294 });
  });

  it('carries the intermediate easy-pace band (Addendum A1) on the week-1 easy run', () => {
    const easyDay = plan.weeks[0].days[0] as Workout;
    expect(easyDay.pace).toEqual({ lowSecPerKm: 281 + 45, highSecPerKm: 294 + 60 });
  });

  it('assigns HR zones matching the fixture doc table for a 25-year-old', () => {
    expect(hrZoneBpm(1, 25)).toEqual({ low: 117, high: 137 });
    expect(hrZoneBpm(2, 25)).toEqual({ low: 137, high: 156 });
    expect(hrZoneBpm(3, 25)).toEqual({ low: 156, high: 170 });
    expect(hrZoneBpm(4, 25)).toEqual({ low: 170, high: 185 });
    expect(hrZoneBpm(5, 25)).toEqual({ low: 185, high: 195 });
  });

  it('assigns the fixed effort-to-HR-zone mapping to week-1 workouts (paid density)', () => {
    const easyDay = plan.weeks[0].days[0] as Workout;
    const tempoDay = plan.weeks[0].days[4] as Workout;
    expect(easyDay.hrZone).toBe(1);
    expect(tempoDay.hrZone).toBe(3);
  });

  it('carries no strides and no hard efforts in either deload week (4 or 8)', () => {
    for (const weekIndex of [3, 7]) {
      const workouts = plan.weeks[weekIndex].days.filter(isWorkout);
      for (const w of workouts) {
        expect(['easy', 'recovery']).toContain(w.effort);
        expect(w.structure ?? '').not.toMatch(/stride/i);
      }
    }
  });

  it('runs TR then INT (8 × 600 m, McMillan "Buildup B") in week 9 (peak), reps at current-fitness pace, 300 m jog recovery (cycle-2)', () => {
    // docs/reference/coaching/example-plan-5k-pro.md, Week 9: "Day 3 — TR · 9 km ..."; "Day 5 —
    // INT · ≈11 km (WU 2 + 4.8 km quality + 2.1 km recovery jog + CD 2 ≈ 10.9, rounded to 11)
    // ... 8 × 600 m @ current-fitness interval pace (262-270 s/km) ... w/ 300 m jog". The
    // recovery jog is 300 m, not the cycle-1 200 m — inside `workout-library.md`'s 40-67%
    // recovery menu for 600 m reps (200 m would belong to a 400 m rep, not a 600 m one), which
    // is also why this day's total moved from 10 km to 11 km.
    const week9 = plan.weeks[8];
    const day3 = week9.days[2] as Workout;
    const day5 = week9.days[4] as Workout;
    expect(day3.effort).toBe('tempo');
    expect(day3.label).toBe('TR');
    expect(day5.effort).toBe('interval');
    expect(day5.label).toBe('INT');
    expect(day5.hrZone).toBe(4);
    expect(day5.distanceKm).toBe(11);
    expect(day5.structure ?? '').toMatch(/8\s*×\s*600\s*m/);
    expect(day5.structure ?? '').toMatch(/300\s*m\s*jog/);
    expect(day5.structure ?? '').not.toMatch(/200\s*m\s*jog/);
    expect(day5.pace).toEqual({ lowSecPerKm: 262, highSecPerKm: 270 });
  });

  it('runs TR then INT (5 × 1000 m, McMillan "Best 5K Workout") in week 10 (peak), reps at current-fitness pace', () => {
    // Doc, Week 10: "Day 3 — TR · 10 km ..."; "Day 5 — INT · ... 5 × 1000 m @ current-fitness
    // interval pace (262-270 s/km) ... w/ 400 m jog".
    const week10 = plan.weeks[9];
    const day3 = week10.days[2] as Workout;
    const day5 = week10.days[4] as Workout;
    expect(day3.effort).toBe('tempo');
    expect(day3.label).toBe('TR');
    expect(day5.effort).toBe('interval');
    expect(day5.label).toBe('INT');
    expect(day5.structure ?? '').toMatch(/5\s*×\s*1000\s*m/);
    expect(day5.structure ?? '').toContain('w/');
    expect(day5.pace).toEqual({ lowSecPerKm: 262, highSecPerKm: 270 });
  });

  it("places week-11 race-pace reps (3 × 1600 m) at goal pace, 240 s/km flat (ruling 3 — supersedes the 2026-07-10 Addendum A3's recent-equivalent 270 s/km, see header)", () => {
    // Doc, Week 11: "Day 3 — RP · ... 3 × 1600 m @ GP 4:00/km w/ ~400 m jog ...". 4:00/km = 240
    // s/km. "The first session prescribed at goal pace, not current-fitness pace — ruling 3's
    // convergence point."
    const week11 = plan.weeks[10];
    const raceSpecificDay = week11.days[2] as Workout;
    expect(raceSpecificDay.kind).toBe('run');
    expect(raceSpecificDay.label).toBe('RP');
    expect(raceSpecificDay.effort).toBe('interval');
    expect(raceSpecificDay.pace).toEqual({ lowSecPerKm: 240, highSecPerKm: 240 });
    expect(raceSpecificDay.structure ?? '').toMatch(/3\s*×\s*1600\s*m/);
    expect(raceSpecificDay.structure ?? '').toContain('w/');
  });

  it('lays out race week (12) as run, rest, run, rest, run, rest, race-day-run, with no long run', () => {
    const week12 = plan.weeks[11];
    expect(week12.days.map((d) => d.kind)).toEqual([
      'run', 'rest', 'run', 'rest', 'run', 'rest', 'run',
    ]);
    expect(findLongRun(week12)).toBeUndefined();
  });

  it('runs the 5K race itself on day 7 of the final week, prescribed by the Zone 4 pace-feel mapping', () => {
    const raceDay = plan.weeks[11].days[6] as Workout;
    expect(raceDay.kind).toBe('run');
    expect(raceDay.effort).toBe('interval');
    // notation.md: "Race Day stays unabbreviated ... it is the event itself, not a run type."
    expect(raceDay.label).toBe('Race Day');
  });

  it('never emits `why` on any week or workout, and never emits `coachIntro` (a template has none)', () => {
    expect(plan.coachIntro).toBeUndefined();
    for (const week of plan.weeks) {
      expect(week.why).toBeUndefined();
      for (const day of week.days.filter(isWorkout)) {
        expect(day.why).toBeUndefined();
      }
    }
  });

  it('carries a non-empty disclaimers list (Rule 10, legally required)', () => {
    expect(plan.disclaimers.length).toBeGreaterThan(0);
  });

  it('sums each week\'s session distances to exactly that week\'s volumeKm', () => {
    for (const week of plan.weeks) {
      const total = week.days
        .filter(isWorkout)
        .reduce((sum, d) => sum + (d.distanceKm ?? 0), 0);
      expect(total).toBe(week.volumeKm);
    }
  });

  it('keeps every non-long-run session under the long run and under the level\'s absolute cap', () => {
    for (const week of plan.weeks.slice(0, 11)) {
      // Weeks 1-11 all have a designated long run to compare against; race week (12) does not.
      const longRun = findLongRun(week);
      const others = week.days.filter(isWorkout).filter((d) => !d.isLongRun);
      for (const day of others) {
        expect(day.distanceKm ?? 0).toBeLessThan(longRun?.distanceKm ?? Infinity);
        expect(day.distanceKm ?? 0).toBeLessThanOrEqual(INTERMEDIATE_MAX_SINGLE_RUN_KM);
      }
    }
  });

  // ---------------------------------------------------------------------------------------
  // Ian's 2026-07-11 rulings — session sizing, rep prescription, and pace anchoring must be
  // keyed to race distance and phase, never to weekly volume. These pin the engine to the
  // rebuilt spec so it cannot be built to the old (3/10) one. Mirrors the invariants asserted
  // directly against the hand-built fixture in `examplePlan.fixture.test.ts`.
  // ---------------------------------------------------------------------------------------

  /** Mirrors `examplePlan.fixture.test.ts`'s parser: total quality km = reps × per-rep distance.
   * Only the rep segment of a structure string uses '×' (notation.md's grammar), so this never
   * mismatches a "WU 2 km" / "CD 2 km" segment. */
  function parseQualityVolumeKm(structure: string): number {
    const match = structure.match(/(\d+)\s*×\s*(\d+)\s*(km|m)\b/);
    if (!match) {
      throw new Error(`No rep prescription (N × M m/km) found in structure: "${structure}"`);
    }
    const [, repsStr, distStr, unit] = match;
    const reps = Number(repsStr);
    const perRepKm = unit === 'km' ? Number(distStr) : Number(distStr) / 1000;
    return reps * perRepKm;
  }

  function allWorkouts(): Workout[] {
    return plan.weeks.flatMap((w) => w.days.filter(isWorkout));
  }

  it('caps every TR workout at 10 km total and every INT/RP workout at 11 km total (session sizing keyed to race distance, not weekly volume)', () => {
    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    expect(tempoWorkouts.length).toBeGreaterThan(0);
    expect(qualityWorkouts.length).toBeGreaterThan(0);
    for (const tr of tempoWorkouts) {
      expect(tr.distanceKm).toBeLessThanOrEqual(10);
    }
    for (const w of qualityWorkouts) {
      expect(w.distanceKm).toBeLessThanOrEqual(11);
    }
  });

  it('keeps every INT/RP rep prescription\'s quality volume (N × rep length) between 4.0 and 5.0 km', () => {
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    expect(qualityWorkouts.length).toBeGreaterThan(0);
    for (const w of qualityWorkouts) {
      const qualityKm = parseQualityVolumeKm(w.structure ?? '');
      expect(qualityKm).toBeGreaterThanOrEqual(4.0);
      expect(qualityKm).toBeLessThanOrEqual(5.0);
    }
  });

  it('gives every INT/RP structure a rep pattern (N × M m or N × M km), a pace signal (@), and a recovery signal (w/); every TR structure itemizes WU and CD', () => {
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    expect(qualityWorkouts.length).toBeGreaterThan(0);
    expect(tempoWorkouts.length).toBeGreaterThan(0);
    for (const w of qualityWorkouts) {
      const structure = w.structure ?? '';
      expect(structure).toMatch(/\d+\s*×\s*\d+\s*(km|m)\b/);
      expect(structure).toContain('@');
      expect(structure).toContain('w/');
    }
    for (const w of tempoWorkouts) {
      const structure = w.structure ?? '';
      expect(structure).toContain('WU');
      expect(structure).toContain('CD');
    }
  });

  it('never grows TR distance with weekly volume — fixed values matching the doc\'s per-week TR figures', () => {
    // Doc, weeks with a TR session in order (1, 2, 3, 5, 6, 7, 9, 10): 8, 8, 8, 8, 9, 9, 9, 10 km.
    const expectedTrKm = [8, 8, 8, 8, 9, 9, 9, 10];
    const actualTrKm = allWorkouts()
      .filter((w) => w.label === 'TR')
      .map((w) => w.distanceKm);
    expect(actualTrKm).toEqual(expectedTrKm);
  });

  it('anchors every TR at the tempo band, every easy-effort workout at the easy band, weeks 9-10 INT at the current-fitness band, and week-11 RP at goal pace', () => {
    const TEMPO_PACE = { lowSecPerKm: 281, highSecPerKm: 294 };
    const EASY_PACE = { lowSecPerKm: 326, highSecPerKm: 354 };
    const CURRENT_INTERVAL_PACE = { lowSecPerKm: 262, highSecPerKm: 270 };
    const GOAL_PACE = { lowSecPerKm: 240, highSecPerKm: 240 };

    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    const easyWorkouts = allWorkouts().filter((w) => w.effort === 'easy');
    expect(tempoWorkouts.length).toBeGreaterThan(0);
    expect(easyWorkouts.length).toBeGreaterThan(0);
    for (const w of tempoWorkouts) {
      expect(w.pace).toEqual(TEMPO_PACE);
    }
    for (const w of easyWorkouts) {
      expect(w.pace).toEqual(EASY_PACE);
    }
    for (const weekIndex of [8, 9]) {
      const int = plan.weeks[weekIndex].days.filter(isWorkout).find((w) => w.label === 'INT');
      expect(int?.pace).toEqual(CURRENT_INTERVAL_PACE);
    }
    const rp = plan.weeks[10].days.filter(isWorkout).find((w) => w.label === 'RP');
    expect(rp?.pace).toEqual(GOAL_PACE);
  });

  // ---------------------------------------------------------------------------------------
  // Cycle-2 addition (2026-07-11) — strides extend to one easy day per loading week.
  // Research-sourced, flagged in the doc for Ian's sign-off (Open item 7), but already load-
  // bearing in the golden plan the engine must reproduce. Mirrors the invariants asserted
  // directly against the hand-built fixture in `examplePlan.fixture.test.ts`.
  // ---------------------------------------------------------------------------------------

  it('places the loading-week strides day exactly where the doc specifies', () => {
    // Doc § "Session sizing": weeks 1, 2, 3, 5, 6, 7 carry strides on "the second ER day"
    // (Day 3, index 2, e.g. "Week 2 ... ER 8 / ER + Strides 8 / TR 8 / LR 11"); weeks 9 and 10
    // carry them on Day 1 (index 0), that week's only easy day ("Week 9 ... Day 1 — ER +
    // Strides"); week 11 carries them on Day 5 (index 4, "Day 5 — ER + Strides · 9 km + 4 × 30
    // s Strides @ GP"), since it's already the race-specific phase.
    for (const weekIndex of [0, 1, 2, 4, 5, 6]) {
      const day3 = plan.weeks[weekIndex].days[2] as Workout;
      expect(day3.label).toBe('ER + Strides');
    }
    for (const weekIndex of [8, 9]) {
      const day1 = plan.weeks[weekIndex].days[0] as Workout;
      expect(day1.label).toBe('ER + Strides');
    }
    const week11Day5 = plan.weeks[10].days[4] as Workout;
    expect(week11Day5.label).toBe('ER + Strides');
  });

  it('gives every loading week exactly one ER + Strides day, and keeps deload weeks (4, 8) strides-free', () => {
    // "This revision extends the existing `4 × 30 s Strides` prescription to one easy day in
    // every other loading week (weeks 3, 5, 6, 7, 9, 10, 11)" plus weeks 1-2, which already
    // carried it — every loading week: 1, 2, 3, 5, 6, 7, 9, 10, 11. "Deload weeks 4 and 8 stay
    // strides-free."
    const loadingWeeks = [1, 2, 3, 5, 6, 7, 9, 10, 11];
    for (const weekNumber of loadingWeeks) {
      const stridesDays = plan.weeks[weekNumber - 1].days
        .filter(isWorkout)
        .filter((d) => d.label === 'ER + Strides');
      expect(stridesDays).toHaveLength(1);
    }
    for (const weekNumber of [4, 8]) {
      const stridesDays = plan.weeks[weekNumber - 1].days
        .filter(isWorkout)
        .filter((d) => d.label === 'ER + Strides');
      expect(stridesDays).toHaveLength(0);
    }
  });
});
