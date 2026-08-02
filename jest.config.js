/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: [
    // Local agent worktrees are full copies of the repo; without this, every suite runs once per
    // worktree.
    '<rootDir>/.claude/worktrees/',
  ],
  // Node resolves these packages as ESM; Jest needs them transformed like app code.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|react-native-url-polyfill))',
  ],
};
