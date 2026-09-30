# Age Assurance and Guardian Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-authoritative age assurance to every new account, with atomic minor consent and a first-use OAuth gate, while grandfathering existing users.

**Architecture:** better-auth writes canonical assurance fields on the `user` row. D1 triggers validate the write-once tuple and insert minor consent within the same SQLite statement. The central Worker dispatch blocks pending OAuth users, and a shared Blueprint choice component serves email signup and the authenticated first-use overlay.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, better-auth 1.6.25, Cloudflare Workers, D1/SQLite, Jest, Vitest/workerd.

**Spec:** `docs/superpowers/specs/2026-10-01-age-assurance-design.md`

## Global Constraints

- The V2.3 repo at `/Users/Guestyyyyyyyy/firstmate/projects/running-form-v2.3` is read-only.
- Existing accounts with no age band remain usable as `grandfathered`.
- `13_17` requires literal `guardianConsent: true`; unknown values including `under_13` are refused.
- Policy version is server-owned and comes only from `PRIVACY_POLICY_VERSION`.
- Pending users may access only auth/sign-out, age assurance, and account deletion; every other app route returns `403 age_assurance_required`.
- Do not touch billing, Sign in with Apple, or dummy-purchase availability.
- No new dependency, color token, or hand-rolled primary action.
- Production deployment and migration are captain-only and must not be run. The captain must hold
  production traffic from before migration until the new Worker is deployed and its pending gate is
  probed; the old Worker does not understand the new `pending` state.
- Tests assert behavior through public/executable interfaces, never by grepping implementation source.
- Per `AGENTS.md`, implementation agents do not commit; `verifier` runs both gates and `github-ops` owns the final commit/PR operation.

---

### Task 1: Shared contract and atomic D1 schema

**Files:**
- Create: `src/lib/ageAssurance.ts`
- Create: `src/lib/__tests__/ageAssurance.test.ts`
- Create: `workers/migrations/0005_age_assurance.sql`
- Modify: `workers/tsconfig.json`
- Test: `workers/test/worker.test.ts`

**Interfaces:**
- Produces: `AgeBand`, `AgeAssuranceStatus`, `AgeBandChoice`, `parseAgeBandChoice(raw)`, `selectionOf(band, guardianConsent)`, and `requiresLegacyIntakeConsent(status, age)`.
- Produces physical columns `user.age_band`, `user.age_assurance_status`, and `user.age_policy_version` mapped by Task 2.
- Reuses `guardian_consent(user_id, granted_at, policy_version)` from migration `0004`.

- [ ] **Step 1: Write the shared-contract tests first**

Cover these literal outcomes:

```ts
expect(parseAgeBandChoice({ ageBand: '18_plus' })).toEqual({
  ok: true,
  choice: { ageBand: '18_plus', guardianConsent: false },
});
expect(parseAgeBandChoice({ ageBand: '13_17', guardianConsent: true })).toEqual({
  ok: true,
  choice: { ageBand: '13_17', guardianConsent: true },
});
expect(parseAgeBandChoice({})).toMatchObject({ ok: false, code: 'age_band_required' });
expect(parseAgeBandChoice({ ageBand: 'under_13' })).toMatchObject({
  ok: false,
  code: 'age_band_required',
});
expect(parseAgeBandChoice({ ageBand: '13_17', guardianConsent: false })).toMatchObject({
  ok: false,
  code: 'guardian_consent_required',
});
expect(requiresLegacyIntakeConsent('grandfathered', 16)).toBe(true);
expect(requiresLegacyIntakeConsent('recorded', 16)).toBe(false);
```

- [ ] **Step 2: Run the focused Jest suite and observe RED**

Run: `npm test -- --runInBand src/lib/__tests__/ageAssurance.test.ts`

