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
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
