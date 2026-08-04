# `workers/` — the Pace Blueprint backend

Cloudflare Workers + D1 + better-auth. This is the app's real backend; `supabase/` is dead
scaffold kept only so the earlier design is still readable (see "Why not Supabase" below).

A separate npm project on purpose. `wrangler`, `better-auth`, and `vitest` have no business in the
Expo dependency tree, and Metro is told to skip this directory entirely (`metro.config.js` at the
repo root). Traffic goes one way only: the Worker imports the shared pure modules in `../src/lib/`
(`planTypes.ts`, `tierLimits.ts`, `quotaPeriod.ts`); nothing in the app imports from here.

## Run it

Everything below works **offline, with no Cloudflare account and no `wrangler login`.**

```bash
npm --prefix workers install
cp workers/.dev.vars.example workers/.dev.vars   # then set BETTER_AUTH_SECRET
npm --prefix workers run db:migrate:local        # applies migrations/ into local D1
npm --prefix workers run dev                     # wrangler dev on :8787
```

Verification gate (both must be clean before a commit that touches this directory):

```bash
npm --prefix workers run typecheck
npm --prefix workers test
```

The root `npm run typecheck && npm run lint && npm test` deliberately does **not** cover this
project — different runtime, different type system, different test runner. Root config excludes it
in three places: `tsconfig.json`, `eslint.config.js`, `jest.config.js`.

## Layout

```
workers/
  wrangler.toml          # bindings + non-secret vars. Committed, so nothing secret goes in it.
  .dev.vars.example      # template for .dev.vars (gitignored) — local secrets
  migrations/
    0001_better_auth.sql # user, session, account, verification — better-auth's own tables
    0002_app_schema.sql  # profiles, intake_responses, subscriptions, plans + the quota ledger
  src/
    index.ts             # entry: authenticate once, then dispatch. The route table lives here.
    auth.ts              # better-auth wired to D1
    routes.ts            # the app's handlers, each taking an already-verified userId
    deps.ts              # THE ONLY FILE THAT READS A SECRET, and the only one that binds seams
    env.ts               # the bindings/env contract
    http.ts              # { error, code } envelope
    lib/
      store.ts               # every D1 statement. Authorization lives here — read its header.
      generate-plan-flow.ts  # the eleven pipeline steps, pure, all deps injected
      planEngine.ts          # skeleton + personalizer seams (skeleton bound 2026-08-04, personalizer not — see below)
      planValidation.ts      # structural validation, shape only
      model.ts               # the Anthropic call, behind an injectable seam
  test/                  # vitest, inside real workerd + real D1 (Miniflare). No network.
```

## What works today, and what does not

Working end to end, verified against `wrangler dev` and by 86 tests:

- email/password sign-up and sign-in, sessions, Bearer-token auth for the React Native client
- the quota ledger: reserve → settle/release, atomic gate, idempotency replay, fallback exemption
- `quota-status`, `purchase-tier`, `delete-account`, intake read/write, plan reads
- `generate-plan` — Free tier (and, as a template fallback, Pro/Elite) returns a real generated
  plan, as of the 2026-08-04 `createTemplateSkeletonBuilder()` binding in `src/deps.ts`

**One binding in `src/deps.ts` remains unwired: `promptBuilder`.** It needs the Pro/Elite
personalization prompt, which is coaching-sensitive work of its own — until it lands, Pro/Elite
generation falls back to the same template Free gets (`isFallback: true`, quota-exempt).

It is deliberately bound to a typed unimplemented seam rather than a mock. `src/lib/planEngine.ts`'s
header explains why at length; the short version is that the sibling repo shipped a mock as its
production client and served nothing but dead ends for weeks.

## What the captain has to do (nobody else can)

Everything above is local. These need accounts:

| Step | Command | Why only you |
|---|---|---|
| Cloudflare login | `wrangler login` | Interactive, opens a browser |
| Create the database | `wrangler d1 create pace-blueprint` | Then paste the id into `wrangler.toml`'s `database_id`, which is a placeholder today |
| Apply migrations remotely | `npm --prefix workers run db:migrate:remote` | Needs the above |
| Auth secret | `wrangler secret put BETTER_AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| Anthropic key | `wrangler secret put ANTHROPIC_API_KEY` | Your account, your billing |
| Google OAuth | `wrangler secret put GOOGLE_CLIENT_ID` / `..._SECRET` | Your Google Cloud project — see `src/auth.ts`'s TODO for the exact console steps |
| Deploy | `wrangler deploy` | Needs all of the above |

This mirrors the Supabase path exactly: `wrangler login` is `supabase login`, and
`wrangler secret put` is `supabase secrets set`.

## Secrets

Same discipline as the app, one directory over:

- `wrangler.toml [vars]` is **committed** — non-secret config only, the Cloudflare analogue of the
  `EXPO_PUBLIC_` trap.
- `.dev.vars` is **gitignored** — local secrets, the analogue of `supabase/functions/.env`.
- `ANTHROPIC_API_KEY` is read in exactly one place, `src/lib/model.ts`, reached from exactly one
  place, `src/deps.ts`. Nothing here may ever acquire an `EXPO_PUBLIC_` prefix or move into the
  repo-root `.env`: Expo inlines those in plain text into the app bundle.

## Why not Supabase

A captain's call, not a technical verdict on Supabase: the Supabase project-slot constraint, and a
preference for a stack that stays genuinely free at this stage. Cloudflare also clears the bar that
ruled out Firebase's free tier — Workers can make outbound `fetch` calls, which `generate-plan`
needs to reach Anthropic.

The relational design was **not** re-decided. It is the same schema, the same quota rules, and the
same API shape as `docs/architecture.md`'s Supabase draft, translated into SQLite. What SQLite
could not take verbatim is enumerated at the top of `migrations/0002_app_schema.sql`; the headline
is that **there is no RLS**, so ownership is enforced in `src/lib/store.ts` and nowhere else.

`supabase/` is left in place, untouched and unused. Deleting it is a separate decision.
