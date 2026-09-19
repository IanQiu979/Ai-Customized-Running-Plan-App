import { readFileSync } from 'node:fs';
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

  it('is published from the same source file the workflow renders', () => {
    expect(workflow).toContain('pandoc docs/privacy-policy.md');
    expect(workflow).toContain('- docs/privacy-policy.md');
  });

  it('links the app to the path the workflow publishes', () => {
    const url = new URL(PRIVACY_POLICY_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('ianqiu979.github.io');
    // The workflow writes `site/<path>/index.html`; Pages serves it at `/<repo>/<path>/`.
    const outputDir = /--output site\/([^/\s]+)\/index\.html/.exec(workflow)?.[1];
    expect(outputDir).toBeDefined();
    expect(url.pathname.endsWith(`/${outputDir}/`)).toBe(true);
  });
});
