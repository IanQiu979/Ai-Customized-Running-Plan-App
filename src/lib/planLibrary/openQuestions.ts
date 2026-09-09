/**
 * **Every coaching decision the source library does not make.**
 *
 * `planning/research/plan-blueprint-examples.md` is the source of truth for the Free tier's
 * 40-plan engine, and this project's standing rule is that coaching content is never invented
 * (`AGENTS.md`, "Coaching content is never invented"). Six decisions the engine cannot avoid
 * making are not in that document. Rather than scatter six guesses through the engine, all six
 * live here, each with:
 *
 * - the numbered question exactly as it is put to the captain in
 *   `docs/reference/coaching/free-engine-open-questions.md`, and
 * - the **provisional** behaviour the engine uses until he answers it, chosen in every case to be
 *   the most conservative reading the document itself already supports — never a new number.
 *
 * When an answer lands, change the constant here and the question's entry in that doc. Nothing
 * else in `planLibrary/` should need to move.
 */

import type { EffortLevel, ExperienceLevel } from '../planTypes';
import type { ExperienceTrack, RunnerProfile, WorkoutCode } from './registry';

export type OpenQuestionId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6';

export interface OpenQuestion {
  id: OpenQuestionId;
  title: string;
  /** What the source document does say, so the captain can see the gap rather than take it on trust. */
  sourceSays: string;
  /** What the engine does until he rules. */
  provisional: string;
}

export const OPEN_QUESTIONS: Record<OpenQuestionId, OpenQuestion> = {
  Q1: {
    id: 'Q1',
    title: 'Free-tier eligibility for intake the 40-plan register does not cover',
    sourceSays:
      '§ 1 registers 40 plans across exactly four race distances. § 8 "No target race date" says ' +
      'to "run the base/build portion for the selected distance" — which still needs a distance.',
    provisional:
      'A request with no race distance at all (a duration goal where intake never named a target) ' +
      'is reported as not covered by the library, and the caller keeps the existing generic ' +
      'template engine for it. No library plan is invented for it.',
  },
  Q2: {
    id: 'Q2',
    title: 'SPD/END classification thresholds',
    sourceSays:
      '§ 7 classifies on "a recent performance at two distances", "materially stronger", and a ' +
      'self-reported fading/gear-change answer. It also states the fallback: "Only one result, ' +
      'conflicting evidence, or no usable evidence → Conservative default: `END` lane, but first ' +
      'occurrence of every fast workout is reduced one dose."',
    provisional:
      'Intake captures at most one recent performance and no fading/gear-change answer, so every ' +
      'runner takes § 7\'s own documented conservative default: the `END` lane with the first ' +
      'occurrence of each fast workout reduced one dose. `SPD` plans exist in the register and are ' +
      'fully built, but no live intake can currently select one.',
  },
  Q3: {
    id: 'Q3',
    title: 'Exact shorter / longer / no-race-date calendar transforms',
    sourceSays:
      '§ 8 gives the rules in prose — never delete race week or the final taper exposure; remove ' +
      'early repeated loading weeks "only when the runner already demonstrates the required base ' +
      'and recent-long-run capacity"; otherwise retain preparation and remove later ambitious ' +
      'workouts; under four weeks prescribe easy running, one brief reminder, taper/race — but ' +
      'names no numeric test for "the required base" and no ordering for which week goes first.',
    provisional:
      "`deriveReadinessPath`'s captain-approved `prepared` verdict is used as the \"demonstrates " +
      'the required base" test: a `prepared` runner loses early repeated loading weeks first, a ' +
      '`first-timer` keeps preparation and loses the later ambitious weeks instead. Extension ' +
      'repeats the canonical weeks 1–4 base cycle only, never peak or taper.',
  },
  Q4: {
    id: 'Q4',
    title: 'Numeric-range and workout-collision tie-breaks',
    sourceSays:
      '§ 5 gives `HOLD` as 95–100% and the tapers as bands with no named target (unlike `ENTRY`, ' +
      '`RECOVERY`, and the loading states, which do name one). § 11–14 say "if eligible" and "for ' +
      'eligible runners" without defining eligibility. § 6 caps `REG` at 4–5 days "unless already ' +
      'stable at six", with no test for stability.',
    provisional:
      'An unnamed band takes its midpoint — arithmetic, not a new coaching number. "Eligible" ' +
      "means the track's § 4 quality policy normally allows two sessions, which is `EXP` and " +
      '`COMP`: `REG`\'s second session is "only after demonstrated tolerance" and intake reports ' +
      'no tolerance signal. `REG` requesting six days is clamped to five and the extra day becomes ' +
      'rest, the same direction § 6 already takes for `NEW`.',
  },
  Q5: {
    id: 'Q5',
    title: 'H0–H4 derivation and progression from the intake the app actually collects',
    sourceSays:
      '§ 15 requires six fields before any module applies: location, status (past/returning/' +
      'active-stable/active-worsening), a four-point pain score, running impact, red-flag symptoms, ' +
      'and professional instruction. § 16 branches on all of them. `IntakeResponses` carries only ' +
      'the closed-set `injuries: InjuryFlag[]` and free-text `injuryNotes`, which § 15 says "never ' +
      'changes numeric training rules by itself".',
    provisional:
      'No declared injury → `H0`. Any declared injury → `H1` ("cautious history"), the mildest ' +
      'branch that still applies a module. `H2`, `H3`, and `H4` are fully implemented and testable ' +
      'but unreachable from live intake, because nothing in the current intake can evidence them. ' +
      'The engine never guesses a worse state than the intake can support, and never a better one ' +
      'than a declared injury implies.',
  },
  Q6: {
    id: 'Q6',
    title: 'Notation and effort mapping for library codes with no `notation.md` counterpart',
    sourceSays:
      '§ 3 defines 20 workout codes. `notation.md` (Ian\'s 2026-07-11 notation ruling, ported in ' +
      '`src/lib/notation.ts`) defines nine labels: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, ' +
      '`Strides`, `Race Day`. Seven library codes — `AER`, `MLR`, `FF`, `HS`, `F`, `H`, `TU` — ' +
      'have no label, and § 3 gives an explicit RPE only for `REC`, `E`, `AER`, and `LR`.',
    provisional:
      'Each library code maps onto an existing `notation.md` label and an `EffortLevel` read from ' +
      "§ 3's own intensity column (see `CODE_PRESENTATION` below). No new abbreviation is minted — " +
      'a new notation entry is a notation ruling, not an engine decision.',
  },
};

