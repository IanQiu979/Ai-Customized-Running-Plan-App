/**
 * **The six coaching decisions the source library does not make — all six now ruled.**
 *
 * `planning/research/plan-blueprint-examples.md` is the source of truth for the Free tier's
 * 40-plan engine, and this project's standing rule is that coaching content is never invented
 * (`AGENTS.md`, "Coaching content is never invented"). Six decisions the engine cannot avoid
 * making are not in that document. They were put to Ian as numbered questions on 2026-09-09 and
 * **answered on 2026-09-10**; this file holds his rulings, and it is still the only place in
 * `planLibrary/` allowed to hold a coaching value the source document does not state.
 *
 * The filename is kept for the links already pointing at it from `docs/change_log.md` and
 * `AGENTS.md`. Read it as "the questions the library left open, and how they were answered" —
 * the companion prose, with the reasoning and the exact wording put to him, is
 * `docs/reference/coaching/free-engine-open-questions.md`.
 *
 * **A seventh decision may not be added here without a seventh question to Ian in the same
 * commit.** That is the whole point of the file: one audited place, never a guess in the engine.
 */

import type { EffortLevel, ExperienceLevel } from '../planTypes';
import type { ExperienceTrack, RunnerProfile, WorkoutCode } from './registry';

export type LibraryDecisionId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6';

export interface LibraryDecision {
  id: LibraryDecisionId;
  title: string;
  /** What the source document does say, so a reader can see the gap rather than take it on trust. */
  sourceSays: string;
  /** Ian's ruling, 2026-09-10. */
  ruling: string;
}

export const LIBRARY_DECISIONS: Record<LibraryDecisionId, LibraryDecision> = {
  Q1: {
    id: 'Q1',
    title: 'Free-tier eligibility for intake the 40-plan register does not cover',
    sourceSays:
      '§ 1 registers 40 plans across exactly four race distances. § 8 "No target race date" says ' +
      'to "run the base/build portion for the selected distance" — which still needs a distance.',
    ruling:
      'Require a target distance before generating on Free. A duration-only Free request that ' +
      'names no distance anywhere is **not served by the library engine** and must not be ' +
      'defaulted onto the 10K calendar or handed to the generic template engine. Paid tiers keep ' +
      'the optional-race behaviour of the captain’s 2026-08-15 report unchanged.',
  },
  Q2: {
    id: 'Q2',
    title: 'SPD/END classification thresholds',
    sourceSays:
      '§ 7 classifies on "a recent performance at two distances", "materially stronger", and a ' +
      'self-reported fading/gear-change answer. It also states the fallback: "Only one result, ' +
      'conflicting evidence, or no usable evidence → Conservative default: `END` lane, but first ' +
      'occurrence of every fast workout is reduced one dose."',
    ruling:
      '"Materially stronger" is **5% or more faster than the Riegel-predicted equivalent** ' +
      '(`SPD_MATERIALLY_STRONGER_PCT` below). Banked for when intake is expanded to two ' +
      'performances; until then intake captures at most one result and no fading/gear-change ' +
      'answer, so every runner takes § 7’s own conservative default — the `END` lane with the ' +
      'first occurrence of each fast workout reduced one dose. `SPD` staying unreachable is ' +
      'expected, not a defect.',
  },
  Q3: {
    id: 'Q3',
    title: 'Exact shorter / longer / no-race-date calendar transforms',
    sourceSays:
      '§ 8 gives the rules in prose — never delete race week or the final taper exposure; remove ' +
      'early repeated loading weeks "only when the runner already demonstrates the required base ' +
      'and recent-long-run capacity"; otherwise retain preparation and remove later ambitious ' +
      'workouts; under four weeks prescribe easy running, one brief reminder, taper/race — but ' +
      'names no numeric test for "the required base".',
    ruling:
      "`deriveReadinessPath`'s `prepared` verdict **is** the test for \"demonstrates the required " +
      'base" — approved as implemented, with no new threshold. A `prepared` runner loses the ' +
      'early repeated loading weeks first; a `first-timer` keeps preparation and loses the later ' +
      'ambitious weeks instead. Extension repeats the canonical weeks 1–4 base cycle only.',
  },
  Q4: {
    id: 'Q4',
    title: 'Numeric-range and workout-collision tie-breaks',
    sourceSays:
      '§ 5 gives `HOLD` as 95–100% and the tapers as bands with no named target (unlike `ENTRY`, ' +
      '`RECOVERY`, and the loading states, which do name one). § 11–14 say "if eligible" and "for ' +
      'eligible runners" without defining eligibility. § 6 caps `REG` at 4–5 days "unless already ' +
      'stable at six", with no test for stability.',
    ruling:
      'All three defaults approved as implemented. An unnamed band takes its **midpoint** — ' +
      'arithmetic, not a new coaching number — for `HOLD`, `TAPER-1`, `TAPER-2` and `RACE-WEEK`. ' +
      '**"Eligible" is `EXP` and `COMP` only**: `REG`’s second session is "only after ' +
      'demonstrated tolerance" and intake reports no tolerance signal. A **`REG` runner ' +
      'requesting six days is clamped to five**, the extra day becoming rest.',
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
    ruling:
      '**Keep the H0/H1 default; § 15’s six-field injury intake is NOT required before Free ' +
      'ships** — that is a separate future task. No declared injury → `H0`. Any declared injury → ' +
      '`H1` ("cautious history"), the mildest branch that still applies a module. `H2`, `H3` and ' +
      '`H4` stay fully implemented and tested but unreachable from live intake, because nothing ' +
      'the app currently collects can evidence them. The engine never derives a worse state than ' +
      'the intake supports, and never a better one than a declared injury implies.',
  },
  Q6: {
    id: 'Q6',
    title: 'Notation and effort mapping for library codes with no `notation.md` counterpart',
    sourceSays:
      "§ 3 defines 20 workout codes. `notation.md` (Ian's 2026-07-11 notation ruling, ported in " +
      '`src/lib/notation.ts`) defines nine labels: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, ' +
      '`Strides`, `Race Day`. Seven library codes — `AER`, `MLR`, `FF`, `HS`, `F`, `H`, `TU` — ' +
      'have no label, and § 3 gives an explicit RPE only for `REC`, `E`, `AER`, and `LR`.',
    ruling:
      'All ten proposed mappings approved as-is, **including `MP` as *steady* and `RP10` as ' +
      '*interval*** (see `CODE_PRESENTATION` below). No new abbreviation is minted: each library ' +
      'code renders through an existing `notation.md` label, because a new notation entry is a ' +
      'notation ruling, not an engine decision.',
  },
};

