/**
 * The Worker's own edges: the authentication gate, the route table, and better-auth actually
 * running against D1.
 *
 * The first block is the important one. `index.ts` authenticates once, ahead of dispatch, so that
 * no handler *can* be reached anonymously; these tests are what turn that claim into something
 * that stays true after the next route is added.
 */

import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuth } from '../src/auth';
import { normalizeAllowedBrowserOrigin } from '../src/cors';
import type { Env } from '../src/env';
import worker from '../src/index';

const APP_ROUTES: [string, string][] = [
  ['POST', '/api/generate-plan'],
  ['GET', '/api/quota-status'],
  ['POST', '/api/purchase-tier'],
  ['POST', '/api/delete-account'],
  ['GET', '/api/intake'],
  ['PUT', '/api/intake'],
  ['GET', '/api/plans'],
  ['GET', '/api/plans/some-id'],
];

/** Signs a fresh user up through the real adapter and returns their session token. */
async function signUp(email: string): Promise<string> {
  const response = await SELF.fetch('https://example.test/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'a-long-enough-password', name: 'Runner' }),
  });

  const body = await response.text();
  expect(response.status, body).toBe(200);

  const token = (JSON.parse(body) as { token?: string }).token;
  expect(token).toBeTruthy();
  return token as string;
}

beforeEach(async () => {
  await env.DB.batch(
    [
      'plans',
      'intake_responses',
      'guardian_consent',
      'subscriptions',
      'profiles',
      'session',
      'account',
      'user',
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`))
  );
});

describe('the authentication gate', () => {
  it.each(APP_ROUTES)('rejects an anonymous %s %s with 403', async (method, path) => {
    const response = await SELF.fetch(`https://example.test${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });

    // 403, not 401 — the documented contract in `docs/architecture.md`'s API table. A client
    // written against the docs branches on this exact number.
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
  });

  it('does not leak whether a route exists to an anonymous caller', async () => {
    // `/api/nope` answers 403 like every other `/api/*` path, because the gate runs before
    // dispatch. Route existence is not something an unauthenticated caller gets to probe.
    const response = await SELF.fetch('https://example.test/api/nope');
    expect(response.status).toBe(403);
  });
});

