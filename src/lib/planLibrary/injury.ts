/**
 * The injury gate — § 15–18 of `planning/research/plan-blueprint-examples.md`.
 *
 * All seven modules ship in v1 with the library's stated disclaimers (captain's ruling,
 * 2026-09-06). The library's own acceptance checklist leaves "qualified clinical review of injury
 * branching" unticked; the captain was shown that gap and chose to ship. Do not add a
 * clinical-review gate of your own, and do not drop a module.
 *
 * **This is coaching safety guidance, not medical diagnosis.** § 16: "H2–H4 always display the
 * injury disclaimer. H4 cannot be overridden by race proximity, goal time, tier, or the runner
 * pressing 'generate' again."
 *
 * What this file cannot do is *derive* the state. § 15 requires six intake fields (location,
 * status, four-point pain, running impact, red flags, professional instruction) that
 * `IntakeResponses` does not yet carry — it has only the closed-set `InjuryFlag[]`. The
 * derivation therefore lives in `openQuestions.ts` (Q5) as a single, isolated, conservative
 * provisional rule, not scattered through the engine.
 */

import type { InjuryFlag } from '../planTypes';
import type { WorkoutCode } from './registry';

/** § 16's five branches, in escalation order. */
export type InjuryState = 'H0' | 'H1' | 'H2' | 'H3' | 'H4';

export const INJURY_STATES: readonly InjuryState[] = ['H0', 'H1', 'H2', 'H3', 'H4'] as const;

/** § 18 rule 2: "Use the highest state number (`H4` beats H3, H3 beats H2, and so on)." */
export function highestInjuryState(states: readonly InjuryState[]): InjuryState {
  return states.reduce<InjuryState>(
    (worst, state) => (INJURY_STATES.indexOf(state) > INJURY_STATES.indexOf(worst) ? state : worst),
    'H0',
  );
}

/** § 16's branch table, verbatim. */
export const INJURY_BRANCHES: Record<
  InjuryState,
  { entry: string; output: string; progressionGate: string }
> = {
  H0: {
    entry: 'No injury, or past/resolved with normal pain-free running',
    output: 'Selected core plan; a known former trigger may be introduced one dose lower',
    progressionGate: 'Normal plan checks',
  },
  H1: {
    entry: 'Resolved injury, but return to full load was recent or confidence is low',
    output:
      'Week 1 at 90% of validated baseline; one fewer quality session; provoking workout one dose ' +
      'lower for first two loading weeks',
    progressionGate: 'No pain during, after, or next morning',
  },
  H2: {
    entry:
      'Cleared/returning; pain-free daily activity and pain-free 30-minute walk; no red flags',
    output:
      '2–3 nonconsecutive easy run/walk or short easy sessions; Day 7 is simply the longest easy ' +
      'session; no quality, hills, strides, fast finish, or race-pace work',
    progressionGate: 'All checkpoints zero before adding time or progressing stage',
  },
  H3: {
    entry:
      'Pain ≤3/10, no swelling/bone pain/gait change/worsening, and no instruction to stop',
    output:
      'Hold or reduce normal running by the module amount; easy only; no progression while ' +
      'symptoms remain',
    progressionGate:
      'Symptoms must not rise during, after, or next morning; otherwise move to H4',
  },
  H4: {
    entry:
      'Pain >3/10; sharp/stabbing or localized bone pain; swelling; limp/gait change; worsening ' +
      'symptoms; pain with daily activity; or clinician says do not run',
    output:
      'No running workouts. Display professional-assessment guidance and preserve the race plan ' +
      'only as inactive future context',
    progressionGate: 'Resume only through H2 after appropriate clearance/pain-free criteria',
  },
};

/** § 16: "Week 1 at 90% of validated baseline" for `H1`. */
export const H1_WEEK_1_BASELINE_SHARE = 0.9;

/**
 * § 16 `H2`: "2–3 nonconsecutive easy run/walk or short easy sessions; Day 7 is simply the longest
 * easy session". The lower end of the stated band, taken because § 16's `H2` output is itself the
 * conservative re-entry stage.
 */
export const H2_RUN_DAYS = 3;

/** § 17's module identifiers, and the intake flag each one is selected by. */
export type InjuryModuleId = 'INJ-1' | 'INJ-2' | 'INJ-3' | 'INJ-4' | 'INJ-5' | 'INJ-6' | 'INJ-7';

