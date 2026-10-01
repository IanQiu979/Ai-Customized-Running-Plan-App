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
 * `docs/privacy-policy.md`'s "Last updated" stamp, stamped onto every guardian-consent event
 * (`workers/migrations/0004_guardian_consent.sql`) so a recorded consent always says which
 * revision of the policy the guardian actually saw. Whenever that "Last updated" line changes,
 * this constant must be bumped in the same commit. Since 2026-10-01 (issue #95) it is also the
 * `user.age_policy_version` stamped on every recorded age band (`workers/migrations/
 * 0005_age_assurance.sql`), always by the Worker and never taken from the client.
 *
 * Format: the ISO date, plus `-rN` for the Nth revision published on the same date — the line
 * reads `**Last updated: YYYY-MM-DD (revision N)**`. A bare date names that day's first revision.
 * The suffix exists because two different texts under one version string would make a consent row
 * unable to say which one was agreed to: 2026-10-01's age-assurance text (PR 131) and the same
 * day's aging-transition text are `2026-10-01` and `2026-10-01-r2`. `legal.test.ts` derives this
 * value from the published line, so the two cannot drift.
 */
export const PRIVACY_POLICY_VERSION = '2026-10-01-r2';
