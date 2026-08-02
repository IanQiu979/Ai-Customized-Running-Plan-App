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
    ],
  }
]);
