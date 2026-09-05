/**
 * Local fixture — a hand-built 12-week 5K plan at Pro-tier density, modeled on
 * `docs/reference/coaching/example-plan-5k-pro.md`. `src/app/plan/[id].tsx` renders this,
 * un-fetched, whenever the route id equals `EXAMPLE_PLAN_ID` below — the captain's explicit
 * "never remove the sample plan" call, kept permanently reachable from the pinned row atop
 * `src/app/(tabs)/my-plans.tsx` now that real, backend-fetched plans render alongside it. It
 * exists to prove the plan-view screen against a real, source-derived plan shape — it is a
 * screen fixture, not the golden fixture `planTemplates.ts`'s own tests work from (that agent
 * works from the coaching docs directly).
 *
 * REBUILT 2026-07-11 against the source doc's 2026-07-11 revision. Ian scored the previously
 * rendered plan 3/10 and issued five rulings: quality-session size is keyed to race distance,
 * not weekly volume; interval/race-pace reps are prescribed as distance × count, never a bare
 * distance or time; race-pace-rep anchoring converges from current-fitness pace to goal pace;
 * run-type labels are abbreviated (`docs/reference/coaching/notation.md`); HR zones and the
 * volume-adherence discipline were praised and are unchanged. Every number below traces to the
 * rebuilt doc's own worked arithmetic — the volume table, the week-by-week day lines (given in
 * full for weeks 1, 4, 9, 10, 11, 12; derived for weeks 2, 3, 5, 6, 7, 8 from the doc's one-line
 * per-week notes plus the Day 1/3/5/6 pattern the doc establishes explicitly, and the tempo
 * duration rule its Week 1, Week 6, and Week 7 "why" text states outright) — nothing here is
 * invented.
 *
 * Two corrections layered onto the 2026-07-10 build of this file no longer apply, superseded by
 * the 2026-07-11 rebuild:
 *
 *   1. SUPERSEDED by Ian's 2026-07-11 ruling 3. The 2026-07-10 file pinned week 11's race-pace
 *      reps flat at this runner's current pace, 270 s/km ("intervals anchor to goal pace, maybe
 *      a bit slower" was the source doc's own unresolved Open item #3 at the time). Ruling 3
 *      settles it the other way: `"your goal is to run at your goal pace, might be slower in
 *      the beginning."` Early-plan interval sessions (weeks 9–10) stay at current-fitness pace
 *      (262–270 s/km) — covering the overtraining concern the 2026-07-10 file was guarding
 *      against — but week 11's race-pace-rep session, now sitting in the race-specific phase,
 *      converges to goal pace directly: 240 s/km (4:00/km). See the source doc's "Session
 *      sizing" section and Open item 3 for the full reasoning.
 *   2. MOOT. The 2026-07-10 file trimmed the week 4 and week 8 deload long runs to 7 km and
 *      9 km (from the source doc's 8 km and 10 km) to land inside the 35–45% deload band. The
 *      rebuilt doc's own volume table already lands cleanly there without any adjustment: week 4
 *      (23 km total, 8 km long run) is 39.5% off week 3 (38 km, the last loading week); week 8
 *      (30 km total, 10 km long run) is 37.5% off week 7 (48 km). This file now uses the doc's
 *      own figures unaltered.
 *
 * Labels follow `docs/reference/coaching/notation.md` (`src/lib/notation.ts` is its code
 * counterpart): `ER`, `ER + Strides`, `TR`, `INT`, `RP`, `LR`, `SR`, and unabbreviated
 * `Race Day`. Per notation.md's headline-number convention, a `Workout`'s `distanceKm` is the
 * day's TOTAL kilometres — warm-up, cool-down, and recovery jog included — so each day sums
 * cleanly into the week's volume; the `structure` field itemizes the warm-up / work / cool-down
 * / recovery breakdown so the true quality-work size is never hidden inside that total.
 *
 * Where the source doc gives only a per-week one-line note and not a full day-by-day breakdown
 * (weeks 2, 3, 5, 6, 7, 8), the days below follow the day-slot pattern the doc establishes
 * explicitly in weeks 1, 4, and 9: four running days at Day 1/3/5/6, rest at Day 2/4/7, hard
 * sessions 48+ hours apart. Tempo `structure` strings for those same weeks are derived, not
 * invented: the doc's Week 1 "why" states the 20-minute tempo session "stays exactly this size
 * for as long as this phase calls for 20 minutes of tempo work" (weeks 1–3 and 5, all TR 8 km);
 * Week 6's note states the step to 22 minutes explicitly (TR 9 km); Week 7's note states it
 * holds at ~24 minutes (also TR 9 km, arithmetic coincidence of the rounding, not a typo). The
 * per-week `why` text for weeks 2, 3, 5, 6, 7, 8 narrates only the numbers and rules the doc's
 * own one-line note for that week already states — nothing here is invented training content.
 *
 * RESYNCED 2026-07-11, cycle-2 correction pass (same-day code-review + doc fix, see the doc's
 * own "Cycle-2 correction pass" blockquote at its top). Two numeric changes and one new content
 * dimension, all traced to that pass:
 *
 *   - Week 9's `INT` recovery jog moves from 200 m to 300 m per rep — `workout-library.md`'s own
 *     recovery menu for 600 m reps is 40–67% (200–300 m would belong to a 400 m rep, not a
 *     600 m one); the plan Ian first scored used 200 m, outside that menu. The corrected
 *     structure's warm-up + quality + recovery + cool-down (2 + 4.8 + 2.1 + 2 = 10.9) now rounds
 *     to **11 km**, not 10, so week 9's `volumeKm` and `weeklyLoad[8]` move from 44 to **45**.
 *   - **Strides extend to one easy day per loading week** (cycle-2 addition, research-sourced,
 *     flagged in the doc for Ian's sign-off, not yet a ruling) — weeks 3, 5, 6, 7 (the second ER
 *     day), 9 (Day 1, this week's only easy day), 10 (Day 1, same reason), and 11 (Day 5, which
 *     also carries a `@ GP` reference like week 12's, since it's already the race-specific
 *     phase) now label that day `ER + Strides` with the doc's `4 × 30 s Strides` prescription.
 *     Weeks 1–2 and 12 already had strides and are unchanged; deload weeks 4 and 8 stay
 *     strides-free by the doc's own explicit choice (not a rule — the library permits strides
 *     during a deload for "speedster" types, but this revision keeps deloads pure as the
 *     simpler default). Strides add no headline distance, so no volume-table arithmetic changes
 *     from this dimension.
 *
 * RULED 2026-07-12, GitHub issue #34 (Ian's rulings on this cycle's open coaching questions).
 * Two confirmed rulings change this file; the rest of the ruling set is either confirmation of
 * numbers already here or has no code impact on this file:
 *
 *   - R6: `raceDayWorkout()`'s structure string becomes `'WU 3 km · 5 km race · CD 2 km'`,
 *     replacing the cycle-1 `'5 km warm-up/cool-down + 5 km race'`. Same 10 km headline total,
 *     the same `·` separator the other eleven structure strings already use, and no new
 *     `STRUCTURE_SHORTHAND` token — `WU` and `CD` already cover it.
 *   - R7: the cycle-2 strides addition above is now a confirmed ruling, and it goes further —
 *     strides go on BOTH easy days of every loading week that has two easy days, not just the
 *     second. Day 1's `easyRun()` call in weeks 1, 2, 3, 5, 6, 7 now also carries
 *     `'4 × 30 s Strides'` (previously only Day 3 did), making its label `ER + Strides` there
 *     too. Weeks 9 and 10 are unchanged — each has only one easy day (Day 1), already covered.
 *     Week 11 (taper) is unchanged by explicit ruling: Day 1 stays strides-free and only Day 5
 *     keeps `'4 × 30 s Strides @ GP'` — Ian ruled the taper is left alone. Week 12 (race week)
 *     and the deload weeks 4 and 8 are unchanged. Strides still add no headline distance, so no
 *     volume/weeklyLoad arithmetic changes anywhere.
 *   - R8 confirms week 9's 300 m recovery jog as-is (11 km INT session, `volumeKm` 45, see the
 *     cycle-2 paragraph above); R2 confirms this file's peak volume, 48 km (week 7), as-is.
 *     Neither changes anything here.
 *
 * R1 (the long-run share-cap ladder and its new deload exemption) lives in `src/lib/loadRules.ts`,
 * not this file — this fixture's long-run numbers are hand-transcribed from the coaching doc, not
 * run through `clampLongRun`, so R1 requires no data change here. R3–R5 have no code impact.
 */

