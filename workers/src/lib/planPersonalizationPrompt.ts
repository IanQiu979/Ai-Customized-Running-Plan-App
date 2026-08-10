/**
 * The Pro/Elite personalization prompt — `planEngine.ts`'s "swap 2", landed.
 *
 * DESIGN DECISION, deliberately narrower than `docs/reference/plan-generation.md`'s original step
 * 7/8 sketch ("one representative week per phase" + a "deterministic expander" that materializes
 * every calendar week from it). That shape exists to fit a full week's worth of *structure* into
 * one model response cheaply. This implementation asks the model for something smaller and safer
 * instead, and never re-derives structure at all:
 *
 *   The template skeleton (`createTemplateSkeletonBuilder`, `planTemplates.ts`) already computes
 *   every week's distances, phase, deload flag, and — at `density: 'paid'`, which both Pro and
 *   Elite use — every workout's pace and HR zone/RPE, straight from `loadRules.ts` and
 *   `paceDerivation.ts`. Those are already personalized and already safety-clamped before this
 *   file is ever reached. What the coaching library calls "personalization" for Pro/Elite beyond
 *   that is a weekly "why" (Pro) and a per-workout "why" too (Elite) — coach's-reasoning PROSE.
 *   That prose is the only thing this prompt buys, and the only thing the model is asked for.
 *
 * WHY THIS IS SAFER THAN THE ORIGINAL SKETCH, not just cheaper: `CLAUDE.md`'s "Coaching domain"
 * rule is "a model must not be able to prescribe an unsafe week — the code rejects the number
 * before the user sees it." A model asked to re-emit a whole week (distances, paces, structure)
 * has to be trusted not to drift a number even inside a schema. A model asked ONLY for `why`
 * strings has no numeric field to drift in the first place. `mergePersonalization()` below
 * enforces this structurally, not just by prompt instruction: it reads exactly one thing (a
 * string) out of the model's answer per week/workout and copies everything else — every distance,
 * pace, HR zone, RPE, phase, deload flag, and day layout — byte-for-byte from the skeleton the
 * deterministic engine already built and clamped. There is no code path by which a model answer
 * can change a number.
 *
 * `docs/reference/plan-generation.md`'s "one representative week + expander" idea is intentionally
 * not implemented; see that document's updated status note for this decision.
 */

import { isUnder18 } from '../../../src/lib/loadRules';
import type { Day, Plan, Tier, Week, Workout } from '../../../src/lib/planTypes';
import type { AnthropicMessagesRequest, AnthropicMessagesResponse } from './model';
import type { PersonalizeInput, PromptBuilder } from './planEngine';

export const PLAN_PERSONALIZATION_MODEL = 'claude-sonnet-5';
export const PLAN_PERSONALIZATION_TOOL_NAME = 'submit_plan_personalization';

/** A "why" string longer than this is truncated on the way in — arithmetic bound-checking, not
 * content validation, same category as `MAX_PLAN_DURATION_WEEKS` in `planEngine.ts`. Keeps a
 * pathological response from bloating the stored plan row. */
export const MAX_WHY_LENGTH = 700;
/** Same bound, tighter, for the top-level intro — it renders once, above the whole plan. */
export const MAX_COACH_INTRO_LENGTH = 900;

/** Scales the token ceiling with how much prose was actually asked for: a weekly why for every
 * tier, plus a per-workout why for Elite. Capped well below `MODEL_TIMEOUT_MS`'s generosity —
 * this is a cost ceiling, not a quality lever. */
export function computeMaxTokens(durationWeeks: number, tier: Exclude<Tier, 'free'>): number {
  const perWeek = tier === 'elite' ? 220 : 90;
  return Math.min(8000, 800 + durationWeeks * perWeek);
}

// -------------------------------------------------------------------------------------------
// The narrow output contract — prose only, never a number
// -------------------------------------------------------------------------------------------

interface WeekWhy {
  weekNumber: number;
  why: string;
}

interface WorkoutWhy {
  weekNumber: number;
  /** 0-6, matching `Week.days`'s index — never a calendar day name (`CLAUDE.md`: "days are
   * unnamed"). */
  dayIndex: number;
  why: string;
}

