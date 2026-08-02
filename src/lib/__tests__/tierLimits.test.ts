/**
 * The shared tier constants.
 *
 * These tests are short on purpose — the module is data, not logic. They exist because the numbers
 * are the thing Echo V1 got wrong by duplicating them across three files with "KEEP IN SYNC"
 * comments until they drifted, so pinning them once, next to the file that is now their only home,
 * is the point.
 */

import {
  DEFAULT_TIER,
  FALLBACK_EXEMPTION_CAP,
  FREE_IS_LIFETIME,
  isPurchasableTier,
  PURCHASABLE_TIERS,
  TIER_PLAN_LIMITS,
} from '../tierLimits';

describe('TIER_PLAN_LIMITS', () => {
  it('matches the documented tiers: Free 1, Pro 3, Elite 10', () => {
    expect(TIER_PLAN_LIMITS).toEqual({ free: 1, pro: 3, elite: 10 });
  });

  it("marks Free's single plan as a lifetime allowance, not a monthly one", () => {
    // "Free is 1 plan **total**, not monthly" — so nothing may render a period countdown for it.
    expect(FREE_IS_LIFETIME).toBe(true);
  });

  it('defaults a user with no subscription row to free', () => {
    expect(DEFAULT_TIER).toBe('free');
  });
});

describe('FALLBACK_EXEMPTION_CAP', () => {
  it('is 3 per period', () => {
    // Fallbacks are quota-exempt so a failing model does not cost the user plans, capped at 3 so
    // the free-text `notes` field cannot be used to farm unlimited template plans.
    expect(FALLBACK_EXEMPTION_CAP).toBe(3);
  });
});

describe('isPurchasableTier', () => {
  it('accepts pro and elite', () => {
    expect(PURCHASABLE_TIERS).toEqual(['pro', 'elite']);
    expect(isPurchasableTier('pro')).toBe(true);
    expect(isPurchasableTier('elite')).toBe(true);
  });

  it('rejects free — free is the absence of a purchase, never a purchase target', () => {
    expect(isPurchasableTier('free')).toBe(false);
  });

  it('rejects anything that is not a tier', () => {
    for (const value of ['premium', '', null, undefined, 3, {}]) {
      expect(isPurchasableTier(value)).toBe(false);
    }
  });
});
