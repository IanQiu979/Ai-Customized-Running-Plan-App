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
      // The Cloudflare Workers backend is a separate npm project with its own dependency tree and
      // its own runtime (workerd, not React Native), so eslint-config-expo's rules do not apply to
      // it. Its gate is `npm --prefix workers run typecheck && npm --prefix workers test`.
      "workers/**",
    ],
  }
]);
