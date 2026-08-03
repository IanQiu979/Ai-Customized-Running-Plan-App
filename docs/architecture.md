# Architecture

System design for V2.2 — Running Training Plan Builder. Current state and planned state are
kept in clearly separate sections below; nothing in a "planned" section is built yet. See also
[`CLAUDE.md`](../CLAUDE.md), [`docs/mvp-progress.md`](mvp-progress.md),
[`docs/reference/plan-generation.md`](reference/plan-generation.md), and the source spec,
[`planning/03-engineering-requirements.md`](../planning/03-engineering-requirements.md).

> **The backend is Cloudflare, not Supabase (decision, 2026-08-02).** D1 + Workers + better-auth,
> living in [`workers/`](../workers/README.md). Two reasons, both the captain's: a Supabase
> project-slot constraint, and a preference for a stack that stays genuinely free at this stage.
> Cloudflare also clears the bar that ruled Firebase's free tier out — Workers can make outbound
> `fetch` calls, which `generate-plan` needs to reach Anthropic.
>
> **The relational design was not re-decided.** Same tables, same quota rules, same API shape as
> the Supabase draft this document already carried — translated into SQLite. The one change with
> real consequences is that **SQLite has no row-level security**, so authorization moved into
> Worker code; see "Authorization without RLS" below. `supabase/` remains in the repo, untouched
> and unused; deleting it is a separate decision.

## Current — what exists in `src/`

```
src/
  app/
    _layout.tsx          # root layout — loads the three font families; ThemeProvider is fed
                          #                constants/navigation-theme.ts's tokened Theme, Stack
    (tabs)/
      _layout.tsx          # tab bar — Home + Glossary today (My Plans/Settings-lite land with
                            #           the backend that gives them something to show)
      index.tsx             # Home placeholder shell + a temporary demo link to the fixture plan
      glossary.tsx           # abbreviations glossary — sourced from notation.ts, nothing hardcoded
    plan/[id].tsx            # plan view — renders the golden fixture; `[id]` isn't read yet
  components/
    plan/                   # WeekAccordion, WorkoutRow, EffortChip, ReadoutBracket,
                             # PlanNameplate, DisclaimerFooter, FallbackNotice, format.ts
  constants/
    theme.ts                # "Instrument & Matter" token system — current, see below
    navigation-theme.ts      # bridges theme.ts's tokens into @react-navigation/native's `Theme`
                             #  shape, so ThemeProvider never leaks the library's own stock
                             #  DefaultTheme/DarkTheme colors (fixes issue #27)
    __tests__/                # navigation-theme (10 tests) — first suite under constants/
  hooks/                    # use-theme, use-color-scheme
  lib/
    supabase.ts             # LEGACY, unused — see below
    planTypes.ts              # canonical — shared Plan/Week/Workout/Tier vocabulary
    loadRules.ts               # canonical — deterministic safety arithmetic, 31 unit tests
    notation.ts                 # canonical — run-type/structure-string notation, the code
                                 #             counterpart of `notation.md`, 13 unit tests
    paceDerivation.ts        # pure Riegel/training-pace/goal-realism arithmetic
    planTemplates.ts         # pure deterministic template + fallback plan engine
    tierLimits.ts                # canonical — the ONE copy of Free/Pro/Elite limits + the
                                  #             fallback-exemption cap. Imported by the app AND
                                  #             by `workers/`. 8 unit tests
    quotaPeriod.ts                # canonical — `currentPeriod(anchorDate, now)`, the purchase-day
                                   #            anchored window with the month-end clamp. Shared
                                   #            by the app and `workers/`. 10 unit tests
    fixtures/examplePlan.ts  # hand-built 5K screen fixture; `plan/[id].tsx` still renders it
    __tests__/               # supabase, loadRules, notation, examplePlan.fixture, tierLimits,
                              # quotaPeriod, planTemplates (golden + general), paceDerivation —
                              # the two engine contracts included
```

