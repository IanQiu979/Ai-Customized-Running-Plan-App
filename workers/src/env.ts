/**
 * The Worker's binding + environment contract.
 *
 * SECRETS DISCIPLINE (CLAUDE.md "Secrets & env"). Everything on this interface that is a secret is
 * marked as such below, and every one of them arrives from `.dev.vars` locally or
 * `wrangler secret put` in production. None of them may EVER acquire an `EXPO_PUBLIC_` prefix or
 * be written into `.env` / `.env.example` at the repo root: Expo inlines `EXPO_PUBLIC_*` in plain
 * text into the compiled app bundle, so a key placed there is a published key. The Cloudflare
 * equivalent of that trap is `[vars]` in `wrangler.toml`, which is committed — hence the split.
 */

export interface Env {
  /** D1 binding, declared in `wrangler.toml`. */
  DB: D1Database;

  // --- non-secret vars, from `wrangler.toml [vars]` -------------------------------------------

  /** Public origin the Worker answers on. Used for cookie scoping and OAuth callbacks. */
  BETTER_AUTH_URL: string;
  /** The Expo app's deep-link scheme, e.g. `paceblueprint://`. A trusted OAuth return target. */
  APP_SCHEME: string;
  /** Comma-separated exact origins allowed to make credentialed browser requests. */
  CORS_ALLOWED_ORIGINS: string;
  /**
   * TEMPORARY TEST OVERRIDE. `"true"` grants every authenticated user Elite access and bypasses
   * the quota gate. Remove or set to `"false"` before real users arrive.
   */
  ALL_USERS_UNLIMITED_ACCESS?: string;

  // --- secrets, from `.dev.vars` / `wrangler secret put` ---------------------------------------

  /** SECRET. better-auth's signing key for sessions and tokens. */
  BETTER_AUTH_SECRET: string;

  /**
   * SECRET. Anthropic Messages API key, read ONLY by `lib/model.ts`'s real caller.
   *
   * Not wired to anything live yet, by design — see `lib/model.ts`. Absent in every local run and
   * in every test.
   */
  ANTHROPIC_API_KEY?: string;

  /** SECRET (the secret half). Google OAuth. Both are absent until the captain provides them. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