describe('CORS', () => {
  it('answers an allowed credentialed browser preflight', async () => {
    const response = await SELF.fetch('https://example.test/api/quota-status', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:8081',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('fails closed for an origin outside the allowlist', async () => {
    const response = await SELF.fetch('https://example.test/api/quota-status', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows an auth POST from an allowlisted Expo web origin', async () => {
    // NOTE on what this test does and does not prove: `env.CORS_ALLOWED_ORIGINS` (pinned in
    // `vitest.config.ts`) already contains `http://localhost:8081`, so `index.ts`'s
    // `normalizeAllowedBrowserOrigin()` rewrites this request's `origin` header to
    // `env.BETTER_AUTH_URL` *before* better-auth ever sees it — `BETTER_AUTH_URL` is unconditionally
    // trusted, with or without `auth.ts`'s `trustedOrigins`/`CORS_ALLOWED_ORIGINS` fold. This test
    // therefore only pins that a CORS-allowlisted origin round-trips successfully through the full
    // Worker entry point; it does NOT exercise the fold itself (see
    // `'better-auth trusts an origin CORS allows even when the CORS rewrite does not run'` below,
    // and `test/social-auth.test.ts`'s callback-URL suite), and it would keep passing even if the
    // fold were reverted. The real 2026-08-10 production bug — `INVALID_ORIGIN` for
    // `http://localhost:8081` — could not reproduce here for exactly this reason: production's
    // `CORS_ALLOWED_ORIGINS` did not contain that origin, so no rewrite happened there, while this
    // suite's pinned env always does contain it.
    const response = await SELF.fetch('https://example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { origin: 'http://localhost:8081', 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'cors-web@example.test',
        password: 'a-long-enough-password',
        name: 'Web Runner',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });

  it('adds CORS headers to ordinary allowed-origin responses', async () => {
    const response = await SELF.fetch('https://example.test/health', {
      headers: { origin: 'http://localhost:8081' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });

  describe('the 2026-08-10 production INVALID_ORIGIN bug', () => {
    // Reproduces the exact request that failed against the live deployed Worker
    // (`curl -X POST https://pace-blueprint-production.i78979848.workers.dev/api/auth/sign-up/email
    // -H 'Origin: http://localhost:8081'` -> `{"code":"INVALID_ORIGIN"}`), by driving the same
    // pipeline `index.ts`'s `fetch()` uses (`normalizeAllowedBrowserOrigin()` then
    // `createAuth(env).handler()`) against production-shaped env vars, instead of `SELF.fetch`'s
    // fixed `vitest.config.ts` bindings — this is the harness gap the previous test above cannot
    // cover, because `env.CORS_ALLOWED_ORIGINS` there is pinned to already contain the origin under
    // test.
    function withEnv(overrides: Partial<Env>): Env {
      return { ...(env as unknown as Env), ...overrides };
    }

    async function signUpThroughFullPipeline(authEnv: Env, origin: string) {
      const request = new Request('https://example.test/api/auth/sign-up/email', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `prod-shaped-${origin.replace(/[^a-z0-9]/gi, '')}@example.test`,
          password: 'a-long-enough-password',
          name: 'Prod Shaped',
        }),
      });
      return createAuth(authEnv).handler(normalizeAllowedBrowserOrigin(request, authEnv));
    }

    it('fails INVALID_ORIGIN for a web origin absent from CORS_ALLOWED_ORIGINS, matching the pre-fix production repro', async () => {
      // The exact env shape production had *before* this fix: CORS_ALLOWED_ORIGINS lists only the
      // deployed origin itself, so localhost:8081 is neither CORS-rewritten nor directly trusted.
      const prodShapedBeforeFix = withEnv({
        BETTER_AUTH_URL: 'https://pace-blueprint-production.i78979848.workers.dev',
        APP_SCHEME: 'paceblueprint://',
        CORS_ALLOWED_ORIGINS: 'https://pace-blueprint-production.i78979848.workers.dev',
      });

      const response = await signUpThroughFullPipeline(prodShapedBeforeFix, 'http://localhost:8081');

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'INVALID_ORIGIN' });
    });

    it('succeeds for the same origin once CORS_ALLOWED_ORIGINS includes it, matching the fixed wrangler.toml', async () => {
      // The env shape production has *after* this fix (`[env.production.vars] CORS_ALLOWED_ORIGINS`
      // in `wrangler.toml`) — same BETTER_AUTH_URL, localhost:8081 added to CORS_ALLOWED_ORIGINS.
      const prodShapedAfterFix = withEnv({
        BETTER_AUTH_URL: 'https://pace-blueprint-production.i78979848.workers.dev',
        APP_SCHEME: 'paceblueprint://',
        CORS_ALLOWED_ORIGINS:
          'https://pace-blueprint-production.i78979848.workers.dev,http://localhost:8081,http://localhost:19006',
      });

      const response = await signUpThroughFullPipeline(prodShapedAfterFix, 'http://localhost:8081');

      const body = await response.text();
      expect(response.status, body).toBe(200);
    });

    it('better-auth trusts an origin CORS allows even when the CORS rewrite does not run — pins the auth.ts fold itself', async () => {
      // Isolates `auth.ts`'s `trustedOrigins` fold from `normalizeAllowedBrowserOrigin()`'s masking
      // effect by calling `createAuth().handler()` directly (bypassing `index.ts`'s `fetch()`
      // entirely, so no rewrite can happen) with an origin that is in `CORS_ALLOWED_ORIGINS` but is
      // neither `BETTER_AUTH_URL` nor `APP_SCHEME`. Fails pre-fix (trustedOrigins ignored
      // CORS_ALLOWED_ORIGINS); passes post-fix.
      const authEnv = withEnv({
        BETTER_AUTH_URL: 'https://distinct-from-cors-origin.example',
        APP_SCHEME: 'paceblueprint://',
        CORS_ALLOWED_ORIGINS: 'http://localhost:8081',
      });

      const response = await createAuth(authEnv).handler(
        new Request('https://example.test/api/auth/sign-up/email', {
          method: 'POST',
          headers: { origin: 'http://localhost:8081', 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'fold-proof@example.test',
            password: 'a-long-enough-password',
            name: 'Fold Proof',
          }),
        })
      );

      const body = await response.text();
      expect(response.status, body).toBe(200);
    });

    it('still fails closed for an origin CORS never allowed, proving the fix did not over-broaden trust', async () => {
      const prodShapedAfterFix = withEnv({
        BETTER_AUTH_URL: 'https://pace-blueprint-production.i78979848.workers.dev',
        APP_SCHEME: 'paceblueprint://',
        CORS_ALLOWED_ORIGINS:
          'https://pace-blueprint-production.i78979848.workers.dev,http://localhost:8081,http://localhost:19006',
      });

      const response = await signUpThroughFullPipeline(prodShapedAfterFix, 'https://evil.example');

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'INVALID_ORIGIN' });
    });
  });
});