`src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts` are, like `planTypes.ts`, **pure and
dual-consumed** — no React, no Node, no Cloudflare globals — because `workers/src/` imports them
directly. That is deliberate: `planning/03-engineering-requirements.md` names `tierLimits.ts` and
requires one shared `currentPeriod()` specifically so `quota-status` can never promise a slot that
`generate-plan` then refuses, and so the Echo V1 "KEEP IN SYNC" drift cannot recur.

## Current — the backend, in `workers/`

```
workers/                    # a SEPARATE npm project; Metro is told to skip it (metro.config.js)
  wrangler.toml             # bindings + non-secret vars (committed — nothing secret here)
  migrations/
    0001_better_auth.sql    # user, session, account, verification
    0002_app_schema.sql     # profiles, intake_responses, subscriptions, plans
  src/
    index.ts                # authenticate once, then dispatch — the route table
    auth.ts                 # better-auth on D1, email/password + Bearer sessions
    routes.ts               # handlers, each taking an already-verified userId
    deps.ts                 # the only file that reads a secret; binds every seam
    lib/store.ts            # every D1 statement — authorization lives here
    lib/generate-plan-flow.ts  # the eleven pipeline steps, pure, deps injected
    lib/planEngine.ts       # skeleton + personalizer seams (neither implemented — see below)
    lib/planValidation.ts   # structural validation, shape only
    lib/model.ts            # the Anthropic call, behind an injectable seam
  test/                     # 75 tests in real workerd + real D1 (Miniflare). No network.
```

Full operational detail — how to run it, what the captain must do himself, why the layout is what
it is — lives in [`workers/README.md`](../workers/README.md).

**Working today**, verified against `wrangler dev` and by the test suite: email/password auth with
Bearer sessions, the quota ledger (reserve → settle/release, atomic gate, idempotency replay,
fallback exemption), `quota-status`, `purchase-tier`, `delete-account`, intake read/write, and plan
reads. **`generate-plan` returns `503 engine_unavailable` and consumes no quota** — everything
around the plan engine is built; the engine itself is not. See "generate-plan" below.

`src/lib/supabase.ts` and `supabase/functions/.env.example` are **legacy**. Nothing imports the
Supabase client any more and no Supabase project is used. Both are kept rather than deleted so the
earlier design stays readable, and because removing them is its own decision.

For the record of what it did while it was live, `src/lib/supabase.ts` exports `supabase`, built
with `createClient(url, publishableKey, { auth: {...} })`: `storage: AsyncStorage` on native only,
`autoRefreshToken`/`persistSession` on, `detectSessionInUrl: false`, `lock: processLock`, a throw
at import time if either `EXPO_PUBLIC_SUPABASE_*` var is missing, and an `AppState` listener that
starts/stops auto-refresh as the app foregrounds. The client half of Cloudflare auth — a
better-auth React Native client against `workers/`, replacing this file — is not built yet.

