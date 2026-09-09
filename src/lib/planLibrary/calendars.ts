/**
 * The four canonical week-by-week calendars — § 11 (5K, 12 weeks), § 12 (10K, 14), § 13 (half
 * marathon, 16), and § 14 (marathon, 24) of `planning/research/plan-blueprint-examples.md`.
 *
 * Each row is a verbatim port of that document's table: the load/focus cell, the shared
 * prescription, the two lane cells, and the Day 7 cell. The `spd`/`end` structures below are a
 * machine reading of the same two cells — the prose is kept alongside in `text` so a coach can
 * check the encoding against the source without leaving the file.
 *
 * Pure data. Do not add a week, change a dose, or reorder a block without a coaching ruling.
 */

import type { DoseKey, ExperienceTrack, LibraryDistance, LongRunTarget, VolumeState, WorkoutCode } from './registry';

/**
 * Which tracks may receive the week's Q2 slot.
 *
 * - `'none'` — the document says no Q2 this week.
 * - `'twoQuality'` — "if eligible" / "for eligible runners": the tracks whose § 4 quality policy
 *   normally allows two sessions. `REG`'s second session is "only after demonstrated tolerance",
 *   and intake captures no tolerance signal, so `REG` is not eligible — see
 *   `openQuestions.ts` (Q4).
 * - `'REG+'`, `'EXP+'`, `'COMP'` — the document names a floor explicitly.
 */
export type Q2Eligibility = 'none' | 'twoQuality' | 'REG+' | 'EXP+' | 'COMP';

export interface QualitySpec {
  code: WorkoutCode;
  /** The § 4 dose row supplying this session's numbers. Absent for `TU`. */
  dose?: DoseKey;
  /** "Half-dose X" in the source cell. */
  halfDose?: boolean;
  /** `HS` is "only when already tolerated"; intake captures no tolerance signal. */
  requiresPriorTolerance?: boolean;
  /** What the document says to use when the condition above is not met. */
  fallback?: QualitySpec;
  /** Verbatim qualifier from the source cell, when one exists. */
  note?: string;
}

export interface LaneWeek {
  /** The source table's lane cell, verbatim. */
  text: string;
  q1: QualitySpec | null;
  q2: QualitySpec | null;
  q2Eligibility: Q2Eligibility;
  /** "Add 10 min `AER` inside one easy run" — minutes band folded into an easy run. */
  aerMinutes?: readonly [number, number];
  /** "Second `ST-A` for `REG+`" — an extra stride exposure, not a quality session. */
  extraStridesMinTrack?: ExperienceTrack;
}

export interface LibraryWeek {
  week: number;
  state: VolumeState;
  /** The source table's "Load / focus" cell, verbatim. */
  focus: string;
  /** The source table's "Shared prescription" cell, verbatim. */
  shared: string;
  /** The week-level stride exposure attached to Day 1, where the shared cell prescribes one. */
  strides?: DoseKey;
  /** "optional 4 relaxed strides for `REG+`" — recovery weeks only. */
  optionalStridesMinTrack?: ExperienceTrack;
  /** `REG+` may use a controlled tune-up instead of Q1 (§ 11 week 8, § 12 week 12). */
  tuneUpInsteadOfQ1MinTrack?: ExperienceTrack;
  spd: LaneWeek;
  end: LaneWeek;
  longRun: LongRunTarget;
  /** The Day 7 cell's remainder, verbatim. */
  longRunNote?: string;
  /** Day 7 is the week's second quality session (`FF`/`HMP`/`MP`), so Day 5 becomes easy. */
  longRunQuality?: Extract<WorkoutCode, 'FF' | 'HMP' | 'MP'>;
  /** The document marks this week's Day 7 for fueling rehearsal. */
  fuelingPractice?: boolean;
}

const noQuality = (text: string): LaneWeek => ({ text, q1: null, q2: null, q2Eligibility: 'none' });

// ---------------------------------------------------------------------------
// § 11. The 10 complete 5K plans — canonical length 12 weeks
// ---------------------------------------------------------------------------

