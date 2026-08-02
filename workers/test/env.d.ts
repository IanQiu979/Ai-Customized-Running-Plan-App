import type { D1Migration } from 'cloudflare:test';

/**
 * Teaches the test runtime about this Worker's real bindings, plus the migrations the setup file
 * applies. Without it every `env.DB` in a test is an untyped guess, which is how a renamed binding
 * slips past the typechecker and only fails at runtime.
 *
 * `cloudflare:test`'s `env` is typed as the global `Cloudflare.Env` — the interface `wrangler types`
 * would generate — so the augmentation goes there rather than on the `ProvidedEnv` interface older
 * versions of the pool used and this one no longer has.
 *
 * The members are spelled out rather than `extends`-ed from `src/env.ts` because `Cloudflare.Env`
 * is an ambient interface merged across declarations, and a merged interface does not inherit
 * through an `extends` clause added by one of its augmentations. Keep this list in step with
 * `src/env.ts`; only the bindings tests actually touch need to appear.
 */
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      APP_SCHEME: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