`src/lib/planTypes.ts`, `src/lib/loadRules.ts`, `src/lib/notation.ts`,
`src/lib/paceDerivation.ts`, `src/lib/planTemplates.ts`, `src/lib/tierLimits.ts`, and
`src/lib/quotaPeriod.ts` **exist and are canonical** — pure TypeScript with no runtime
dependencies, importable by both the Expo app and the Cloudflare Workers backend
(`tierLimits.ts` and `quotaPeriod.ts` are imported directly by `workers/`).
**When this document and the types disagree, the types win** — `planTypes.ts` is the source of
truth, this file is a description of it. `src/constants/theme.ts` is one such consumer: as of
2026-07-12 (issue #32 findings 4 and 7) it derives `EffortLevel`'s render order and bar-height ramp
from `planTypes.ts`'s `EFFORT_LEVELS`/`EFFORT_ORDINAL` rather than redeclaring them, so a
presentation value can no longer drift from the shared type it's meant to visualize — see "visual
direction" below.

`src/lib/fixtures/examplePlan.ts` is the 5K golden fixture rendered as real `Plan` data —
`src/app/plan/[id].tsx` and `src/components/plan/` render it end to end on a real screen
(ugly-beyond-tokens caveats aside), and `src/app/(tabs)/glossary.tsx` explains its abbreviations,
reading its copy from `notation.ts`. The pure generator now exists, but the route is not wired to
it yet: every plan id still renders the same fixture.

There is no `subscription.ts` yet; no auth screens; no intake screen; no client-side API module
talking to `workers/` yet; no `supabase/functions/`; no `supabase/migrations/`.
`tsconfig.json` maps `@/*` → `./src/*` and `@/assets/*` → `./assets/*`, and **excludes `workers/`**
— that project has its own `tsconfig.json`, its own runtime, and its own type system, so the root
`npm run typecheck` deliberately does not cover it (same for `eslint.config.js` and
`jest.config.js`; the Workers gate is `npm --prefix workers run typecheck && npm --prefix workers
test`).

## Route tree — current + planned

```
src/app/
  (auth)/sign-in, sign-up
  (tabs)/index          # Home / Create plan — exists today (placeholder shell + demo link)
  (tabs)/glossary       # exists today — abbreviations glossary, not in the original blueprint's
                         # tab list; added for Ian's 2026-07-11 notation ruling (see change_log.md)
  (tabs)/plans          # My Plans (history) — planned, needs the backend first
  (tabs)/settings       # third tab — dummy paywall + settings-lite (decision 1, 2026-07-10) — planned
  intake/                # onboarding questionnaire (stack) — planned
  plan/[id]              # plan view — exists today, renders the golden fixture only
```

**Decision 1 (2026-07-10):** the paywall and a settings-lite screen (sign out, tier display,
restore purchases) are restored to MVP scope, using the blueprint's reserved third tab slot
(`docs/design/mvp-blueprint.md` Part 8) rather than shipping as detached modal-only routes.

**Decision 5 (2026-07-10):** Home shows the plan link (or "Create a plan") and quota state only —
no "next workout" or "current week" card. No current-week arithmetic exists in v1; days are
unnamed and there are no check-offs, so "next" has no well-defined meaning without one. This is
Ian's override of the recommended `floor(days since created_at / 7) + 1` design.

## Current + planned — `src/lib/` layout

```
src/lib/
  supabase.ts            # exists today — LEGACY, unused
  planTypes.ts             # exists today — shared Plan/Week/Workout/Tier types, one source of
                            #                truth for the app and the Worker
  loadRules.ts              # exists today — deterministic safety arithmetic, 31 unit tests
  notation.ts                # exists today — run-type/structure-string notation, the code
                              #                counterpart of `notation.md`, 13 unit tests
  tierLimits.ts               # exists today — the one copy of the tier limits, app + Worker
  quotaPeriod.ts               # exists today — `currentPeriod()`, app + Worker
  fixtures/examplePlan.ts    # exists today — the 5K golden fixture as real `Plan` data
  planTemplates.ts        # exists — the free-tier engine AND the fallback engine for Pro/Elite.
                            #          A parametric generator, not a fixed matrix: any distance,
                            #          any legal week count (per the plan-shape rules in
                            #          `planning/02-product-requirements.md`), any days/week, any
                            #          starting weekly volume (km); exactly reproduces the golden
                            #          5K case. Free's 12-week/5K limit is a UI/quota gate applied
                            #          on top of this engine, not a limit of the engine itself — a
                            #          Pro/Elite fallback still needs, say, a 26-week marathon
                            #          template.
  paceDerivation.ts        # exists — Riegel cross-distance equivalency, source-relative training
                            #          bands, and the ruled goal-realism/race-pace cap (decision
                            #          13, 2026-07-10)
  subscription.ts          # planned — tier read + dummy purchase (now a `quota-status` call)
```

## Current — `generate-plan`, and what is still missing from it

The core of the app. Full tier/quota/validation detail:
[`docs/reference/plan-generation.md`](reference/plan-generation.md). The eleven steps below are
implemented in `workers/src/lib/generate-plan-flow.ts`, with each dependency injected so every
branch is unit-testable without a network or a cent of Anthropic spend.

**Two steps have no implementation behind them yet, deliberately.** Steps 4/5/8/9 (the
deterministic skeleton) need `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts`, which are
being written separately against the red TDD suites already quarantined in `jest.config.js`; step 7
needs the Pro/Elite personalization prompt, which is coaching-sensitive work of its own. Both are
bound to typed *unavailable* implementations rather than to mocks, so the endpoint answers a
structured `503` and releases its quota reservation instead of serving a plausible-looking plan
from nowhere. Each is one binding in `workers/src/deps.ts`, and that file names them explicitly so
the swap has an owner.

1. **Auth** — verify the session, reject anonymous requests. Happens once in
   `workers/src/index.ts`, ahead of dispatch, so no handler can be reached anonymously.
2. **Idempotency replay** — `GeneratePlanRequest.idempotencyKey` is minted client-side when the
   configure modal opens. If `(user_id, idempotency_key)` already has a row in `plans`, return
   that row instead of generating again. This is what makes a network-timeout retry safe.
3. **Atomic quota gate** — one conditional `INSERT ... SELECT ... WHERE (SELECT count(*) ...) <
   limit` statement checks the tier limit, counts non-fallback plans in the current period, and
   reserves the slot in a single write (no bare count-then-insert — that has a TOCTOU race with a
   window as wide as the generation itself). Over quota → `402` with a structured body. Fallback
   plans (`is_fallback: true`) never count
   against quota, capped at 3 quota-exempt fallbacks per period so the free-text `notes` field
   can't be used to farm unlimited template plans.
4. **Reconcile plan length** — a race farther out than the tier's max plan length gets a delayed
   start so the taper lands on race day (ported from Echo V1's `reconcilePlanLength`); a
   compressed race gets an honest short plan. **Never refuse.** A declared red-flag injury still
   produces a plan — a normal, volume-adjusted one carrying a strengthened disclaimer (captain
   ruling, 2026-08-03; see `docs/reference/coaching/plan-structure.md`), not a separate
   return-to-running protocol — never a rejection, and does not consume quota.
5. **Build the template skeleton** — parametric, from `planTemplates.ts` and the coaching docs:
   phases, deload cadence, weekly volumes under `loadRules.ts` caps, workout primitives from
   `workout-library.md`. **All three tiers build on this same coach-authored skeleton — it is
   never removed.** What scales across tiers is how much of the runner the plan reasons about and
   how much it explains, never how much of the coach's judgment is taken away.
6. **Free tier stops here.** Template + effort descriptions only. No AI call, ever.
7. **Pro/Elite — one Claude call** (`claude-sonnet-5`). The skeleton goes into the prompt as the
   fixed structure; Claude personalizes **one representative week per phase**, not all 24–30
   weeks — a full plan does not fit a single model response (ported from Echo V1's token
   strategy: brevity mandate, forced tool call for guaranteed JSON, SSE streaming, truncation
   detection). Pro gets paces (only if a recent time exists), HR zones, warm-ups/drills, and a
   weekly "why". Elite gets the same, plus a per-workout "why" and the richest prompt (injury
   history, race context, periodization nuance) — **still inside the skeleton**. `engine: 'ai'`
   is never emitted in v1; every paid plan is skeleton-constrained `hybrid` (see `planTypes.ts`'s
   `Engine` comment).
8. **Deterministic expander** — typed code materializes every calendar week from the
   representative weeks, scaling distances along the phase's load curve.
9. **Clamp** — `loadRules.ts` re-checks every week (weekly increase cap, deload band 35–45%,
   long-run share/spike/time caps) identically across all three tiers. A model cannot emit an
   unsafe week because this code rejects the number before the user sees it.
10. **Validate structurally, loosely** — shape only. Fail → retry once. Fail again → fall back to
    the pure template plan, `is_fallback: true`, rendered at Free density.
11. **Settle** the reserved `plans` row (immutable plan JSON, `tier_at_generation`, `engine`,
    `is_fallback`, `idempotency_key`) and return `{ plan, planId, isFallback }`.

    Because the quota slot is *reserved* at step 3 and the plan document only arrives at step 11,
    every row has a lifecycle: `reserved` → `settled` or `released`. **A reservation is settled or
    released on every exit path**, including an unexpected throw — a slot silently held by a
    crashed generation is the one quota bug a user can neither see nor work around. A reservation
    that outlives its TTL stops being counted at read time, which is what removes the need for the
    sweep cron the Postgres design would have wanted. `tier_at_generation`, `engine`, and
    `is_fallback` are stamped by the server over whatever the plan carried: they decide how the
    plan renders forever, so neither a model nor a client may name them.

The deterministic load-rule clamp (volume caps, deload cadence, long-run caps) applies identically
to all three tiers — while building the template for Free, and as a post-generation clamp on
Claude's output for Pro and Elite. See
[`docs/reference/plan-generation.md`](reference/plan-generation.md) for why: selling the top tier
as the one with the guardrail removed would be backwards.

### Quota periods

Computed **arithmetically at read time** from the purchase-day anchor (e.g. May 26 → June 26,
clamped at month end: Jan 31 → Feb 28 → Mar 31). No cron job, no rollover write. One pure shared
function, `currentPeriod(anchorDate, now)`, used by both `generate-plan` and `quota-status`. A
user with no `subscriptions` row is `free`.

## Current — API

The client talks to the Worker and to nothing else. There is no client-facing database API at all
(D1 has none), so **every** read and write is a route — including the three that were direct
RLS-guarded client reads in the Supabase design.

Auth is a better-auth session, sent as `Authorization: Bearer <token>`. A React Native client has
no browser cookie jar, so better-auth's `bearer()` plugin is enabled and is not optional: without
it `getSession()` ignores the header and every route 403s a user who just signed in.

| Method / Route | Auth | Body | Returns | Notes |
|---|---|---|---|---|
| `ANY /api/auth/*` | — | better-auth's own | better-auth's own | Sign-up, sign-in, sign-out, session, OAuth callbacks. Email/password works today; Google needs credentials only the captain can create (`workers/src/auth.ts`'s TODO). |
| `GET /health` | none | — | `{ ok: true }` | Liveness. Touches no database. |
| `POST /api/generate-plan` | session | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes?, idempotencyKey }` | `{ plan, planId, isFallback }`, or `402` over-quota / `403` anon / `409` intake-required / **`503` engine-unavailable (today)** | Enforces tier + quota server-side, branches by tier, validates, persists. A duplicate `idempotencyKey` returns the existing plan instead of generating twice. |
| `GET /api/quota-status` | session | — | `{ tier, used, limit, periodEnd }` | Drives the Home "2 of 3 plans left" UI. `used` counts **non-fallback** plans in the current purchase-anchored period, server-side, never a client counter. `periodEnd` is `null` for Free, whose allowance is lifetime — the UI must not render a countdown for it. |
| `POST /api/purchase-tier` | session | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart, periodEnd }` | v1 dummy flow. v2 swaps `source` to `"revenuecat"` and verifies the receipt — same route, same table write. `source: "revenuecat"` is refused in v1 rather than trusted. |
| `POST /api/delete-account` | session | — | `{ deleted: true }` | Really deletes; no soft-delete flag, because the app's own copy promises erasure. The only route that deletes a plan. |
| `GET /api/intake` | session | — | `{ intake }` or `{ intake: null }` | Was a direct client read under Supabase. |
| `PUT /api/intake` | session | `IntakeResponses` | `{ saved: true }` | Was a direct client upsert under Supabase. |
| `GET /api/plans` | session | — | `{ plans: [summary] }` | My Plans. Summaries only — full documents would be megabytes for a heavy user. |
| `GET /api/plans/:id` | session | — | `{ plan, planId, isFallback }` or `404` | Someone else's plan id is a `404`, not a `403`: it does not exist to you. |

There is deliberately **no `DELETE /api/plans/:id`**. Count-based quota depends on plans being
undeletable — a delete route would let a user reset their own count.

### Authorization without RLS

The single most consequential difference from the Supabase design. Postgres RLS was the *last*
line of defence: a forgotten `where user_id = ...` in an edge function still could not leak another
user's rows. **SQLite has no policy system, so that net does not exist.** D1 executes whatever SQL
the Worker sends, as the Worker.

What replaces it:

- Authentication happens **once**, in `workers/src/index.ts`, ahead of dispatch — so no handler
  *can* be reached anonymously, rather than each handler remembering to check.
- Every statement in `workers/src/lib/store.ts` binds a `userId` taken from the verified session.
  No function there accepts a row id without also accepting the owner's id, and `settle`,
  `release`, and `getPlan` all carry `AND user_id = ?` despite already having a primary key: a
  primary key that arrived over the wire proves nothing about who sent it.
- Reviewing that file means checking that predicate on every statement. A statement missing it is
  a data-leak bug, not a style nit.

Tests pin the property from both ends: `test/worker.test.ts` asserts every app route 403s
anonymously, and `test/store.test.ts` asserts one user cannot read, list, settle, or release
another's rows.

## Current — DB schema (D1, applied locally)

Migrations live in `workers/migrations/` and are applied with
`npm --prefix workers run db:migrate:local`. Nothing is applied remotely yet: `wrangler.toml`'s
`database_id` is a deliberately fake placeholder until the captain runs `wrangler d1 create`. The
files themselves are the source of truth; this is a summary.

```sql
-- 0001 — better-auth's, verified against its own schema builder (see the migration's header)
user, session, account, verification

-- 0002 — the app's
profiles          (user_id -> user.id, display_name, created_at, updated_at)
intake_responses  (user_id -> user.id, goal, age, experience, days_per_week, weekly_km,
                   race_distance, race_date, goal_time_sec,
                   recent_perf_distance, recent_perf_time_sec,
                   injuries, injury_notes, updated_at)
  -- goal_time_sec drives race-pace sessions only; recent_perf_* drives every training pace.
  -- Without recent_perf_*, no numeric pace is emitted at any tier. A CHECK refuses HALF a
  -- recent performance — storing one column without the other would silently disable every
  -- numeric pace with nothing in the UI to explain why.
subscriptions     (user_id, tier pro|elite, purchased_at, source dummy|revenuecat,
                   status active|cancelled)          -- source column = painless v2 swap
plans             (id, user_id, tier_at_generation, engine template|hybrid|ai,
                   goal_type race|duration, race_distance, race_date, duration_weeks,
                   plan TEXT json_valid, is_fallback, idempotency_key,
                   status reserved|settled|released, counts_against_quota, release_reason,
                   created_at, settled_at)
  -- UNIQUE (user_id, idempotency_key) — lets generate-plan detect a retried request and
  --                                     return the existing plan instead of generating twice.
```

Two intentional departures from the Postgres draft, both because the draft contradicted a rule
stated next to it:

- **`subscriptions` stores `purchased_at`, not `period_start`/`period_end`.** Storing boundaries
  requires something to roll them over, which contradicts "computed arithmetically at read time …
  no cron, no rollover write". The anchor is stored; `currentPeriod()` derives the window.
  `purchase-tier` still *returns* `{ periodStart, periodEnd }`, so the client contract is
  unchanged. The anchor is also preserved across an upgrade — re-anchoring would hand a Pro user
  on day 29 a fresh period of Elite quota for free.
- **`free` is not a storable tier.** It is the absence of a subscription row, exactly as the spec
  says, so a `tier = 'free'` row can never disagree with no row at all.

Quota is still counted from `plans` itself — there is no separate counter table to drift out of
sync — but the gate is **one conditional `INSERT ... SELECT ... WHERE (SELECT count(*) ...) <
limit` statement**, not the SECURITY DEFINER RPC the Postgres design used (SQLite has neither
stored procedures nor advisory locks). That single statement is genuinely atomic *here*, and this
is the one place the port is simpler than its source: SQLite takes an exclusive write lock for the
duration of a write and D1 funnels every query for a database through one Durable Object, so the
count subquery cannot read a snapshot predating a concurrent uncommitted insert. Postgres MVCC
gives no such guarantee, which is exactly why the original needed `pg_advisory_xact_lock`.
`UNIQUE (user_id, idempotency_key)` is the unconditional backstop. `test/store.test.ts` fires eight
concurrent reservations at a three-slot limit and asserts exactly three succeed.

### What SQLite could not take from the Postgres design

The full list, with what was done instead, is the header of
[`workers/migrations/0002_app_schema.sql`](../workers/migrations/0002_app_schema.sql). In brief:

| Postgres construct | SQLite equivalent |
|---|---|
| Row-level security | **None.** Enforced in Worker code — see "Authorization without RLS" above |
| `SECURITY DEFINER` RPC, `pg_advisory_xact_lock` | One conditional `INSERT … SELECT … WHERE count < limit` (atomic here, see above) |
| `jsonb` | `TEXT` + a `json_valid()` CHECK. Nothing queries inside the document, so no operators are missed |
| `text[]` (`injuries`) | A JSON array in `TEXT`, `json_valid()`-checked; the closed set is enforced in code against `planTypes.ts` |
| `ENUM` types | `TEXT` + CHECK constraints. Same rejection, worse messages, and adding a member rebuilds the table |
| `timestamptz` | ISO-8601 UTC `TEXT` — lexicographic order is chronological order, which the period and TTL comparisons rely on |
| `uuid` / `gen_random_uuid()` | `TEXT`, minted with `crypto.randomUUID()` in Worker code |
| Per-operation grants ("select/insert only, never update or delete") | A `BEFORE UPDATE` trigger that aborts any write to an already-terminal `plans` row — *stronger* than the grant it replaces, because it binds the Worker too, not only the client |
| A stale-reservation sweep cron | Reservations older than the TTL simply stop being counted, evaluated at read time |

**Tier and quota are only ever written by the Worker** — the client has no database access at all,
so it can never write its own tier or quota.

## Current — visual direction (`theme.ts`, commit `145d7e0`)

`src/constants/theme.ts` is the "Instrument & Matter" token system below — the stock Expo
template palette it replaced (light `#000000`/`#ffffff`/`#F0F0F3`/`#E0E1E6`/`#60646C`, dark
`#ffffff`/`#000000`/`#212225`/`#2E3135`/`#B0B4BA`) is gone, along with the template screens that
used it (`explore.tsx` and friends). `Spacing` now runs half=2, one=4, two=8, three=16, four=24,
five=32, **six=48** (new step), seven=64 (the old `six`); `MaxContentWidth = 800` is unchanged from
the scaffold. `BottomTabInset`'s value is likewise unchanged, but as of 2026-07-12 (issue #32
finding 8) it carries a docblock explaining why it still has zero call sites: it models a tab bar
that *floats over* content, and the real tab bar (`(tabs)/_layout.tsx`) lays out in normal flow
instead, so applying the inset today would add trailing void, not clearance — see
`docs/mvp-progress.md`'s "Known debt" for the full reasoning. Full rationale for every other
value — contrast math, the two computed dark-mode fixes, the `grid.*` tokens — lives in the token
file's own header comment and `docs/design/frontend-design-brief.md` Part 2; this section is a
summary, not the source of truth.

- **Bases**: `asphalt #14171C` (dark), `chalk #F7F7F4` (light), `graphite #5A6069` (secondary
  text) — deliberately not pure black/white, and deliberately not a cream-and-terracotta look.
- **Effort scale** — the palette *is* the information, not decoration: `recovery #6FA8C9`,
  `easy #4FA97E`, `steady #C9A227`, `tempo #D9772B`, `interval #C6402F`. A color always means an
  intensity. `barHeight` (the ramp's mandatory non-hue accessibility channel) is computed as
  `0.4 + 0.15 × EFFORT_ORDINAL[level]` against `planTypes.ts`'s ordinal rather than hand-written
  per level (issue #32 findings 4 and 7, 2026-07-12) — see "Current" above.
- One accent, `hivis #D8F14A`, reserved exclusively for the single primary forward-action of
  whatever screen you're on — boldness spent in exactly one place. (There is no "next workout"
  card in v1 — decision 5, 2026-07-10 — so hivis does not move to one; it stays on the primary
  CTA.)
- **Interaction**: one `PressedOpacity` token (`0.7`) for every `Pressable`'s press-dim, added
  2026-07-12 (issue #32 finding 3) so the value can't fork across components the way it had in
  `index.tsx` and `WeekAccordion.tsx`.
- Type: a condensed grotesque for display and numerals (running is numbers — distance, pace,
  splits), a neutral body face, a mono face for split tables. Scale 32/24/20/17/15/13.
- **Signature element — the "week ribbon"**: each training week renders as seven cells colored
  by effort, rest days as gaps. A 16-week plan reads as a barcode of periodization at a glance.
  The plan view is meant to lead with the ribbon rather than a list. **This per-week micro ribbon
  is implemented** (`src/components/plan/WeekAccordion.tsx`); the macro periodization wave
  (`mvp-blueprint.md` Part 3) is not built yet.
- **React Navigation's own chrome is tokened too, not just the screens built on top of it.**
  `src/constants/navigation-theme.ts` bridges the same `Colors` tokens into the `Theme` shape
  `@react-navigation/native` expects (`background`→`surface.base`, `card`→`surface.raised`,
  `text`→`text.primary`, `border`→`hairline`, `primary`→`text.primary`, `notification`→
  `status.error`), so `_layout.tsx`'s `ThemeProvider` never falls back to the library's own stock
  `DefaultTheme`/`DarkTheme` palette for transition underlays, header defaults, or the back-swipe
  reveal (closes issue #27, a 2026-07-11 frontend-audit finding). `primary` deliberately maps to
  `text.primary`, not `Accent.hivis` — hivis stays reserved for the single per-screen forward-action.
- Accessibility rule, non-negotiable: an effort color is never the only signal — always pair it
  with a text label, so the plan stays legible to color-blind users.
- Standing rule (already in the engineering spec): theme tokens only, no hardcoded colors or
  spacing in components.

## Owner design directions (recorded 2026-07-10)

- **Screens are composed like a website**: long, scrolling surfaces, not fixed-viewport panels.
  A later, post-MVP phase adds website-style scroll-driven animations (scroll-triggered reveals,
  scroll-linked motion). **MVP ships plain native scroll** — the mvp-blueprint's rule stands for
  v1 (no parallax, no shrinking headers, no scroll-linked worklets) — but nothing may be built
  that precludes scroll-driven animation later: screens stay on Reanimated-compatible scroll
  containers, no nested-scroll traps, no layout hard-pinned to a static viewport.
- The v1 aesthetic is the blueprint's **Instrument & Matter** system
  (`docs/design/mvp-blueprint.md` Part 1). Its banned list — glow, glassmorphism, ambient/idle
  motion, frosted panels — applies to the future scroll-driven animations too, not just to v1.
