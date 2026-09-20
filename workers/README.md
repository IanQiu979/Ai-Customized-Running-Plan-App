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
    0003_*.sql           # the 13+ intake age floor
    0004_guardian_consent.sql # guardian_consent — one consent event per 13–17 user, written in the
                         #  same batch as the intake row (issue #89; docs/architecture.md has the schema)
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
      planEngine.ts          # skeleton + personalizer seams (bound 2026-08-04 and 2026-08-10)
      planValidation.ts      # structural validation, shape only
      model.ts               # the Anthropic call, behind an injectable seam
  test/                  # vitest, inside real workerd + real D1 (Miniflare). No network.
```

## Temporary captain test mode

`workers/wrangler.toml` currently sets `ALL_USERS_UNLIMITED_ACCESS = "true"`. The single control
point is `src/access.ts`: every authenticated account is evaluated as Elite and quota refusal is
bypassed, while subscriptions, purchases, and the normal quota ledger stay intact underneath.
Set the variable to `"false"` in both Wrangler environments before real users arrive.

## The v1 dummy purchase gate

`POST /api/purchase-tier` (`source: 'dummy'`) is gated by two non-secret vars, read only in
`src/dummyPurchase.ts`: `DUMMY_PURCHASE_ENABLED` (`"true"` opens it to every authenticated caller)
and `DUMMY_PURCHASE_ALLOWLIST` (comma-separated exact emails, matched case-insensitively but never
as a substring, allowed through even when disabled). Local/dev's `wrangler.toml [vars]` sets
`DUMMY_PURCHASE_ENABLED = "true"`; `[env.production.vars]` leaves it absent (equivalent to
`"false"`) with an empty allowlist, so production ships with the dummy purchase off for everyone
until the captain adds a tester. Both `GET /api/quota-status` and `POST /api/purchase-tier` decide
this server-side and expose it as `purchasesAvailable` — the paywall only renders that flag, it
never computes availability itself. To let a trusted tester in on production, the captain edits
`DUMMY_PURCHASE_ALLOWLIST` in `wrangler.toml`'s `[env.production.vars]` (append the email) and
runs `wrangler deploy --env production` — it is a committed `[vars]` value, not a secret, so there
is no `wrangler secret put` for it.

## What works today, and what does not

Working end to end, verified against `wrangler dev` and the Worker test suite:

- email/password sign-up and sign-in, sessions, Bearer-token auth for the React Native client
- password reset and email verification (issue #94) — the full token round trip against D1, with
  mail going through the provider-agnostic sender in `src/lib/mail.ts`; inert (`ConsoleAdapter`)
  until the captain configures Resend, see `docs/email-setup.md`
- the quota ledger: reserve → settle/release, atomic gate, idempotency replay, fallback exemption
- `quota-status`, `purchase-tier`, `delete-account`, intake read/write, plan reads
- `generate-plan` — Free tier (and, as a template fallback, Pro/Elite) returns a real generated
  plan, as of the 2026-08-04 `createTemplateSkeletonBuilder()` binding in `src/deps.ts`

**Both bindings in `src/deps.ts` are wired.** The template skeleton landed on 2026-08-04 and the
Pro/Elite personalization prompt (`src/lib/planPersonalizationPrompt.ts`) on 2026-08-10. The prompt
can add coaching prose only; it cannot replace the skeleton's safety-clamped numbers. The remaining
gap is `ANTHROPIC_API_KEY`, still unset everywhere, so `resolveModelCaller` selects the honest
unconfigured caller and Pro/Elite generation falls back to the template (`isFallback: true`,
quota-exempt) until the captain provisions the key.

## What the captain has to do (nobody else can)

Everything above is local. These need accounts — and **every one of them needs `--env production`**,
because the deployed Worker is the named `production` environment (`pace-blueprint-production`), not
the bare `pace-blueprint`. A `wrangler secret put` without the flag succeeds, prints a cheerful
confirmation, and writes the secret onto a *different* Worker that nothing talks to. That is not
hypothetical: it is one of the two ways Google sign-in can present as `PROVIDER_NOT_FOUND` on a
Worker whose secrets you are certain you set.

| Step | Command | Why only you |
|---|---|---|
| Cloudflare login | `wrangler login` | Interactive, opens a browser |
| Create the database | `wrangler d1 create pace-blueprint` | Done — the id is committed in `wrangler.toml` |
| Apply migrations remotely | `npm --prefix workers run db:migrate:remote` | Needs the above |
| Auth secret | `wrangler secret put BETTER_AUTH_SECRET --env production` | Generate with `openssl rand -base64 32`. Done |
| Anthropic key | `wrangler secret put ANTHROPIC_API_KEY --env production` | Your account, your billing |
| Google OAuth | `wrangler secret put GOOGLE_CLIENT_ID --env production` / `..._SECRET --env production` | Done 2026-08-09; the provider is registered in production. The token exchange and consent-screen publishing status remain unproven. Your Google Cloud project; see below |
| Transactional mail | `wrangler secret put RESEND_API_KEY --env production` / `MAIL_FROM --env production` | Your domain, your Resend account. Off until both exist; **[`docs/email-setup.md`](../docs/email-setup.md)** is the runbook (DNS, the `MAIL_VERIFICATION_REQUIRED` flag, the `curl /api/email-status` check) |
| Deploy | `wrangler deploy --env production` | Needs all of the above |

This mirrors the Supabase path exactly: `wrangler login` is `supabase login`, and
`wrangler secret put` is `supabase secrets set`.

### Google OAuth, specifically

Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 Client ID of type
**Web application**. Both of these must be listed under "Authorized redirect URIs" on the *same*
client, or whichever is missing fails the round trip with `redirect_uri_mismatch`:

```
http://localhost:8787/api/auth/callback/google                                      # wrangler dev
https://pace-blueprint-production.i78979848.workers.dev/api/auth/callback/google    # production
```

The production URI is `[env.production.vars] BETTER_AUTH_URL` + `/api/auth/callback/google`;
better-auth derives it from that var, so the two can never be allowed to drift apart.

To check which state a Worker is in, without a device or a browser:

```sh
curl -X POST https://<origin>/api/auth/sign-in/social \
  -H 'content-type: application/json' -d '{"provider":"google","callbackURL":"/"}'
```

`{"code":"PROVIDER_NOT_FOUND"}` means the two secrets are absent (or blank, or on the wrong
Worker — see the `--env production` note above). A JSON body containing a
`https://accounts.google.com/...` `url` means the provider is registered and the failure, if any,
is further down the round trip.

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
