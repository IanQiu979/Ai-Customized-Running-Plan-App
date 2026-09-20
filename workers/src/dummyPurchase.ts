/**
 * v1 dummy-purchase gate — trusted testers only until public launch.
 *
 * The dummy purchase (`POST /api/purchase-tier`, `source: 'dummy'`) must not become a client-side
 * flag that unlocks tier for anyone who finds the button (`planning/03-engineering-requirements.md`
 * "Security requirements"). The server is the sole authority: `DUMMY_PURCHASE_ENABLED` and
 * `DUMMY_PURCHASE_ALLOWLIST` (`wrangler.toml [vars]`, `env.ts`) are read only here, and the only
 * thing the client ever sees is the resulting boolean — never the allowlist itself.
 */

import type { Env } from './env';

export function isDummyPurchaseAvailable(env: Env, email: string | null | undefined): boolean {
  if (env.DUMMY_PURCHASE_ENABLED?.trim().toLowerCase() === 'true') {
    return true;
  }
  return isAllowlisted(env.DUMMY_PURCHASE_ALLOWLIST, email);
}

/** Exact match only, case-insensitive — never a substring/`includes` check on the raw string. */
function isAllowlisted(allowlist: string | undefined, email: string | null | undefined): boolean {
  if (!allowlist || !email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowlist
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