// ---------------------------------------------------------------------------
// Q1 — coverage
// ---------------------------------------------------------------------------

/**
 * Why a request could not be served from the library.
 *
 * Q1's ruling makes this a **refusal**, not a hand-off: `workers/src/lib/planEngine.ts` turns it
 * into an `invalid_request` so the runner is asked for a target distance, and no quota slot is
 * charged. Do not route it to `buildTemplatePlan` — that would put a Free user back on the paid
 * tiers' skeleton, which is exactly the wiring the 2026-09-06 tier-split ruling forbids.
 */
export type LibraryCoverageGap = 'no-race-distance';

/** What the runner is told when Q1's refusal fires. States the fix, not just the problem. */
export const NO_RACE_DISTANCE_MESSAGE =
  'Choose a target race distance — 5K, 10K, half marathon, or marathon — before generating your ' +
  'plan. Your plan is built from a coach-authored library organised by distance, so it needs one ' +
  'to start from. You can still train without entering a race date.';

// ---------------------------------------------------------------------------
// Q2 — runner-profile classification
// ---------------------------------------------------------------------------

/**
 * Q2's ruling: a result **5% or more** faster than its Riegel-predicted equivalent counts as
 * "materially stronger" for § 7's `SPD`/`END` classification.
 *
 * Banked, not yet reachable. § 7 needs a recent performance at *two* distances plus the
 * fading/gear-change self-report, and `IntakeResponses.recentPerformance` holds one performance
 * and no self-report. When intake gains the second result, this is the threshold to compare
 * against `riegelEquivalentSec` — the classification is the only thing missing, not the plans:
 * all 20 `SPD` calendars are already built and tested.
 */
export const SPD_MATERIALLY_STRONGER_PCT = 0.05;

/** § 7's conservative default, and the only lane a live intake can currently reach (Q2). */
export const DEFAULT_RUNNER_PROFILE: RunnerProfile = 'END';

/** § 7: the conservative default also reduces "the first occurrence of every fast workout … one dose". */
export const REDUCE_FIRST_FAST_DOSE_ON_DEFAULT_LANE = true;

// ---------------------------------------------------------------------------
// Q4 — tie-breaks
// ---------------------------------------------------------------------------

/** Midpoint of a band the document does not give a target for. Arithmetic, not a coaching number. */
export function bandMidpoint(band: readonly [number, number]): number {
  return (band[0] + band[1]) / 2;
}

/** Q4's ruling: "eligible" / "eligible runners" is `EXP` and `COMP` only. */
export const TWO_QUALITY_TRACKS: readonly ExperienceTrack[] = ['EXP', 'COMP'];

// ---------------------------------------------------------------------------
// Q5 — injury-state derivation
// ---------------------------------------------------------------------------

/**
 * Q5's ruling: any declared injury maps to `H1` until § 15's six-field injury intake exists, which
 * is a separate future task. Isolated here so that intake replaces exactly this constant and
 * `engine.ts`'s `deriveInjuryState`, and nothing else.
 */
export const INJURY_STATE_WITH_DECLARED_INJURY = 'H1' as const;

// ---------------------------------------------------------------------------
// Q6 — presentation mapping
// ---------------------------------------------------------------------------

export interface CodePresentation {
  /** A `notation.md` label. Never a newly minted abbreviation (Q6). */
  label: string;
  effort: EffortLevel;
  /** Free tier's only pace signal, so it must stand alone. */
  effortDescription: string;
  /** True when the code counts against § 2 rule 4's hard-session cap. */
  isHardSession: boolean;
}

/**
 * Q6's mapping, approved 2026-09-10. `effort` comes from § 3's "Intensity / construction" column
 * wherever it states one (`REC` RPE 2–3 → recovery; `E`/`LR` RPE 3–4 → easy; `AER` RPE 4–5 →
 * steady); the remainder is read from the same column's words ("comfortably hard, even" → tempo;
 * "current-fitness VO2/5K effort" → interval). `MP` as *steady* and `RP10` as *interval* were
 * called out explicitly and confirmed.
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

/** Levels the library's operating limits are expressed against, for cross-checks with `loadRules`. */
export type { ExperienceLevel };
