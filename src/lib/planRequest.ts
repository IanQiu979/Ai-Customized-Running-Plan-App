/**
 * What Home may ask, and what it sends to `generate-plan`.
 *
 * **Why this exists.** On 2026-08-15 the captain reported taking "the intake test two times, the
 * survey two times, only one time is necessary before you actually create the plan". There is only
 * one intake *screen*, but there were two intake *surfaces*: `/intake`, which asks for a target
 * race and a race date, and Home's generate panel, which asked for a goal type, a race distance
 * and a race date all over again — and, unlike intake, refused to proceed without them. A runner
 * who had just answered "no target race (optional)" was then blocked by "Select a race distance."
 *
 * The rule this module encodes: **intake owns the runner's target; Home never re-asks it.** Home
 * derives the target from the saved intake and asks for exactly one thing intake cannot know —
 * how long an open-ended plan should run — and only when there is no race date to derive it from.
 * Changing a target goes back to `/intake`, the one place those questions live.
 *
 * Pure and dependency-free so the flow is unit-testable without rendering a screen.
 */

import type { GeneratePlanRequest, IntakeResponses, RaceDistance } from './planTypes';

/** The default length of a plan with no race date to measure against. */
export const DEFAULT_PLAN_WEEKS = 12;

/** Mirrors `MAX_PLAN_DURATION_WEEKS` in `workers/src/lib/planEngine.ts`. */
export const MAX_PLAN_WEEKS = 104;

export type PlanTarget =
  /** Intake named a distance and a date. The plan's length comes from the date. */
  | { kind: 'race'; raceDistance: RaceDistance; raceDate: string }
  /** Intake named a distance but no date, so there is no start line to count back from. */
  | { kind: 'distance'; raceDistance: RaceDistance }
  /** Intake named no race at all. A general plan, and an entirely valid answer. */
  | { kind: 'general' };

/**
 * Reads the runner's target straight off their saved intake. Note what is absent: any default
 * distance. A runner who named no race gets `general`, never an assumed 5K — the same rule the
 * template engine now follows after its `?? '5k'` came out.
 */
export function planTargetFromIntake(intake: IntakeResponses | null | undefined): PlanTarget {
  if (!intake?.raceDistance) return { kind: 'general' };
  if (intake.raceDate) {
    return { kind: 'race', raceDistance: intake.raceDistance, raceDate: intake.raceDate };
  }
  return { kind: 'distance', raceDistance: intake.raceDistance };
}

const DISTANCE_LABELS: Record<RaceDistance, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
};

/** The one-line summary Home shows instead of re-asking. */
export function describePlanTarget(target: PlanTarget): string {
  switch (target.kind) {
    case 'race':
      return `${DISTANCE_LABELS[target.raceDistance]} on ${target.raceDate}`;
    case 'distance':
      return `${DISTANCE_LABELS[target.raceDistance]} — no date set`;
    case 'general':
      return 'General fitness — no target race';
  }
}

/**
 * Whether Home must ask for a plan length. Only when no race date exists to derive one from —
 * asking a runner who already gave a race date how long their plan should be would be the same
 * duplicated question this module exists to remove.
 */
export function needsPlanLength(target: PlanTarget): boolean {
  return target.kind !== 'race';
}

export type BuildRequestResult =
  | { ok: true; request: GeneratePlanRequest }
  | { ok: false; error: string };

/**
 * Assembles the request. The only failure it can report is a bad plan length — which is the only
 * thing the runner types on this screen. A missing race can never be an error here: `general` and
 * `distance` both produce a valid `duration` request.
 *
 * `distance` deliberately still sends `raceDistance`. The server's `validateIntake` only *requires*
 * it for a race goal type, and `buildTemplatePlan` uses it to shape the periodization, so a runner
 * training toward a half with no date fixed yet gets half-specific phase weights without the plan
 * claiming a race date they never gave.
 */
export function buildGeneratePlanRequest(input: {
  target: PlanTarget;
  /** Raw field text; ignored when `needsPlanLength(target)` is false. */
  planLengthWeeks: string;
  notes: string;
  idempotencyKey: string;
}): BuildRequestResult {
  const notes = input.notes.trim();
  const withNotes = notes ? { notes } : {};

  if (input.target.kind === 'race') {
    return {
      ok: true,
      request: {
        goalType: 'race',
        raceDistance: input.target.raceDistance,
        raceDate: input.target.raceDate,
        ...withNotes,
        idempotencyKey: input.idempotencyKey,
      },
    };
  }

  const weeks = Number(input.planLengthWeeks);
  if (!input.planLengthWeeks.trim() || !Number.isInteger(weeks) || weeks < 1) {
    return { ok: false, error: 'Plan length must be a whole number of weeks, 1 or more.' };
  }
  if (weeks > MAX_PLAN_WEEKS) {
    return { ok: false, error: `Plan length must be ${MAX_PLAN_WEEKS} weeks or fewer.` };
  }

  return {
    ok: true,
    request: {
      goalType: 'duration',
      durationWeeks: weeks,
      ...(input.target.kind === 'distance' ? { raceDistance: input.target.raceDistance } : {}),
      ...withNotes,
      idempotencyKey: input.idempotencyKey,
    },
  };
}
