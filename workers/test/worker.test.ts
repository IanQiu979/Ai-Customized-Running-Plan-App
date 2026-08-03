/**
 * The Worker's own edges: the authentication gate, the route table, and better-auth actually
 * running against D1.
 *
 * The first block is the important one. `index.ts` authenticates once, ahead of dispatch, so that
 * no handler *can* be reached anonymously; these tests are what turn that claim into something
 * that stays true after the next route is added.
 */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

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
    ['plans', 'intake_responses', 'subscriptions', 'profiles', 'session', 'account', 'user'].map(
      (table) => env.DB.prepare(`DELETE FROM ${table}`)
    )
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
      // Free's allowance is lifetime, so there is no countdown to render.
      periodEnd: null,
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
