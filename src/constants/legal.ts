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