/** What the model's tool call must contain. Nothing here is a number that reaches the runner as a
 * training instruction — `weekNumber`/`dayIndex` are only used to find the matching skeleton slot,
 * never written back out. */
export interface PlanPersonalizationPayload {
  coachIntro: string;
  weeks: WeekWhy[];
  /** Present at Elite; ignored (not requested) at Pro even if the model sends it anyway. */
  workouts?: WorkoutWhy[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isWeekWhy(value: unknown): value is WeekWhy {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.weekNumber === 'number' && isNonEmptyString(v.why);
}

function isWorkoutWhy(value: unknown): value is WorkoutWhy {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.weekNumber === 'number' &&
    typeof v.dayIndex === 'number' &&
    Number.isInteger(v.dayIndex) &&
    v.dayIndex >= 0 &&
    v.dayIndex <= 6 &&
    isNonEmptyString(v.why)
  );
}

/** Shape only — same posture as `planValidation.ts`'s `isPlanShaped`. Never judges whether a
 * `why` reads well, only whether the JSON has the fields this file can safely merge. */
export function isPersonalizationShaped(value: unknown): value is PlanPersonalizationPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isNonEmptyString(v.coachIntro)) return false;
  if (!Array.isArray(v.weeks) || v.weeks.length === 0) return false;
  if (!v.weeks.every(isWeekWhy)) return false;
  if (v.workouts !== undefined) {
    if (!Array.isArray(v.workouts)) return false;
    if (!v.workouts.every(isWorkoutWhy)) return false;
  }
  return true;
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Merges narrative-only fields onto the skeleton. Structural fields — `weekNumber`, `totalWeeks`,
 * `phase`, `isDeload`, `volumeKm`, every `Day`/`Workout` field except `why` — are copied from
 * `skeleton` unchanged, never read from `payload`. This is the enforcement point the file header
 * describes: there is no line below that assigns a model-derived value to a numeric or structural
 * field.
 */
export function mergePersonalization(
  skeleton: Plan,
  payload: PlanPersonalizationPayload,
  tier: Exclude<Tier, 'free'>,
): Plan {
  const weekWhyByNumber = new Map(payload.weeks.map((w) => [w.weekNumber, w.why]));
  const workoutWhyByKey = new Map(
    (tier === 'elite' ? payload.workouts ?? [] : []).map((w) => [
      `${w.weekNumber}:${w.dayIndex}`,
      w.why,
    ]),
  );

  const weeks: Week[] = skeleton.weeks.map((week) => {
    const why = weekWhyByNumber.get(week.weekNumber);
    const days = week.days.map((day, dayIndex) => {
      if (day.kind !== 'run') return day;
      const workoutWhy = workoutWhyByKey.get(`${week.weekNumber}:${dayIndex}`);
      const merged: Workout = workoutWhy
        ? { ...day, why: truncate(workoutWhy, MAX_WHY_LENGTH) }
        : day;
      return merged;
    }) as unknown as Week['days'];

    return why ? { ...week, why: truncate(why, MAX_WHY_LENGTH), days } : { ...week, days };
  });

  return {
    ...skeleton,
    coachIntro: truncate(payload.coachIntro, MAX_COACH_INTRO_LENGTH),
    weeks,
  };
}

// -------------------------------------------------------------------------------------------
// Request assembly
// -------------------------------------------------------------------------------------------

/** Compact per-day summary sent to the model — never the full `Workout` (no pace, no HR zone/RPE:
 * those are already finalized and the model has no business restating or reasoning about a number
 * it cannot change). */
function summarizeDay(day: Day, dayIndex: number): Record<string, unknown> {
  if (day.kind === 'rest') return { dayIndex, kind: 'rest' };
  return {
    dayIndex,
    kind: 'run',
    effort: day.effort,
    label: day.label,
    ...(day.distanceKm !== undefined ? { distanceKm: day.distanceKm } : {}),
    ...(day.durationMin !== undefined ? { durationMin: day.durationMin } : {}),
    ...(day.isLongRun ? { isLongRun: true } : {}),
    ...(day.structure ? { structure: day.structure } : {}),
  };
}

