/**
 * Whether the paywall may offer the v1 dummy purchase — read straight off `QuotaStatus`, never
 * decided here. `workers/src/dummyPurchase.ts` is the sole authority; this file only interprets
 * its answer for rendering, the same "structural, not content" split every other server-decided
 * flag in this app follows.
 */

import type { QuotaStatus } from './planTypes';

export function isDummyPurchaseAvailable(quota: QuotaStatus | null): boolean {
  return quota?.purchasesAvailable === true;
}

/**
 * The paywall's three states. `undefined` is the fetch still in flight — render neither the
 * purchase buttons nor the "invited testers only" notice, since either would be a definitive
 * claim before the server has answered. `null` is a settled failure and fails closed.
 */
export type PurchaseAvailability = 'pending' | 'available' | 'unavailable';

export function resolvePurchaseAvailability(
  quota: QuotaStatus | null | undefined
): PurchaseAvailability {
  if (quota === undefined) return 'pending';
  return isDummyPurchaseAvailable(quota) ? 'available' : 'unavailable';
}

export const DUMMY_PURCHASE_UNAVAILABLE_COPY =
  'Test upgrades are limited to invited testers right now.';