export interface InjuryModule {
  id: InjuryModuleId;
  /** § 17's heading, verbatim. */
  title: string;
  /** § 17's `H0` row, verbatim. */
  h0: string;
  /** § 17's `H1` row, verbatim. */
  h1: string;
  /**
   * The `H1` first-loading-week volume reduction the module names, as a fraction. `null` where the
   * module's `H1` action is not a volume cut — `INJ-4` reduces hard-session count instead and only
   * uses "the generic −20% volume fallback … when current training tolerance is also reduced",
   * which intake does not report.
   */
  h1VolumeReductionPct: number | null;
  /** `INJ-4` only: "Reduce hard-session count by 50% for the first two loading weeks." */
  h1HardSessionReductionPct?: number;
  /** How many loading weeks the `H1` action applies for. § 17 says two throughout. */
  h1LoadingWeeks: number;
  /** § 17's `H2/H3` row, verbatim. */
  h2h3: string;
  /** Workout codes the module removes at `H2`/`H3`. § 18 rule 4 takes the union of these. */
  removesAtH2H3: readonly WorkoutCode[];
  /** § 17's "Escalate" row, verbatim. */
  escalate: string;
  /** § 17's "Return order" line, verbatim. */
  returnOrder: string;
}

/** § 17's seven modules, verbatim. Percentages apply to the validated baseline once; § 18 rule 3
 * forbids stacking them. */
