# Age Assurance and Guardian Consent Design

**Date:** 2026-10-01  
**Issue:** #95  
**Status:** Approved by the launch brief; architecture reviewed before implementation

## Goal

Require every new Pace Blueprint account to record either `18_plus` or `13_17`, require a
parent/guardian attestation for `13_17`, and keep a new OAuth account unusable until the same
server-side record exists. Existing accounts remain usable without a recorded band.

## Scope

This change covers email/password signup, Google first use, D1 persistence, the central Worker
authorization boundary, the signup and first-use UI, intake compatibility, tests, and the privacy
policy. It does not change billing, Sign in with Apple, or the dummy purchase route.

The V2.3 implementation is the behavioral reference. V2.2 deliberately changes the persistence
mechanism because better-auth on D1 is not Supabase: D1 can make the age state and consent row a
single SQLite statement through a trigger, which is stronger than a follow-up write plus a
best-effort compensating delete.

## Required invariants

1. Email signup is refused before account creation unless `ageBand` is `18_plus` or `13_17`.
2. `13_17` is refused unless `guardianConsent === true`.
3. The policy version always comes from `PRIVACY_POLICY_VERSION`; the client cannot set it.
4. The new email user's assurance tuple and guardian-consent row are committed by the same SQLite
   `INSERT user` statement. If the consent trigger fails, the user insert rolls back, so no user,
   account, or session is left behind.
5. New OAuth users start `pending`. The central Worker dispatch refuses every ordinary app route
   while pending; only age assurance, sign-out/auth endpoints, and account deletion remain usable.
6. Age assurance is write-once. A retry of the winning choice is idempotent; a conflicting choice
   is rejected and cannot overwrite it. The first-use request also carries the account id the gate
   rendered (`expectedUserId` in the JSON body); the Worker compares it with the newly verified
   session before writing (`409 age_assurance_account_mismatch`), preventing a stale web tab from
   recording immutable evidence onto an account selected in another tab.
   *[Later, 2026-10-01: one exception now exists — a recorded `13_17` account may move to
   `18_plus` once, irreversibly (`workers/migrations/0006_age_transition.sql`,
   `POST /api/age-transition`). See `docs/change_log.md`, 2026-10-01 (later).]*
7. Every user row that exists when the migration runs becomes `grandfathered`. Missing age data on
   those accounts never locks them out.
8. Recorded minors are not asked for guardian consent again in intake. Grandfathered minors retain
   the existing intake-time consent flow.
9. A recorded adult account cannot submit an exact intake age below 18.
10. Deleting the account deletes the assurance and consent evidence through the existing cascade.

## Data model

The better-auth `user` row gains three app-owned columns, exposed to better-auth as additional
fields:

| Column | Logical field | Meaning |
|---|---|---|
| `age_band` | `ageBand` | `18_plus`, `13_17`, or `NULL` |
| `age_assurance_status` | `ageAssuranceStatus` | `pending`, `recorded`, or `grandfathered` |
| `age_policy_version` | `agePolicyVersion` | Server-stamped policy version for a recorded band |

The only valid tuples are:

| Status | Band | Policy version |
|---|---|---|
| `pending` | `NULL` | `NULL` |
| `grandfathered` | `NULL` | `NULL` |
| `recorded` | `18_plus` | non-empty |
| `recorded` | `13_17` | non-empty |

The migration adds the columns with a `pending` default, then updates all rows already present to
`grandfathered`. The default ensures every post-migration account has an explicit unresolved state,
but the currently deployed Worker does not understand that state. Production traffic must therefore
be held at Cloudflare for the short interval between applying the migration and deploying the new
Worker; the rollout must never describe that interval as automatically fail-closed.

Database triggers enforce tuple validity and immutability. Although `grandfathered / NULL / NULL`
is a valid persisted tuple after the migration backfill, the insert trigger rejects it: every new
row must begin pending or arrive already recorded through validated email signup. The only state
transition is `pending -> recorded` *[later, 2026-10-01: `0006_age_transition.sql` adds a
second, recorded `13_17` -> recorded `18_plus`, which archives the consent row in the same
statement]*. Separate `AFTER INSERT` and `AFTER UPDATE` triggers insert a
`guardian_consent` row for `13_17`, using `NEW.age_policy_version`. A plain `INSERT` is used:
an unexpected existing consent row is an invariant failure and must roll the outer statement back.

The `user` and `guardian_consent` writes are atomic. Better-auth's later credential-account and
session writes are separate because its D1 adapter has no interactive transaction implementation;
the design does not claim otherwise.

## Email signup flow

`ageBand` is a better-auth additional input field so it reaches the user insert. `guardianConsent`
is request-only and is read from the endpoint context; it is not stored on `user`.

