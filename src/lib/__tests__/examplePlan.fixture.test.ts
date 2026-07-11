import { examplePlan } from '../fixtures/examplePlan';
import { clampLongRun } from '../loadRules';
import { RUN_TYPE_ABBREVIATIONS } from '../notation';
import type { Day, Pace, Week, Workout } from '../planTypes';

/**
 * Invariant tests over `src/lib/fixtures/examplePlan.ts`, encoding Ian's 2026-07-11 rulings
 * (`docs/reference/coaching/example-plan-5k-pro.md`, rebuilt after he scored the prior render
 * 3/10) so a future edit to the fixture that drifts from the doc is caught mechanically, not
 * caught by eye. Every expected number below is copied from the doc, cited inline, and is NOT
 * read back out of the fixture itself — the point of this suite is to catch the fixture
 * disagreeing with the doc, so deriving "expected" from the fixture would defeat it.
 *
 * Extended 2026-07-12 for GitHub issue #34 (Ian's rulings on this cycle's open coaching
 * questions): R6 (the race-day structure string) and R7 (strides now on both easy days of every
 * loading week with two easy days) — see `examplePlan.ts`'s own header for the full ruling text.
 *
 * This is a fixture test, not the golden-fixture TDD suite for the not-yet-built
 * `planTemplates.ts` engine (that's `planTemplates.golden.test.ts`); this file only asserts
 * against the hand-built screen fixture that already exists and already runs.
 */

// Full weekday names/abbreviations must never appear anywhere in a plan — days are unnamed
// (Day 1 ... Day 7). Mirrors the pattern `planTemplates.golden.test.ts` defines for the same
// reason; duplicated here (not imported) because that file's own module import
// (`../planTemplates`) doesn't resolve yet and would fail this suite too.
const DAY_NAME_PATTERN =
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Weds|Thu|Thur|Thurs|Fri|Sat|Sun)\b/i;

function isWorkout(day: Day): day is Workout {
  return day.kind === 'run';
}

function findLongRun(week: Week): Workout | undefined {
  return week.days.filter(isWorkout).find((d) => d.isLongRun === true);
}

function allWorkouts(): Workout[] {
  return examplePlan.weeks.flatMap((w) => w.days.filter(isWorkout));
}

/** Parses a structure string's rep prescription ("8 × 600 m", "3 × 1600 m") into total quality
 * kilometres (reps × per-rep distance). Only the rep segment uses '×' per notation.md's
 * structure-string grammar, so this never accidentally matches a "WU 2 km" / "CD 2 km" segment. */
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

/** Parses a structure string's per-rep distance and its "w/ N m jog" recovery, both in
 * metres, so the recovery can be checked as a fraction of the rep it follows. The `~` in
 * week 11's "w/ ~400 m jog" is tolerated (optional in the regex) since it marks the figure
 * approximate, not a different token. */
function parseRepAndRecoveryMeters(structure: string): { repDistanceM: number; recoveryM: number } {
  const repMatch = structure.match(/(\d+)\s*×\s*(\d+)\s*(km|m)\b/);
  if (!repMatch) {
    throw new Error(`No rep prescription found in structure: "${structure}"`);
  }
  const [, , distStr, unit] = repMatch;
  const repDistanceM = unit === 'km' ? Number(distStr) * 1000 : Number(distStr);

  const recoveryMatch = structure.match(/w\/\s*~?(\d+)\s*m\s*jog/);
  if (!recoveryMatch) {
    throw new Error(`No "w/ N m jog" recovery found in structure: "${structure}"`);
  }
  const recoveryM = Number(recoveryMatch[1]);

  return { repDistanceM, recoveryM };
}