export const INJURY_MODULES: Record<Exclude<InjuryFlag, 'none'>, InjuryModule> = {
  knee: {
    id: 'INJ-1',
    title: 'INJ-1 — Knee',
    h0:
      'No automatic reduction. Reintroduce any previously provoking hills or speed one dose lower. ' +
      'Do not prescribe a universal cadence number.',
    h1: 'First loading week −15%; one quality session maximum for two loading weeks; flat easy Day 7.',
    h1VolumeReductionPct: 0.15,
    h1LoadingWeeks: 2,
    h2h3:
      'Easy flat running only when symptom gate permits; remove `H`, `HS`, `I`, `FF`, and ' +
      'race-pace blocks initially.',
    removesAtH2H3: ['H', 'HS', 'I', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate: 'Swelling, locking/giving way, gait change, sharp pain, or pain >3/10 → `H4`.',
    returnOrder:
      'easy flat running → relaxed strides if fully symptom-free → controlled threshold → ' +
      'hills/intervals → fast-finish long run last',
  },
  ankle_achilles: {
    id: 'INJ-2',
    title: 'INJ-2 — Ankle/Achilles',
    h0: 'No automatic reduction, but recent history starts speed and hills one dose lower.',
    h1:
      'First loading week −20%; remove `HS`, `H`, `I`, and fast finishes for at least the first two ' +
      'symptom-free loading weeks.',
    h1VolumeReductionPct: 0.2,
    h1LoadingWeeks: 2,
    h2h3:
      'Flat Zone-1/easy running only if permitted by the symptom gate; no strides, sprinting, ' +
      'hills, or race-pace work.',
    removesAtH2H3: ['ST', 'HS', 'H', 'I', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Pain >3/10, worsening stiffness/pain, swelling, gait change, or instruction to stop → `H4`.',
    returnOrder:
      'flat easy → steady/aerobic → relaxed strides → threshold → hills and short repetitions last. ' +
      'Race proximity never accelerates this order.',
  },
  shin_splints: {
    id: 'INJ-3',
    title: 'INJ-3 — Shin splints / shin pain',
    h0:
      'No automatic reduction. Keep initial long-run and speed progression conservative after ' +
      'recent history.',
    h1: 'First loading week −15%; one quality session maximum; avoid sudden surface or hill-load changes.',
    h1VolumeReductionPct: 0.15,
    h1LoadingWeeks: 2,
    h2h3: 'Easy running only; remove `I`, `H`, `HS`, `FF`, and race-pace work until symptom-free.',
    removesAtH2H3: ['I', 'H', 'HS', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Localized bone pain, point tenderness, pain worsening through a run, pain at rest, or gait ' +
      'change → `H4`; the app must not label this “just shin splints.”',
    returnOrder:
      'short easy → ordinary easy frequency → strides → threshold → intervals/hills last',
  },
  it_band: {
    id: 'INJ-4',
    title: 'INJ-4 — IT band / outer knee',
    h0: 'No automatic reduction; avoid adding downhill and speed load simultaneously.',
    h1:
      'Reduce hard-session count by 50% for the first two loading weeks; use the generic −20% ' +
      'volume fallback only when current training tolerance is also reduced.',
    h1VolumeReductionPct: null,
    h1HardSessionReductionPct: 0.5,
    h1LoadingWeeks: 2,
    h2h3:
      'Flat easy running only; remove downhill running, `H`, `FF`, and long race-pace blocks. Stop ' +
      "the session before the runner's repeatable symptom-onset point.",
    removesAtH2H3: ['H', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Gait change, swelling, sharp pain, or progressively earlier symptom onset → `H4`.',
    returnOrder:
      'flat easy below symptom threshold → longer easy → threshold → hills/fast finish last',
  },
  hip_glute: {
    id: 'INJ-5',
    title: 'INJ-5 — Hip/glute',
    h0:
      'No automatic reduction; reintroduce hills, long-run finishes, and sprint-like work separately.',
    h1: 'First loading week −20%; one quality session maximum; Day 7 easy and clipped to demonstrated tolerance.',
    h1VolumeReductionPct: 0.2,
    h1LoadingWeeks: 2,
    h2h3:
      'Short flat easy running only; remove `HS`, `H`, `I`, `FF`, and long race-pace blocks.',
    removesAtH2H3: ['HS', 'H', 'I', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Bone-localized hip pain, pain at rest/night, weakness, radiating symptoms, or gait change → `H4`.',
    returnOrder:
      'short easy → normal easy duration → controlled steady/threshold → hills and fast finishes last',
  },
  lower_back: {
    id: 'INJ-6',
    title: 'INJ-6 — Lower back',
    h0:
      'No automatic reduction; avoid introducing both longer running and faster running in the same ' +
      'week after recent history.',
    h1: 'First loading week −20%; remove fast finish; keep Day 7 at `LR-low`.',
    h1VolumeReductionPct: 0.2,
    h1LoadingWeeks: 2,
    h2h3:
      'Easy running only if it does not alter posture or gait; remove `HS`, `H`, `I`, `FF`, and long ' +
      'sustained race-pace work.',
    removesAtH2H3: ['HS', 'H', 'I', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Radiating pain, numbness, weakness, major trauma, night/rest pain, or gait change → `H4` and ' +
      'prompt appropriate medical assessment. New bowel/bladder dysfunction or loss of sensation ' +
      'around the genitals/anus requires emergency-care language, not an ordinary physiotherapy ' +
      'suggestion.',
    returnOrder:
      'short easy → easy duration → strides if symptom-free → controlled threshold → long fast work last',
  },
  plantar_arch: {
    id: 'INJ-7',
    title: 'INJ-7 — Plantar/arch',
    h0: 'No automatic reduction; introduce speed, hills, and long-run growth separately.',
    h1: 'First loading week −20%; no hills or fast finish for two symptom-free loading weeks.',
    h1VolumeReductionPct: 0.2,
    h1LoadingWeeks: 2,
    h2h3:
      'Short easy running only when symptoms do not rise during, after, or the following morning; ' +
      'remove `HS`, `H`, `I`, `FF`, and race-pace work.',
    removesAtH2H3: ['HS', 'H', 'I', 'FF', 'RP5', 'RP10', 'HMP', 'MP'],
    escalate:
      'Severe or increasing first-step pain, swelling, localized bone pain, gait change, or pain ' +
      '>3/10 → `H4`.',
    returnOrder:
      'short easy → normal easy frequency → relaxed strides → threshold → hills/fast finish last',
  },
};

/** `H1` removals, per module — § 17 names them for `INJ-2` (`HS`/`H`/`I`/fast finish) and
 * `INJ-6`/`INJ-7` (fast finish, and hills for `INJ-7`). Every other module's `H1` row prescribes a
 * volume or hard-session change only. */
export const INJURY_H1_REMOVALS: Partial<Record<Exclude<InjuryFlag, 'none'>, readonly WorkoutCode[]>> = {
  ankle_achilles: ['HS', 'H', 'I', 'FF'],
  lower_back: ['FF'],
  plantar_arch: ['H', 'FF'],
};

/** `H1` "one quality session maximum" — § 17's `INJ-1`, `INJ-3` and `INJ-5` rows. */
export const INJURY_H1_SINGLE_QUALITY: readonly Exclude<InjuryFlag, 'none'>[] = [
  'knee',
  'shin_splints',
  'hip_glute',
];

/**
 * `INJ-6`'s `H1` row "keep Day 7 at `LR-low`" — a **cap**, not a fixed value (captain's ruling on
 * issue #119, 2026-09-20): Day 7 never rises above `LR-low`, and a rest week's Day 7 still takes
 * § 9's `LR-recovery` (60–70% of the preceding long run) below it, so the recovery cut keeps
 * landing on the long run first instead of on the easy runs alone. Read as a value until then,
 * the pin held a rest week's Day 7 at full `LR-low` length and the easy runs absorbed the whole
 * 15–25% cut — the opposite of § 6 "shorten Day 7".
 */
export const INJURY_H1_LONG_RUN_LOW: readonly Exclude<InjuryFlag, 'none'>[] = ['lower_back'];

export function declaredInjuries(
  injuries: readonly InjuryFlag[],
): readonly Exclude<InjuryFlag, 'none'>[] {
  return injuries.filter((flag): flag is Exclude<InjuryFlag, 'none'> => flag !== 'none');
}

/**
 * § 18, "Multiple-injury composition", rules 3 and 4.
 *
 * 3. "Take the single largest applicable volume reduction; never add percentages."
 * 4. "Apply the union of all workout removals."
 */
export interface ComposedInjuryEffect {
  state: InjuryState;
  modules: readonly InjuryModule[];
  /** The single largest applicable reduction, never a sum. `0` when no module names one. */
  volumeReductionPct: number;
  /** § 18 rule 4 — the union, as a set for cheap membership tests. */
  removedCodes: ReadonlySet<WorkoutCode>;
  /** `INJ-4`'s hard-session halving, when it applies. */
  hardSessionReductionPct: number;
  /** True when any module's `H1` row caps the week at one quality session. */
  singleQualityOnly: boolean;
  /** § 18 rule 5: "the shortest permitted Day 7" — a ceiling of `LR-low` on Day 7, under which a
   * rest week's `LR-recovery` still applies (issue #119, see `INJURY_H1_LONG_RUN_LOW`). */
  longRunPinnedLow: boolean;
  /** § 18 rule 6: "Display each relevant location warning without claiming the locations share
   * one diagnosis." */
  locationWarnings: readonly string[];
}

export function composeInjuryEffect(
  state: InjuryState,
  injuries: readonly InjuryFlag[],
): ComposedInjuryEffect {
  const flags = declaredInjuries(injuries);
  const modules = flags.map((flag) => INJURY_MODULES[flag]);

  const applyH1 = state === 'H1';
  const applyH2H3 = state === 'H2' || state === 'H3';

  const volumeReductionPct =
    applyH1 || applyH2H3
      ? modules.reduce((largest, module) => Math.max(largest, module.h1VolumeReductionPct ?? 0), 0)
      : 0;

  const removed = new Set<WorkoutCode>();
  if (applyH2H3) {
    for (const module of modules) for (const code of module.removesAtH2H3) removed.add(code);
  } else if (applyH1) {
    for (const flag of flags) for (const code of INJURY_H1_REMOVALS[flag] ?? []) removed.add(code);
  }

  return {
    state,
    modules,
    volumeReductionPct,
    removedCodes: removed,
    hardSessionReductionPct: applyH1
      ? modules.reduce((largest, m) => Math.max(largest, m.h1HardSessionReductionPct ?? 0), 0)
      : 0,
    singleQualityOnly:
      applyH1 && flags.some((flag) => INJURY_H1_SINGLE_QUALITY.includes(flag)),
    longRunPinnedLow:
      (applyH1 && flags.some((flag) => INJURY_H1_LONG_RUN_LOW.includes(flag))) || applyH2H3,
    locationWarnings: modules.map((module) => `${module.title}: ${module.escalate}`),
  };
}

// ---------------------------------------------------------------------------
// § 16. Symptom-gated return sequence
// ---------------------------------------------------------------------------

/** § 16's return sequence, verbatim. "No fixed medical recovery duration is promised." */
export const RETURN_SEQUENCE: readonly string[] = [
  'Clearance gate: daily activity pain-free, no visible swelling, 30-minute flat walk pain-free; significant injuries require appropriate professional clearance.',
  'Run/walk: 1 minute easy running / 2 minutes walking × 6–8, two or three nonconsecutive days.',
  'Short continuous easy: 20–25 minutes, two or three nonconsecutive days.',
  'Build tolerance: two 25–35-minute easy runs plus a 40-minute easy Day 7; add only 5–10 minutes to Day 7 when every symptom checkpoint stays at zero.',
  'Near return: three easy runs; later add one mild steady segment.',
  'Normal-plan re-entry: first add easy frequency, then strides, then a shortened controlled quality session, and only afterward resume the selected core calendar.',
];
