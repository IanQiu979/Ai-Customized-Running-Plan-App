/**
 * What the intake asks, and what it sends to `generate-plan`.
 *
 * **Why this exists.** On 2026-08-15 the captain reported taking "the intake test two times, the
 * survey two times, only one time is necessary before you actually create the plan". There is only
 * one intake *screen*, but there were two intake *surfaces*: `/intake`, which asked for a target
 * race and a race date, and Home's generate panel, which asked for a goal type, a race distance
 * and a race date all over again — and, unlike intake, refused to proceed without them.
 *
 * The rule this module encodes: **intake owns the runner's target, and, since the captain's
 * 2026-09-20 phone test, intake owns plan creation too.** The questionnaire ends in one "Create
 * plan" that saves the answers and generates from them in the same press; Home never asks a
 * question and never sends a request — its "Create a new plan" only opens the intake. The one
 * thing asked here beyond the ten intake fields is how long an open-ended plan should run, and
 * only when there is no race date to derive it from (`needsPlanLength`).
 *
 * Pure and dependency-free so the flow is unit-testable without rendering a screen.
 */

import type { GeneratePlanRequest, IntakeResponses, RaceDistance } from './planTypes';

/** The default length of a plan with no race date to measure against. */
export const DEFAULT_PLAN_WEEKS = 12;

/**
 * The single source of the maximum plan length, for both sides. `workers/src/lib/planEngine.ts`
 * imports it as `MAX_PLAN_DURATION_WEEKS` rather than re-declaring the number, so the client's
 * refusal and the server's can never drift apart.
 */
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

/**
 * Whether the intake must ask for a plan length. Only when no race date exists to derive one
 * from — asking a runner who already gave a race date how long their plan should be would be the
 * same duplicated question this module exists to remove.
 */
export function needsPlanLength(target: PlanTarget): boolean {
  return target.kind !== 'race';
}

export type BuildRequestResult =
  | { ok: true; request: GeneratePlanRequest }
  | { ok: false; error: string };

/**
 * The one stale-date refusal, told once. The intake is the only screen that sends a request now,
 * so the message names the control it actually has — the race-date field — and the way out:
 * the race is required, but its date is not.
 */
export const RACE_DATE_PASSED_MESSAGE =
  'That race date has already passed. Enter a future date, or clear the date — a race date is optional.';

function isoDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Whether a saved race date is in the past. Race day itself is not past — a plan can still be
 * generated on the morning of the race. `YYYY-MM-DD` sorts lexicographically, so this is a string
 * comparison, and `now` is a parameter rather than a clock read so the decision is deterministic.
 */
export function isRaceDatePast(raceDate: string, now: Date): boolean {
  return raceDate < isoDay(now);
}

/**
 * The intake's save-time guard, kept here rather than in the screen so all four cases are
 * unit-testable. The intake saves and generates in one press, so a stale date has to be refused
 * before either happens — otherwise the answers would be stored and the generation charged for a
 * degenerate one-week plan.
 *
 * A blank date is not an error — the target race is required, its date is optional.
 */
export function intakeRaceDateError(raceDate: string | undefined, now: Date): string | null {
  if (!raceDate) return null;
  return isRaceDatePast(raceDate, now) ? RACE_DATE_PASSED_MESSAGE : null;
}

/**
 * Assembles the request.
 *
 * Two failures are possible. One is a bad plan length. The other is a race date that has already
 * passed: `weeksUntilRace` (`workers/src/lib/planEngine.ts`) floors at one week, and the quota
 * slot is reserved before the skeleton is built, so that request would charge a generation for a
 * degenerate one-week plan. It is refused here instead, before anything is sent — the intake
 * checks the same condition earlier through `intakeRaceDateError`, so this is the second net, not
 * the first. The server-side floor is deliberate behaviour for other callers and is untouched.
 *
 * A missing race can never be an error here: `general` and `distance` both produce a valid
 * `duration` request. (The intake screen itself requires a distance — captain's 2026-09-20
 * ruling — but that is the screen's rule; this builder stays a faithful encoder of any target.)
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
  /** Injected, never read from the clock in here, so the guard below is testable. */
  now: Date;
}): BuildRequestResult {
  const notes = input.notes.trim();
  const withNotes = notes ? { notes } : {};

  if (input.target.kind === 'race') {
    if (isRaceDatePast(input.target.raceDate, input.now)) {
      return { ok: false, error: RACE_DATE_PASSED_MESSAGE };
    }
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