import type { Day, Pace, Phase, Plan, RestDay, Week, Week7, Workout } from '@/lib/planTypes';

/**
 * Fixed route param `src/app/plan/[id].tsx` checks for to render this fixture instead of
 * fetching a real plan, and the id the pinned "Example Plan" row on
 * `src/app/(tabs)/my-plans.tsx` always links to. The captain has required this static example
 * stay permanently viewable, real backend or not.
 */
export const EXAMPLE_PLAN_ID = 'example-5k-pro';

const REST: RestDay = { kind: 'rest' };

const EASY_DESCRIPTION = 'Easy, conversational pace.';
const LONG_DESCRIPTION = 'Easy, conversational pace — your endurance-building run for the week.';
const TEMPO_DESCRIPTION = 'Comfortably hard, sustained effort — at or just below threshold.';
const INTERVAL_DESCRIPTION = 'Hard, controlled effort with full recovery between reps.';
// Updated for ruling 3: these reps anchor to goal pace, not "current" pace — see file header.
const RACE_PACE_DESCRIPTION = 'Controlled speed at your goal race pace — not an all-out effort.';
const SHAKEOUT_DESCRIPTION = 'Very light jog to keep the legs loose. Nothing here should feel like work.';
const RACE_DESCRIPTION = 'Race effort — give what the last twelve weeks built.';

