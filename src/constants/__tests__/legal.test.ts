import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PRIVACY_POLICY_URL } from '../legal';

/**
 * The privacy policy is three files that must agree: `docs/privacy-policy.md` (the text),
 * `.github/workflows/publish-legal-pages.yml` (where it is published) and `src/constants/legal.ts`
 * (where the app sends the runner). Issue #89 was "no policy exists"; the regression this guards
 * is the quieter one — a policy that exists but is a lie: a placeholder left in, the hosted path
 * moved without the app's link following, or the controller identity edited out. V2.3's draft
 * shipped with `[DATA CONTROLLER — TBC]` behind a DO-NOT-PUBLISH guard for two months; this
 * repo's version has no guard, so the pin is a test instead.
 *
 * Deliberately NOT pinned: the policy's description of the data flows. That is prose reviewed
 * against `workers/` by a human, and a substring assertion on it would be a test of wording.
 */

const ROOT = join(__dirname, '..', '..', '..');
const policy = readFileSync(join(ROOT, 'docs', 'privacy-policy.md'), 'utf8');
const workflow = readFileSync(
  join(ROOT, '.github', 'workflows', 'publish-legal-pages.yml'),
  'utf8'
);

/** The body a reader sees — the HTML comment header is maintainer notes, not policy. */
const published = policy.replace(/<!--[\s\S]*?-->/g, '');

function workflowRunBlock(stepName: string): string {
  const lines = workflow.split('\n');
  const nameIndex = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  if (nameIndex === -1) throw new Error(`Missing workflow step: ${stepName}`);

  const runIndex = lines.findIndex(
    (line, index) => index > nameIndex && line.trim() === 'run: |'
  );
  if (runIndex === -1) throw new Error(`Missing run block for workflow step: ${stepName}`);

  const body: string[] = [];
  for (let index = runIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('      - ')) break;
    body.push(line.startsWith('          ') ? line.slice(10) : line);
  }
  return body.join('\n');
}

describe('the privacy policy the app links to', () => {
  it('names the data controller and the contact address, not placeholders', () => {
    expect(published).toContain('**Ian Qiu**');
    expect(published).toContain('**Thailand**');
    expect(published).toContain('i78979848@gmail.com');
    // V2.3's draft placeholders, and the guard that kept them off the store — none may survive
    // into a policy that is published on merge.
    expect(published).not.toMatch(/TBC|TBD|DO NOT PUBLISH|\[DATA CONTROLLER|\[CONTACT EMAIL/);
  });

  it('carries a Last updated date in ISO form', () => {
    expect(published).toMatch(/\*\*Last updated: \d{4}-\d{2}-\d{2}\*\*/);
  });

  it('states the under-18 posture: 13 and over, 13–17 with guardian consent', () => {
    expect(published).toMatch(/\*\*13 or older\*\*/);
    expect(published).toMatch(/\*\*13 to 17\*\*/);
    expect(published).toMatch(/consent of a parent or guardian/);
  });

  it('stages only the policy as a renderable Jekyll source', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'pace-legal-pages-'));
    try {
      mkdirSync(join(scratch, 'docs'));
      cpSync(join(ROOT, 'docs', 'privacy-policy.md'), join(scratch, 'docs', 'privacy-policy.md'));

      execFileSync('bash', ['-c', workflowRunBlock('Stage the policy as an otherwise-empty Jekyll source')], {
        cwd: scratch,
      });

      expect(readdirSync(join(scratch, 'legal-site')).sort()).toEqual([
        'index.html',
        'privacy-policy',
      ]);
      expect(readdirSync(join(scratch, 'legal-site', 'privacy-policy'))).toEqual(['index.md']);

      const stagedPolicy = readFileSync(
        join(scratch, 'legal-site', 'privacy-policy', 'index.md'),
        'utf8'
      );
      expect(stagedPolicy).toMatch(
        /^---\ntitle: Pace Blueprint — Privacy Policy\nlang: en\n---\n\n<!--/
      );
      expect(stagedPolicy.slice(stagedPolicy.indexOf('<!--'))).toBe(policy.replace(/\r/g, ''));

      const rootPage = readFileSync(join(scratch, 'legal-site', 'index.html'), 'utf8');
      expect(rootPage).toContain('url=privacy-policy/');
      expect(rootPage).toContain('href="privacy-policy/"');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('builds the staged source with the pinned Pages Jekyll action and uploads only its output', () => {
    expect(workflow).toContain(
      'actions/jekyll-build-pages@44a6e6beabd48582f863aeeb6cb2151cc1716697'
    );
    expect(workflow).toContain('source: ./legal-site');
    expect(workflow).toContain('destination: ./legal-site-output');
    expect(workflow).toContain(
      'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa'
    );
    expect(workflow).toMatch(/actions\/upload-pages-artifact@[\s\S]*?path: \.\/legal-site-output/);
    expect(workflow).not.toMatch(/path:\s+\.?\/?docs(?:\/|\s|$)/);
    expect(workflow).not.toContain('pandoc');
  });

  it('links the app to the exact repository Pages path', () => {
    const url = new URL(PRIVACY_POLICY_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('ianqiu979.github.io');
    expect(url.pathname).toBe('/Ai-Customized-Running-Plan-App/privacy-policy/');
    expect(workflow).toContain('legal-site/privacy-policy/index.md');
  });
});
