# Architecture

System design for V2.2 — Running Training Plan Builder. Current state and planned state are
kept in clearly separate sections below; nothing in a "planned" section is built yet. See also
[`CLAUDE.md`](../CLAUDE.md), [`docs/mvp-progress.md`](mvp-progress.md),
[`docs/reference/plan-generation.md`](reference/plan-generation.md), and the source spec,
[`planning/03-engineering-requirements.md`](../planning/03-engineering-requirements.md).

## Current — what exists in `src/`

```
src/
  app/
    _layout.tsx          # root layout — loads the three font families, ThemeProvider, Stack
    (tabs)/
      _layout.tsx          # tab bar — Home + Glossary today (My Plans/Settings-lite land with
                            #           the backend that gives them something to show)
      index.tsx             # Home placeholder shell + a temporary demo link to the fixture plan
      glossary.tsx           # abbreviations glossary — sourced from notation.ts, nothing hardcoded
    plan/[id].tsx            # plan view — renders the golden fixture; `[id]` isn't read yet
  components/
    plan/                   # WeekAccordion, WorkoutRow, EffortChip, ReadoutBracket,
                             # PlanNameplate, DisclaimerFooter, FallbackNotice, format.ts
  constants/theme.ts        # "Instrument & Matter" token system — current, see below
  hooks/                    # use-theme, use-color-scheme
  lib/
    supabase.ts             # env-guarded Supabase client
    planTypes.ts              # canonical — shared Plan/Week/Workout/Tier vocabulary
    loadRules.ts               # canonical — deterministic safety arithmetic, 19 unit tests
    notation.ts                 # canonical — run-type/structure-string notation, the code
                                 #             counterpart of `notation.md`, 13 unit tests
    fixtures/examplePlan.ts       # the 5K golden fixture as real `Plan` data — what `plan/[id].tsx`
                                   # renders today; not yet `planTemplates.ts` output
    __tests__/                    # supabase, loadRules, notation, examplePlan.fixture (64 passing);
                                   # planTemplates.golden and paceDerivation intentionally fail —
                                   # TDD specs for modules that don't exist yet
```

`src/lib/supabase.ts` exports `supabase`, built with
`createClient(url, publishableKey, { auth: {...} })`:

- `storage: AsyncStorage` on native only (on web, supabase-js falls back to `localStorage`
  itself — no storage option is passed there).
- `autoRefreshToken: true`, `persistSession: true`.
- `detectSessionInUrl: false` — native has no URL bar to read a session out of; OAuth returns
  via deep link instead.
- `lock: processLock`.
- Throws at import time if either `EXPO_PUBLIC_SUPABASE_URL` or
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing, with a message pointing at `.env.example`.
- Registers an `AppState` listener (native only) that calls `supabase.auth.startAutoRefresh()`
  / `stopAutoRefresh()` as the app foregrounds/backgrounds, so a backgrounded app stops issuing
  token refreshes.

`src/lib/planTypes.ts`, `src/lib/loadRules.ts`, and `src/lib/notation.ts` **exist and are
canonical** — pure TypeScript, no runtime deps, imported by both the Expo app and (once written)
the Deno edge functions. `loadRules.ts` carries 19 passing unit tests, `notation.ts` 13.
**When this document and the types disagree, the types win** — `planTypes.ts` is the source of
truth, this file is a description of it.

`src/lib/fixtures/examplePlan.ts` is the 5K golden fixture rendered as real `Plan` data —
`src/app/plan/[id].tsx` and `src/components/plan/` render it end to end on a real screen
(ugly-beyond-tokens caveats aside), and `src/app/(tabs)/glossary.tsx` explains its abbreviations,
reading its copy from `notation.ts`. None of this is wired to a real intake or a real generator
yet: every plan id renders the same fixture.

There is no `src/lib/planTemplates.ts`, `src/lib/paceDerivation.ts`, or `subscription.ts` yet; no
auth screens; no intake screen; no `supabase/functions/`; no `supabase/migrations/`.
`tsconfig.json` maps `@/*` → `./src/*` and `@/assets/*` → `./assets/*`.

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

## Planned — `src/lib/` layout

