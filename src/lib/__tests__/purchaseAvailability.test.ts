/**
 * Unit tests for `src/lib/purchaseAvailability.ts` — the paywall's read of the server-decided
 * `QuotaStatus.purchasesAvailable` flag. No decision logic to test here on purpose; the point of
 * this suite is pinning that the client only reads the flag and never infers it.
 */

import { isDummyPurchaseAvailable, resolvePurchaseAvailability } from '../purchaseAvailability';
import type { QuotaStatus } from '../planTypes';

function makeStatus(purchasesAvailable: boolean): QuotaStatus {
  return {
    tier: 'free',
    used: 0,
    limit: 1,
    periodEnd: null,
    unlimited: false,
    purchasesAvailable,
  };
}

describe('isDummyPurchaseAvailable', () => {
  it('is true only when the server says so', () => {
    expect(isDummyPurchaseAvailable(makeStatus(true))).toBe(true);
  });

  it('is false when the server refuses', () => {
    expect(isDummyPurchaseAvailable(makeStatus(false))).toBe(false);
  });

  it('fails closed when there is no quota status yet (loading or a failed fetch)', () => {
    expect(isDummyPurchaseAvailable(null)).toBe(false);
  });
});

describe('resolvePurchaseAvailability', () => {
  it('is pending while the quota fetch is still in flight', () => {
    expect(resolvePurchaseAvailability(undefined)).toBe('pending');
  });

  it('is available once the server says so', () => {
    expect(resolvePurchaseAvailability(makeStatus(true))).toBe('available');
  });

  it('is unavailable once the server refuses', () => {
    expect(resolvePurchaseAvailability(makeStatus(false))).toBe('unavailable');
  });

  it('is unavailable, not pending, after a failed fetch', () => {
    expect(resolvePurchaseAvailability(null)).toBe('unavailable');
  });
});
