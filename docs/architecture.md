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
    _layout.tsx        # root layout — still the create-expo-app template
    index.tsx          # still the create-expo-app template
    explore.tsx         # still the create-expo-app template
  components/           # template UI (themed-text, themed-view, app-tabs, collapsible, ...)
  constants/theme.ts     # stock Expo template palette — see "Proposed visual direction" below
  hooks/                 # use-theme, use-color-scheme
  lib/
    supabase.ts          # the only app-specific (non-template) code that exists today
    __tests__/supabase.test.ts
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

There is no `src/lib/planTemplates.ts`, `planTypes.ts`, or `subscription.ts` yet; no auth
screens; no intake screen; no plan view; no `supabase/functions/`; no `supabase/migrations/`.
`tsconfig.json` maps `@/*` → `./src/*` and `@/assets/*` → `./assets/*`.

## Planned — route tree

```
src/app/
  (auth)/sign-in, sign-up
  (tabs)/index          # Home / Create plan
  (tabs)/plans          # My Plans (history)
  intake/                # onboarding questionnaire (stack)
  plan/[id]              # plan view
  paywall, settings
```

## Planned — `src/lib/` layout

```
src/lib/
  supabase.ts            # exists today
  planTemplates.ts        # planned — free-tier hard-coded plans (5K/10K/half/marathon x 8/12/16wk)
  planTypes.ts             # planned — shared Plan/Week/Workout/Tier types, one source of truth
                            #           for the app and the edge functions
  subscription.ts          # planned — tier read + dummy purchase
```

## Planned — `generate-plan` edge function flow

The core of the app. Full tier/quota/validation detail:
[`docs/reference/plan-generation.md`](reference/plan-generation.md).

1. Authenticate the JWT — reject anonymous requests.
2. Read tier + `count(plans)` in the current period, server-side; reject requests over quota.
3. Branch by tier. **All three tiers build on the same coach-authored template skeleton — it is
   never removed.** What scales across tiers is how much of the runner the plan reasons about and
   how much it explains, never how much of the coach's judgment is taken away. **Free** → select +
   lightly parametrize the skeleton, no AI call, effort descriptions only. **Pro** → the skeleton +
   Claude personalizes workouts, paces, HR zones, and a weekly "why" within it. **Elite** → the same
   skeleton, customized far more heavily: richest prompt (injury history, periodization nuance, race
   context), a per-workout "why", plus any confirmed extras — still inside the skeleton.
4. Validate the result structurally; on failure retry once; on a second failure fall back to
   the matching template plan and mark it `is_fallback: true`.
5. Insert into `plans`, return the plan.

The deterministic load-rule clamp (volume caps, deload cadence, long-run caps) applies identically
to all three tiers — while building the template for Free, and as a post-generation clamp on
Claude's output for Pro and Elite. See
[`docs/reference/plan-generation.md`](reference/plan-generation.md) for why: selling the top tier
as the one with the guardrail removed would be backwards.

## Planned — API

The client never talks to Postgres for privileged operations — those go through edge
functions. Plain reads of the caller's own rows go through the Supabase client, protected by
RLS.

| Method / Route | Auth | Body | Returns | Notes |
|---|---|---|---|---|
| `POST /functions/v1/generate-plan` | JWT | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes? }` | `{ plan, planId, isFallback }` or `402` over-quota / `403` anon | Enforces tier + quota server-side, branches by tier, validates, persists. |
| `POST /functions/v1/purchase-tier` | JWT | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart, periodEnd }` | v1 dummy flow. v2 swaps `source` to `"revenuecat"` and verifies the receipt — same route, same table write. |
| `GET /functions/v1/quota-status` | JWT | — | `{ tier, used, limit, periodEnd }` | Drives the Home "2 of 3 plans left" UI. Computed from `count(plans)`, never a client counter. |

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
                   plan jsonb, is_fallback bool, created_at)
```

Quota check = `count(plans) where user_id = X and created_at in current period` compared
against the tier limit — no separate counter table to drift out of sync.

**RLS rule for every table**: `user_id = auth.uid()` for select/insert of the caller's own
rows. Tier and quota columns are only ever written by edge functions running as the service
role — the client can never write its own tier or quota.

## Proposed visual direction (not yet in `theme.ts`)

`src/constants/theme.ts` today is still the stock Expo template palette — light `#000000` /
`#ffffff` / `#F0F0F3` / `#E0E1E6` / `#60646C`, dark `#ffffff` / `#000000` / `#212225` /
`#2E3135` / `#B0B4BA` — plus `Fonts` (system-ui/serif/rounded/mono), `Spacing` (half=2, one=4,
two=8, three=16, four=24, five=32, six=64), `BottomTabInset`, and `MaxContentWidth = 800`. The
PACE palette below is a proposal from the frontend-design skill; it does not exist in code and
is recorded here so it isn't lost before implementation.

- **Bases**: `asphalt #14171C` (dark), `chalk #F7F7F4` (light), `graphite #5A6069` (secondary
  text) — deliberately not pure black/white, and deliberately not a cream-and-terracotta look.
- **Effort scale** — the palette *is* the information, not decoration: `recovery #6FA8C9`,
  `easy #4FA97E`, `steady #C9A227`, `tempo #D9772B`, `interval #C6402F`. A color always means an
  intensity.
- One accent, `hivis #D8F14A`, reserved exclusively for "your next workout" and the primary
  CTA — boldness spent in exactly one place.
- Type: a condensed grotesque for display and numerals (running is numbers — distance, pace,
  splits), a neutral body face, a mono face for split tables. Scale 32/24/20/17/15/13.
- **Signature element — the "week ribbon"**: each training week renders as seven cells colored
  by effort, rest days as gaps. A 16-week plan reads as a barcode of periodization at a glance.
  The plan view is meant to lead with the ribbon rather than a list.
- Accessibility rule, non-negotiable: an effort color is never the only signal — always pair it
  with a text label, so the plan stays legible to color-blind users.
- Standing rule (already in the engineering spec): theme tokens only, no hardcoded colors or
  spacing in components.