Two server checks intentionally share the same parser:

- A better-auth request `hooks.before` check for `/sign-up/email` runs before duplicate-email
  handling. This prevents missing consent from becoming an account-enumeration difference.
- `databaseHooks.user.create.before` stamps the canonical `recorded` tuple for email signup. Any
  non-email/internal user creation defaults to the canonical pending tuple.

`ageAssuranceStatus` and `agePolicyVersion` are `input: false`. A user update database hook rejects
any attempt to update assurance fields through `/api/auth/update-user`, and D1 triggers provide a
second, non-bypassable write-once boundary.

## OAuth first-use flow

A new Google user is inserted with `pending`, `NULL`, `NULL`. The resulting session is valid only
for better-auth endpoints, `POST /api/age-assurance`, and `POST /api/delete-account`. The central
Worker gate returns `403 age_assurance_required` before dependency creation or ordinary route
dispatch for everything else.

The client reads `ageAssuranceStatus` from `session.user`. A modal replaces the authenticated
application stack when it is pending, presents the same two choices as signup, and always offers
sign out. The gate wraps the whole stack, including the password-reset and email-verification
token screens: a pending account is always a new OAuth account, which has no password and an
already-verified email, so neither screen has work to do for it, and signing out from the gate
restores their cold-deep-link contract. Continue calls the authenticated Worker route with the
gate-rendered account id as a precondition. On success the client performs
an uncached session read, verifies the same account id, notifies better-auth's session signal, and
only then lifts the modal.

The route binds the update target only from the verified session. Before writing it compares the
client's `expectedUserId` body field with that verified id and rejects a mismatch (a body field
rather than a header, so no CORS allow-list change is needed); the field is never used as the
database target. Its conditional update is serialized by D1 and includes
`WHERE id = ? AND age_assurance_status = 'pending'`. A zero-row update triggers a reread: the same
choice is success, a different recorded choice is conflict, a grandfathered row stays untouched,
and a missing row is not found.

The post-signup redirect is consumed only after assurance is no longer pending. This prevents a
new Google user from losing the one-shot intake redirect while the Worker correctly refuses
intake.

## Intake compatibility

The exact intake age remains a separate coaching input.

- `recorded / 13_17`: no second guardian checkbox and no second consent write. The account remains
  in the minor regime until a separately approved one-way aging policy exists. *[Later,
  2026-10-01: that policy was approved and ships as `0006_age_transition.sql` /
  `POST /api/age-transition`; a transitioned account is a recorded `18_plus` account.]*
- `recorded / 18_plus`: exact intake age must be at least 18.
- `grandfathered`: preserve today's behavior; exact age 13-17 requires `guardianConsent: true`,
  and intake plus consent are written in one D1 batch.
- `pending`: cannot reach intake because the central gate refuses it first.

Unknown/missing session metadata is treated as grandfathered by the intake UI, never as recorded.
The Worker remains authoritative in every case.

## UI and copy

The shared choice is controlled and stateless. It renders two radio choices, reveals a separate
unchecked guardian checkbox only for `13_17`, clears that checkbox when switching away, states
that users must be at least 13, and links to the published privacy policy. It uses Blueprint tokens
and the existing action components; no new color or dependency is introduced.

The copy records an attestation that a parent or guardian agreed. It does not claim that Pace
Blueprint verified the guardian's identity. The repository's existing captain/legal copy
certification caveat remains a release note.

## Rollout

Production requires, in order:

1. Put the production Worker behind a Cloudflare maintenance/traffic gate so no signup or ordinary
   app request can reach the old Worker during the schema transition.
2. Apply `workers/migrations/0005_age_assurance.sql` to the production D1 database.
3. Deploy the named Worker environment with `wrangler deploy --env production`.
4. Verify an unauthenticated health/capability probe and a pending-account refusal, then remove the
   traffic gate.
5. Release the updated client.

Those production actions are captain-only and are not run by this task. The PR must say that the
traffic gate, migration, Worker deploy, and post-deploy probe are required before the feature takes
effect. The privacy policy is not described as live until the legal Pages workflow succeeds after
merge.

## Verification

Behavioral tests must prove request validation, duplicate-email parity, immutable server-owned
fields, trigger rollback, rejection of newly inserted grandfathered rows, pending-route refusal,
write-once/idempotent OAuth recording, session refresh, signup UI gating, accessible first-use UI,
recorded-vs-grandfathered intake behavior, and account deletion cascade. Both the root and Worker
gates must pass. The current `cloudflare:test` harness applies every migration before tests and has
one D1 binding, so pre-0005 backfill is verified by migration review plus executable behavior of
the resulting grandfathered tuple rather than a synthetic source-grep assertion.