Expected: FAIL because `ageAssurance.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure contract**

Use exact wire values `18_plus`, `13_17`, `pending`, `recorded`, and `grandfathered`. The parser
must return named refusal codes and normalize adult consent to `false`.

- [ ] **Step 4: Add the D1 migration**

The migration must:

```sql
ALTER TABLE user ADD COLUMN age_band TEXT;
ALTER TABLE user ADD COLUMN age_assurance_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user ADD COLUMN age_policy_version TEXT;
UPDATE user SET age_assurance_status = 'grandfathered';
```

Add update validation triggers for the four persisted tuples. The insert trigger permits pending
and recorded tuples but rejects a newly supplied `grandfathered` tuple; only the migration backfill
may create that state. Add an immutable transition trigger that permits only
`pending -> recorded`, and `AFTER INSERT` / `AFTER UPDATE` consent triggers for `13_17`. Consent
insertion uses `NEW.id`, a UTC timestamp, and `NEW.age_policy_version` with plain `INSERT`
semantics.

- [ ] **Step 5: Prove migration defaults and trigger rollback in real D1**

The Worker harness applies all migrations before tests and exposes one D1 binding, so do not fake a
backfill test by grepping SQL or inserting a grandfathered row after migration. Assert a new default
row is pending, a new explicit grandfathered row is rejected, invalid tuples fail, and the
grandfathered persisted tuple behaves correctly in later route tests. Install a test-only
`BEFORE INSERT ON guardian_consent ... RAISE(ABORT)` trigger and assert an attempted recorded-minor
user insert leaves no user or consent row. Migration review must separately confirm that the
backfill statement precedes trigger creation.

- [ ] **Step 6: Run focused tests GREEN**

Run:

```sh
npm test -- --runInBand src/lib/__tests__/ageAssurance.test.ts
(cd workers && npm test -- --run workers/test/worker.test.ts)
```

- [ ] **Step 7: Leave the verified diff uncommitted**

The controller records the task review; `github-ops` commits only after the full verifier gate.

### Task 2: Enforce age assurance inside better-auth signup

**Files:**
- Create: `workers/src/age-assurance.ts`
- Create: `workers/test/age-assurance.test.ts`
- Modify: `workers/src/auth.ts`
- Modify: `workers/test/worker.test.ts`
- Modify: `workers/test/auth-email.test.ts`

**Interfaces:**
- Consumes `parseAgeBandChoice` and `PRIVACY_POLICY_VERSION`.
- Produces additional session user fields `ageBand` and `ageAssuranceStatus`.
- Produces named auth refusal codes `AGE_BAND_REQUIRED` and `GUARDIAN_CONSENT_REQUIRED`.

- [ ] **Step 1: Write failing pure and full-pipeline tests**

Tests must show:

- missing, unknown, and `under_13` bands fail before any user/account/session row exists;
- `13_17` without true consent fails identically for a new and existing email;
- adult signup records the canonical adult tuple and no consent row;
- minor signup records the server policy version and exactly one consent row;
- spoofed status/policy fields are rejected;
- `/api/auth/update-user` cannot mutate any assurance field;
- a failing consent trigger rolls the email user's outer insert back, leaving all auth tables empty;
- OAuth user creation is pending while linking OAuth to an existing user preserves its state.

- [ ] **Step 2: Run focused Worker tests RED**

Run: `(cd workers && npm test -- --run test/age-assurance.test.ts test/worker.test.ts test/auth-email.test.ts)`

- [ ] **Step 3: Implement the canonical resolver**

The resolver accepts exact endpoint path, parsed request body, and candidate user data. Only
`/sign-up/email` may become recorded during create. Null context and every other path become
`pending / NULL / NULL`.

- [ ] **Step 4: Add uniform pre-handler validation**

Register a better-auth `hooks.before` matcher for exact `/sign-up/email`. Parse the request before
duplicate-email handling and throw a `BAD_REQUEST` `APIError` with the parser's named code.

- [ ] **Step 5: Add additional fields and database hooks**

Configure:

```ts
user: {
  additionalFields: {
    ageBand: { type: 'string', required: false, fieldName: 'age_band' },
    ageAssuranceStatus: {
      type: 'string', required: true, defaultValue: 'pending', input: false,
      fieldName: 'age_assurance_status',
    },
    agePolicyVersion: {
      type: 'string', required: false, input: false, returned: false,
      fieldName: 'age_policy_version',
    },
  },
},
```

The create hook stamps canonical fields. The update hook rejects data containing any assurance
field. Database triggers remain the non-bypassable backstop.

- [ ] **Step 6: Update unrelated signup fixtures with adult assurance**

Every helper whose purpose is not age testing submits `ageBand: '18_plus'` and
`guardianConsent: false`, preserving its prior behavioral scope.

- [ ] **Step 7: Run focused Worker tests GREEN**

Run the Task 2 command again and confirm all specified tests pass.

- [ ] **Step 8: Leave the verified diff uncommitted**

The controller records the task review; `github-ops` commits only after the full verifier gate.

### Task 3: Add the OAuth write-once route, central gate, and intake reconciliation

**Files:**
- Modify: `workers/src/lib/store.ts`
- Modify: `workers/src/routes.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/src/http.ts`
- Modify: `src/lib/apiErrors.ts`
- Modify: `workers/test/store.test.ts`
- Modify: `workers/test/worker.test.ts`

**Interfaces:**
- Produces `POST /api/age-assurance` with `{ ageBand, guardianConsent }` and response
  `{ ageBand, guardianConsentRecorded }`.
- Produces `403 { code: 'age_assurance_required' }` for every ordinary app route used by pending
  sessions.
- Produces store methods to read and conditionally record assurance by authenticated `userId`.

- [ ] **Step 1: Write failing store and Worker tests**

Cover anonymous refusal, caller-id binding, adult/minor recording, missing consent, server policy
stamp, identical retry, conflicting retry, concurrent choices with one winner, trigger rollback,
ordinary-route refusal, deletion allowance, recorded/grandfathered access, recorded-minor intake
without a second consent, grandfathered-minor intake with consent, and adult-band/minor-age refusal.

- [ ] **Step 2: Run focused Worker tests RED**

Run: `(cd workers && npm test -- --run test/store.test.ts test/worker.test.ts)`

- [ ] **Step 3: Implement store read and conditional record**

The update binds the verified `userId` and includes
`WHERE id = ? AND age_assurance_status = 'pending'`. After a zero-row update, reread and classify
identical recorded choice, conflicting recorded choice, grandfathered, or missing. Do not accept a
user id or policy version from the request body.

- [ ] **Step 4: Implement the route and central gate**

After session verification and before ordinary dispatch:

```ts
if (session.user.ageAssuranceStatus === 'pending') {
  if (request.method === 'POST' && path === '/api/age-assurance') {
    return handleRecordAgeAssurance(request, userId, deps);
  }
  if (request.method === 'POST' && path === '/api/delete-account') {
    return handleDeleteAccount(request, userId, deps);
  }
  return fail(403, 'age_assurance_required', 'Choose your age range before using Pace Blueprint.');
}
```

The age route is authenticated for every state; recorded identical retries succeed, conflicting
choices return `409`, and grandfathered accounts cannot be rewritten.

- [ ] **Step 5: Make intake assurance-aware**

Use authoritative stored status/band. Recorded minors skip the intake consent write. Recorded
adults cannot submit an age below 18. Grandfathered minors keep the current checkbox and atomic
intake/consent batch. Pending users never reach the handler.

- [ ] **Step 6: Run focused Worker and API-error tests GREEN**

Run:

```sh
(cd workers && npm test -- --run test/store.test.ts test/worker.test.ts)
npm test -- --runInBand src/lib/__tests__/apiErrors.test.ts
```

- [ ] **Step 7: Leave the verified diff uncommitted**

The controller records the task review; `github-ops` commits only after the full verifier gate.

### Task 4: Build the signup choice and authenticated first-use gate

**Files:**
- Create: `src/components/auth/AgeBandChoice.tsx`
- Create: `src/components/auth/AgeAssuranceGate.tsx`
- Create: `src/components/auth/__tests__/AgeBandChoice.test.tsx`
- Create: `src/components/auth/__tests__/AgeAssuranceGate.test.tsx`
- Create: `src/app/(auth)/__tests__/sign-up-age-assurance.test.tsx`
- Modify: `src/app/(auth)/sign-up.tsx`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/postSignupRedirect.ts`
- Modify: `src/lib/__tests__/postSignupRedirect.test.ts`
- Create: `src/lib/__tests__/apiClient.ageAssurance.test.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/intake.tsx`
- Modify: `src/app/__tests__/intake-guardian-consent.test.tsx`
- Modify: `src/app/__tests__/root-layout-font-gate.test.tsx`