// ---------------------------------------------------------------------------
// Q2 — runner-profile default
// ---------------------------------------------------------------------------

/** § 7's documented conservative default, and the only lane a live intake can currently reach. */
export const PROVISIONAL_RUNNER_PROFILE: RunnerProfile = 'END';

/** § 7: the conservative default also reduces "the first occurrence of every fast workout … one dose". */
export const PROVISIONAL_REDUCE_FIRST_FAST_DOSE = true;

// ---------------------------------------------------------------------------
// Q4 — tie-breaks
// ---------------------------------------------------------------------------

/** Midpoint of a band the document does not give a target for. Arithmetic, not a coaching number. */
export function bandMidpoint(band: readonly [number, number]): number {
  return (band[0] + band[1]) / 2;
}

/** Q4: "eligible" / "eligible runners" — the tracks whose § 4 quality policy normally allows two. */
export const PROVISIONAL_TWO_QUALITY_TRACKS: readonly ExperienceTrack[] = ['EXP', 'COMP'];

// ---------------------------------------------------------------------------
// Q6 — presentation mapping
// ---------------------------------------------------------------------------

export interface CodePresentation {
  /** A `notation.md` label. Never a newly minted abbreviation. */
  label: string;
  effort: EffortLevel;
  /** Free tier's only pace signal, so it must stand alone. */
  effortDescription: string;
  /** True when the code counts against § 2 rule 4's hard-session cap. */
  isHardSession: boolean;
}

/**
 * Q6's mapping. `effort` comes from § 3's "Intensity / construction" column wherever it states one
 * (`REC` RPE 2–3 → recovery; `E`/`LR` RPE 3–4 → easy; `AER` RPE 4–5 → steady); the remainder is
 * read from the same column's words ("comfortably hard, even" → tempo; "current-fitness VO2/5K
 * effort" → interval) and is exactly what Q6 asks the captain to confirm.
 */