function summarizeWeek(week: Week): Record<string, unknown> {
  return {
    weekNumber: week.weekNumber,
    phase: week.phase,
    isDeload: week.isDeload,
    volumeKm: week.volumeKm,
    days: week.days.map(summarizeDay),
  };
}

const TIER_DEPTH: Record<Exclude<Tier, 'free'>, string> = {
  pro: [
    'TIER: PRO.',
    '- Write ONE `why` per week (2-4 sentences): what this week is for and how it sets up the',
    '  next one. Reference the phase (base/build/peak/taper), the deload flag, and the runner\'s',
    '  own goal — never invent a number.',
    '- Write ONE `coachIntro` (3-5 sentences): welcome the runner, name the goal, and preview the',
    '  arc of the plan (phases, roughly how the weeks build).',
    '- Do NOT send `workouts` — per-workout reasoning is Elite-only.',
  ].join('\n'),
  elite: [
    'TIER: ELITE.',
    '- Everything Pro gets, at the same standard: one `why` per week, one `coachIntro`.',
    '- ALSO write a `why` for every `kind: "run"` day (skip rest days) in the `workouts` array —',
    '  1-2 sentences, tied to that specific session: why this effort, why this distance/duration,',
    '  why today. Reference `structure` when it is present.',
    '- Depth is the step up from Pro, never certainty — you still may not alter or restate a',
    '  pace, an HR zone, an RPE, or a distance as if you derived it; those numbers already exist',
    '  and are not yours to explain away or second-guess.',
  ].join('\n'),
};

const ROLE_PREAMBLE = [
  'You are the coaching voice for PACE Blueprint, a running-plan app built by a McMillan-',
  'certified coach. A deterministic engine has already built the ENTIRE training plan below —',
  'every phase, every week\'s volume, every workout\'s distance, pace, HR zone or RPE, and every',
  'deload — from the coach\'s own load rules. Those numbers are FINAL. Your only job is to add the',
  '"why": the coaching reasoning a runner would want explained. You cannot change a single number',
  'even if you try — nothing you write to any field but `why`/`coachIntro` will ever reach the',
  'runner, so do not attempt to restate, "correct", or re-derive any distance, pace, HR zone, or',
  'RPE. Never invent training content outside what the plan below already prescribes; you are',
  'narrating a plan, not writing a new one.',
].join('\n');

const SAFETY_NOTE = [
  'If the runner declared an injury, the plan below has already had its volume reduced for it —',
  'acknowledge that adjustment in your reasoning where relevant, but never suggest a workout, a',
  'volume, or a return-to-running timeline of your own. Never give medical advice or diagnose;',
  'the app renders its own medical disclaimer separately from anything you write.',
].join('\n');

function buildOutputContract(tier: Exclude<Tier, 'free'>): string {
  return [
    TIER_DEPTH[tier],
    '',
    'Call `submit_plan_personalization` exactly once, as your entire response. `weeks` must',
    'include an entry for every week number shown below — do not skip any.',
  ].join('\n');
}

function personalizationToolSchema(tier: Exclude<Tier, 'free'>): Record<string, unknown> {
  const weekWhySchema = {
    type: 'object',
    properties: {
      weekNumber: { type: 'integer', description: 'Matches a weekNumber from the plan below.' },
      why: { type: 'string', description: 'The coaching reasoning for this week.' },
    },
    required: ['weekNumber', 'why'],
    additionalProperties: false,
  };

  const properties: Record<string, unknown> = {
    coachIntro: {
      type: 'string',
      description: 'A short welcome that names the goal and previews the plan\'s arc.',
    },
    weeks: {
      type: 'array',
      description: 'One entry per week in the plan, matched by weekNumber.',
      items: weekWhySchema,
    },
  };

  if (tier === 'elite') {
    properties.workouts = {
      type: 'array',
      description: 'One entry per run day (never a rest day) whose reasoning is worth calling out.',
      items: {
        type: 'object',
        properties: {
          weekNumber: { type: 'integer' },
          dayIndex: { type: 'integer', description: '0-6, matching the day\'s index in that week.' },
          why: { type: 'string' },
        },
        required: ['weekNumber', 'dayIndex', 'why'],
        additionalProperties: false,
      },
    };
  }

  return {
    type: 'object',
    properties,
    required: tier === 'elite' ? ['coachIntro', 'weeks', 'workouts'] : ['coachIntro', 'weeks'],
    additionalProperties: false,
  };
}