describe('the route table', () => {
  it('serves an unauthenticated health check', async () => {
    const response = await SELF.fetch('https://example.test/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('404s outside /api', async () => {
    const response = await SELF.fetch('https://example.test/not-a-route');
    expect(response.status).toBe(404);
  });

  it('has no route that deletes a single plan, even for a signed-in caller', async () => {
    // Count-based quota depends on plans being undeletable: a delete route would let a user reset
    // their own count. This has to be checked *with* a session — unauthenticated it would 403 like
    // everything else, which would prove nothing about whether the route exists.
    const token = await signUp('deleter@example.test');

    const response = await SELF.fetch('https://example.test/api/plans/some-id', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ code: 'method_not_allowed' });
  });
});

describe('better-auth on D1', () => {
  it('signs a user up, writes the row, and issues a session that the app routes accept', async () => {
    // End to end through the real adapter: this is what proves the D1 dialect and
    // `migrations/0001_better_auth.sql` actually agree with each other.
    const token = await signUp('runner@example.test');

    const row = await env.DB.prepare('SELECT id, email FROM user WHERE email = ?')
      .bind('runner@example.test')
      .first<{ id: string; email: string }>();
    expect(row?.email).toBe('runner@example.test');

    // The session must be usable on an app route — a sign-up that does not unlock the API is not
    // a working sign-up.
    const quota = await SELF.fetch('https://example.test/api/quota-status', {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(quota.status).toBe(200);
    expect(await quota.json()).toEqual({
      tier: 'free',
      used: 0,
      limit: 1,
      unlimited: false,
      // Free's allowance is lifetime, so there is no countdown to render.
      periodEnd: null,
      // Local/dev's `DUMMY_PURCHASE_ENABLED` is "true" (`wrangler.toml [vars]`) — see
      // "the v1 dummy purchase gate" below for the production-shaped ("false" + allowlist) cases.
      purchasesAvailable: true,
    });
  });

  it('rejects a password shorter than the configured minimum', async () => {
    const response = await SELF.fetch('https://example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'short@example.test', password: 'abc', name: 'Short' }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe('the v1 dummy purchase gate', () => {
  // `SELF.fetch` always runs against `vitest.config.ts`'s one fixed env, which — like local/dev —
  // leaves `DUMMY_PURCHASE_ENABLED` at wrangler.toml's top-level "true". To exercise the
  // production shape (absent/"false" + an allowlist) this suite calls the exported Worker's own
  // `fetch()` directly with an overridden env, the same technique the CORS suite above uses for
  // production-shaped `BETTER_AUTH_URL`/`CORS_ALLOWED_ORIGINS`.
  function withEnv(overrides: Partial<Env>): Env {
    return { ...(env as unknown as Env), ...overrides };
  }

  function fakeExecutionContext(): ExecutionContext {
    return { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
  }

  async function purchase(token: string, purchaseEnv: Env) {
    return worker.fetch(
      new Request('https://example.test/api/purchase-tier', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: 'pro', source: 'dummy' }),
      }),
      purchaseEnv,
      fakeExecutionContext()
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function allowlistGrantLogs(log: { mock: { calls: unknown[][] } }) {
    return log.mock.calls.filter(([message]) => message === 'dummy purchase granted via allowlist');
  }

  it('allows the purchase when DUMMY_PURCHASE_ENABLED is "true" (local/dev)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const token = await signUp('dev-tester@example.test');
    const devEnv = withEnv({ DUMMY_PURCHASE_ENABLED: 'true', DUMMY_PURCHASE_ALLOWLIST: '' });

    const response = await purchase(token, devEnv);

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ tier: 'pro' });
    expect(allowlistGrantLogs(log)).toHaveLength(0);
  });

  it('allows an exact allowlisted email even when disabled, matching production for a trusted tester', async () => {
    const token = await signUp('Allowlisted-Tester@example.test');
    const prodShapedAllowlisted = withEnv({
      DUMMY_PURCHASE_ENABLED: undefined,
      // Mixed case and surrounding whitespace, another entry that must not match: the lookup is
      // case-insensitive/trimmed but exact, never a substring.
      DUMMY_PURCHASE_ALLOWLIST: ' allowlisted-tester@example.test , other-tester@example.test ',
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await purchase(token, prodShapedAllowlisted);

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ tier: 'pro' });

    const grants = allowlistGrantLogs(log);
    expect(grants).toHaveLength(1);
    expect(grants[0][1]).toEqual({ userId: expect.any(String) });
    expect(JSON.stringify(grants[0]).toLowerCase()).not.toContain('example.test');
  });

  it('refuses a non-allowlisted caller with 403 purchases_unavailable when disabled, matching production', async () => {
    const token = await signUp('stranger@example.test');
    const prodShaped = withEnv({ DUMMY_PURCHASE_ENABLED: undefined, DUMMY_PURCHASE_ALLOWLIST: '' });

    const response = await purchase(token, prodShaped);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'purchases_unavailable' });
  });

  it('never matches an allowlist entry as a substring', async () => {
    // "stranger@example.test" is not the same account as an allowlisted
    // "another-stranger@example.test" — a naive `.includes()` on the raw string would wrongly
    // match it.
    const token = await signUp('stranger@example.test');
    const prodShaped = withEnv({
      DUMMY_PURCHASE_ENABLED: undefined,
      DUMMY_PURCHASE_ALLOWLIST: 'another-stranger@example.test',
    });

    const response = await purchase(token, prodShaped);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'purchases_unavailable' });
  });

  it('reflects the same gate on GET /api/quota-status\'s purchasesAvailable field', async () => {
    const token = await signUp('quota-status-tester@example.test');
    const prodShaped = withEnv({ DUMMY_PURCHASE_ENABLED: undefined, DUMMY_PURCHASE_ALLOWLIST: '' });

    const response = await worker.fetch(
      new Request('https://example.test/api/quota-status', {
        headers: { authorization: `Bearer ${token}` },
      }),
      prodShaped,
      fakeExecutionContext()
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ purchasesAvailable: false });
  });
});

