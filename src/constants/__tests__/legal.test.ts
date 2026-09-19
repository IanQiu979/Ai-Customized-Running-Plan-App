/**
 * @jest-environment node
 * @jest-environment-options {"customExportConditions": ["node"]}
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { PRIVACY_POLICY_URL, PRIVACY_POLICY_VERSION } from '../legal';

/**
 * The privacy policy is three files that must agree: `docs/privacy-policy.md` (the text),
 * `.github/workflows/publish-legal-pages.yml` (where it is published) and `src/constants/legal.ts`
 * (where the app sends the runner). Issue #89 was "no policy exists"; the regression this guards
 * is the quieter one — a policy that exists but is a lie: a placeholder left in, the hosted path
 * moved without the app's link following, or the controller identity edited out. V2.3's draft
 * shipped with `[DATA CONTROLLER — TBC]` behind a DO-NOT-PUBLISH guard for two months; this
 * repo's version has no guard, so the pin is a test instead.
 *
 * The workflow is read as what it is — a machine-consumed document: parsed into its jobs and
 * steps, the staging step's script actually executed, and the `source → destination → path`
 * chain between the Pages actions asserted on the parsed values. Nothing here matches the YAML's
 * text, so a reformat cannot fail it and a commented-out step cannot pass it.
 *
 * Deliberately NOT pinned: the policy's description of the data flows. That is prose reviewed
 * against `workers/` by a human, and a substring assertion on it would be a test of wording.
 */

const ROOT = join(__dirname, '..', '..', '..');
const REPO_PAGES_BASE = '/Ai-Customized-Running-Plan-App/';

const policy = readFileSync(join(ROOT, 'docs', 'privacy-policy.md'), 'utf8');

/** The body a reader sees — the HTML comment header is maintainer notes, not policy. */
const published = policy.replace(/<!--[\s\S]*?-->/g, '');

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Workflow {
  on: { push?: { branches?: string[]; paths?: string[] } };
  jobs: Record<string, { needs?: string; steps: WorkflowStep[] }>;
}

const workflow = parseYaml(
  readFileSync(join(ROOT, '.github', 'workflows', 'publish-legal-pages.yml'), 'utf8')
) as Workflow;

const buildSteps = workflow.jobs.build.steps;

/** The step that runs an action, identified by the action's name — its `@ref` is checked separately. */
function actionStep(action: string): WorkflowStep {
  const matches = buildSteps.filter((step) => step.uses?.startsWith(`${action}@`));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one build step using ${action}, found ${matches.length}`);
  }
  return matches[0];
}

/** The commit a `uses:` is pinned to — a full SHA, never a movable tag. */
function pinnedRef(step: WorkflowStep): string {
  const ref = step.uses?.split('@')[1] ?? '';
  expect(ref).toMatch(/^[0-9a-f]{40}$/);
  return ref;
}

function stagingScript(): string {
  const stagingSteps = buildSteps.filter((step) => typeof step.run === 'string');
  if (stagingSteps.length !== 1) {
    throw new Error(`Expected exactly one scripted build step, found ${stagingSteps.length}`);
  }
  return stagingSteps[0].run as string;
}

/** Runs the workflow's own staging script against a scratch checkout holding only the policy. */
function stagePolicy(scratch: string): void {
  mkdirSync(join(scratch, 'docs'));
  cpSync(join(ROOT, 'docs', 'privacy-policy.md'), join(scratch, 'docs', 'privacy-policy.md'));
  execFileSync('bash', ['-c', stagingScript()], { cwd: scratch });
}

function withScratch(body: (scratch: string) => void): void {
  const scratch = mkdtempSync(join(tmpdir(), 'pace-legal-pages-'));
  try {
    body(scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
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

  it('carries a Last updated date in ISO form, and that date is the recorded consent version', () => {
    const lastUpdated = published.match(/\*\*Last updated: (\d{4}-\d{2}-\d{2})\*\*/g);
    expect(lastUpdated).toHaveLength(1);
    const date = /(\d{4}-\d{2}-\d{2})/.exec(lastUpdated![0])![1];
    expect(new Date(date).toISOString().slice(0, 10)).toBe(date);
    // Every guardian-consent row is stamped with `PRIVACY_POLICY_VERSION`; a policy revision the
    // constant did not follow would record consent against text the guardian never saw.
    expect(PRIVACY_POLICY_VERSION).toBe(date);
  });

  it('states the under-18 posture: 13 and over, 13–17 with guardian consent', () => {
    expect(published).toMatch(/\*\*13 or older\*\*/);
    expect(published).toMatch(/\*\*13 to 17\*\*/);
    expect(published).toMatch(/consent of a parent or guardian/);
  });

  it('publishes from main only, and only when the policy or the workflow itself changes', () => {
    expect(workflow.on.push?.branches).toEqual(['main']);
    expect(workflow.on.push?.paths).toEqual([
      'docs/privacy-policy.md',
      '.github/workflows/publish-legal-pages.yml',
    ]);
    expect(workflow.jobs.deploy.needs).toBe('build');
  });

  it('stages only the policy as a renderable Jekyll source', () => {
    withScratch((scratch) => {
      stagePolicy(scratch);

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
    });
  });

  it('renders the staged directory with the SHA-pinned Pages Jekyll action and uploads only its output', () => {
    const jekyll = actionStep('actions/jekyll-build-pages');
    const upload = actionStep('actions/upload-pages-artifact');
    pinnedRef(jekyll);
    pinnedRef(upload);
    pinnedRef(actionStep('actions/checkout'));
    pinnedRef(actionStep('actions/configure-pages'));

    // The chain: the script stages into a directory, Jekyll renders that directory into another,
    // and only the rendered one is uploaded — so `/docs` (every internal doc) is never published.
    const source = jekyll.with?.source;
    const destination = jekyll.with?.destination;
    expect(typeof source).toBe('string');
    expect(typeof destination).toBe('string');
    expect(upload.with?.path).toBe(destination);
    expect(destination).not.toBe(source);
    for (const dir of [source, destination]) {
      expect(dir).not.toMatch(/^\.?\/?docs(\/|$)/);
    }

    withScratch((scratch) => {
      stagePolicy(scratch);
      expect(existsSync(join(scratch, source as string))).toBe(true);
      expect(existsSync(join(scratch, destination as string))).toBe(false);
    });

    expect(buildSteps.indexOf(jekyll)).toBeGreaterThan(
      buildSteps.findIndex((step) => typeof step.run === 'string')
    );
    expect(buildSteps.indexOf(upload)).toBeGreaterThan(buildSteps.indexOf(jekyll));
    expect(buildSteps.some((step) => /pandoc/.test(step.run ?? ''))).toBe(false);
  });

  it('links the app to the page the staged source renders at', () => {
    const url = new URL(PRIVACY_POLICY_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('ianqiu979.github.io');
    expect(url.pathname.startsWith(REPO_PAGES_BASE)).toBe(true);

    // Jekyll serves `<source>/<page>/index.md` at `<base>/<page>/`, so the app's URL must resolve
    // to a file the staging script actually produces.
    const pagePath = url.pathname.slice(REPO_PAGES_BASE.length);
    expect(pagePath.endsWith('/')).toBe(true);
    const source = actionStep('actions/jekyll-build-pages').with?.source as string;
    withScratch((scratch) => {
      stagePolicy(scratch);
      expect(existsSync(join(scratch, source, pagePath, 'index.md'))).toBe(true);
    });
  });
});
