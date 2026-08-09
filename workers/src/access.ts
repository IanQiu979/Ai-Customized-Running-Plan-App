/**
 * Temporary captain-requested entitlement override for the comprehensive v2.2 test pass.
 *
 * This does NOT delete subscriptions, purchases, tier limits, or the quota ledger. When the
 * non-secret `ALL_USERS_UNLIMITED_ACCESS` Worker variable is `"true"`, every authenticated user
 * is evaluated as Elite and the quota gate is bypassed. Set the variable to `"false"` (or remove
 * it) before real users arrive to restore the normal subscription-derived behavior.
 */

import type { Tier } from '../../src/lib/planTypes';

export const UNLIMITED_ACCESS_TIER: Tier = 'elite';

export function isAllUsersUnlimitedAccessEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