describe('the intake age floor', () => {
  const intake = (age: number) => ({
    goal: 'Run a faster 5K',
    age,
    experience: 'some',
    daysPerWeek: 4,
    weeklyKm: 30,
    injuries: ['none'],
    // Age 13 falls in the 13–17 guardian-consent band (captain's ruling, 2026-09-19); consent is
    // orthogonal to the age-floor behavior this test is pinning, so it is asserted unconditionally.
    guardianConsent: true,
  });

  it('rejects age 12 and accepts age 13', async () => {
    const token = await signUp('agegate@example.test');
    const put = (age: number) =>
      SELF.fetch('https://example.test/api/intake', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(intake(age)),
      });

    const rejected = await put(12);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ code: 'invalid_request' });

    const accepted = await put(13);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ saved: true });
  });
});

describe('PUT /api/intake', () => {
  /** A full, otherwise-valid IntakeResponses body — only `injuries` varies per test. */
  function intakeBody(injuries: string[]) {
    return {
      goal: 'race',
      age: 34,
      experience: 'regular',
      daysPerWeek: 4,
      weeklyKm: 30,
      raceDistance: '10k',
      injuries,
    };
  }

  async function putIntake(token: string, body: unknown) {
    return SELF.fetch('https://example.test/api/intake', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  it('accepts plantar_arch — added to the InjuryFlag union per Ian ruling 2026-08-03', async () => {
    // Regression test: the worker's INJURY_FLAGS whitelist previously omitted this flag even
    // though it is fully implemented in loadRules.ts, so a valid request was wrongly rejected.
    const token = await signUp('plantar-arch@example.test');

    const response = await putIntake(token, intakeBody(['plantar_arch']));

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual({ saved: true });
  });

  it('accepts multiple injury flags together, order notwithstanding', async () => {
    const token = await signUp('multi-injury@example.test');

    const response = await putIntake(token, intakeBody(['plantar_arch', 'knee']));

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual({ saved: true });
  });

  it('rejects "none" combined with a real injury instead of persisting contradictory state', async () => {
    const token = await signUp('contradictory-injury@example.test');

    const response = await putIntake(token, intakeBody(['none', 'knee']));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
  });

  it('rejects fractional ages before they reach D1', async () => {
    const token = await signUp('fractional-age@example.test');

    const response = await putIntake(token, { ...intakeBody(['none']), age: 17.5 });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
  });

  it('rejects impossible race dates before they reach D1', async () => {
    const token = await signUp('bad-date@example.test');

    const response = await putIntake(token, { ...intakeBody(['none']), raceDate: '2026-02-30' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
  });

  it('still rejects a flag outside the closed set with 400 invalid_request', async () => {
    // Pins that the set stays closed — this is not a validation bypass.
    const token = await signUp('bad-injury@example.test');

    const response = await putIntake(token, intakeBody(['not_a_real_flag']));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
  });
});

describe('guardian consent (13–17 intake) — captain ruling 2026-09-19', () => {
  /** A full, otherwise-valid IntakeResponses body at the given age. */
  function intakeBody(age: number, extra: Record<string, unknown> = {}) {
    return {
      goal: 'Run a faster 5K',
      age,
      experience: 'new',
      daysPerWeek: 3,
      weeklyKm: 15,
      injuries: ['none'],
      ...extra,
    };
  }

  async function putIntake(token: string, body: unknown) {
    return SELF.fetch('https://example.test/api/intake', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  async function consentRow(userId: string) {
    return env.DB.prepare(
      'SELECT granted_at, policy_version FROM guardian_consent WHERE user_id = ?'
    )
      .bind(userId)
      .first<{ granted_at: string; policy_version: string }>();
  }

  it('rejects a 13–17 intake with no guardianConsent, and persists nothing', async () => {
    const token = await signUp('minor-no-consent@example.test');

    const response = await putIntake(token, intakeBody(15));

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'invalid_request' });

    const intakeCount = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM intake_responses ir JOIN user u ON u.id = ir.user_id WHERE u.email = ?'
    )
      .bind('minor-no-consent@example.test')
      .first<{ n: number }>();
    expect(intakeCount?.n).toBe(0);
  });

  it('rejects a 13–17 intake with guardianConsent: false, and persists nothing', async () => {
    const token = await signUp('minor-false-consent@example.test');

    const response = await putIntake(token, intakeBody(16, { guardianConsent: false }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
  });

  it('accepts a 13–17 intake with guardianConsent: true and records a consent row', async () => {
    const token = await signUp('minor-consented@example.test');

    const response = await putIntake(token, intakeBody(14, { guardianConsent: true }));

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual({ saved: true });

    const user = await env.DB.prepare('SELECT id FROM user WHERE email = ?')
      .bind('minor-consented@example.test')
      .first<{ id: string }>();
    const row = await consentRow(user!.id);
    expect(row?.policy_version).toBe('2026-09-19');
    expect(row?.granted_at).toBeTruthy();
  });

  it('accepts an 18+ intake with no guardianConsent field and writes no consent row', async () => {
    const token = await signUp('adult-no-consent-field@example.test');

    const response = await putIntake(token, intakeBody(34));

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual({ saved: true });

    const user = await env.DB.prepare('SELECT id FROM user WHERE email = ?')
      .bind('adult-no-consent-field@example.test')
      .first<{ id: string }>();
    const row = await consentRow(user!.id);
    expect(row).toBeNull();
  });
});
