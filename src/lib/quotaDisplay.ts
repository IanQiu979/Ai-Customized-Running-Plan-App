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
  const { tier, used, limit } = status;
  const isLifetime = tier === 'free' && FREE_IS_LIFETIME;
  return isLifetime
    ? `${used} of ${limit} plans used`
    : `${used} of ${limit} plans used this period`;
}