```
src/lib/
  supabase.ts            # exists today
  planTypes.ts             # exists today — shared Plan/Week/Workout/Tier types, one source of
                            #                truth for the app and the edge functions
  loadRules.ts              # exists today — deterministic safety arithmetic, 19 unit tests
  notation.ts                # exists today — run-type/structure-string notation, the code
                              #                counterpart of `notation.md`, 13 unit tests
  fixtures/examplePlan.ts    # exists today — the 5K golden fixture as real `Plan` data
  planTemplates.ts        # planned — the free-tier engine AND the fallback engine for Pro/Elite.
                            #          A parametric generator, not a fixed matrix: any distance,
                            #          any legal week count (per the plan-shape rules in
                            #          `planning/02-product-requirements.md`), any days/week, any
                            #          starting weekly volume (km). Free's 12-week/5K limit is a UI/quota
                            #          gate applied on top of this engine, not a limit of the
                            #          engine itself — a Pro/Elite fallback still needs, say, a
                            #          26-week marathon template.
  paceDerivation.ts        # planned — planTemplates.ts's pace-derivation counterpart (decision
                            #          13, 2026-07-10: Riegel cross-distance equivalency + the
                            #          source's relative pace rules). TDD test suite exists
                            #          (`paceDerivation.test.ts`) and intentionally fails today.
  subscription.ts          # planned — tier read + dummy purchase
```

## Planned — `generate-plan` edge function flow

The core of the app. Full tier/quota/validation detail:
[`docs/reference/plan-generation.md`](reference/plan-generation.md).

1. **Auth** — verify the JWT, reject anonymous requests.
2. **Idempotency replay** — `GeneratePlanRequest.idempotencyKey` is minted client-side when the
   configure modal opens. If `(user_id, idempotency_key)` already has a row in `plans`, return
   that row instead of generating again. This is what makes a network-timeout retry safe.
3. **Atomic quota gate** — a single SECURITY DEFINER RPC checks the tier limit, counts
   non-fallback plans in the current period, and reserves the slot in one transaction (no bare
   count-then-insert — that has a TOCTOU race with a window as wide as the generation itself).
   Over quota → `402` with a structured body. Fallback plans (`is_fallback: true`) never count
   against quota, capped at 3 quota-exempt fallbacks per period so the free-text `notes` field
   can't be used to farm unlimited template plans.
4. **Reconcile plan length** — a race farther out than the tier's max plan length gets a delayed
   start so the taper lands on race day (ported from Echo V1's `reconcilePlanLength`); a
   compressed race gets an honest short plan. **Never refuse.** A declared red-flag injury
   produces the return-to-running protocol as a plan, never a rejection, and does not consume
   quota.
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
11. **Insert** the `plans` row (immutable JSONB, `tier_at_generation`, `engine`, `is_fallback`,
    `idempotency_key`) and return `{ plan, planId, isFallback }`.

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

## Planned — API

The client never talks to Postgres for privileged operations — those go through edge
functions. Plain reads of the caller's own rows go through the Supabase client, protected by
RLS.

| Method / Route | Auth | Body | Returns | Notes |
|---|---|---|---|---|
| `POST /functions/v1/generate-plan` | JWT | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes?, idempotencyKey }` | `{ plan, planId, isFallback }` or `402` over-quota / `403` anon | Enforces tier + quota server-side (atomic RPC), branches by tier, validates, persists. `idempotencyKey` is minted client-side when the configure modal opens; a duplicate key returns the existing plan instead of generating twice. |
| `POST /functions/v1/purchase-tier` | JWT | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart, periodEnd }` | v1 dummy flow. v2 swaps `source` to `"revenuecat"` and verifies the receipt — same route, same table write. |
| `GET /functions/v1/quota-status` | JWT | — | `{ tier, used, limit, periodEnd }` | Drives the Home "2 of 3 plans left" UI. `used` is a count of **non-fallback** plans (`is_fallback = false`) in the current purchase-anchored period, never a client counter — matching decision 2's fallback exemption exactly. |

Direct Supabase-client reads (RLS-guarded, `user_id = auth.uid()`): read/write own
`intake_responses` (upsert on the intake screen); list own `plans` (My Plans tab — select only,
inserts happen only inside `generate-plan`); read own `subscriptions` (cosmetic UI state, not
the source of truth).

## Planned — DB schema (draft, not deployed)