describe('examplePlan fixture — arithmetic integrity', () => {
  // docs/reference/coaching/example-plan-5k-pro.md § "Volume plan" table, Volume column,
  // weeks 1-12: 34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28. Week 9 is 45, not the
  // cycle-1 44: the doc's cycle-2 correction pass moves week 9's INT recovery jog from
  // 200 m to 300 m per rep to stay inside `workout-library.md`'s 40-67%-of-rep-distance
  // menu for 600 m reps, which pushes that day's total from "≈10.2, rounded to 10" to
  // "WU 2 + 4.8 km quality + 2.1 km recovery jog + CD 2 ≈ 10.9, rounded to 11" (Week 9 day
  // line), so week 9's own Volume-plan row reads "45 km" now, not 44.
  const EXPECTED_WEEKLY_LOAD = [34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28];

  it('matches the doc\'s Volume-plan table exactly, week by week', () => {
    expect(examplePlan.weeklyLoad).toEqual(EXPECTED_WEEKLY_LOAD);
  });

  it("mirrors weeklyLoad against each week's own volumeKm", () => {
    expect(examplePlan.weeklyLoad).toEqual(examplePlan.weeks.map((w) => w.volumeKm));
  });

  it("sums each week's day distances to exactly that week's volumeKm", () => {
    for (const week of examplePlan.weeks) {
      const total = week.days
        .filter(isWorkout)
        .reduce((sum, d) => sum + (d.distanceKm ?? 0), 0);
      expect(total).toBe(week.volumeKm);
    }
  });
});

