const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = path.resolve(__dirname, '..', 'generate-router-types.js');

describe('generate-router-types', () => {
  let testDir;

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('restores the exact tsconfig bytes when Expo mutates it before failing', () => {
    testDir = mkdtempSync(path.join(tmpdir(), 'generate-router-types-'));
    const binDir = path.join(testDir, 'bin');
    mkdirSync(binDir);

    const originalTsconfig = Buffer.from('{\r\n  "compilerOptions": {}\r\n}\r\n');
    writeFileSync(path.join(testDir, 'tsconfig.json'), originalTsconfig);

    const npxShim = path.join(binDir, 'npx');
    writeFileSync(npxShim, '#!/bin/sh\nprintf "clobbered\\n" > tsconfig.json\nexit 17\n');
    chmodSync(npxShim, 0o755);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: testDir,
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(testDir, 'tsconfig.json'))).toEqual(originalTsconfig);
  });
});
