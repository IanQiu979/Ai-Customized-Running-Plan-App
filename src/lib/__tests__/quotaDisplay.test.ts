/**
 * Unit tests for `src/lib/quotaDisplay.ts`.
 *
 * The line under test is the only place client-facing quota copy branches on
 * `FREE_IS_LIFETIME` — free's single plan must never claim "this period" (it isn't
 * period-scoped, `tierLimits.ts`), while Pro/Elite must always say "this period" since their
 * quota resets on the purchase-day-anchored window (`quotaPeriod.ts`).
 */

import { formatQuotaLine, isFreeAllowanceUsed } from '../quotaDisplay';
import type { QuotaStatus } from '../planTypes';

function makeStatus(overrides: Partial<QuotaStatus>): QuotaStatus {
  return {
    tier: 'free',
    used: 0,
    limit: 1,
    periodEnd: '2026-09-01T00:00:00.000Z',
    unlimited: false,
    purchasesAvailable: true,
    ...overrides,
  };
}

describe('formatQuotaLine', () => {
  it('phrases the free lifetime allowance without a period reference', () => {
    const status = makeStatus({ tier: 'free', used: 1, limit: 1 });

    expect(formatQuotaLine(status)).toBe('1 of 1 plans used');
  });

  it('phrases a period-scoped tier (pro) with "this period"', () => {
    const status = makeStatus({ tier: 'pro', used: 2, limit: 3 });

    expect(formatQuotaLine(status)).toBe('2 of 3 plans used this period');
  });

  it('phrases a period-scoped tier (elite) with "this period"', () => {
    const status = makeStatus({ tier: 'elite', used: 4, limit: 10 });

    expect(formatQuotaLine(status)).toBe('4 of 10 plans used this period');
  });

  it('handles zero used for the free tier', () => {
    const status = makeStatus({ tier: 'free', used: 0, limit: 1 });

    expect(formatQuotaLine(status)).toBe('0 of 1 plans used');
  });

  it('handles zero used for a period-scoped tier', () => {
    const status = makeStatus({ tier: 'pro', used: 0, limit: 3 });

    expect(formatQuotaLine(status)).toBe('0 of 3 plans used this period');
  });

  it('handles being exactly at the limit for a period-scoped tier', () => {
    const status = makeStatus({ tier: 'elite', used: 10, limit: 10 });

    expect(formatQuotaLine(status)).toBe('10 of 10 plans used this period');
  });

  it('states the temporary unlimited-access override without inventing a numeric limit', () => {
    const status = makeStatus({ tier: 'elite', used: 0, limit: null, periodEnd: null, unlimited: true });

    expect(formatQuotaLine(status)).toBe('Unlimited plans during the test pass');
  });
});

describe('isFreeAllowanceUsed', () => {
  it('is true once a Free runner has used their one lifetime plan', () => {
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'free', used: 1, limit: 1 }))).toBe(true);
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'free', used: 2, limit: 1 }))).toBe(true);
  });

  it('is false while the Free plan is still unused', () => {
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'free', used: 0, limit: 1 }))).toBe(false);
  });

  it('never applies to a paid tier, even at its period limit', () => {
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'pro', used: 3, limit: 3 }))).toBe(false);
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'elite', used: 10, limit: 10 }))).toBe(false);
  });

  it('is false under the unlimited test-pass override', () => {
    expect(isFreeAllowanceUsed(makeStatus({ tier: 'free', used: 1, limit: null, unlimited: true }))).toBe(
      false
    );
  });

  it('is false while the status is unknown — an unknown tier is not "free, used up"', () => {
    expect(isFreeAllowanceUsed(null)).toBe(false);
  });
});
