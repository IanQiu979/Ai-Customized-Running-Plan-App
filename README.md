# V2.2 — Running Training Plan Builder

An Expo / React Native app that turns a runner's intake answers (goal, experience, schedule,
target race) into a structured, week-by-week training plan. Part of the **PACE family**: it is
deliberately narrow — it builds plans, it is not a training log.

## Status

**Scaffold / pre-implementation.** This repo is currently a stock Expo SDK 54 app
(expo-router template) with no product code written yet — no auth, no database, no plan
generation, no Supabase dependency, no tests. Everything described below past this section is
the *design*, not shipped behavior. See `planning/` for the full spec:

- [`planning/01-brainstorm.md`](planning/01-brainstorm.md) — goal, milestones, open questions
- [`planning/02-product-requirements.md`](planning/02-product-requirements.md) — who it's for, tiers, user flow, milestones
- [`planning/03-engineering-requirements.md`](planning/03-engineering-requirements.md) — stack, architecture, edge functions, DB schema, security

## Stack (planned)

| Layer | Choice | Notes |
|-------|--------|-------|
| App | Expo / React Native + TypeScript, expo-router | |
| Auth | Supabase Auth — Google OAuth + Sign in with Apple + email/password | Required sign-up, no guest mode in v1 |
| Database | Supabase Postgres | New project, separate from other PACE-family apps |
| Server logic | Supabase Edge Functions (Deno) | AI calls + quota enforcement live here, never in the client |
| AI | Claude API (`claude-sonnet-5`) via edge function | API key stays server-side, never in the app bundle |
| Payments | Dummy (v1) → RevenueCat/StoreKit (v2) | Apple requires real IAP for public release; dummy is TestFlight-only |
| Hosting/builds | EAS Build, TestFlight | |

## Tiers (planned)

| Tier | Plans | Engine | Quality |
|------|-------|--------|---------|
| **Free** | 1 total | Templates only | Basic hard-coded plan for the chosen distance/duration |
| **Pro** | 3 / month | AI + template hybrid | Personalized paces, HR zones, warm-ups/drills, coach-style "why" per week |
| **Elite** | 10 / month | Same skeleton, customized far more heavily — richest prompt | Everything in Pro plus mid-plan adjustments, race-day strategy, deeper periodization |

All three tiers build on the same coach-authored template skeleton — it is never removed. Elite
customizes it far more heavily than Pro (richest prompt, per-workout "why," any confirmed extras);
it does not trade away the skeleton for an unconstrained AI plan. The deterministic load-rule clamp
(volume caps, deload cadence, long-run caps) applies identically to all three tiers. See
`docs/reference/plan-generation.md` for the full design.

Quotas reset monthly for Pro/Elite (Free is 1 plan total) and are enforced **server-side** in
the `generate-plan` edge function — the client never decides or tracks its own quota. The Elite
extras above are still marked "proposed, to confirm" in the product requirements doc.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values, see Environment below
npx expo start
```

Other scripts (from `package.json`):

```bash
npm run ios      # expo start --ios
npm run android  # expo start --android
npm run web      # expo start --web
npm run lint     # expo lint
```

## Environment

`.env` is gitignored and holds your real values; `.env.example` is the committed template —
copy it, don't edit it in place.

- **Client variables** must be prefixed `EXPO_PUBLIC_`. Expo inlines these in plain text into
  the compiled app bundle, so treat anything with this prefix as public. The two client vars are:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — safe to ship publicly because Postgres Row Level
    Security (RLS) is what actually protects the data, not secrecy of this key.
- **The Anthropic API key never goes in `.env` and never gets an `EXPO_PUBLIC_` prefix.** It is
  an edge-function secret, set with `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`. For
  local edge-function development it lives in `supabase/functions/.env` instead (also
  gitignored).
- Supabase automatically injects `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and
  `SUPABASE_SECRET_KEYS` into edge functions at runtime — you don't set those yourself.

## Project structure

What exists today:

```
src/
  app/                  # expo-router screens
    _layout.tsx
    index.tsx
  constants/
    theme.ts            # "Instrument & Matter" design tokens — see docs/architecture.md
  hooks/
    use-color-scheme.ts
    use-color-scheme.web.ts
    use-theme.ts
  lib/
    supabase.ts         # env-guarded Supabase client
    planTypes.ts        # shared Plan/Week/Workout/Tier types
    loadRules.ts        # deterministic safety arithmetic, 19 unit tests
    __tests__/
      supabase.test.ts
      loadRules.test.ts
```

Planned layout (not yet built — see `planning/03-engineering-requirements.md`):

```
src/app/
  (auth)/sign-in, sign-up
  (tabs)/index         # Home / Create plan
  (tabs)/plans         # My Plans (history)
  intake/               # onboarding questionnaire
  plan/[id]             # plan view
  paywall, settings

lib/
  supabase.ts           # client init
  planTemplates.ts      # free-tier hard-coded plans
  planTypes.ts          # shared Plan/Week/Workout types
  subscription.ts       # tier read + dummy purchase

supabase/functions/
  generate-plan/        # core plan-generation edge function
```

## Roadmap

- **M1 — Foundation**: Expo app scaffolded, Supabase project, required sign-up working.
- **M2 — Intake**: onboarding questionnaire persists to the database.
- **M3 — Plan engine**: free template plans + paid AI plans generate reliably; plan view renders.
- **M4 — Tiers & quotas**: dummy paywall, tier and quota enforcement server-side.
- **M5 — My Plans**: history tab, plan persistence, re-open past plans.
- **M6 — Polish & TestFlight**: empty states, errors, loading, app icon/splash, TestFlight build.

Full milestone "done" criteria are in `planning/02-product-requirements.md`.

## License

MIT — see [`LICENSE`](LICENSE). Note the license file currently carries the copyright of
650 Industries, Inc. (Expo) from the `create-expo-app` template it was generated from.
