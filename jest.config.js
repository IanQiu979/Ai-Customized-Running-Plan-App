/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  // QUARANTINED — GitHub issue #3 (the plan engine), tracked by issue #41.
  // These two are red-first TDD specs: they import `src/lib/planTemplates.ts` and
  // `src/lib/paceDerivation.ts`, which do not exist yet. Merged ahead of their modules by PR #2,
  // they left `main` unable to satisfy CLAUDE.md's own "clean typecheck && lint && test before
  // every commit" gate, so every branch cut from `main` inherited a red build.
  // They are excluded here (and in tsconfig.json) rather than deleted: the specs are correct and
  // assert every current coaching ruling. Deleting these two lines and getting both suites green
  // IS the plan engine's done-when — do not land the engine without doing it.
  testPathIgnorePatterns: [
    '<rootDir>/src/lib/__tests__/planTemplates.golden.test.ts',
    '<rootDir>/src/lib/__tests__/paceDerivation.test.ts',
    // Local agent worktrees are full copies of the repo; without this, every suite runs once per
    // worktree and their (stale) copies of the quarantined specs fail the run.
    '<rootDir>/.claude/worktrees/',
  ],
  // Node resolves these packages as ESM; Jest needs them transformed like app code.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|react-native-url-polyfill))',
  ],
};
