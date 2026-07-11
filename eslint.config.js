// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      // Local agent worktrees are full copies of the repo — linting them lints everything twice.
      ".claude/worktrees/**",
      // QUARANTINED, GitHub issue #3 — see the banner in each file and jest.config.js.
      // Red-first TDD specs importing `planTemplates.ts` / `paceDerivation.ts`, neither of which
      // exists yet, so `import/no-unresolved` fires on both. Un-ignore when the engine lands.
      "src/lib/__tests__/planTemplates.golden.test.ts",
      "src/lib/__tests__/paceDerivation.test.ts",
    ],
  }
]);
