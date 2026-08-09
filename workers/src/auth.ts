/**
 * better-auth, wired to D1.
 *
 * WHY THIS IS A FACTORY AND NOT A MODULE-LEVEL SINGLETON: a Worker has no `process.env` at module
 * scope. Bindings (`env.DB`) and secrets only exist inside a request's `env`, so the auth instance
 * must be built per request. That is cheap — better-auth's constructor is configuration, not I/O —
 * and it is the documented pattern for Workers.
 *
 * WHY NO EXPLICIT KYSELY DIALECT: better-auth 1.6.25's Kysely adapter detects a `D1Database` by
 * structural typing (`'batch' in db && 'exec' in db && 'prepare' in db`) and selects its own
 * bundled `D1SqliteDialect` — verified by reading
 * `node_modules/@better-auth/kysely-adapter/dist/index.mjs` in the installed version, not from
 * memory. Passing `env.DB` straight through is therefore the supported path, and adding
 * `kysely-d1` on top would be a second, competing dialect. If better-auth is upgraded, re-check
 * that detection branch still exists before assuming this still holds.
 *
 * TABLE OWNERSHIP: better-auth owns `user`, `session`, `account`, and `verification`
 * (`migrations/0001_better_auth.sql`). Application data lives in its own tables keyed to
 * `user.id`, never as extra columns on `user` — see `migrations/0002_app_schema.sql`.
 */

import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

import type { Env } from './env';

/**
 * Everything after `/api/auth` is better-auth's: sign-up, sign-in, sign-out, session, OAuth
 * callbacks. The app's own routes live outside this prefix.
 */
export const AUTH_BASE_PATH = '/api/auth';

/**
 * Inferred from `createAuth` rather than written as `ReturnType<typeof betterAuth>`: better-auth's
 * return type is generic in the exact options object it was given, so the un-parameterised form is
 * a *different*, incompatible type — annotating with it is a type error, not a widening.
 */
export type Auth = ReturnType<typeof createAuth>;

export function createAuth(env: Env) {
  if (!env.BETTER_AUTH_SECRET) {
    // Loud, at the door. A missing signing secret must never degrade into unsigned sessions.
    throw new Error(
      'BETTER_AUTH_SECRET is not set. Local: add it to workers/.dev.vars (see .dev.vars.example). ' +
        'Production: wrangler secret put BETTER_AUTH_SECRET'
    );
  }

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,

    /**
     * The Expo app returns from an OAuth round trip through its own deep-link scheme, which is not
     * an http origin better-auth would trust by default.
     */
    trustedOrigins: [env.BETTER_AUTH_URL, env.APP_SCHEME].filter(Boolean),

    emailAndPassword: {
      enabled: true,
      /**
       * FALSE ON PURPOSE, and this is a decision with a date on it rather than a default left
       * alone: turning it on requires an email sender, and this Worker has none — better-auth
       * would mint a verification token and drop it on the floor, locking out every new account.
       * `planning/03-engineering-requirements.md` "Tech stack" plans a real transactional sender
       * (Resend/Postmark) before public launch; verification turns on in the same change that
       * lands one, not before.
       */
      requireEmailVerification: false,
      minPasswordLength: 8,
    },

    socialProviders: buildSocialProviders(env),

    /**
     * REQUIRED, not optional polish. Out of the box better-auth authenticates with a cookie, and a
     * React Native client has no cookie jar in the browser sense — the session token comes back in
     * the sign-in response and is replayed as `Authorization: Bearer <token>`. Without this plugin
     * `api.getSession()` ignores that header entirely and every app route answers 403 to a user who
     * just signed in successfully, which is exactly what `test/worker.test.ts`'s end-to-end sign-up
     * test caught.
     *
     * `expo()` is the server half of `@better-auth/expo`: it trusts the Expo dev client's
     * `exp://` origin, rewrites the `origin` header from `expo-origin` (native fetch does not
     * send a browser `Origin` header better-auth's default check can read), and redirects an
     * OAuth callback into the app's own deep-link scheme instead of a browser location. A no-op
     * for the email/password path; required for Google OAuth, which as of 2026-08-09 is still
     * pending the captain's `wrangler secret put --env production` (see `buildSocialProviders`).
     */
    plugins: [bearer(), expo()],

    advanced: {
      // Secure cookies only over https, so `wrangler dev` on plain http still works. Cross-domain
      // cookie settings are deliberately absent — the client authenticates by Bearer token, above.
      useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
    },
  });
}

/**
 * Google OAuth, if and only if both halves of the credential are present and non-blank.
 *
 * WHY THIS RETURNS `{}` RATHER THAN THROWING: an absent Google credential is a degraded sign-in
 * screen, not a broken Worker — email/password still works, so refusing to boot would turn a
 * partial outage into a total one. The cost is that the failure is quiet, and it has already been
 * paid once: on 2026-08-09 the deployed Worker answered every `POST /api/auth/sign-in/social` with
 * `{"code":"PROVIDER_NOT_FOUND"}` because `wrangler secret put GOOGLE_CLIENT_ID --env production`
 * had never been run. The app renders that as "Google sign-in isn't available yet." (see
 * `src/app/(auth)/sign-in.tsx`), which is honest but looks identical to a bug. If Google sign-in
 * is reported broken, `curl -X POST <origin>/api/auth/sign-in/social -d '{"provider":"google"}'`
 * is the one-command test: `PROVIDER_NOT_FOUND` means the secrets are missing on *that* Worker.
 *
 * WHY `.trim()`, AND WHY BLANK COUNTS AS ABSENT: `wrangler secret put` reads from stdin, and a
 * pasted value routinely carries a trailing newline; `.dev.vars` just as routinely carries a
 * `KEY=` line with nothing after it. Untrimmed, `"<id>\n"` is truthy, so the provider registers
 * and *then* fails much later and much less legibly — Google answers the token exchange with
 * `invalid_client`, which reads like a revoked credential rather than a stray byte. Trimming
 * turns both cases into the one diagnosis this function already reports clearly.
 *
 * The redirect URI registered on the Google OAuth client must match the Worker's origin exactly:
 * `http://localhost:8787/api/auth/callback/google` for `wrangler dev`, and the
 * `[env.production.vars] BETTER_AUTH_URL` origin + `/api/auth/callback/google` for production.
 * Both have to be listed on the same client, or whichever is missing fails with
 * `redirect_uri_mismatch`. See `workers/README.md`'s "What the captain has to do".
 */
function buildSocialProviders(env: Env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {};
  }

  return {
    google: { clientId, clientSecret },
  };
}
