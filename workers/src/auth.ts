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
     * for the email/password path; required once Google OAuth is provisioned.
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
 * Google OAuth, if and only if both halves of the credential are present.
 *
 * TODO (captain): Google sign-in is configured but NOT provisioned. Nothing here can be finished
 * without values only the captain can create, and fabricating them would produce a build that
 * looks wired and fails at the consent screen. What is needed:
 *
 *   1. A Google Cloud project → APIs & Services → Credentials → OAuth 2.0 Client ID (type "Web
 *      application"). Note that this is a *web* client even for a mobile app, because the OAuth
 *      round trip terminates at this Worker, not in the app.
 *   2. Its authorized redirect URI set to `${BETTER_AUTH_URL}/api/auth/callback/google` — for
 *      local work that is `http://localhost:8787/api/auth/callback/google`.
 *   3. `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`
 *      (and the same two keys in `workers/.dev.vars` for local runs).
 *   4. `APP_SCHEME` in `wrangler.toml` confirmed against the app's real scheme — it was renamed to
 *      `paceblueprint://` on 2026-07-12 and has not been verified against a built app since.
 *
 * Until then this returns `{}` and only email/password is available. That is a working sign-in
 * path, not a broken one, which is why it is safe to ship in this state.
 */
function buildSocialProviders(env: Env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return {};
  }

  return {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  };
}
