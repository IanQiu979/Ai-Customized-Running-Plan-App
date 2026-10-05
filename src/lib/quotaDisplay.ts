/**
 * Presentation-only phrasing for a `QuotaStatus` (`planTypes.ts`). Pure, no React — like
 * `tierLimits.ts`, this stays a display helper only; the numbers themselves are computed and
 * enforced server-side (`CLAUDE.md` "No business rules in the client").
 */

import { FREE_IS_LIFETIME } from './tierLimits';
import type { QuotaStatus } from './planTypes';

/**
 * "1 of 1 plans used" for free (a lifetime allowance, `FREE_IS_LIFETIME`) — "2 of 3 plans used
 * this period" for period-scoped tiers (Pro/Elite).
 */
export function formatQuotaLine(status: QuotaStatus): string {
  const { tier, used, limit, unlimited } = status;
  if (unlimited || limit === null) return 'Unlimited plans during the test pass';

  const isLifetime = tier === 'free' && FREE_IS_LIFETIME;
  return isLifetime
    ? `${used} of ${limit} plans used`
    : `${used} of ${limit} plans used this period`;
}

/**
 * Whether the server-reported status shows a Free runner's one lifetime plan already spent — the
 * captain's 2026-10-05 fix: Home's "Create a new plan" then opens the paywall instead of a whole
 * intake the server would refuse at the end. A display decision only, read straight off what
 * `quota-status` returned: the client never counts plans itself, the `generate-plan` gate stays
 * the authority, and an unknown status (`null`), the test-pass override, or a paid tier never
 * changes what the button does.
 */
export function isFreeAllowanceUsed(status: QuotaStatus | null): boolean {
  if (!status || status.tier !== 'free' || !FREE_IS_LIFETIME) return false;
  if (status.unlimited || status.limit === null) return false;
  return status.used >= status.limit;
}