**Interfaces:**
- Consumes `selectionOf`, `AgeBandChoice`, session `ageBand`, and session
  `ageAssuranceStatus`.
- Produces a narrowly typed `signUpWithAgeAssurance` wrapper and `recordAgeAssurance` API call.
- The gate lifts only after an uncached session refresh and `$sessionSignal` notification.

- [ ] **Step 1: Write failing component and screen tests**

Assert actual roles/states and request bodies:

- both radio choices and the 13+ eligibility line render;
- the guardian checkbox appears only for `13_17`, begins false, and resets when switching away;
- signup cannot submit with no complete choice, including programmatic handler invocation;
- adult and minor signup bodies carry the normalized values;
- Google signup does not consume the email form's selection;
- pending sessions cover the full authenticated stack, hide it from accessibility, retain choice on
  failure, allow retry and sign out, and lift only after the API/session refresh succeeds;
- recorded/grandfathered sessions render the app immediately;
- recorded minors do not see/send intake consent while grandfathered minors still do.

- [ ] **Step 2: Run focused Jest suites RED**

Run (use `--runTestsByPath` because Jest otherwise interprets the parentheses in `(auth)` as a
regular-expression group and silently skips that suite):

```sh
npm test -- --runInBand --runTestsByPath \
  src/components/auth/__tests__/AgeBandChoice.test.tsx \
  src/components/auth/__tests__/AgeAssuranceGate.test.tsx \
  'src/app/(auth)/__tests__/sign-up-age-assurance.test.tsx' \
  src/app/__tests__/intake-guardian-consent.test.tsx \
  src/lib/__tests__/postSignupRedirect.test.ts \
  src/lib/__tests__/apiClient.ageAssurance.test.ts
```