/** Easy band (intermediate offset over the tempo band), 326–354 s/km ≈ 5:26–5:54/km. Source
 * doc's "Pace bands" section: "the app itself carries this band on every easy-run `Workout`." */
const EASY_PACE: Pace = { lowSecPerKm: 326, highSecPerKm: 354 };
/** Tempo band, 281–294 s/km ≈ 4:41–4:54/km. Fixed regardless of week — session *size* grows
 * with the phase, pace never does (ruling 1, "Session sizing"). */
const TEMPO_PACE: Pace = { lowSecPerKm: 281, highSecPerKm: 294 };
/** Current-fitness interval band, 262–270 s/km ≈ 4:22–4:30/km. Weeks 9–10 only — ruling 3's
 * early-plan moderation, before the week 11 convergence to goal pace. */
const CURRENT_INTERVAL_PACE: Pace = { lowSecPerKm: 262, highSecPerKm: 270 };
/** Goal pace, 240 s/km = 4:00/km exactly. Week 11's race-pace reps — ruling 3's convergence
 * point, now that the plan sits in the race-specific phase. */
const GOAL_PACE: Pace = { lowSecPerKm: 240, highSecPerKm: 240 };

function easyRun(distanceKm: number, structure?: string, hasStrides = false): Workout {
  return {
    kind: 'run',
    effort: 'easy',
    label: hasStrides ? 'ER + Strides' : 'ER',
    distanceKm,
    effortDescription: EASY_DESCRIPTION,
    pace: EASY_PACE,
    hrZone: 1,
    ...(structure ? { structure } : {}),
  };
}

function longRun(distanceKm: number): Workout {
  return {
    kind: 'run',
    effort: 'easy',
    label: 'LR',
    distanceKm,
    effortDescription: LONG_DESCRIPTION,
    pace: EASY_PACE,
    hrZone: 1,
    isLongRun: true,
  };
}

function tempoRun(distanceKm: number, structure?: string): Workout {
  return {
    kind: 'run',
    effort: 'tempo',
    label: 'TR',
    distanceKm,
    effortDescription: TEMPO_DESCRIPTION,
    pace: TEMPO_PACE,
    hrZone: 3,
    ...(structure ? { structure } : {}),
  };
}

function intervalRun(distanceKm: number, structure: string): Workout {
  return {
    kind: 'run',
    effort: 'interval',
    label: 'INT',
    distanceKm,
    effortDescription: INTERVAL_DESCRIPTION,
    pace: CURRENT_INTERVAL_PACE,
    hrZone: 4,
    structure,
  };
}

function racePaceReps(distanceKm: number, structure: string): Workout {
  return {
    kind: 'run',
    effort: 'interval',
    label: 'RP',
    distanceKm,
    effortDescription: RACE_PACE_DESCRIPTION,
    pace: GOAL_PACE,
    hrZone: 4,
    structure,
  };
}

function shakeoutRun(distanceKm: number, structure: string): Workout {
  return {
    kind: 'run',
    effort: 'recovery',
    label: 'SR',
    distanceKm,
    effortDescription: SHAKEOUT_DESCRIPTION,
    hrZone: 1,
    structure,
  };
}

function raceDayWorkout(): Workout {
  return {
    kind: 'run',
    effort: 'interval',
    label: 'Race Day',
    distanceKm: 10,
    effortDescription: RACE_DESCRIPTION,
    structure: 'WU 3 km · 5 km race · CD 2 km',
  };
}

function week(
  weekNumber: number,
  phase: Phase,
  isDeload: boolean,
  volumeKm: number,
  days: Week7<Day>,
  why: string,
): Week {
  return { weekNumber, totalWeeks: 12, phase, isDeload, volumeKm, days, why };
}