The live Supabase project (`v2.2_plan_generation`) currently has 0 tables, 0 migrations, and 0
edge functions. This schema is the draft in
[`planning/03-engineering-requirements.md`](../planning/03-engineering-requirements.md), not
deployed anywhere yet.

```sql
profiles          (id -> auth.users, created_at, display_name)
intake_responses  (user_id, goal, age, experience, days_per_week, weekly_km,
                   race_distance, race_date, goal_time_sec,
                   recent_perf_distance, recent_perf_time_sec,
                   injuries, injury_notes, updated_at)
  -- goal_time_sec drives race-pace sessions only; recent_perf_* drives every training pace.
  -- Without recent_perf_*, no numeric pace is emitted at any tier.
subscriptions     (user_id, tier free|pro|elite, period_start, period_end,
                   source dummy|revenuecat)          -- source column = painless v2 swap
plans             (id, user_id, tier_at_generation, engine template|hybrid|ai,
                   goal_type race|duration, race_date, duration_weeks,
                   plan jsonb, is_fallback bool, idempotency_key, created_at)
  -- UNIQUE (user_id, idempotency_key) — lets generate-plan detect a retried request and
  --                                     return the existing plan instead of generating twice.
```

Quota check is an **atomic SECURITY DEFINER RPC**, not a bare `count(plans)` read followed by an
insert — a count-then-insert has a TOCTOU race with a window as wide as the generation itself. The
RPC checks the tier limit, counts non-fallback plans (`is_fallback = false`) in the current
period, and reserves the slot in one transaction; N concurrent requests at 2-of-3 quota must
yield exactly one success. There is no separate counter table to drift out of sync with `plans`
itself. Quota periods are computed arithmetically from the purchase-day anchor — see "Quota
periods" above — not stored or rolled over.

**RLS rule for every table**: `user_id = auth.uid()` for select/insert of the caller's own
rows. **`plans` grants select/insert only — never update or delete.** Count-based quota depends
on this: a delete policy would let a user reset their own count. Tier and quota columns are only
ever written by edge functions running as the service role — the client can never write its own
tier or quota.

## Current — visual direction (`theme.ts`, commit `145d7e0`)

`src/constants/theme.ts` is the "Instrument & Matter" token system below — the stock Expo
template palette it replaced (light `#000000`/`#ffffff`/`#F0F0F3`/`#E0E1E6`/`#60646C`, dark
`#ffffff`/`#000000`/`#212225`/`#2E3135`/`#B0B4BA`) is gone, along with the template screens that
used it (`explore.tsx` and friends). `Spacing` now runs half=2, one=4, two=8, three=16, four=24,
five=32, **six=48** (new step), seven=64 (the old `six`); `BottomTabInset` and
`MaxContentWidth = 800` are unchanged from the scaffold. Full rationale for every value —
contrast math, the two computed dark-mode fixes, the `grid.*` tokens — lives in the token file's
own header comment and `docs/design/frontend-design-brief.md` Part 2; this section is a summary,
not the source of truth.

- **Bases**: `asphalt #14171C` (dark), `chalk #F7F7F4` (light), `graphite #5A6069` (secondary
  text) — deliberately not pure black/white, and deliberately not a cream-and-terracotta look.
- **Effort scale** — the palette *is* the information, not decoration: `recovery #6FA8C9`,
  `easy #4FA97E`, `steady #C9A227`, `tempo #D9772B`, `interval #C6402F`. A color always means an
  intensity.
- One accent, `hivis #D8F14A`, reserved exclusively for the single primary forward-action of
  whatever screen you're on — boldness spent in exactly one place. (There is no "next workout"
  card in v1 — decision 5, 2026-07-10 — so hivis does not move to one; it stays on the primary
  CTA.)
- Type: a condensed grotesque for display and numerals (running is numbers — distance, pace,
  splits), a neutral body face, a mono face for split tables. Scale 32/24/20/17/15/13.
- **Signature element — the "week ribbon"**: each training week renders as seven cells colored
  by effort, rest days as gaps. A 16-week plan reads as a barcode of periodization at a glance.
  The plan view is meant to lead with the ribbon rather than a list. **This per-week micro ribbon
  is implemented** (`src/components/plan/WeekAccordion.tsx`); the macro periodization wave
  (`mvp-blueprint.md` Part 3) is not built yet.
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
