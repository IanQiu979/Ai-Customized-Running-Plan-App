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
     * an http origin better-auth would trust by default. `CORS_ALLOWED_ORIGINS` is folded in here
     * too: until 2026-08-10 this list and better-auth's own `trustedOrigins` had silently drifted
     * apart — a browser origin could clear the CORS allowlist in `cors.ts` and still be rejected by
     * better-auth's *own* origin/CSRF check (`INVALID_ORIGIN`), because that check never read
     * `CORS_ALLOWED_ORIGINS` at all. Reproduced against production 2026-08-10 by sending a real
     * `Origin` header on `sign-up/email`. One list, not two, going forward.
     *
     * NOTE this fold is necessary but was, by itself, NOT SUFFICIENT to fix the production repro:
     * `index.ts`'s `fetch()` runs `normalizeAllowedBrowserOrigin()` (`cors.ts`) ahead of dispatch,
     * which rewrites any browser `Origin` already inside `CORS_ALLOWED_ORIGINS` to `BETTER_AUTH_URL`
     * before better-auth ever sees it — so for a request that reaches better-auth through the normal
     * Worker entry point, this fold only matters for an origin `normalizeAllowedBrowserOrigin` did
     * NOT rewrite, i.e. one that was never in `CORS_ALLOWED_ORIGINS` to begin with. The actual
     * production repro (`http://localhost:8081`, from `npm run web` against the deployed Worker per
     * the client's `.env`) was failing because `[env.production.vars] CORS_ALLOWED_ORIGINS` in
     * `wrangler.toml` listed only the deployed origin itself, not the local web dev origins — fixed
     * there, alongside this fold, in the same change.
     *
     * `'exp://'` is trusted unconditionally, not just in dev: `@better-auth/expo`'s own `expo()`
     * plugin (`node_modules/@better-auth/expo/dist/index.js`) already adds it automatically, but
     * only `if (process.env.NODE_ENV === 'development')` — and Wrangler's esbuild bundling replaces
     * that literal with `'production'` for `wrangler deploy` (`'development'` only for `wrangler
     * dev`), so the plugin's own exp:// trust is silently absent from every deployed Worker. Expo Go
     * (the only way to run this app on a device today — no EAS dev client exists yet, see
     * `docs/mvp-progress.md`) never uses the registered `paceblueprint://` scheme; `expo-linking`'s
     * `resolveScheme()` falls back to the fixed `'exp'` scheme inside Expo Go's "store client"
     * environment regardless of the `scheme` option passed to `createURL()`. Without this, Google
     * sign-in's OAuth `callbackURL` (built via `Linking.createURL('/')` in
     * `@better-auth/expo/client`) is an `exp://<lan-ip>:<port>/--/` URL that was never in
     * `trustedOrigins`, and better-auth answers `403 INVALID_CALLBACK_URL` — reproduced by reading
     * `expo-linking`'s `resolveScheme()`/`createURL()` and the plugin's `init` hook, not by device;
     * see `docs/change_log.md` 2026-08-10 for the trace.
     */
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      env.APP_SCHEME,
      'exp://',
      ...env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    ].filter(Boolean),

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

    // OAuth redirects normally turn callback failures into a browser page. Keep a structured,
    // secret-free server log as well so the token exchange — previously the only unobservable link
    // in this chain — can be diagnosed from Worker logs without exposing codes, tokens, or secrets.
    logger: {
      level: 'error',
      log(level, message, ...args) {
        if (level === 'error') console.error('better-auth error', { message, details: sanitizeAuthLog(args) });
        else if (level === 'warn') console.warn('better-auth warning', { message });
      },
    },

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

  return { google: { clientId, clientSecret } };
}

function sanitizeOAuthError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { kind: typeof error };

  const candidate = error as Error & {
    status?: number | string;
    statusCode?: number;
    code?: string;
    response?: { status?: number; statusText?: string };
  };
  return {
    name: candidate.name,
    message: redactSensitiveText(candidate.message),
    code: candidate.code,
    status: candidate.statusCode ?? candidate.status ?? candidate.response?.status,
    statusText: candidate.response?.statusText,
  };
}

function sanitizeAuthLog(args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeAuthLogValue(arg));
}

function sanitizeAuthLogValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return sanitizeOAuthError(value);
  if (typeof value === 'string') return redactSensitiveText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (depth >= 2 || typeof value !== 'object') return typeof value;

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/secret|token|cookie|authorization|code|state/i.test(key)) redacted[key] = '[redacted]';
    else redacted[key] = sanitizeAuthLogValue(child, depth + 1);
  }
  return redacted;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/(client_secret|access_token|refresh_token|id_token|code|cookie|state)=?[^\s&,]*/gi, '$1=[redacted]')
    .slice(0, 500);
}