export const examplePlan: Plan = {
  title: 'Example Plan (5K)',
  goalType: 'race',
  raceDistance: '5k',
  raceDate: '2026-09-26',
  durationWeeks: 12,
  tierAtGeneration: 'pro',
  engine: 'hybrid', // paid tiers are always skeleton-constrained hybrid — 'ai' is never emitted
  isFallback: false,
  weeklyLoad: [34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28],
  coachIntro:
    'Twelve weeks, built around your current 35 km week and four training days. The first ' +
    'eight weeks lay an aerobic base with two deload weeks along the way, the next two sharpen ' +
    'speed with tempo and interval work, and the final two convert all of it into a controlled ' +
    'taper toward race day.',
  weeks: [
    week(
      1,
      'base',
      false,
      34,
      [
        easyRun(8, '4 × 30 s Strides', true),
        REST,
        easyRun(8, '4 × 30 s Strides', true),
        REST,
        tempoRun(8, 'WU 2 km · 20 min @ tempo · CD 2 km'),
        longRun(10),
        REST,
      ],
      'Establishing the aerobic floor. The tempo session is fixed at 20 minutes sustained — ' +
        '4 km of work between a 2 km warm-up and a 2 km cool-down — and stays exactly this size ' +
        "for as long as this phase calls for 20 minutes of tempo work, regardless of how much " +
        "the week's total volume grows. It also sits deliberately at the bottom of Zone 3 — " +
        'tempo runs are run at or slightly below threshold, not on it.',
    ),
    week(
      2,
      'base',
      false,
      35,
      [
        easyRun(8, '4 × 30 s Strides', true),
        REST,
        easyRun(8, '4 × 30 s Strides', true),
        REST,
        tempoRun(8, 'WU 2 km · 20 min @ tempo · CD 2 km'),
        longRun(11),
        REST,
      ],
      'Second load week: volume rises 2.9% to 35 km — comfortably under the 10–15% weekly cap. ' +
        'Tempo holds at 8 km, still 20 minutes sustained; the long run grows to 11 km.',
    ),
    week(
      3,
      'base',
      false,
      38,
      [
        easyRun(9, '4 × 30 s Strides', true),
        REST,
        easyRun(9, '4 × 30 s Strides', true),
        REST,
        tempoRun(8, 'WU 2 km · 20 min @ tempo · CD 2 km'),
        longRun(12),
        REST,
      ],
      'Third load week: volume climbs 8.6% to 38 km, still inside the weekly cap. Tempo holds ' +
        'at 8 km; the long run reaches 12 km, one week from this phase’s deload.',
    ),
    week(
      4,
      'base',
      true,
      23,
      [easyRun(6), REST, easyRun(5), REST, easyRun(4), longRun(8), REST],
      "First deload. No quality work at all — a deload that keeps the hard session isn't a " +
        'deload. Volume drops 39.5% off week 3, the last loading week. Deliberately ' +
        'strides-free, unlike the loading weeks either side — the library permits strides ' +
        'during a deload for "speedster" types, but this revision keeps deload weeks pure as ' +
        'the simpler default.',
    ),
    week(
      5,
      'build',
      false,
      41,
      [
        easyRun(10, '4 × 30 s Strides', true),
        REST,
        easyRun(10, '4 × 30 s Strides', true),
        REST,
        tempoRun(8, 'WU 2 km · 20 min @ tempo · CD 2 km'),
        longRun(13),
        REST,
      ],
      'First week of the aerobic-training phase, and the first load week compared against ' +
        "week 3 — the last loading week, not week 4's reduced number — so the +7.9% climb never " +
        'punishes the plan for having recovered. Tempo still holds at 8 km, 20 minutes ' +
        'sustained; the long run grows to 13 km.',
    ),
    week(
      6,
      'build',
      false,
      45,
      [
        easyRun(11, '4 × 30 s Strides', true),
        REST,
        easyRun(11, '4 × 30 s Strides', true),
        REST,
        tempoRun(9, 'WU 2 km · 22 min @ tempo · CD 2 km'),
        longRun(14),
        REST,
      ],
      'Volume rises 9.8% to 45 km. Tempo steps up to 22 minutes sustained (about 5 km of work, ' +
        'still well inside the 15–30 minute tempo band) — the step is the phase’s own ' +
        "progression, not a response to the week's rising volume. The long run reaches 14 km.",
    ),
    week(
      7,
      'build',
      false,
      48,
      [
        easyRun(12, '4 × 30 s Strides', true),
        REST,
        easyRun(12, '4 × 30 s Strides', true),
        REST,
        tempoRun(9, 'WU 2 km · 24 min @ tempo · CD 2 km'),
        longRun(15),
        REST,
      ],
      'Peak week of the aerobic-training phase — volume rises 6.7% to 48 km. Tempo holds at ' +
        'about 24 minutes sustained, still about 5 km of work; the long run reaches this ' +
        'phase’s peak at 15 km.',
    ),
    week(
      8,
      'build',
      true,
      30,
      [easyRun(8), REST, easyRun(7), REST, easyRun(5), longRun(10), REST],
      'Second deload, same rule as week 4: no quality work at all. Volume drops 37.5% off ' +
        'week 7 — the last loading week. Strides-free, like week 4.',
    ),
    week(
      9,
      'peak',
      false,
      45,
      [
        easyRun(11, '4 × 30 s Strides', true),
        REST,
        tempoRun(9, 'WU 2 km · 24 min @ tempo · CD 2 km'),
        REST,
        intervalRun(11, 'WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km'),
        longRun(14),
        REST,
      ],
      'Two quality sessions, 48 hours apart (Day 3 to Day 5). The interval structure is the ' +
        'McMillan rep-menu "Buildup B" (8 × 600 m, 4.8 km quality volume). Recovery is a ' +
        "300 m jog — inside the library's 40–67% menu for 600 m reps; the version of this " +
        'plan Ian first scored used 200 m here, outside that menu, corrected in this revision. ' +
        "Reps run at this runner's current-fitness interval pace, not goal pace yet — ruling " +
        "3's early-plan moderation. First and last interval should sit within 5–8 s/km of " +
        'each other; a drop of more than 10 s/km means the pace was too aggressive. Day 1 ' +
        "adds strides — this week's easy-day maintenance dose.",
    ),
    week(
      10,
      'peak',
      false,
      48,
      [
        easyRun(12, '4 × 30 s Strides', true),
        REST,
        tempoRun(10, 'WU 2 km · 29 min @ tempo · CD 2 km'),
        REST,
        intervalRun(11, 'WU 2 km · 5 × 1000 m @ 4:22–4:30/km w/ 400 m jog · CD 2 km'),
        longRun(15),
        REST,
      ],
      'The heaviest week of the plan. Tempo reaches this phase’s ceiling (about 29 minutes, ' +
        'inside the 25–30 minute maximum for this plan’s final tempo session) and the interval ' +
        'session moves to McMillan’s flagship "Best 5K Workout" design (5 × 1000 m, 5.0 km ' +
        'quality volume). Everything after this week converts fitness into race readiness, not ' +
        "adds more of it. Day 1's strides continue this plan's easy-day maintenance dose.",
    ),
    week(
      11,
      'taper',
      false,
      40,
      [
        easyRun(9),
        REST,
        racePaceReps(10, 'WU 2 km · 3 × 1600 m @ GP 4:00/km w/ ~400 m jog · CD 2 km'),
        REST,
        easyRun(9, '4 × 30 s Strides @ GP', true),
        longRun(12),
        REST,
      ],
      'The first session prescribed at goal pace, not current-fitness pace — ruling 3’s ' +
        'convergence point. Reps run at 4:00/km because this is the race-specific phase; the ' +
        'same session earlier in the plan would have used the current-fitness interval band ' +
        'instead (weeks 9–10). Recovery is generous — a ~400 m jog between reps, not a tight ' +
        "interval-style recovery — because this session rehearses goal pace, it doesn't chase " +
        'VO2 max. Volume drops 16.7% off week 10 while intensity stays specific. Day 5’s ' +
        'strides carry a GP pace reference, like week 12’s, since this is already the ' +
        'race-specific phase.',
    ),
    week(
      12,
      'taper',
      false,
      28,
      [
        easyRun(8),
        REST,
        easyRun(6, '4 × 20 s Strides @ GP', true),
        REST,
        shakeoutRun(4, '2 × 30 s Strides @ GP'),
        REST,
        raceDayWorkout(),
      ],
      'Race week. Nothing here builds fitness — everything preserves it.',
    ),
  ],
  extras: [], // Elite extras are cut for MVP (decision 7, 2026-07-10); nothing populates this yet.
  disclaimers: [
    'This is not medical advice. Consult a doctor before starting any training program or if ' +
      'you experience pain, persistent soreness, dizziness, chest discomfort, or any health ' +
      'concern. PACE provides coaching guidance, not medical diagnosis or treatment.',
  ],
};
