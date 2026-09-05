const { execFileSync } = require('node:child_process');

// Expo Router's generated declarations are gitignored, but `tsc` includes them. A clean checkout
// can otherwise typecheck against stale route types left by an older dev-server run. Generate the
// declarations deterministically before `tsc`. `expo-router/build/typed-routes`'s
// `regenerateDeclarations` was a private API that SDK 55 removed without replacement (verified:
// gone from the installed package, not renamed); Expo's own docs
// (https://docs.expo.dev/router/reference/typed-routes/) document `expo customize tsconfig.json`
// as the supported way to generate these types on CI without starting the dev server. Stdin is
// closed so the command can't block on the "overwrite tsconfig.json?" prompt it would otherwise
// print when tsconfig.json already exists — verified it then exits 0, leaves tsconfig.json
// untouched, and still writes .expo/types/router.d.ts.
execFileSync('npx', ['expo', 'customize', 'tsconfig.json'], {
  stdio: ['ignore', 'inherit', 'inherit'],
});
