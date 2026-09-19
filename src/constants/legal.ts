/**
 * Public legal documents the app links to.
 *
 * `docs/privacy-policy.md` is the source of truth; `.github/workflows/publish-legal-pages.yml`
 * renders it to this URL on every push to `main` that touches it (issue #89). The path is the
 * repo's GitHub Pages site, so a repository rename changes it — `src/constants/__tests__/
 * legal.test.ts` pins this constant to the workflow's output path, not to the repo name.
 */
export const PRIVACY_POLICY_URL =
  'https://ianqiu979.github.io/Ai-Customized-Running-Plan-App/privacy-policy/';

/**
 * `docs/privacy-policy.md`'s "Last updated" date, stamped onto every guardian-consent event
 * (`workers/migrations/0004_guardian_consent.sql`) so a recorded consent always says which
 * revision of the policy the guardian actually saw. Whenever that "Last updated" date changes,
 * this constant must be bumped in the same commit.
 */
export const PRIVACY_POLICY_VERSION = '2026-09-19';
