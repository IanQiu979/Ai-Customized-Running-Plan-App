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

export const DUMMY_PURCHASE_UNAVAILABLE_COPY =
  'Test upgrades are limited to invited testers right now.';
