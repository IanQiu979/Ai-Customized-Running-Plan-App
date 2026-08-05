# V2.2 — Running Training Plan Builder

An Expo / React Native app that turns a runner's intake answers (goal, experience, schedule,
target race) into a structured, week-by-week training plan. Part of the **PACE family**: it is
deliberately narrow — it builds plans, it is not a training log.

## Status

**Backend spine built; the first end-to-end user loop (sign-up → intake → generate a plan → view
it → My Plans) works client-side too.** The Cloudflare backend in [`workers/`](workers/README.md)
works end to end against local emulation — auth, the quota ledger, `quota-status`, `purchase-tier`,
`delete-account`, intake, plan reads, and `generate-plan`'s free-tier template engine — but nothing
is deployed, and the Pro/Elite AI-generation path is not yet built. On the client, auth screens,
the intake screen, the generate-plan action, a plan view (real plans plus the permanent
golden-fixture example), and a My Plans list all exist. Still missing: quota/tier display UI and
the dummy paywall. Everything described below that is marked *planned* is design, not shipped
behavior. Current state: [`docs/mvp-progress.md`](docs/mvp-progress.md). Full spec:

- [`planning/01-brainstorm.md`](planning/01-brainstorm.md) — goal, milestones, open questions
- [`planning/02-product-requirements.md`](planning/02-product-requirements.md) — who it's for, tiers, user flow, milestones
- [`planning/03-engineering-requirements.md`](planning/03-engineering-requirements.md) — stack, architecture, server routes, DB schema, security (written against the Supabase design that Cloudflare replaced; the rules survive, the vendor does not)

## Stack

**The backend is Cloudflare, not Supabase** (decision, 2026-08-02): a Supabase project-slot
constraint, plus a preference for a stack that stays genuinely free at this stage. Cloudflare also
clears the bar that ruled Firebase's free tier out — Workers can make outbound `fetch` calls, which
plan generation needs to reach Anthropic. `supabase/` and `src/lib/supabase.ts` remain in the repo,
unused, and are marked legacy.

| Layer | Choice | Notes |
|-------|--------|-------|
| App | Expo / React Native + TypeScript, expo-router | |
| Auth | better-auth on D1 — email/password today, Google OAuth coded but unprovisioned | Required sign-up, no guest mode in v1. Apple Sign-In parked ([`docs/apple-dev-blocked.md`](docs/apple-dev-blocked.md)) |
| Database | Cloudflare D1 (SQLite) | **No row-level security** — ownership is enforced in Worker code, see [`docs/architecture.md`](docs/architecture.md) |
| Server logic | Cloudflare Workers (`workers/`) | AI calls + quota enforcement live here, never in the client |
| AI | Claude API (`claude-sonnet-5`) via a Worker route | API key stays server-side, never in the app bundle |
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
the `generate-plan` Worker route — the client never decides or tracks its own quota. The Elite
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
  the compiled app bundle, so treat anything with this prefix as public. The two that exist
  (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are **legacy**: nothing reads
  them except `src/lib/supabase.ts`, which nothing imports. They go when the client is moved onto
  `workers/`.
- **Server variables live in `workers/`, not here.** `workers/.dev.vars` (gitignored;
  `.dev.vars.example` is the template) for local development, `wrangler secret put NAME` for
  production. That covers `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY`, and the Google OAuth pair.
- **`workers/wrangler.toml` is committed**, which makes its `[vars]` block the Cloudflare
  equivalent of the `EXPO_PUBLIC_` trap: public configuration only, never a secret.
- **The Anthropic API key never goes in `.env` and never gets an `EXPO_PUBLIC_` prefix.** It is read
  in exactly one file, `workers/src/lib/model.ts`. No key is configured anywhere today; with none,
  plan generation degrades to the template plan rather than failing.

## Project structure

What exists today:

```
src/
  app/
    _layout.tsx
    (auth)/
      sign-in.tsx, sign-up.tsx  # email/password; "Continue with Google" verified in local dev,
                                 #   production pending (see docs/mvp-progress.md)
    (tabs)/
      _layout.tsx
      index.tsx          # Home
      glossary.tsx        # run-type abbreviations glossary
      my-plans.tsx          # My Plans — lists GET /api/plans
    intake.tsx              # onboarding questionnaire, against GET/PUT /api/intake
    plan/[id].tsx          # plan view — real plans via GET /api/plans/:id, plus the permanent
                            #  golden-fixture example
  components/
    plan/                  # plan-view UI: nameplate, effort chip, workout row, week accordion, ...
  constants/
    theme.ts                # "Instrument & Matter" design tokens
  hooks/
    use-color-scheme.ts, use-color-scheme.web.ts, use-theme.ts
  lib/
    apiClient.ts             # better-auth's Expo client + typed fetch wrappers for every /api/* route
    loadRules.ts             # deterministic safety clamp
    notation.ts               # run-type abbreviations + structure-string shorthand
    planTypes.ts               # shared Plan/Week/Workout types
    planTemplates.ts             # free-tier deterministic template plans
    paceDerivation.ts             # pace/HR-zone derivation
    tierLimits.ts                   # the one copy of the tier limits — app AND worker
    quotaPeriod.ts                   # currentPeriod() — app AND worker
    supabase.ts                       # LEGACY, unused
    fixtures/examplePlan.ts            # golden fixture plan

workers/                     # the Cloudflare backend — see workers/README.md
  wrangler.toml
  migrations/                 # 0001 better-auth's tables, 0002 the app's
  src/                         # index, auth, routes, deps, lib/{store,generate-plan-flow,model,...}
  test/                         # 86 tests in real workerd against real D1
```

Planned, not yet built — see `planning/03-engineering-requirements.md`:

```
src/app/
  paywall, settings   # dummy paywall + tier display
```

## Roadmap

- **M1 — Foundation**: Expo app scaffolded, backend + auth working, required sign-up. *Client auth screens done; Google OAuth needs the captain's credentials.*
- **M2 — Intake**: onboarding questionnaire persists to the database. *Done.*
- **M3 — Plan engine**: free template plans + paid AI plans generate reliably; plan view renders. *Template path done; Pro/Elite AI personalization not yet built.*
- **M4 — Tiers & quotas**: dummy paywall, tier and quota enforcement server-side. *Server-side quota enforcement done; no client UI yet.*
- **M5 — My Plans**: history tab, plan persistence, re-open past plans. *Done.*
- **M6 — Polish & TestFlight**: empty states, errors, loading, app icon/splash, TestFlight build.

Full milestone "done" criteria are in `planning/02-product-requirements.md`.

## License

MIT — see [`LICENSE`](LICENSE). Note the license file currently carries the copyright of
650 Industries, Inc. (Expo) from the `create-expo-app` template it was generated from.