/**
 * Builds the Messages API request. Sets no `temperature`/`top_p`/`top_k` — `claude-sonnet-5`
 * rejects any non-default value of those with a 400 on every request (verified against the
 * sibling repo's `analyze-form-prompt.ts`, which called this out after checking the live docs).
 * Thinking is explicit `{type: 'adaptive'}` rather than omitted, so a future reader cannot mistake
 * the omission for "thinking off" — omitting it means adaptive on this model, not disabled.
 */
export function buildPlanPersonalizationRequest(input: PersonalizeInput): AnthropicMessagesRequest {
  const tier = input.tier;
  const under18 = isUnder18(input.intake.age);

  const contextLines = [
    `Runner's stated goal: ${input.intake.goal}`,
    `Experience: ${input.intake.experience}`,
    `Plan goal type: ${input.skeleton.goalType}`,
    ...(input.skeleton.raceDistance ? [`Race distance: ${input.skeleton.raceDistance}`] : []),
    `Duration: ${input.skeleton.durationWeeks} week(s)`,
    ...(under18
      ? ['This plan belongs to a runner under 18 — keep the tone age-appropriate and never assume adult training history.']
      : []),
    ...(input.intake.injuryNotes
      ? [`Runner's own injury note (context only, never a safety instruction): ${input.intake.injuryNotes}`]
      : []),
    ...(input.notes ? [`Runner's note for this specific plan: ${input.notes}`] : []),
  ].join('\n');

  const planSummary = JSON.stringify(input.skeleton.weeks.map(summarizeWeek));

  const userContent = [
    contextLines,
    '',
    'THE PLAN (already finalized — every number below is fixed):',
    planSummary,
    '',
    buildOutputContract(tier),
  ].join('\n');

  const tool = {
    name: PLAN_PERSONALIZATION_TOOL_NAME,
    description:
      'Submit the coaching reasoning ("why") for this already-finalized training plan. Call this ' +
      'exactly once, as your entire response.',
    input_schema: personalizationToolSchema(tier),
  };

  return {
    model: PLAN_PERSONALIZATION_MODEL,
    max_tokens: computeMaxTokens(input.skeleton.durationWeeks, tier),
    system: [ROLE_PREAMBLE, '', SAFETY_NOTE].join('\n'),
    messages: [{ role: 'user', content: userContent }],
    thinking: { type: 'adaptive' },
    tools: [tool],
    tool_choice: { type: 'tool', name: PLAN_PERSONALIZATION_TOOL_NAME },
  };
}

/** Pulls the tool call's `input` out of a Messages API response. Returns `undefined` — never
 * throws — for anything that does not look like our forced tool call, so the caller's structural
 * validator (`isPersonalizationShaped`) is the single place that decides "malformed". */
export function extractPersonalizationPayload(response: unknown): unknown {
  if (typeof response !== 'object' || response === null) return undefined;
  const content = (response as AnthropicMessagesResponse).content;
  if (!Array.isArray(content)) return undefined;

  const toolUse = content.find(
    (block): block is { type: 'tool_use'; name: string; input: unknown } =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'tool_use' &&
      (block as { name?: unknown }).name === PLAN_PERSONALIZATION_TOOL_NAME,
  );
  return toolUse?.input;
}

/**
 * The production `PromptBuilder` (`planEngine.ts`'s swap 2). Bound in `deps.ts`; nowhere else
 * constructs the real prompt, so there is exactly one place that turns "the prompt is written" on.
 */
export const planPersonalizationPromptBuilder: PromptBuilder = (input) => ({
  request: buildPlanPersonalizationRequest(input),
  extract: (response: unknown) => {
    const payload = extractPersonalizationPayload(response);
    if (!isPersonalizationShaped(payload)) return undefined;
    return mergePersonalization(input.skeleton, payload, input.tier);
  },
});