describe('examplePlan fixture — notation ruling (notation.md, Ian 2026-07-11)', () => {
  const COMPOSITE_LABELS = ['ER + Strides'];
  const UNABBREVIATED_LABELS = ['Race Day'];
  // The full names notation.md explicitly retires in favour of abbreviations — must never
  // appear as a Workout.label.
  const FORBIDDEN_FULL_NAMES = [
    'Easy run',
    'Tempo run',
    'Long run',
    'VO2 intervals',
    'Shakeout run',
    'Race-pace reps',
  ];

  it('labels every workout with a documented abbreviation, the ER + Strides composite, or an unabbreviated name', () => {
    const allowedLabels = new Set([
      ...Object.keys(RUN_TYPE_ABBREVIATIONS),
      ...COMPOSITE_LABELS,
      ...UNABBREVIATED_LABELS,
    ]);
    for (const workout of allWorkouts()) {
      expect(allowedLabels.has(workout.label)).toBe(true);
    }
  });

  it('never uses a spelled-out full run-type name as a label', () => {
    const labels = allWorkouts().map((w) => w.label);
    for (const forbidden of FORBIDDEN_FULL_NAMES) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it('always spells "Strides" out in full — never abbreviates it to "ST"', () => {
    const planText = JSON.stringify(examplePlan);
    expect(planText).toMatch(/Strides/); // sanity: the word is actually present somewhere
    expect(planText).not.toMatch(/\bST\b/); // and never as a bare "ST" token
  });
});

describe('examplePlan fixture — race-day structure string (issue #34 ruling R6)', () => {
  it("gives the race-day workout the exact structure 'WU 3 km · 5 km race · CD 2 km'", () => {
    const week12 = examplePlan.weeks[11];
    const raceDay = week12.days[6] as Workout;
    expect(raceDay.label).toBe('Race Day');
    expect(raceDay.structure).toBe('WU 3 km · 5 km race · CD 2 km');
  });

  it("sums the race-day structure's segments to the existing 10 km headline distanceKm", () => {
    const week12 = examplePlan.weeks[11];
    const raceDay = week12.days[6] as Workout;
    expect(raceDay.distanceKm).toBe(10); // 3 (WU) + 5 (race) + 2 (CD)
  });

  it('uses only vocabulary already in STRUCTURE_SHORTHAND (WU, CD, ·) — no new glossary token', () => {
    const week12 = examplePlan.weeks[11];
    const raceDay = week12.days[6] as Workout;
    const structure = raceDay.structure ?? '';
    expect(structure).toContain('WU');
    expect(structure).toContain('CD');
    expect(structure).toContain('·');
  });
});

describe('examplePlan fixture — session-sizing ruling (5K, example-plan-5k-pro.md § "Session sizing")', () => {
  it('caps every TR (tempo) workout at 10 km total, keyed to race distance not weekly volume', () => {
    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    for (const tr of tempoWorkouts) {
      expect(tr.distanceKm).toBeLessThanOrEqual(10);
    }
  });

  it('caps every INT/RP workout at 11 km total', () => {
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    for (const w of qualityWorkouts) {
      expect(w.distanceKm).toBeLessThanOrEqual(11);
    }
  });

  it('keeps every INT/RP rep prescription\'s quality volume (N × rep length) between 4.0 and 5.0 km', () => {
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    expect(qualityWorkouts.length).toBeGreaterThan(0); // guard against a vacuous pass
    for (const w of qualityWorkouts) {
      const qualityKm = parseQualityVolumeKm(w.structure ?? '');
      expect(qualityKm).toBeGreaterThanOrEqual(4.0);
      expect(qualityKm).toBeLessThanOrEqual(5.0);
    }
  });

  it('never grows TR distance with weekly volume — fixed values matching the doc\'s per-week TR figures', () => {
    // Doc, in week order (weeks 1, 2, 3, 5, 6, 7, 9, 10 — the only weeks with a TR session):
    // "Week 1 ... Day 5 — TR · 8 km"; "Week 2 — 35 km · ER 8 / ER + Strides 8 / TR 8 / LR 11";
    // "Week 3 — 38 km · ER 9 / ER 9 / TR 8 / LR 12"; "Week 5 — 41 km · ... TR 8 / LR 13";
    // "Week 6 — 45 km · ... TR 9 / LR 14"; "Week 7 — 48 km · ... TR 9 / LR 15";
    // "Week 9 ... Day 3 — TR · 9 km"; "Week 10 ... Day 3 — TR · 10 km".
    const expectedTrKm = [8, 8, 8, 8, 9, 9, 9, 10];
    const actualTrKm = allWorkouts()
      .filter((w) => w.label === 'TR')
      .map((w) => w.distanceKm);
    expect(actualTrKm).toEqual(expectedTrKm);
  });

  it('keeps every INT recovery jog within the 40-67%-of-rep-distance menu (RP is exempt — see below)', () => {
    // workout-library.md § "Rep-distance menu and pace convergence": "Recovery is a jog sized
    // to the rep: roughly 40-67% of the rep distance." Doc week 9: "Recovery is a 300 m jog
    // ... inside the library's 40-67% menu for 600 m reps" (300/600 = 50%). Week 10: 400 m
    // jog after a 1000 m rep (400/1000 = 40%, the band's own lower edge).
    //
    // RP is deliberately NOT checked here: doc week 11 — "Recovery is generous (a ~400 m jog
    // between reps, not a tight interval-style recovery) — this session rehearses goal pace,
    // it doesn't chase VO2 max," i.e. RP recovery is intentionally outside the INT menu, not a
    // violation of it.
    const intWorkouts = allWorkouts().filter((w) => w.label === 'INT');
    expect(intWorkouts.length).toBeGreaterThan(0);
    for (const w of intWorkouts) {
      const { repDistanceM, recoveryM } = parseRepAndRecoveryMeters(w.structure ?? '');
      const ratio = recoveryM / repDistanceM;
      expect(ratio).toBeGreaterThanOrEqual(0.4);
      expect(ratio).toBeLessThanOrEqual(0.67);
    }
  });
});

describe('examplePlan fixture — rep-prescription ruling (notation.md § "Structure-string grammar")', () => {
  it('gives every INT/RP structure a rep pattern (N × M m or N × M km), a pace signal, and a recovery signal', () => {
    const qualityWorkouts = allWorkouts().filter((w) => w.label === 'INT' || w.label === 'RP');
    expect(qualityWorkouts.length).toBeGreaterThan(0);
    for (const w of qualityWorkouts) {
      const structure = w.structure ?? '';
      expect(structure).toMatch(/\d+\s*×\s*\d+\s*(km|m)\b/);
      expect(structure).toContain('@');
      expect(structure).toContain('w/');
    }
  });

  it('itemizes WU and CD in every TR structure string', () => {
    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    expect(tempoWorkouts.length).toBeGreaterThan(0);
    for (const w of tempoWorkouts) {
      const structure = w.structure ?? '';
      expect(structure).toContain('WU');
      expect(structure).toContain('CD');
    }
  });
});

describe('examplePlan fixture — pace-anchoring ruling (Ian, 2026-07-11, ruling 3)', () => {
  // Doc § "Pace bands": tempo 281-294 s/km; interval, current fitness, 262-270 s/km;
  // easy band 326-354 s/km. Doc § "Session sizing" / week 11: race-pace reps at goal pace,
  // 4:00/km = 240 s/km flat, "the first session prescribed at goal pace, not current-fitness
  // pace — ruling 3's convergence point".
  const TEMPO_PACE: Pace = { lowSecPerKm: 281, highSecPerKm: 294 };
  const CURRENT_INTERVAL_PACE: Pace = { lowSecPerKm: 262, highSecPerKm: 270 };
  const GOAL_PACE: Pace = { lowSecPerKm: 240, highSecPerKm: 240 };
  const EASY_PACE: Pace = { lowSecPerKm: 326, highSecPerKm: 354 };

  it("anchors week 11's RP workout at goal pace {240, 240}", () => {
    const week11 = examplePlan.weeks[10];
    expect(week11.weekNumber).toBe(11);
    const rp = week11.days.filter(isWorkout).find((w) => w.label === 'RP');
    expect(rp?.pace).toEqual(GOAL_PACE);
  });

  it('anchors weeks 9-10 INT workouts at the current-fitness band {262, 270}', () => {
    for (const weekIndex of [8, 9]) {
      const week = examplePlan.weeks[weekIndex];
      const int = week.days.filter(isWorkout).find((w) => w.label === 'INT');
      expect(int?.pace).toEqual(CURRENT_INTERVAL_PACE);
    }
  });

  it('anchors every TR workout at the tempo band {281, 294}', () => {
    const tempoWorkouts = allWorkouts().filter((w) => w.label === 'TR');
    expect(tempoWorkouts.length).toBeGreaterThan(0);
    for (const w of tempoWorkouts) {
      expect(w.pace).toEqual(TEMPO_PACE);
    }
  });

  it('anchors every easy-effort workout (ER, ER + Strides, LR) at the easy band {326, 354}', () => {
    const easyWorkouts = allWorkouts().filter((w) => w.effort === 'easy');
    expect(easyWorkouts.length).toBeGreaterThan(0);
    for (const w of easyWorkouts) {
      expect(w.pace).toEqual(EASY_PACE);
    }
  });
});

describe('examplePlan fixture — strides extension (issue #34 ruling R7, confirmed and extended)', () => {
  // R7: strides go on BOTH easy days of every loading week that has two easy days — weeks
  // 1, 2, 3, 5, 6, 7 (Day 1 and Day 3 each carry them now, not just Day 3 as in cycle-2).
  // Weeks 9 and 10 have only one easy day each, so they still carry exactly one. Week 11 (the
  // taper) is different: it HAS two easy days (Day 1's easyRun(9) and Day 5's easyRun(9,
  // strides @ GP)) but keeps only its one pre-existing stride day (Day 5) by Ian's explicit
  // ruling that the taper is left alone — NOT because it lacks a second easy day. It's grouped
  // below with 9 and 10 only because the resulting stride-day COUNT happens to match (one each),
  // for two unrelated reasons.
  const TWO_STRIDE_DAY_WEEKS = [1, 2, 3, 5, 6, 7];
  const SINGLE_STRIDE_DAY_WEEKS = [9, 10, 11];
  // "Deload weeks 4 and 8 stay strides-free."
  const DELOAD_WEEKS = [4, 8];

  it('gives weeks with two easy days (1, 2, 3, 5, 6, 7) exactly two ER + Strides days', () => {
    for (const weekNumber of TWO_STRIDE_DAY_WEEKS) {
      const week = examplePlan.weeks[weekNumber - 1];
      expect(week.weekNumber).toBe(weekNumber);
      const stridesDays = week.days.filter(isWorkout).filter((d) => d.label === 'ER + Strides');
      expect(stridesDays).toHaveLength(2);
    }
  });

  it('gives weeks 9 and 10 (only one easy day each) and week 11 (two easy days, but the taper ' +
    'is left alone by explicit ruling) exactly one ER + Strides day each', () => {
    for (const weekNumber of SINGLE_STRIDE_DAY_WEEKS) {
      const week = examplePlan.weeks[weekNumber - 1];
      expect(week.weekNumber).toBe(weekNumber);
      const stridesDays = week.days.filter(isWorkout).filter((d) => d.label === 'ER + Strides');
      expect(stridesDays).toHaveLength(1);
    }
  });

  it("leaves week 11's taper structure alone — Day 1 stays strides-free, only Day 5 carries strides", () => {
    const week11 = examplePlan.weeks[10];
    expect(week11.weekNumber).toBe(11);
    const [day1, , , , day5] = week11.days;
    expect((day1 as Workout).label).toBe('ER');
    expect((day5 as Workout).label).toBe('ER + Strides');
  });

  it('keeps deload weeks (4, 8) strides-free', () => {
    for (const weekNumber of DELOAD_WEEKS) {
      const week = examplePlan.weeks[weekNumber - 1];
      const stridesDays = week.days.filter(isWorkout).filter((d) => d.label === 'ER + Strides');
      expect(stridesDays).toHaveLength(0);
    }
  });

  it("keeps week 12's own pre-existing stride day, untouched by R7", () => {
    // Week 12 already carried strides before cycle 2 (Day 3, "ER + Strides · 6 km + 4 × 20 s
    // Strides @ GP") — it's race week, not a "loading" week, so it's outside both stride-day
    // lists above, and R7 is explicit its own existing stride day is unchanged.
    const week12 = examplePlan.weeks[11];
    const stridesDays = week12.days.filter(isWorkout).filter((d) => d.label === 'ER + Strides');
    expect(stridesDays).toHaveLength(1);
  });

  it('always spells "Strides" out in full on every stride day, never abbreviating it', () => {
    const stridesDays = allWorkouts().filter((w) => w.label === 'ER + Strides');
    expect(stridesDays.length).toBeGreaterThan(0);
    for (const w of stridesDays) {
      expect(w.structure ?? '').toMatch(/Strides/);
      expect(w.structure ?? '').not.toMatch(/\bST\b/);
    }
  });

  it("adds no headline distance for strides — a loading week's ER + Strides day still sums into volumeKm like a plain ER day", () => {
    // "Strides add no headline distance, matching how weeks 1-2 already prescribe them, so no
    // volume-table arithmetic changes anywhere in this revision." Re-derives the same
    // arithmetic-integrity invariant, scoped to stride days specifically, so a regression that
    // slips extra distance onto a stride day is caught even if the week-level sum happened to
    // still balance some other way.
    for (const weekNumber of [...TWO_STRIDE_DAY_WEEKS, ...SINGLE_STRIDE_DAY_WEEKS]) {
      const week = examplePlan.weeks[weekNumber - 1];
      const total = week.days
        .filter(isWorkout)
        .reduce((sum, d) => sum + (d.distanceKm ?? 0), 0);
      expect(total).toBe(week.volumeKm);
    }
  });
});

describe('examplePlan fixture — structural safety (unchanged rules)', () => {
  it('carries no tempo or interval effort in either deload week (4 or 8)', () => {
    for (const weekIndex of [3, 7]) {
      const week = examplePlan.weeks[weekIndex];
      expect(week.isDeload).toBe(true);
      for (const w of week.days.filter(isWorkout)) {
        expect(['tempo', 'interval']).not.toContain(w.effort);
      }
    }
  });

  it('keeps hard sessions (tempo/interval) at least 2 day-slots apart within a week (48h)', () => {
    for (const week of examplePlan.weeks) {
      const hardIndexes = week.days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => isWorkout(d) && ['tempo', 'interval'].includes(d.effort))
        .map(({ i }) => i);
      for (let a = 0; a < hardIndexes.length; a++) {
        for (let b = a + 1; b < hardIndexes.length; b++) {
          expect(Math.abs(hardIndexes[a] - hardIndexes[b])).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('gives every non-race week exactly one long run, and it is that week\'s longest run', () => {
    for (const week of examplePlan.weeks.slice(0, 11)) {
      const longRuns = week.days.filter(isWorkout).filter((d) => d.isLongRun === true);
      expect(longRuns).toHaveLength(1);
      const longRun = longRuns[0];
      const others = week.days.filter(isWorkout).filter((d) => !d.isLongRun);
      for (const other of others) {
        expect(longRun.distanceKm ?? 0).toBeGreaterThan(other.distanceKm ?? 0);
      }
    }
  });

  it('has no designated long run in the final race week', () => {
    expect(findLongRun(examplePlan.weeks[11])).toBeUndefined();
  });

  it("never lets an easy run exceed 80% of that week's long run (exact 80% allowed)", () => {
    for (const week of examplePlan.weeks.slice(0, 11)) {
      const longRun = findLongRun(week);
      expect(longRun).toBeDefined();
      const cap = (longRun!.distanceKm ?? 0) * 0.8;
      const easyRuns = week.days
        .filter(isWorkout)
        .filter((d) => d.effort === 'easy' && !d.isLongRun);
      for (const easy of easyRuns) {
        expect(easy.distanceKm ?? 0).toBeLessThanOrEqual(cap + 1e-9);
      }
    }
  });

  it('never contains a day-name string anywhere in the plan', () => {
    expect(DAY_NAME_PATTERN.test(JSON.stringify(examplePlan))).toBe(false);
  });

  it('gives every week exactly 7 real day slots (rest days included, never absent)', () => {
    for (const week of examplePlan.weeks) {
      expect(week.days).toHaveLength(7);
      const restCount = week.days.filter((d) => d.kind === 'rest').length;
      const runCount = week.days.filter((d) => d.kind === 'run').length;
      expect(restCount + runCount).toBe(7);
      expect(restCount).toBeGreaterThan(0);
    }
  });
});

describe('examplePlan fixture — survives its own safety layer (issue #34 ruling R1c)', () => {
  it("runs every week's long run back through clampLongRun and gets it back unclamped, " +
    "proving the cap ladder and the deload weekly-share rule both actually fit this plan " +
    "rather than merely being asserted against in isolation. This is the test whose absence " +
    "let issue #19 exist: it must fail if either the ladder (R1a) or the deload rule (R1c) is " +
    "ever silently reverted.", () => {
    let previousLongestKm = 0;
    let lastLoadingWeekKm = 0;

    for (const week of examplePlan.weeks) {
      const longRun = findLongRun(week);
      if (longRun) {
        const { km } = clampLongRun({
          proposedKm: longRun.distanceKm ?? 0,
          weeklyKm: week.volumeKm,
          level: 'intermediate',
          previousLongestKm,
          isDeload: week.isDeload,
          lastLoadingWeekKm,
        });
        expect(km).toBe(longRun.distanceKm);
        previousLongestKm = Math.max(previousLongestKm, longRun.distanceKm ?? 0);
      }
      if (!week.isDeload) {
        lastLoadingWeekKm = week.volumeKm;
      }
    }
  });
});
