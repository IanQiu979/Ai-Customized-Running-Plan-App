const path = require('node:path');

// Expo Router's generated declarations are gitignored, but `tsc` includes them. A clean checkout
// can otherwise typecheck against stale route types left by an older dev-server run. Generate the
// declarations deterministically before `tsc`, using the exact SDK-54 router package installed in
// this project.
process.env.EXPO_ROUTER_APP_ROOT = path.resolve('src/app');
const { regenerateDeclarations } = require('expo-router/build/typed-routes');

regenerateDeclarations(path.resolve('.expo/types'));
