/**
 * Structural validation of a generated plan. **Shape only.**
 *
 * `docs/reference/plan-generation.md` "Validation: structural, not strict-content" is a lesson
 * carried from Echo V1's `lib/planGenerator.ts`: validating AI output against tight *content*
 * rules produced MORE bad fallback plans than it prevented, because a plan can be substantively
 * fine while failing a narrow content check. So this file asks only "are the expected fields
 * present and of the right type" and never "is 42 km a sensible week".
 *
 * That is not a gap. The safety numbers are checked separately and deterministically by
 * `src/lib/loadRules.ts`, which clamps every week identically at every tier — clamping a number is
 * arithmetic, not content validation (`CLAUDE.md` "Coaching domain"). This validator's only job is
 * to catch outright malformed responses before they reach a user.
 */

import { EFFORT_LEVELS, type Plan } from '../../../src/lib/planTypes';

const PHASES = new Set(['base', 'build', 'peak', 'taper']);
const EFFORTS = new Set<string>(EFFORT_LEVELS);
const ENGINES = new Set(['template', 'hybrid', 'ai']);
const TIERS = new Set(['free', 'pro', 'elite']);
const GOAL_TYPES = new Set(['race', 'duration']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDay(value: unknown): boolean {
  if (!isObject(value)) return false;

  if (value.kind === 'rest') return true;
  if (value.kind !== 'run') return false;

  // A run always carries its effort, its abbreviated label, and its effort description — the last
  // because on Free it is the only pace signal a runner gets, and a run without one renders blank.
  if (typeof value.effort !== 'string' || !EFFORTS.has(value.effort)) return false;
  if (typeof value.label !== 'string' || value.label.length === 0) return false;
  if (typeof value.effortDescription !== 'string' || value.effortDescription.length === 0) return false;

  // "Exactly one of these is set" (planTypes.ts `Workout`). Both or neither is malformed.
  const hasDistance = typeof value.distanceKm === 'number';
  const hasDuration = typeof value.durationMin === 'number';
  return hasDistance !== hasDuration;
}

function isWeek(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.weekNumber !== 'number') return false;
  if (typeof value.totalWeeks !== 'number') return false;
  if (typeof value.phase !== 'string' || !PHASES.has(value.phase)) return false;
  if (typeof value.isDeload !== 'boolean') return false;
  if (typeof value.volumeKm !== 'number') return false;

  // Exactly seven slots. Rest days are real slots, not absences (`planTypes.ts` `Week`), so a
  // six-element week is a dropped day, not a lighter one.
  if (!Array.isArray(value.days) || value.days.length !== 7) return false;
  return value.days.every(isDay);
}

/**
 * True when `value` has the shape of a `Plan`. Deliberately silent about whether it is a *good*
 * plan.
 */
export function isPlanShaped(value: unknown): value is Plan {
  if (!isObject(value)) return false;

  if (typeof value.title !== 'string' || value.title.length === 0) return false;
  if (typeof value.goalType !== 'string' || !GOAL_TYPES.has(value.goalType)) return false;
  if (typeof value.durationWeeks !== 'number' || value.durationWeeks <= 0) return false;
  if (typeof value.tierAtGeneration !== 'string' || !TIERS.has(value.tierAtGeneration)) return false;
  if (typeof value.engine !== 'string' || !ENGINES.has(value.engine)) return false;
  if (typeof value.isFallback !== 'boolean') return false;

  if (!Array.isArray(value.weeklyLoad) || !value.weeklyLoad.every((n) => typeof n === 'number')) {
    return false;
  }
  if (!Array.isArray(value.weeks) || value.weeks.length === 0) return false;
  if (!value.weeks.every(isWeek)) return false;

  if (!Array.isArray(value.extras)) return false;

  // Rule 10: legally required, never empty. An empty disclaimer array is a plan that ships without
  // its medical caveat, which is the one structural failure with a legal consequence.
  if (!Array.isArray(value.disclaimers) || value.disclaimers.length === 0) return false;
  if (!value.disclaimers.every((d) => typeof d === 'string' && d.length > 0)) return false;

  // The week count must agree with the declared length; a plan that disagrees with itself would
  // render a progress wave that does not match its own weeks.
  return value.weeks.length === value.durationWeeks && value.weeklyLoad.length === value.durationWeeks;
}