- [ ] **Step 3: Implement the controlled Blueprint choice**

Use `accessibilityRole="radiogroup"`, radio roles/states, a separate checkbox role/state, existing
theme spacing and typography, and the existing privacy-policy opener. Legal text wraps and exposes
a visible opener failure. The component owns no submit rule or network request.

- [ ] **Step 4: Add the typed client wrappers**

The signup wrapper sends the ordinary better-auth fields plus `ageBand` and
`guardianConsent`. `recordAgeAssurance` uses `apiFetch`, then calls `getSession()` with better-auth
1.6.25's supported `query: { disableCookieCache: true }`, verifies the refreshed user is recorded
with the returned band, and only then notifies `$sessionSignal`. `SessionUser` includes nullable
`ageBand` and the three-state status.

- [ ] **Step 5: Update signup and root routing**

Signup keeps its current verification and post-signup behavior, but both button and handler require
a complete age choice. Google remains independent and becomes pending server-side when new. Wrap
the entire authenticated stack in `AgeAssuranceGate`. Do not consume the post-signup intake redirect
while the session status is pending. Persist the web Google one-shot redirect intent in same-tab
session storage across the full-page OAuth navigation, retain it through the pending gate, and
clear it on failed OAuth, explicit sign-out, or account change.

- [ ] **Step 6: Reconcile intake rendering**

Only a grandfathered 13-17 exact age renders and sends the existing guardian checkbox. Unknown
metadata takes the grandfathered path. Worker errors still prevent plan generation.

- [ ] **Step 7: Run focused suites GREEN**

Run the Task 4 command plus:

```sh
npm test -- --runInBand src/app/__tests__/root-layout-font-gate.test.tsx
```

- [ ] **Step 8: Leave the verified diff uncommitted**

The controller records the task review; `github-ops` commits only after the full verifier gate.

### Task 5: Align policy, operational docs, and final gates

**Files:**
- Modify: `src/constants/legal.ts`
- Modify: `src/constants/__tests__/legal.test.ts`
- Modify: `docs/privacy-policy.md`
- Modify: `docs/architecture.md`
- Modify: `docs/mvp-progress.md`
- Modify: `docs/change_log.md`
- Modify: `workers/README.md`
- Modify: `docs/google-oauth-runbook.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- `PRIVACY_POLICY_VERSION` equals the policy's `Last updated` date: `2026-10-01`.
- PR handoff explicitly requires a Cloudflare maintenance/traffic gate, production migration,
  `wrangler deploy --env production`, a pending-account refusal probe, and only then reopening
  traffic; none is executed here.

- [ ] **Step 1: Update the policy and version together**

State that account creation asks a band, email signup does not complete before the server records
it, Google asks once on first use, minors require a guardian attestation, under-13 is not offered,
the exact intake age remains a coaching input, and account deletion removes the consent record.
Do not claim guardian identity verification.

- [ ] **Step 2: Update architecture and operational documentation**

Document the three user columns, triggers, central pending gate, route contract, grandfathering,
legacy intake behavior, rollout ordering, and captain-only deployment. State explicitly that the
old Worker does not fail closed on a new pending row, so production traffic must be held between
migration and verified Worker deployment. Record issue #95 as implemented but not live until the
gated migration/deploy/client release and legal Pages publication.

- [ ] **Step 3: Run both complete project gates**

Run exactly:

```sh
npm run typecheck && npm run lint && npm test
(cd workers && npm run typecheck && npm test)
```

Expected: clean exit for both projects; existing suites remain green.

- [ ] **Step 4: Hand the clean diff to review and shipping agents**

Run security/privacy/code review, apply reviewed fixes through the responsible implementation
agent, rerun both gates with `verifier`, then use `github-ops` for the commit. The no-mistakes
pipeline owns push, PR creation, and CI after Firstmate instructs it.
