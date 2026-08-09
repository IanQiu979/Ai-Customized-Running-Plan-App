/**
 * Google OAuth registration — the seam that decides whether `signIn.social({ provider: 'google' })`
 * can work at all.
 *
 * WHY THIS FILE EXISTS: on 2026-08-09 Google sign-in was reported dead in the app. The deployed
 * Worker answered every `POST /api/auth/sign-in/social` with `PROVIDER_NOT_FOUND`, because
 * `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` had never been set on it. Nothing in the suite
 * distinguished "provider deliberately absent" from "provider silently failed to register", so the
 * regression was invisible to `npm --prefix workers test` and stayed invisible until a human tried
 * to log in. These tests pin both halves of that contract.
 *
 * They drive `createAuth(env).handler(...)` directly rather than `SELF.fetch`, because the point is
 * to vary the credential env per case — `SELF` is fixed to `wrangler.toml` plus the vitest config's
 * bindings and cannot express "the same Worker, with Google configured".
 *
 * NO NETWORK IS INVOLVED, even in the configured case: better-auth builds Google's authorization
 * URL from hardcoded endpoints and returns it to the caller. The browser redirect, the code
 * exchange, and Google's own `redirect_uri` check all happen past this boundary and are not
 * testable offline — which is exactly why `workers/README.md` documents the redirect URIs by hand.
 */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createAuth } from '../src/auth';
import type { Env } from '../src/env';

/** A dummy pair. Shaped like Google's real values so a reader doesn't mistake them for real ones. */
const FAKE_CLIENT_ID = '000000000000-testonlytestonlytestonly.apps.googleusercontent.com';
const FAKE_CLIENT_SECRET = 'TEST-ONLY-not-a-real-google-secret';

function withEnv(overrides: Partial<Env>): Env {
  return { ...(env as unknown as Env), ...overrides };
}

/** The exact call `src/app/(auth)/sign-in.tsx`'s "Continue with Google" button makes. */
function signInSocial(authEnv: Env): Promise<Response> {
  return createAuth(authEnv).handler(
    new Request('https://example.test/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
    })
  );
}

describe('Google provider registration', () => {
  it('is absent, and says so honestly, when neither credential is set', async () => {
    const response = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
  });

  it('registers, and hands back a Google authorization URL, when both credentials are set', async () => {
    const response = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: FAKE_CLIENT_ID, GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as { url?: string; redirect?: boolean };
    expect(body.url).toBeTruthy();

    // The URL is the whole point: it proves the provider was built from *these* credentials, and
    // that the callback better-auth will ask Google to return to is derived from BETTER_AUTH_URL.
    const authorizeUrl = new URL(body.url as string);
    expect(authorizeUrl.origin).toBe('https://accounts.google.com');
    expect(authorizeUrl.searchParams.get('client_id')).toBe(FAKE_CLIENT_ID);
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      `${env.BETTER_AUTH_URL}/api/auth/callback/google`
    );
  });

  it('treats one-of-two credentials as not configured rather than half-registering', async () => {
    // A half-configured provider is worse than an absent one: it would register and then fail at
    // the token exchange with `invalid_client`, which reads like a revoked secret.
    const idOnly = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: FAKE_CLIENT_ID, GOOGLE_CLIENT_SECRET: undefined })
    );
    expect(await idOnly.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });

    const secretOnly = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET })
    );
    expect(await secretOnly.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
  });

  it('treats blank and whitespace-only credentials as absent', async () => {
    // `.dev.vars` routinely carries a bare `GOOGLE_CLIENT_ID=` line, which arrives as ''.
    const blank = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })
    );
    expect(await blank.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });

    // And `wrangler secret put` reads stdin, so a pasted value routinely carries a newline.
    const whitespace = await signInSocial(
      withEnv({ GOOGLE_CLIENT_ID: '  \n', GOOGLE_CLIENT_SECRET: '\t\n' })
    );
    expect(await whitespace.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
  });

  it('strips whitespace around credentials instead of sending it to Google', async () => {
    // Untrimmed, `"<id>\n"` is truthy, so the provider registers and fails much later and much
    // less legibly. The authorize URL is where that stray byte would first become visible.
    const response = await signInSocial(
      withEnv({
        GOOGLE_CLIENT_ID: `\n${FAKE_CLIENT_ID}\n`,
        GOOGLE_CLIENT_SECRET: `  ${FAKE_CLIENT_SECRET}  `,
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(new URL(body.url).searchParams.get('client_id')).toBe(FAKE_CLIENT_ID);
  });
});

describe('the OAuth return path into the app', () => {
  it('trusts the app deep-link scheme, so an Expo callbackURL is not rejected as an untrusted origin', async () => {
    // `@better-auth/expo/client` rewrites `callbackURL: '/'` into `paceblueprint:///` before the
    // request leaves the device. If APP_SCHEME ever stops reaching `trustedOrigins`, better-auth
    // answers 403 INVALID_CALLBACK_URL and the round trip dies on the way *out*, before Google is
    // ever reached — a failure that looks nothing like a credential problem.
    const response = await createAuth(
      withEnv({ GOOGLE_CLIENT_ID: FAKE_CLIENT_ID, GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET })
    ).handler(
      new Request('https://example.test/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: 'paceblueprint:///' }),
      })
    );

    expect(response.status).toBe(200);
  });

  it('still rejects a callbackURL that is neither the app scheme nor the Worker origin', async () => {
    const response = await createAuth(
      withEnv({ GOOGLE_CLIENT_ID: FAKE_CLIENT_ID, GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET })
    ).handler(
      new Request('https://example.test/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: 'https://evil.example/steal' }),
      })
    );

    expect(response.status).toBe(403);
  });
});