export const CODE_PRESENTATION: Record<WorkoutCode, CodePresentation> = {
  REST: { label: 'Rest', effort: 'recovery', effortDescription: 'A genuine rest day.', isHardSession: false },
  REC: {
    label: 'RR',
    effort: 'recovery',
    effortDescription: 'Very easy and short — active recovery, not a training stimulus.',
    isHardSession: false,
  },
  E: {
    label: 'ER',
    effort: 'easy',
    effortDescription: 'Easy, conversational pace.',
    isHardSession: false,
  },
  AER: {
    label: 'ER',
    effort: 'steady',
    effortDescription: 'Steady aerobic support — never allowed to drift into threshold.',
    isHardSession: false,
  },
  LR: {
    label: 'LR',
    effort: 'easy',
    effortDescription: 'Easy, conversational pace — your endurance-building run for the week.',
    isHardSession: false,
  },
  ST: {
    label: 'ER + Strides',
    effort: 'easy',
    effortDescription:
      'Easy running with short relaxed accelerations — gradual, never all-out, with full recovery.',
    isHardSession: false,
  },
  HS: {
    label: 'ER + Strides',
    effort: 'easy',
    effortDescription:
      'Easy running with short relaxed hill sprints — 8–10 seconds, full walk-back, only when already tolerated.',
    isHardSession: false,
  },
  F: {
    label: 'TR',
    effort: 'tempo',
    effortDescription: 'Controlled timed efforts with easy float recoveries.',
    isHardSession: true,
  },
  H: {
    label: 'TR',
    effort: 'tempo',
    effortDescription: 'Controlled hill repetitions for strength and economy — not sprinting.',
    isHardSession: true,
  },
  T: {
    label: 'TR',
    effort: 'tempo',
    effortDescription: 'Comfortably hard, even, never a time trial.',
    isHardSession: true,
  },
  CR: {
    label: 'TR',
    effort: 'tempo',
    effortDescription: 'Broken threshold with short easy recoveries.',
    isHardSession: true,
  },
  I: {
    label: 'INT',
    effort: 'interval',
    effortDescription: 'Current-fitness effort with even repetitions and full recovery.',
    isHardSession: true,
  },
  RP5: {
    label: 'RP',
    effort: 'interval',
    effortDescription: 'Realistic 5K race effort — controlled speed, not an all-out effort.',
    isHardSession: true,
  },
  RP10: {
    label: 'RP',
    effort: 'interval',
    effortDescription: 'Realistic 10K race effort — controlled speed, not an all-out effort.',
    isHardSession: true,
  },
  HMP: {
    label: 'RP',
    effort: 'tempo',
    effortDescription: 'Realistic half-marathon effort, continuous or broken.',
    isHardSession: true,
  },
  MP: {
    label: 'RP',
    effort: 'steady',
    effortDescription: 'Realistic marathon effort — also practice for pacing and fueling.',
    isHardSession: true,
  },
  MLR: {
    label: 'ER',
    effort: 'steady',
    effortDescription: 'Longer than an ordinary easy run, shorter than Day 7.',
    isHardSession: false,
  },
  FF: {
    label: 'LR',
    effort: 'steady',
    effortDescription:
      'Easy long run with a controlled final portion — the finish makes it the week’s quality session.',
    isHardSession: true,
  },
  TU: {
    label: 'RP',
    effort: 'interval',
    effortDescription: 'A controlled race or time trial — never paired with another hard workout this week.',
    isHardSession: true,
  },
  RACE: {
    label: 'Race Day',
    effort: 'interval',
    effortDescription: 'Race effort — give what the plan built.',
    isHardSession: true,
  },
};

// ---------------------------------------------------------------------------
// Q1 — coverage
// ---------------------------------------------------------------------------

/** Why a request could not be served from the library. Only Q1's case exists today. */
export type LibraryCoverageGap = 'no-race-distance';

// ---------------------------------------------------------------------------
// Q5 — injury-state derivation
// ---------------------------------------------------------------------------

/**
 * Q5's provisional rule, isolated so the real § 15 intake can replace exactly this function.
 * `H2`–`H4` are implemented in `injury.ts` and reachable by direct call and by test, but no live
 * intake can evidence them.
 */
export const PROVISIONAL_INJURY_STATE_WITH_DECLARED_INJURY = 'H1' as const;

/** Levels the library's operating limits are expressed against, for cross-checks with `loadRules`. */
export type { ExperienceLevel };
