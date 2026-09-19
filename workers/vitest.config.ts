import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * Tests run inside a real `workerd` with a real D1, via Miniflare — the same runtime `wrangler dev`
 * uses, entirely offline and with no Cloudflare account. That matters more here than usual: the
 * quota gate's whole correctness argument is "SQLite serializes writes, so a conditional INSERT is
 * atomic" (see `migrations/0002_app_schema.sql`). An argument about SQLite's behaviour has to be
 * tested against SQLite, not against a hand-written fake that would agree with whatever the test
 * author already believed.
 *
 * API NOTE: `@cloudflare/vitest-pool-workers` 0.20 (Vitest 4) exposes `cloudflareTest()` as a Vite
 * plugin. The older `defineWorkersConfig` from `.../config` that most tutorials still show does not
 * exist in this version — checked against the installed package's own exports map, not recalled.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  /**
   * The shared modules under `../src/lib/` sit inside the Expo app's tsconfig, which extends
   * `expo/tsconfig.base` — a package that only exists in the *root* `node_modules`. Transforming
   * them here must not depend on the app's dependency tree being installed, so the transformer is
   * given an explicit empty tsconfig instead of discovering one by walking up the filesystem.
   * (`workers/tsconfig.json` still typechecks those files properly; this only affects transform.)
   */
  oxc: { tsconfigRaw: '{}' },
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          // Handed to the setup file, which applies them into each test's isolated D1.
          TEST_MIGRATIONS: await readD1Migrations(path.join(here, 'migrations')),
          // Length matters only to better-auth's own entropy warning; it is not a real secret and
          // never leaves this file.
          BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdefghijklmnop',
          CORS_ALLOWED_ORIGINS: 'http://localhost:8081',
          // Most existing quota tests assert the permanent entitlement rules. Individual tests
          // instantiate the store with the override enabled when exercising temporary test mode.
          ALL_USERS_UNLIMITED_ACCESS: 'false',
          // Mail is always inert in tests, even when a developer has real values in `.dev.vars`.
          // This prevents outbound delivery and keeps verification opt-in behavior deterministic.
          RESEND_API_KEY: '',
          MAIL_FROM: '',
          MAIL_VERIFICATION_REQUIRED: 'false',

          /**
           * PINNED ON PURPOSE, and this is a correctness fix rather than tidiness. Wrangler loads
           * `.dev.vars` on top of `wrangler.toml [vars]`, and `.dev.vars` is gitignored — so before
           * this block, `env.BETTER_AUTH_URL` and `env.APP_SCHEME` inside the test runtime were
           * whatever the individual developer happened to have in an untracked file. Caught on
           * 2026-08-09: a worktree carrying stale values (`APP_SCHEME=http://localhost:8090`) made
           * `test/social-auth.test.ts` fail against a config no committed file describes, and would
           * equally have let a genuinely broken `trustedOrigins` pass on someone else's machine.
           * These two are non-secret by definition (they live in the committed `[vars]`), so
           * restating them here costs nothing and makes the suite say the same thing everywhere.
           */
          BETTER_AUTH_URL: 'http://localhost:8787',
          APP_SCHEME: 'paceblueprint://',
          // OAuth credentials are pinned too. Fake values are sufficient because the suite only
          // builds authorization URLs; pinning them prevents a developer's `.dev.vars` (or their
          // absence) from making "Google configured" pass locally while production is missing it.
          GOOGLE_CLIENT_ID: '000000000000-testonlytestonlytestonly.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'TEST-ONLY-not-a-real-google-secret',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
