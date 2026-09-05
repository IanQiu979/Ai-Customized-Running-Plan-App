const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

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
//
// That "leaves it untouched" is the whole safety of running a command whose documented job is to
// write tsconfig.json, and today it rests only on the prompt being unanswerable. This repo's
// tsconfig.json is not the Expo template — it carries the `@/*` aliases and `"exclude": ["workers"]`
// — so a future CLI that defaults its non-TTY prompt to "yes" would silently break every `@/…`
// import and start typechecking the Workers backend. Enforce the invariant instead of assuming it:
// snapshot the file, and fail the script loudly if the command changed a byte of it.
// Resolved against cwd, exactly like the `expo customize tsconfig.json` argument below, so the
// file guarded is always the file the command would write.
const tsconfigPath = 'tsconfig.json';
const before = readFileSync(tsconfigPath);

execFileSync('npx', ['expo', 'customize', 'tsconfig.json'], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

const after = readFileSync(tsconfigPath);
if (!before.equals(after)) {
  throw new Error(
    `\`expo customize tsconfig.json\` overwrote ${tsconfigPath}. This script runs it only to ` +
      'emit .expo/types/router.d.ts and requires tsconfig.json to be left alone. Restore it with ' +
      '`git checkout -- tsconfig.json` and find another way to generate the router types.',
  );
}