const FIVE_K: readonly LibraryWeek[] = [
  {
    week: 1,
    state: 'ENTRY',
    focus: 'ENTRY · settle in',
    shared: 'Easy running only; one `ST-A` exposure late in the week if comfortable',
    strides: 'ST-A',
    spd: { ...noQuality('Add 10 min `AER` inside one easy run'), aerMinutes: [10, 10] },
    end: noQuality('Strides only; no second fast exposure'),
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 2,
    state: 'LOAD-1',
    focus: 'LOAD-1 · aerobic',
    shared: 'Easy running; one `ST-A`',
    strides: 'ST-A',
    spd: { ...noQuality('12–15 min `AER`, controlled'), aerMinutes: [12, 15] },
    end: { ...noQuality('Second `ST-A` only for `REG+`'), extraStridesMinTrack: 'REG' },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 3,
    state: 'LOAD-2',
    focus: 'LOAD-2 · aerobic',
    shared: 'Easy running; `ST-A`; no demanding threshold/hills',
    strides: 'ST-A',
    spd: { ...noQuality('15–20 min `AER`'), aerMinutes: [15, 20] },
    end: {
      text: '`HS-A` only if previously tolerated; otherwise `ST-A`',
      q1: {
        code: 'HS',
        dose: 'HS-A',
        requiresPriorTolerance: true,
        fallback: { code: 'ST', dose: 'ST-A' },
      },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 4,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Short easy running; no Q2; optional 4 relaxed strides for `REG+`',
    optionalStridesMinTrack: 'REG',
    spd: noQuality('No quality'),
    end: noQuality('No quality'),
    longRun: 'LR-recovery',
  },
  {
    week: 5,
    state: 'LOAD-1',
    focus: 'LOAD-1 · strength',
    shared: 'Q1 enters gradually',
    spd: {
      text: '`F-A`; optional `ST-A` later',
      q1: { code: 'F', dose: 'F-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '`H-A`; optional `ST-A` later',
      q1: { code: 'H', dose: 'H-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 6,
    state: 'LOAD-2',
    focus: 'LOAD-2 · threshold/economy',
    shared: 'First sustained quality block',
    spd: {
      text: 'Q1 `T-A`; Q2 `ST-B` for eligible runners',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-A`; Q2 `T-A` for eligible runners',
      q1: { code: 'I', dose: 'I-A' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 7,
    state: 'LOAD-3',
    focus: 'LOAD-3 · development',
    shared: 'Keep repetitions even; never race the workout',
    spd: {
      text: 'Q1 `T-B`; Q2 `I-A` for `EXP+`',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'I', dose: 'I-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy or final 5–10 min steady for `COMP` only',
  },
  {
    week: 8,
    state: 'RECOVERY',
    focus: 'RECOVERY · absorb',
    shared: 'No tune-up for `NEW/SOME`; `REG+` may use a controlled 3K `TU` instead of Q1',
    tuneUpInsteadOfQ1MinTrack: 'REG',
    spd: {
      text: 'Half-dose `T-A` or no quality',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: 'Half-dose `I-A` or no quality',
      q1: { code: 'I', dose: 'I-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-recovery',
  },
  {
    week: 9,
    state: 'LOAD-2',
    focus: 'LOAD-2 · 5K specific',
    shared: 'Q1 uses current fitness, moving toward realistic 5K pace',
    spd: {
      text: 'Q1 `RP5-A`; Q2 `T-B` for eligible runners',
      q1: { code: 'RP5', dose: 'RP5-A' },
      q2: { code: 'T', dose: 'T-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-B`; Q2 half-dose `T-A` for eligible runners',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 10,
    state: 'HOLD',
    focus: 'HOLD · peak specific',
    shared: 'Final full 5K-specific session',
    spd: {
      text: 'Q1 `RP5-A`; Q2 `T-A` for `EXP+`',
      q1: { code: 'RP5', dose: 'RP5-A' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `RP5-A` one dose higher only after successful Week 9; Q2 `ST-B`',
      q1: {
        code: 'RP5',
        dose: 'RP5-A',
        note: 'One dose higher only after a successful Week 9; the plan never raises it unasked.',
      },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy; do not chase distance',
  },
  {
    week: 11,
    state: 'TAPER-1',
    focus: 'TAPER-1',
    shared: 'Reduce volume; retain brief rhythm',
    strides: 'ST-A',
    spd: {
      text: 'Half-dose `RP5-A`; one `ST-A`',
      q1: { code: 'RP5', dose: 'RP5-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: 'Half-dose `I-A`; one `ST-A`',
      q1: { code: 'I', dose: 'I-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 12,
    state: 'RACE-WEEK',
    focus: 'RACE-WEEK',
    shared: 'Two or three short easy runs; `2–4 × 15 sec` relaxed strides once',
    spd: noQuality('Same'),
    end: noQuality('Same'),
    longRun: 'RACE',
    longRunNote: '`RACE` 5K',
  },
];

// ---------------------------------------------------------------------------
// § 12. The 10 complete 10K plans — canonical length 14 weeks
// ---------------------------------------------------------------------------

const TEN_K: readonly LibraryWeek[] = [
  {
    week: 1,
    state: 'ENTRY',
    focus: 'ENTRY · settle in',
    shared: 'Easy running only; optional `ST-A`',
    strides: 'ST-A',
    spd: { ...noQuality('10 min `AER` inside easy run'), aerMinutes: [10, 10] },
    end: noQuality('Strides only'),
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 2,
    state: 'LOAD-1',
    focus: 'LOAD-1 · aerobic',
    shared: 'Easy running; one `ST-A`',
    strides: 'ST-A',
    spd: { ...noQuality('12–15 min `AER`'), aerMinutes: [12, 15] },
    end: { ...noQuality('Second `ST-A` for `REG+` only'), extraStridesMinTrack: 'REG' },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 3,
    state: 'LOAD-2',
    focus: 'LOAD-2 · aerobic',
    shared: 'No demanding interval or threshold work',
    strides: 'ST-A',
    spd: { ...noQuality('15–20 min `AER`'), aerMinutes: [15, 20] },
    end: {
      text: '`HS-A` only if already tolerated',
      q1: {
        code: 'HS',
        dose: 'HS-A',
        requiresPriorTolerance: true,
        fallback: { code: 'ST', dose: 'ST-A' },
      },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 4,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Short easy running; no Q2',
    spd: noQuality('No quality'),
    end: noQuality('No quality'),
    longRun: 'LR-recovery',
  },
  {
    week: 5,
    state: 'LOAD-1',
    focus: 'LOAD-1 · strength',
    shared: 'Q1 introduced conservatively',
    spd: { text: 'Q1 `F-A`', q1: { code: 'F', dose: 'F-A' }, q2: null, q2Eligibility: 'none' },
    end: { text: 'Q1 `H-A`', q1: { code: 'H', dose: 'H-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 6,
    state: 'LOAD-2',
    focus: 'LOAD-2 · threshold',
    shared: 'Even, controlled work',
    spd: {
      text: 'Q1 `T-A`; Q2 `ST-B` if eligible',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-A`; Q2 half-dose `T-A` if eligible',
      q1: { code: 'I', dose: 'I-A' },
      q2: { code: 'T', dose: 'T-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 7,
    state: 'LOAD-3',
    focus: 'LOAD-3 · aerobic strength',
    shared: 'Extend sustainable work',
    spd: {
      text: 'Q1 `T-B`; Q2 `F-A` for `EXP+`',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'F', dose: 'F-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 8,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Shortened stimulus only',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '`ST-A` or half-dose `I-A`',
      q1: { code: 'ST', dose: 'ST-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-recovery',
  },
  {
    week: 9,
    state: 'LOAD-2',
    focus: 'LOAD-2 · 10K support',
    shared: 'Current-fitness 5K/threshold support',
    spd: {
      text: 'Q1 `CR-A`; Q2 `I-A` for eligible runners',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'I', dose: 'I-A' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for eligible runners',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 10,
    state: 'LOAD-3',
    focus: 'LOAD-3 · broken 10K pace',
    shared: 'First `RP10-A`; add no automatic repetitions',
    spd: {
      text: 'Q1 `RP10-A`; Q2 half-dose `T-A` for `EXP+`',
      q1: { code: 'RP10', dose: 'RP10-A' },
      q2: { code: 'T', dose: 'T-A', halfDose: true },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `RP10-A`; Q2 `ST-B`',
      q1: { code: 'RP10', dose: 'RP10-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy',
  },
  {
    week: 11,
    state: 'HOLD',
    focus: 'HOLD · specific tolerance',
    shared: 'Pace and form must remain even',
    spd: {
      text: 'Q1 `RP10-A`; Q2 `T-B` if eligible',
      q1: { code: 'RP10', dose: 'RP10-A' },
      q2: { code: 'T', dose: 'T-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `RP10-A`; Q2 half-dose `I-A` if eligible',
      q1: { code: 'RP10', dose: 'RP10-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 12,
    state: 'RECOVERY',
    focus: 'RECOVERY / tune-up',
    shared: '`NEW/SOME` easy only; `REG+` optional controlled 5K `TU` replaces Q1',
    tuneUpInsteadOfQ1MinTrack: 'REG',
    spd: {
      text: 'Half-dose `T-A` or TU',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '`ST-A` or TU',
      q1: { code: 'ST', dose: 'ST-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-recovery',
  },
  {
    week: 13,
    state: 'TAPER-1',
    focus: 'TAPER-1',
    shared: 'Brief 10K reminder; reduce volume',
    spd: {
      text: 'Half-dose `RP10-A`',
      q1: { code: 'RP10', dose: 'RP10-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: 'Half-dose `RP10-A` + 4 strides',
      q1: { code: 'RP10', dose: 'RP10-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 14,
    state: 'RACE-WEEK',
    focus: 'RACE-WEEK',
    shared: 'Short easy runs; one `2–4 × 15 sec` stride exposure',
    spd: noQuality('Same'),
    end: noQuality('Same'),
    longRun: 'RACE',
    longRunNote: '`RACE` 10K',
  },
];

// ---------------------------------------------------------------------------
// § 13. The 10 complete half-marathon plans — canonical length 16 weeks
// ---------------------------------------------------------------------------

const HALF: readonly LibraryWeek[] = [
  {
    week: 1,
    state: 'ENTRY',
    focus: 'ENTRY · aerobic + speed touch',
    shared: 'Easy running; one `ST-A` only',
    strides: 'ST-A',
    spd: { ...noQuality('10–15 min `AER`'), aerMinutes: [10, 15] },
    end: noQuality('`ST-A`; no hard repetitions'),
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 2,
    state: 'LOAD-1',
    focus: 'LOAD-1 · aerobic',
    shared: 'Easy running and relaxed mechanics',
    strides: 'ST-A',
    spd: { ...noQuality('15 min `AER`'), aerMinutes: [15, 15] },
    end: { ...noQuality('Second `ST-A` for `REG+`'), extraStridesMinTrack: 'REG' },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 3,
    state: 'LOAD-2',
    focus: 'LOAD-2 · aerobic',
    shared: 'No difficult lactate work',
    strides: 'ST-A',
    spd: { ...noQuality('20 min `AER`'), aerMinutes: [20, 20] },
    end: {
      text: '`HS-A` only when previously tolerated',
      q1: {
        code: 'HS',
        dose: 'HS-A',
        requiresPriorTolerance: true,
        fallback: { code: 'ST', dose: 'ST-A' },
      },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 4,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Easy only; no Q2',
    optionalStridesMinTrack: 'REG',
    spd: noQuality('No quality'),
    end: noQuality('Optional 4 relaxed strides'),
    longRun: 'LR-recovery',
  },
  {
    week: 5,
    state: 'LOAD-1',
    focus: 'LOAD-1 · economy/strength',
    shared: 'Introduce first controlled Q1',
    spd: { text: 'Q1 `F-A`', q1: { code: 'F', dose: 'F-A' }, q2: null, q2Eligibility: 'none' },
    end: { text: 'Q1 `H-A`', q1: { code: 'H', dose: 'H-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 6,
    state: 'LOAD-2',
    focus: 'LOAD-2 · economy → threshold',
    shared: 'Maintain low-cost speed',
    spd: {
      text: 'Q1 `T-A`; Q2 `ST-B` if eligible',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-A`; Q2 half-dose `T-A` if eligible',
      q1: { code: 'I', dose: 'I-A' },
      q2: { code: 'T', dose: 'T-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 7,
    state: 'LOAD-3',
    focus: 'LOAD-3 · threshold',
    shared: 'Sustainable work grows',
    spd: {
      text: 'Q1 `T-B`; Q2 `F-A` for `EXP+`',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'F', dose: 'F-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 8,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'One shortened stimulus at most',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '`ST-A` or half-dose `I-A`',
      q1: { code: 'ST', dose: 'ST-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-recovery',
  },
  {
    week: 9,
    state: 'LOAD-2',
    focus: 'LOAD-2 · stamina',
    shared: 'Longer aerobic strength',
    spd: {
      text: 'Q1 `CR-A`; Q2 `AER`/MLR for eligible runners',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'MLR' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for eligible runners',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 10,
    state: 'LOAD-3',
    focus: 'LOAD-3 · stamina/lactate',
    shared: 'Difficult but controlled; no sprinting',
    spd: {
      text: 'Q1 `CR-A`; Q2 half-dose `I-A` for `EXP+`',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-B` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-B' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy',
  },
  {
    week: 11,
    state: 'HOLD',
    focus: 'HOLD · HM transition',
    shared: 'First broken HM-specific work',
    spd: {
      text: 'Q1 `HMP-A`; Q2 `ST-B`',
      q1: { code: 'HMP', dose: 'HMP-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `HMP-A`; Q2 half-dose `I-A` if eligible',
      q1: { code: 'HMP', dose: 'HMP-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'with final 10 min steady only if recovered',
  },
  {
    week: 12,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Maintain frequency, sharply reduce load',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: { text: '`ST-A`', q1: { code: 'ST', dose: 'ST-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-recovery',
  },
  {
    week: 13,
    state: 'LOAD-2',
    focus: 'LOAD-2 · peak HM specificity',
    shared: 'Longest HMP dose',
    spd: {
      text: 'Q1 `HMP-A`; Q2 `T-A` for `EXP+`',
      q1: { code: 'HMP', dose: 'HMP-A' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `HMP-A`; Q2 `I-A` for `EXP+`',
      q1: { code: 'HMP', dose: 'HMP-A' },
      q2: { code: 'I', dose: 'I-A' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy',
  },
  {
    week: 14,
    state: 'HOLD',
    focus: 'HOLD · fatigue resistance',
    shared: 'Day 7 becomes quality; Day 5 easy',
    spd: { text: 'Q1 `T-B`; no Q2', q1: { code: 'T', dose: 'T-B' }, q2: null, q2Eligibility: 'none' },
    end: {
      text: 'Q1 half-dose `I-A`; no Q2',
      q1: { code: 'I', dose: 'I-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-high',
    longRunNote: 'with `FF-A` at realistic HM effort',
    longRunQuality: 'FF',
  },
  {
    week: 15,
    state: 'TAPER-1',
    focus: 'TAPER-1',
    shared: 'Small threshold/HM reminder',
    spd: {
      text: 'Half-dose `HMP-A`',
      q1: { code: 'HMP', dose: 'HMP-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: 'Half-dose `I-A` + `ST-A`',
      q1: { code: 'I', dose: 'I-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    strides: 'ST-A',
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 16,
    state: 'RACE-WEEK',
    focus: 'RACE-WEEK',
    shared: 'Short easy runs; one relaxed stride exposure',
    spd: noQuality('Same'),
    end: noQuality('Same'),
    longRun: 'RACE',
    longRunNote: '`RACE` half marathon',
  },
];

// ---------------------------------------------------------------------------
// § 14. The 10 complete marathon plans — canonical length 24 weeks
// ---------------------------------------------------------------------------

const MARATHON: readonly LibraryWeek[] = [
  {
    week: 1,
    state: 'ENTRY',
    focus: 'ENTRY · settle in',
    shared: 'Easy running; one `ST-A`; no maximal sprinting',
    strides: 'ST-A',
    spd: { ...noQuality('10 min `AER`'), aerMinutes: [10, 10] },
    end: noQuality('Strides only'),
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 2,
    state: 'LOAD-1',
    focus: 'LOAD-1 · aerobic',
    shared: 'Easy running and relaxed mechanics',
    strides: 'ST-A',
    spd: { ...noQuality('15 min `AER`'), aerMinutes: [15, 15] },
    end: { ...noQuality('Second `ST-A` for `REG+`'), extraStridesMinTrack: 'REG' },
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 3,
    state: 'LOAD-2',
    focus: 'LOAD-2 · aerobic',
    shared: 'No difficult threshold or hills',
    strides: 'ST-A',
    spd: { ...noQuality('20 min `AER`'), aerMinutes: [20, 20] },
    end: {
      text: '`HS-A` only if already tolerated',
      q1: {
        code: 'HS',
        dose: 'HS-A',
        requiresPriorTolerance: true,
        fallback: { code: 'ST', dose: 'ST-A' },
      },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 4,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Easy only',
    optionalStridesMinTrack: 'REG',
    spd: noQuality('No quality'),
    end: noQuality('Optional 4 relaxed strides'),
    longRun: 'LR-recovery',
  },
  {
    week: 5,
    state: 'LOAD-1',
    focus: 'LOAD-1 · economy',
    shared: 'First controlled stimulus',
    spd: { text: 'Q1 `F-A`', q1: { code: 'F', dose: 'F-A' }, q2: null, q2Eligibility: 'none' },
    end: { text: 'Q1 `H-A`', q1: { code: 'H', dose: 'H-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 6,
    state: 'LOAD-2',
    focus: 'LOAD-2 · speed/economy',
    shared: 'Low-cost speed precedes stamina',
    spd: {
      text: 'Q1 `T-A`; Q2 `ST-B` if eligible',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-A`; Q2 half-dose `T-A` if eligible',
      q1: { code: 'I', dose: 'I-A' },
      q2: { code: 'T', dose: 'T-A', halfDose: true },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 7,
    state: 'LOAD-3',
    focus: 'LOAD-3 · economy → threshold',
    shared: 'Avoid high lactate accumulation',
    spd: {
      text: 'Q1 `T-B`; Q2 `F-A` for `EXP+`',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'F', dose: 'F-A' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `T-A` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 8,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'One shortened stimulus at most',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '`ST-A` or half-dose `I-A`',
      q1: { code: 'ST', dose: 'ST-A' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-recovery',
  },
  {
    week: 9,
    state: 'LOAD-2',
    focus: 'LOAD-2 · aerobic strength',
    shared: 'Introduce MLR for eligible schedules',
    spd: {
      text: 'Q1 `CR-A`; Q2 `MLR` for `EXP+`',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'MLR' },
      q2Eligibility: 'EXP+',
    },
    end: {
      text: 'Q1 `I-B`; Q2 `AER/MLR` for `EXP+`',
      q1: { code: 'I', dose: 'I-B' },
      q2: { code: 'MLR' },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 10,
    state: 'LOAD-3',
    focus: 'LOAD-3 · threshold support',
    shared: 'Threshold supports, not dominates',
    spd: {
      text: 'Q1 `T-B`; Q2 `MLR` if eligible',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'MLR' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `I-A`; Q2 `T-A` if eligible',
      q1: { code: 'I', dose: 'I-A' },
      q2: { code: 'T', dose: 'T-A' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 11,
    state: 'HOLD',
    focus: 'HOLD · stamina',
    shared: 'Keep intensity controlled',
    spd: {
      text: 'Q1 `CR-A`; Q2 `AER/MLR`',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'MLR' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `T-A`; Q2 `ST-B`',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy',
  },
  {
    week: 12,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Reduce load and long run',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: { text: '`ST-A`', q1: { code: 'ST', dose: 'ST-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-recovery',
  },
  {
    week: 13,
    state: 'LOAD-2',
    focus: 'LOAD-2 · MP introduction',
    shared: 'First broken marathon-pace work',
    spd: {
      text: 'Q1 `MP-A`; Q2 `AER` if eligible',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'AER' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `MP-A`; Q2 half-dose `I-A` for `EXP+`',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy; fueling practice',
    fuelingPractice: true,
  },
  {
    week: 14,
    state: 'LOAD-3',
    focus: 'LOAD-3 · durability',
    shared: 'Medium-long aerobic support',
    spd: {
      text: 'Q1 `T-B`; Q2 `MLR` if eligible',
      q1: { code: 'T', dose: 'T-B' },
      q2: { code: 'MLR' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `T-A`; Q2 `ST-B`',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy; fueling practice',
    fuelingPractice: true,
  },
  {
    week: 15,
    state: 'HOLD',
    focus: 'HOLD · marathon specificity',
    shared: 'MP dose remains realistic',
    spd: {
      text: 'Q1 `MP-A`; Q2 `AER`',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'AER' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `MP-A`; Q2 half-dose `I-A` for `EXP+`',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'EXP+',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 16,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'No long MP work',
    spd: {
      text: 'Half-dose `T-A`',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: { text: '`ST-A`', q1: { code: 'ST', dose: 'ST-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-recovery',
  },
  {
    week: 17,
    state: 'LOAD-2',
    focus: 'LOAD-2 · fatigue resistance',
    shared: 'Day 7 quality; Day 5 easy',
    spd: { text: 'Q1 `T-A`; no Q2', q1: { code: 'T', dose: 'T-A' }, q2: null, q2Eligibility: 'none' },
    end: {
      text: 'Q1 half-dose `I-A`; no Q2',
      q1: { code: 'I', dose: 'I-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-high',
    longRunNote: 'with `FF-A`; fueling practice',
    longRunQuality: 'FF',
    fuelingPractice: true,
  },
  {
    week: 18,
    state: 'LOAD-3',
    focus: 'LOAD-3 · specific load',
    shared: 'Broken MP plus easy long run',
    spd: {
      text: 'Q1 `MP-A`; Q2 `AER/MLR` if eligible',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'MLR' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `MP-A`; Q2 `ST-B`',
      q1: { code: 'MP', dose: 'MP-A' },
      q2: { code: 'ST', dose: 'ST-B' },
      q2Eligibility: 'twoQuality',
    },
    longRun: 'LR-peak',
    longRunNote: 'easy; fueling practice',
    fuelingPractice: true,
  },
  {
    week: 19,
    state: 'HOLD',
    focus: 'HOLD · stamina',
    shared: 'Final substantial threshold support',
    spd: {
      text: 'Q1 `CR-A`; Q2 `AER`',
      q1: { code: 'CR', dose: 'CR-A' },
      q2: { code: 'AER' },
      q2Eligibility: 'twoQuality',
    },
    end: {
      text: 'Q1 `T-A`; Q2 half-dose `I-A` for `COMP` only',
      q1: { code: 'T', dose: 'T-A' },
      q2: { code: 'I', dose: 'I-A', halfDose: true },
      q2Eligibility: 'COMP',
    },
    longRun: 'LR-high',
    longRunNote: 'easy',
  },
  {
    week: 20,
    state: 'RECOVERY',
    focus: 'RECOVERY',
    shared: 'Absorb before final specific work',
    spd: {
      text: 'Half-dose `T-A` or none',
      q1: { code: 'T', dose: 'T-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: { text: '`ST-A`', q1: { code: 'ST', dose: 'ST-A' }, q2: null, q2Eligibility: 'none' },
    longRun: 'LR-recovery',
  },
  {
    week: 21,
    state: 'LOAD-2',
    focus: 'LOAD-2 · final specific load',
    shared: 'Day 7 is final major marathon-specific run',
    spd: { text: 'Q1 `T-A`; no Q2', q1: { code: 'T', dose: 'T-A' }, q2: null, q2Eligibility: 'none' },
    end: {
      text: 'Q1 `ST-B`; no Q2',
      q1: { code: 'ST', dose: 'ST-B' },
      q2: null,
      q2Eligibility: 'none',
    },
    longRun: 'LR-peak',
    longRunNote: 'with conservative `MP-A` block; fueling rehearsal',
    longRunQuality: 'MP',
    fuelingPractice: true,
  },
  {
    week: 22,
    state: 'TAPER-1',
    focus: 'TAPER-1',
    shared: '70–80% peak volume; brief MP rhythm',
    spd: {
      text: 'Half-dose `MP-A`',
      q1: { code: 'MP', dose: 'MP-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: 'Half-dose `MP-A` + `ST-A`',
      q1: { code: 'MP', dose: 'MP-A', halfDose: true },
      q2: null,
      q2Eligibility: 'none',
    },
    strides: 'ST-A',
    longRun: 'LR-mid',
    longRunNote: 'easy',
  },
  {
    week: 23,
    state: 'TAPER-2',
    focus: 'TAPER-2',
    shared: '55–65% peak; no fitness chasing',
    spd: {
      text: '2 × 8 min MP feel',
      q1: { code: 'MP', dose: 'MP-A', halfDose: true, note: '2 × 8 min MP feel' },
      q2: null,
      q2Eligibility: 'none',
    },
    end: {
      text: '4–6 × 15 sec strides plus 10 min MP feel',
      q1: { code: 'MP', dose: 'MP-A', halfDose: true, note: '10 min MP feel' },
      q2: null,
      q2Eligibility: 'none',
    },
    strides: 'ST-A',
    longRun: 'LR-low',
    longRunNote: 'easy',
  },
  {
    week: 24,
    state: 'RACE-WEEK',
    focus: 'RACE-WEEK',
    shared: 'Two or three short easy runs; brief relaxed strides once',
    spd: noQuality('Same'),
    end: noQuality('Same'),
    longRun: 'RACE',
    longRunNote: '`RACE` marathon',
  },
];

/** The four canonical calendars, keyed by the library's distance key. */
export const LIBRARY_CALENDARS: Record<LibraryDistance, readonly LibraryWeek[]> = {
  '5K': FIVE_K,
  '10K': TEN_K,
  HM: HALF,
  M: MARATHON,
};
