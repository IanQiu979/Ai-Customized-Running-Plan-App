#!/usr/bin/env node
/**
 * Launcher for `render-coach-pack.ts`.
 *
 * The plan engines are TypeScript, and this repo deliberately carries no TS runner for scripts
 * (no `tsx`, no `ts-node` — adding one is a dependency decision). The `typescript` compiler is
 * already a devDependency, so this file registers a `.ts` loader that transpiles each module to
 * CommonJS on require, the same way `ts-node --transpile-only` would. No type checking happens
 * here — `npm run typecheck` covers `scripts/*.ts` through the root `tsconfig.json`.
 *
 *     node scripts/render-coach-pack.js               # summary table on stdout
 *     node scripts/render-coach-pack.js <out-dir>     # + one Markdown and JSON file per plan
 */
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

Module._extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

require('./render-coach-pack.ts').main(process.argv.slice(2));
