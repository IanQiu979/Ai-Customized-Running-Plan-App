/**
 * The one source of truth for per-tier plan limits.
 *
 * `planning/03-engineering-requirements.md` ("Architecture" → `lib/tierLimits.ts`) mandates this
 * file by name: "ONE shared constant for Free/Pro/Elite plan limits, imported by every edge
 * function and every screen that displays quota. Echo V1 hand-duplicated these numbers across
 * three files with 'KEEP IN SYNC' comments and they drifted — never repeat that here."
 *
 * Like `planTypes.ts`, this module must stay pure — types and const literals only, no React, no
 * Deno, no Node, no Cloudflare Workers globals. It is imported by the Expo app AND by
 * `workers/src/` (Cloudflare Workers), and a runtime-specific import here breaks one of them.
 *
 * The numbers themselves come from `docs/reference/plan-generation.md` "The three tiers" and
 * "Quotas". Displaying them in the client is fine; *enforcing* them there is not — enforcement is
 * server-side only (`CLAUDE.md` "No business rules in the client").
 */

import type { Tier } from './planTypes';

/**
 * Plans allowed per quota window.
 *
 * Free is **1 plan total, not monthly** — `FREE_IS_LIFETIME` below is the flag that says so, and
 * every consumer must branch on it rather than assuming a period applies to every tier.
 */
export const TIER_PLAN_LIMITS: Record<Tier, number> = {
  free: 1,
  pro: 3,
  elite: 10,
};

/**
 * Free's single plan is a lifetime allowance, so its count is never period-scoped. Pro and Elite
 * count within the purchase-day-anchored period computed by `currentPeriod()` in `quotaPeriod.ts`.
 */
export const FREE_IS_LIFETIME = true;

/**
 * How many quota-exempt fallback plans a user gets per period.
 *
 * `docs/reference/plan-generation.md` "Quotas": fallback plans (`is_fallback: true`) are excluded
 * from the quota count, "capped at 3 quota-exempt fallbacks per period so the free-text `notes`
 * field can't be used to farm unlimited template plans (each attempt still costs up to 2 Claude
 * calls before falling back)".
 *
 * **Addendum R-B (2026-07-10):** past this cap, a 4th+ fallback in the same period *keeps* its
 * already-reserved quota slot rather than being exempted. Nobody is refused a plan; that attempt
 * simply counts against quota like any other.
 */
export const FALLBACK_EXEMPTION_CAP = 3;

/** The tier a user with no subscription row has. */
export const DEFAULT_TIER: Tier = 'free';

/** Tiers that may be purchased. `free` is the absence of a purchase, never a purchase target. */
export const PURCHASABLE_TIERS: readonly Exclude<Tier, 'free'>[] = ['pro', 'elite'] as const;

export function isPurchasableTier(value: unknown): value is Exclude<Tier, 'free'> {
  return typeof value === 'string' && (PURCHASABLE_TIERS as readonly string[]).includes(value);
}
