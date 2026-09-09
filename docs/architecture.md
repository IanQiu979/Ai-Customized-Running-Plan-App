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
                          #                constants/navigation-theme.ts's tokened Theme, and
                          #                gates the whole Stack behind Stack.Protected on
                          #                authClient.useSession() (no anonymous browsing)
    (auth)/
      _layout.tsx          # stack layout for the signed-out route group
      index.tsx             # redirect anchor -> onboarding (2026-08-08; was sign-up). Note this is
                            #   the anchor for EVERY signed-out session, not just first install
      onboarding.tsx        # 2026-08-08 — the signed-out landing screen. Rebuilt 2026-09-03 as a
                            #   scroll-down read: pulse-trace cover (components/onboarding/), a
                            #   SCROLL cue, three numbered beats, then "Get started" -> sign-up and
                            #   the sign-in skip. No form; the CTA is disabled until the hero
                            #   settles, bounded by a 4s ceiling so an onSettled that never
                            #   arrives cannot strand the only forward action (2026-09-04)
      sign-in.tsx            # email/password sign-in + a "Continue with Google" button; Google
                              #   provider live in production since 2026-08-09. Since 2026-09-03 it
                              #   carries the same pulse-trace field at `band` height and a "Back to
                              #   the start" link to onboarding
      sign-up.tsx            # email/password sign-up + the same Google button, same treatment and
                              #   the same link back
                            #   both auth screens scroll (KeyboardAvoidingView + ScrollView) as of
                            #   2026-08-08 — centred content used to be unreachable under a keyboard
    (tabs)/
      _layout.tsx          # tab bar — all four tabs today: Home, Glossary, My Plans, Settings
                            #           (Settings added 2026-08-05)
      index.tsx             # Home — quota line, the runner's target READ BACK from saved intake
                             #  (never re-asked), and Generate plan. As of 2026-08-15 it no longer
                             #  carries its own goal-type / race-distance / race-date panel: that
                             #  duplicated intake and blocked a runner with no race. The only field
                             #  left is a plan length, shown only when there is no race date to
                             #  derive one from; "Change" routes to /intake. Decision logic lives in
                             #  src/lib/planRequest.ts, not here.
      settings.tsx           # Settings tab (new 2026-08-05) — tier + quota (GET
                              #  /api/quota-status, src/lib/quotaDisplay.ts), sign-out (moved off
                              #  Home), a Free-tier "Upgrade" entry point to /paywall, and Delete
                              #  Account (native confirm -> deleteAccount() -> authClient.signOut())
      glossary.tsx           # abbreviations glossary — sourced from notation.ts, nothing hardcoded
      my-plans.tsx           # My Plans — lists plans off GET /api/plans, refetched on every tab
                              #            focus (useFocusEffect), not just on mount
    intake.tsx               # onboarding questionnaire — THE ONLY place a target race is asked
                              # for (2026-08-15). Numeric answers use src/components/inputs/
                              # (segmented YYYY-MM-DD and H:MM:SS boxes, digit-filtered).
                              # Against GET/PUT /api/intake; its
                              # exit-header action replaces to Home ("Done" once intake exists,
                              # "Skip for now" otherwise), and as of 2026-08-05 a successful save
                              # also router.replace('/(tabs)')s there instead of staying put
    plan/[id].tsx            # plan view — `[id]` now selects: renders a real generated plan via
                              #  GET /api/plans/:id, or the permanent static golden fixture for the
                              #  example-plan id; shows GoalRealismNotice for both warned realism
                              #  outcomes ('ambitious' honoured, 'implausible' capped)
    paywall.tsx              # dummy paywall (new 2026-08-05) — a Stack route, reached from
                              #  Settings or from Home's generate-plan 402 over_quota catch;
                              #  calls POST /api/purchase-tier, honest "test upgrade" copy
    dev/pulse-trace.tsx      # DEV-ONLY preview of PulseTraceHero (new 2026-09-04) — reachable at
                              #  /dev/pulse-trace in a dev build, redirects home in release, linked
                              #  from nowhere. Self-draw tab + a scroll rehearsal with a sticky
                              #  band. Temporary: the onboarding rebuild may delete or keep it
  components/
    auth/                   # AuthField — the labelled text input both auth screens use
    brand/                  # RouteLine — the in-app contour ornament, two variants (header, card).
                             # The dusk-era DuskHero/DuskSpark were deleted 2026-09-03 with the
                             # gradient they drew on
    home/                   # LockedPanel, PlanContentTeaser — the Free-tier lock and its teaser
    intake/                 # IntakeExitAction — the questionnaire's header "Skip for now" / "Done"
    layout/                 # ScreenHeader, GroupedRows (Group / Row / ActionRow)
    nav/                    # TabBarIcon — the four tab glyphs, drawn not shipped as assets
    plan/                   # WeekAccordion, WorkoutRow, EffortChip, ReadoutBracket,
                             # PlanNameplate, DisclaimerFooter, FallbackNotice, GoalRealismNotice
                             # (new 2026-08-05 — renders Plan.goalRealism), format.ts
    onboarding/             # PulseTraceSlot (new 2026-09-03) — a marked INTEGRATION POINT. It
                             # renders the static end state of <PulseTraceHero>, the signature
                             # animation owned by a parallel branch; its props are a subset of that
                             # component's, so the swap is one import line. Illustration only,
                             # never the user's data
    ui/                     # ActionButton (new 2026-09-03) — PrimaryAction / SecondaryAction /
                             # ActionDivider / LinkAction. PrimaryAction IS the signal, so "one
                             # accent per screen" is a question about imports, not about review
    __tests__/              # render smoke tests: render, and pulseTraceHero (11 tests, new
                             # 2026-09-04)
    inputs/                 # NumberField, SegmentedField, DateField, ClockField (new 2026-08-15) —
                             # every numeric/structured answer in the app. Keystrokes are filtered
                             # through src/lib/fieldInput.ts; dates and times are segmented boxes
                             # with the `-`/`:` printed, never typed. No screen uses a raw
                             # <TextInput keyboardType="..."> for a number
  constants/
    theme.ts                # "Instrument" token system — current, see below
    pulseTrace.ts            # the pulse trace's OWN palette, timings and field heights (new
                              #  2026-09-04). Duplicates Accent.field/Accent.signal as
                              #  PulseTracePalette.field/.trace — same hexes, verified; folding it
                              #  into a re-export from theme.ts is the follow-up once both branches
                              #  have landed
    navigation-theme.ts      # bridges theme.ts's tokens into expo-router's re-exported `Theme`
                             #  shape, so ThemeProvider never leaks the library's own stock
                             #  DefaultTheme/DarkTheme colors (fixes issue #27)
    __tests__/                # navigation-theme, and theme.contrast (new 2026-09-03) — the latter
                             #  recomputes every ratio in the design doc's tables from theme.ts's
                             #  own hexes, so the contrast rule is enforced rather than documented
  hooks/                    # use-theme, use-color-scheme
  lib/
    supabase.ts             # LEGACY, unused — see below
    apiClient.ts             # the one module that talks to `workers/`: better-auth's Expo client
                              #  (`authClient` — sign-up/sign-in/sign-out/useSession, session
                              #  persisted via expo-secure-store) plus typed fetch wrappers for
                              #  every other `/api/*` route; re-exports apiErrors.ts's error
                              #  vocabulary so screens keep one import site
    apiErrors.ts              # pure error vocabulary for every `/api/*` call: `ApiError` (server
                               #  answered and refused) vs `NetworkError` (nothing answered),
                               #  `describeError()` for the user-facing message. Split out so it
                               #  has no React/expo-secure-store/@better-auth dependency and can be
                               #  unit-tested directly (2026-08-07, `Network request failed` fix)
    postSignupRedirect.ts    # one-shot module-level flag so a fresh signup lands on Intake — see
                              #  "Sign-up → Intake redirect" below
    planTypes.ts              # canonical — shared Plan/Week/Workout/Tier vocabulary
    loadRules.ts               # canonical — deterministic safety arithmetic
    notation.ts                 # canonical — run-type/structure-string notation, the code
                                 #             counterpart of `notation.md`, 13 unit tests
    paceDerivation.ts        # pure Riegel/training-pace/goal-realism arithmetic
    planTemplates.ts         # pure deterministic, distance-specific engine — the PAID skeleton
                              #  and the fallback engine
    planLibrary/             # pure (new 2026-09-09) — the FREE tier's whole engine: the 40-plan
                              #  deterministic library, ported from
                              #  planning/research/plan-blueprint-examples.md. registry.ts,
                              #  calendars.ts, injury.ts, engine.ts (`buildLibraryPlan`),
                              #  openQuestions.ts. 53 unit tests
    tierLimits.ts                # canonical — the ONE copy of Free/Pro/Elite limits + the
                                  #             fallback-exemption cap. Imported by the app AND
                                  #             by `workers/`. 8 unit tests
    quotaPeriod.ts                # canonical — `currentPeriod(anchorDate, now)`, the purchase-day
                                   #            anchored window with the month-end clamp. Shared
                                   #            by the app and `workers/`. 10 unit tests
    planRequest.ts           # pure (new 2026-08-15) — intake owns the runner's target and Home
                              #  never re-asks it; also the shared stale-race-date guard. See the
                              #  src/lib/ notes below
    fieldInput.ts            # pure (new 2026-08-15) — the digit/decimal filters and clock/date part
                              #  parsers behind src/components/inputs/
    pulseTrace.ts            # pure (new 2026-09-04) — the pulse trace's geometry: beats -> strictly
                              #  x-monotonic polyline -> SVG path + lookup tables, `normalizeBeats`,
                              #  `beatsAtMarks`, and the `scrollProgress` worklet (the hook that
                              #  drives it from a ScrollView is usePulseTraceScroll, in
                              #  components/brand/PulseTraceHero.tsx). 23 unit tests
    goalRealismDisclosure.ts # pure, app-only copy helper (new 2026-08-15) — the ONE place that
                              #  decides whether a realism notice shows and what it says
                              #  ('plan' vs 'preview' tense); classification and cap arithmetic
                              #  stay in paceDerivation.ts
    quotaDisplay.ts          # pure, app-only display helper (new 2026-08-05) — `formatQuotaLine()`
                              #  phrases a `QuotaStatus` for Settings/Home/the paywall; the numbers
                              #  themselves stay server-computed, this only formats them
    fixtures/examplePlan.ts  # hand-built 5K screen fixture; `plan/[id].tsx` still renders it
    __tests__/               # supabase, loadRules, notation, examplePlan.fixture, tierLimits,
                              # quotaPeriod, planTemplates (golden + general + noRace),
                              # planLibrary/ (registry, engine — 65 tests, new 2026-09-09),
                              # paceDerivation, quotaDisplay (6 tests, new 2026-08-05),
                              # goalRealismDisclosure, planRequest, fieldInput (new 2026-08-15),
                              # pulseTrace (23 tests, new 2026-09-04)
                              # — the two engine contracts included
```

`src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts` are, like `planTypes.ts`, **pure and
dual-consumed** — no React, no Node, no Cloudflare globals — because `workers/src/` imports them
directly. That is deliberate: `planning/03-engineering-requirements.md` names `tierLimits.ts` and
requires one shared `currentPeriod()` specifically so `quota-status` can never promise a slot that
`generate-plan` then refuses, and so the Echo V1 "KEEP IN SYNC" drift cannot recur.

**Temporary captain test override (2026-08-09).** `workers/src/access.ts` interprets the non-secret
`ALL_USERS_UNLIMITED_ACCESS` Worker variable. While it is `"true"`, `D1PlanStore.quotaWindow()`
returns Elite with `limit: null`, reservation/settlement preserve the immutable ledger but never
refuse or count a slot, and the client labels the state as unlimited. This is one reversible
short-circuit over the entitlement system, not a replacement for it; set the variable to `"false"`
before real users arrive.

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
    lib/planEngine.ts       # skeleton + personalizer seams (bound 2026-08-04 and 2026-08-10);
                            # also the tier split — Free -> planLibrary, paid -> planTemplates
    lib/planValidation.ts   # structural validation, shape only
    lib/model.ts            # the Anthropic call, behind an injectable seam
  test/                     # vitest in real workerd + real D1 (Miniflare). No network;
                            # run `npm --prefix workers test` for the current count
```

Full operational detail — how to run it, what the captain must do himself, why the layout is what
it is — lives in [`workers/README.md`](../workers/README.md).

**Working today**, verified against `wrangler dev` and by the test suite: email/password auth with
Bearer sessions, the quota ledger (reserve → settle/release, atomic gate, idempotency replay,
fallback exemption), `quota-status`, `purchase-tier`, `delete-account`, intake read/write, and plan
reads. **`generate-plan` now returns a real plan**, as of the 2026-08-04 skeleton binding — Free
and, as a template fallback, Pro/Elite. **As of 2026-08-10 the Pro/Elite personalization prompt is
bound too** (`workers/src/lib/planPersonalizationPrompt.ts`) — see "generate-plan" below. The one
remaining gap is `ANTHROPIC_API_KEY`, unset everywhere, so Pro/Elite generation still serves the
template plan as a quota-exempt fallback until the captain provisions it.

`src/lib/supabase.ts` and `supabase/functions/.env.example` are **legacy**. Nothing imports the
Supabase client any more and no Supabase project is used. Both are kept rather than deleted so the
earlier design stays readable, and because removing them is its own decision.

For the record of what it did while it was live, `src/lib/supabase.ts` exports `supabase`, built
with `createClient(url, publishableKey, { auth: {...} })`: `storage: AsyncStorage` on native only,
`autoRefreshToken`/`persistSession` on, `detectSessionInUrl: false`, `lock: processLock`, a throw
at import time if either `EXPO_PUBLIC_SUPABASE_*` var is missing, and an `AppState` listener that
starts/stops auto-refresh as the app foregrounds.

**The client half of Cloudflare auth now exists: `src/lib/apiClient.ts`.** It wraps better-auth's
Expo client (`@better-auth/expo/client`, session persisted via `expo-secure-store`) as `authClient`
— `signIn`, `signUp`, `signOut`, and `useSession` are re-exported straight from it for screens to
call directly — plus a small typed `apiFetch<T>()` wrapper and one function per non-auth
`/api/*` route (`getQuotaStatus`, `purchaseTier`, `deleteAccount`, `getIntake`/`putIntake`,
`listPlans`/`getPlan`, `generatePlan`). Those custom routes attach the stored session by reading
`authClient.getCookie()` onto the request's `cookie` header, since better-auth's Expo plugin only
replays the session automatically for calls made through `authClient` itself, not for plain
`fetch`. **As of 2026-08-09, this is native-only**: on web, `expo-secure-store` has no
implementation, so the Expo plugin is given a no-op storage adapter and `getCookie()` intentionally
returns `''`; `apiFetch` instead sends `credentials: 'include'` and lets the browser attach the
HttpOnly session cookie itself, which also requires `workers/src/cors.ts`'s exact-origin allowlist
(`CORS_ALLOWED_ORIGINS`) to answer credentialed preflights. A `403 unauthenticated` response also
triggers a best-effort `authClient.signOut()` before the original error is thrown, so a
server-revoked session clears the local authenticated shell instead of leaving the app looking
signed in. **As of 2026-08-07, the error vocabulary is its own pure module, `src/lib/apiErrors.ts`**
(`ApiError` for a server refusal, `NetworkError` for a transport failure that never reached a
server, `describeError()` to turn either into a message screens can show), re-exported from
`apiClient.ts` so screens keep a single import site; every screen's `catch` funnels through
`describeError` rather than checking `error instanceof ApiError` alone, since a bare fetch
`TypeError` used to fall through that check into a generic, misleading fallback message — see
`docs/change_log.md`'s 2026-08-07 entry for the full story. `src/app/(auth)/sign-in.tsx` and
`sign-up.tsx` are the two screens built against it —
email/password, plus a "Continue with Google" button. Native Google auth is driven by
`signInWithGoogle()` in `apiClient.ts`: it asks better-auth for an authorization URL without an
automatic redirect, opens `@better-auth/expo`'s browser proxy (so the browser receives the signed
OAuth state cookie), observes the deep-link result, turns callback errors into user copy, stores the
returned session cookie, verifies `getSession()`, and explicitly notifies the reactive session atom.
That last step prevents a successful return from leaving the runner on the auth form. Social sign-up
also marks `postSignupRedirect`, so first-time Google users follow the same Intake route as email
users. The production Worker has `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` bound and its live URL
uses the accepted deployed HTTPS callback, but token exchange and consent audience still require a
real human Google login; the exact proof and console contract are in
[`google-oauth-runbook.md`](google-oauth-runbook.md). Worker callback errors use a redacting logger
so token/state failures are visible without secrets. The root layout (`src/app/_layout.tsx`) reads `authClient.useSession()` and gates the entire route tree
on it with Expo Router's `Stack.Protected` — there is no anonymous browsing at all, matching every
`/api/*` route already 403ing anonymously.

**Sign-up → Intake redirect (2026-08-04).** A fresh signup must land on Intake, not on `(auth)` or
nowhere. `sign-up.tsx` unmounts as soon as `_layout.tsx`'s `Stack.Protected` swaps the signed-in
user into `(tabs)`/`intake`, in the same commit that its session becomes truthy — so a redirect
driven by `sign-up.tsx`'s own `useEffect` can lose that unmount race. The fix is
`src/lib/postSignupRedirect.ts`: a one-shot module-level flag (`markPostSignupRedirect()` /
`consumePostSignupRedirect()`), set by `sign-up.tsx` on a successful signup and consumed by
`_layout.tsx` — which never unmounts — in its own `useEffect` watching `session`, followed by
`router.replace('/intake')`. Any future post-signup routing decision belongs in `_layout.tsx` for
the same reason, not in a screen that's about to unmount. Intake itself therefore owns an explicit,
always-visible "Skip for now" header action that replaces to `/(tabs)`: Home permits a missing
intake and presents the existing "Complete your intake" prompt, so this is a working escape without
weakening the deliberate one-shot post-signup replace.

A known type-only friction: `@better-auth/expo` declares
a `typescript: ^6.0.3` peer against this project's pinned `~5.9.2`; `apiClient.ts` carries a
narrow, commented `as unknown as BetterAuthClientPlugin` cast plus a small interface merge to
restore `getCookie()`'s type, rather than bumping TypeScript (tried, broke ambient type resolution
project-wide, reverted).

`src/lib/planTypes.ts`, `src/lib/loadRules.ts`, `src/lib/notation.ts`,
`src/lib/paceDerivation.ts`, `src/lib/planTemplates.ts`, `src/lib/planLibrary/`,
`src/lib/tierLimits.ts`, and
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
reading its copy from `notation.ts`. **As of 2026-08-04, the pure generator is also wired into the
route**: `src/app/plan/[id].tsx` renders a real generated plan fetched via `GET /api/plans/:id` for
any real plan id, and falls back to the static fixture only for the example-plan id — the fixture
is the permanent demo/glossary example, not a stand-in for missing wiring.

There is no `subscription.ts` file — that planned module was never needed as its own thing;
`apiClient.ts`'s `getQuotaStatus()`/`purchaseTier()` wrappers cover the same ground, now consumed
by `src/app/(tabs)/settings.tsx` and `src/app/paywall.tsx` (both new 2026-08-05) as well as Home.
Intake now has a screen (`src/app/intake/`, against `GET`/`PUT /api/intake`), and My Plans now has
one too (`src/app/(tabs)/my-plans.tsx`, against `GET /api/plans`) — both as of 2026-08-04. No
`supabase/functions/`; no `supabase/migrations/`. Auth screens (`src/app/(auth)/`) and the
client-side API module (`src/lib/apiClient.ts`) now exist — see above.
`tsconfig.json` maps `@/*` → `./src/*` and `@/assets/*` → `./assets/*`, and **excludes `workers/`**
— that project has its own `tsconfig.json`, its own runtime, and its own type system, so the root
`npm run typecheck` deliberately does not cover it (same for `eslint.config.js` and
`jest.config.js`; the Workers gate is `npm --prefix workers run typecheck && npm --prefix workers
test`).

## Route tree — current + planned

```
src/app/
  (auth)/sign-in, sign-up  # exists today — email/password; Google provider live in production
                           # since 2026-08-09. Gated in by root Stack.Protected when there is no
                           # session.
  (tabs)/index          # Home / Create plan — exists today (placeholder shell + demo link)
  (tabs)/glossary       # exists today — abbreviations glossary, not in the original blueprint's
                         # tab list; added for Ian's 2026-07-11 notation ruling (see change_log.md)
  (tabs)/my-plans       # My Plans (history) — exists today, lists GET /api/plans
  (tabs)/settings       # exists today (2026-08-05) — tier + quota display, sign-out, delete
                         # account, an "Upgrade" entry point to /paywall (decision 1, 2026-07-10)
  intake/                # onboarding questionnaire (stack) — exists today, against GET/PUT
                         #  /api/intake
  plan/[id]              # plan view — exists today; renders a real generated plan via
                         #  GET /api/plans/:id, or the permanent static golden fixture for the
                         #  example-plan id
  paywall                # exists today (2026-08-05) — dummy purchase-tier UI, a Stack route
                         #  reached from Settings or from Home's 402 over_quota catch
  dev/pulse-trace        # exists today (2026-09-04) — DEV-ONLY preview of the pulse trace;
                         #  redirects home in a release build, linked from nowhere. Temporary
```

**Decision 1 (2026-07-10):** the paywall and a settings-lite screen (sign out, tier display,
restore purchases) are restored to MVP scope, using the blueprint's reserved third tab slot
(`docs/design/mvp-blueprint.md` Part 8) rather than shipping as detached modal-only routes.
**Built 2026-08-05** — see `(tabs)/settings` and `paywall` above; "restore purchases" has no
counterpart yet since v1's in-app purchase flow is dummy-only, with no real store receipt to
restore.

**Decision 5 (2026-07-10):** Home shows the plan link (or "Create a plan") and quota state only —
no "next workout" or "current week" card. No current-week arithmetic exists in v1; days are
unnamed and there are no check-offs, so "next" has no well-defined meaning without one. This is
Ian's override of the recommended `floor(days since created_at / 7) + 1` design.

## Current + planned — `src/lib/` layout

```
src/lib/
  supabase.ts            # exists today — LEGACY, unused
  apiClient.ts             # exists today — better-auth's Expo client (`authClient`) plus typed
                            #                fetch wrappers for the app's `/api/*` routes
  apiErrors.ts              # exists today (2026-08-07) — pure `ApiError`/`NetworkError`/
                             #                `describeError()`, re-exported from `apiClient.ts`
  planTypes.ts             # exists today — shared Plan/Week/Workout/Tier types, one source of
                            #                truth for the app and the Worker
  loadRules.ts              # exists today — deterministic safety arithmetic
  notation.ts                # exists today — run-type/structure-string notation, the code
                              #                counterpart of `notation.md`, 13 unit tests
  tierLimits.ts               # exists today — the one copy of the tier limits, app + Worker
  quotaPeriod.ts               # exists today — `currentPeriod()`, app + Worker
  fixtures/examplePlan.ts    # exists today — the 5K golden fixture as real `Plan` data
  planTemplates.ts        # exists — the PAID skeleton AND the fallback engine for Pro/Elite.
                            #          Since 2026-09-09 it is no longer the Free tier's engine —
                            #          see `planLibrary/` below.
                            #          A parametric generator, not a fixed matrix: any distance,
                            #          any legal week count (per the plan-shape rules in
                            #          `planning/02-product-requirements.md`), any days/week, any
                            #          starting weekly volume (km); exactly reproduces the golden
                            #          5K case, while 10K/half/marathon use their own volume and
                            #          long-run curves. Race plans select first-timer vs prepared
                            #          phase weighting from demonstrated weekly volume/recent
                            #          performance, never desired goal time. At 3–4 running days
                            #          the generic layout keeps Q1 and drops Q2 before easy
                            #          support; Q2 may remain at 5+ days. Tier limits (Free's
                            #          12-week/5K, for instance) are a UI/quota gate applied on top
                            #          of this engine, never a limit of the engine itself — a
                            #          Pro/Elite fallback still needs, say, a 26-week marathon
                            #          template. Since 2026-08-15 a plan with no race is a first
                            #          class shape, not a 5K in disguise: no invented distance, no
                            #          taper phase, the loading block of the curve only, and a final
                            #          week forced to be a loading week so it never ends on a deload
                            #          (captain's coaching ruling — the cadence yields for that week
                            #          alone). On generic non-deload peak weeks, the long-run
                            #          candidate also includes the algebraic capacity needed for the
                            #          existing easy-run ceiling to carry the rendered pre-peak
                            #          high-water mark; `clampLongRun`'s safety ceilings remain
                            #          authoritative. The byte-pinned golden fixture remains its
                            #          own path.
  planLibrary/            # exists (2026-09-09) — the Free tier's entire engine: the 40-plan
                            #          deterministic library, a port of
                            #          `planning/research/plan-blueprint-examples.md`'s "V1
                            #          deterministic template library". `registry.ts` (plan
                            #          register, workout vocabulary, experience-dose ladder and
                            #          operating limits, weekly-volume state machine, 3-7-day
                            #          placement layouts, long-run ladder, canonical durations
                            #          12/14/16/24, recovery-cadence overlay), `calendars.ts` (the
                            #          four canonical week-by-week calendars verbatim: 5K/12,
                            #          10K/14, half/16, marathon/24), `injury.ts` (the H0-H4 state
                            #          machine, all seven injury modules, multiple-injury
                            #          composition), `engine.ts` (`buildLibraryPlan` — the source
                            #          document's resolution order plus its mandatory
                            #          disclaimers), `openQuestions.ts` (the six coaching decisions
                            #          the source does NOT make, all six ruled by Ian 2026-09-10
                            #          and isolated in one file — see
                            #          `docs/reference/coaching/free-engine-open-questions.md`).
                            #          Selection is by register lookup, never by inventing a plan:
                            #          a request the register does not cover is refused, not
                            #          approximated.
  paceDerivation.ts        # exists — Riegel cross-distance equivalency, source-relative training
                            #          bands, and the ruled goal-realism/race-pace cap (decision
                            #          13, 2026-07-10)
  planRequest.ts           # exists (2026-08-15) — the rule that intake owns the runner's target and
                            #          Home never re-asks it: `planTargetFromIntake()`,
                            #          `needsPlanLength()`, `buildGeneratePlanRequest()`. Pure, so
                            #          the "asked exactly once" and "no race needed" guarantees are
                            #          unit-tested without rendering a screen. Also owns the
                            #          stale-race-date guard both screens share — `isRaceDatePast()`
                            #          (`now` is injected, never read from the clock in here),
                            #          `intakeRaceDateError()` and the two messages. Home sends no
                            #          request and intake saves nothing when the date has passed, so
                            #          no quota slot is charged for the one-week plan the server's
                            #          `weeksUntilRace` floor would otherwise produce.
  fieldInput.ts            # exists (2026-08-15) — digit/decimal filters and the clock/date part
                            #          parsers behind `src/components/inputs/`. Its header records
                            #          why `keyboardType` alone is not enough (it restricts nothing;
                            #          a letter reached a number-pad field on device).
  pulseTrace.ts            # exists (2026-09-04) — the geometry behind
                            #          `components/brand/PulseTraceHero.tsx`: a beat list becomes a
                            #          strictly x-monotonic polyline, an SVG path, and the lookup
                            #          tables (x, y, arc length) the UI thread interpolates over, so
                            #          the whole animation is driven by one number — the head's
                            #          x-position — and the "idle, then snap through the spike"
                            #          rhythm falls out of arc length rather than a bespoke easing.
                            #          `normalizeBeats()` sanitises any caller's beats;
                            #          `beatsAtMarks()` places spikes at scroll-section boundaries;
                            #          `scrollProgress()` is a worklet so the dev preview and the
                            #          real onboarding derive the same 0..1 from a scroll event.
                            #          Pure — no React, no SVG, no Reanimated.
  quotaDisplay.ts          # exists (2026-08-05) — `formatQuotaLine()`, pure display phrasing for
                            #          `QuotaStatus`. There is no separate `subscription.ts`; the
                            #          tier-read/dummy-purchase ground it would have covered is
                            #          `apiClient.ts`'s `getQuotaStatus()`/`purchaseTier()`.
```

## Current — `generate-plan`, and what is still missing from it

The core of the app. Full tier/quota/validation detail:
[`docs/reference/plan-generation.md`](reference/plan-generation.md). The eleven steps below are
implemented in `workers/src/lib/generate-plan-flow.ts`, with each dependency injected so every
branch is unit-testable without a network or a cent of Anthropic spend.

**Both former unbound seams are now bound.** Steps 4/5/8/9 (the deterministic skeleton, built from
`src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts`) were bound in `workers/src/deps.ts` on
2026-08-04 via `createTemplateSkeletonBuilder()`, so `generate-plan` now returns a real plan
instead of `503`. **Since 2026-09-09 that same builder is where the tier split lives**: a Free
request is answered by `src/lib/planLibrary/`'s 40-plan deterministic library, paying tiers by
`planTemplates.ts` as before — see step 5. **Step 7's Pro/Elite personalization prompt was bound on 2026-08-10**
(`workers/src/lib/planPersonalizationPrompt.ts`) — see the corrected step 7 below for what
actually shipped, which is narrower than the original "one representative week + expander" sketch
this section used to describe. The remaining gap is not code: `ANTHROPIC_API_KEY` is unset
everywhere, so `resolveModelCaller` still binds `createUnconfiguredModelCaller` and Pro/Elite
generation still falls back to the same template every tier gets, honestly marked
`isFallback: true` and quota-exempt, until the captain provisions the key.

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
5. **Build the plan skeleton — and this is where the tier split happens** (captain's ruling
   2026-09-06, wired 2026-09-09 in `workers/src/lib/planEngine.ts`'s
   `createTemplateSkeletonBuilder()`). A **Free** request is served entirely by
   `src/lib/planLibrary/`'s `buildLibraryPlan`: the 40-plan deterministic library selects a plan
   from the register, applies the calendar, the volume state machine, the injury state and the
   mandatory disclaimers, and that plan is the finished product — the pipeline stops at step 6.
   The library is not a fallback for the AI generator and not a parameter source for it; the two
   never meet. The one request shape the register does not cover — a Free runner naming no race
   distance at all — is **refused** with `invalid_request`, the quota reservation released so the
   attempt costs nothing (Ian's Q1 ruling, 2026-09-10: Free requires a target distance; a race
   *date* stays optional on every tier). It deliberately does not fall through to the parametric
   engine below, which would put a Free user back on the paid tiers' skeleton. See
   `docs/reference/coaching/free-engine-open-questions.md`. **Pro/Elite** get the
   parametric skeleton, unchanged — from `planTemplates.ts` and the coaching docs:
   distance-specific weekly-volume/long-run curves, readiness selected from demonstrated recent
   training rather than desired goal time, phases, deload cadence, weekly volumes under
   `loadRules.ts` caps, and workout primitives from `workout-library.md`. Intermediate/advanced
   marathon race plans cap long runs at 35% of the generated loading-week denominator; their
   separate absolute kilometre ceiling (≤25 / ≤35 km) is lifted only for a `prepared` runner whose
   easy pace makes the 180-minute duration cap enforceable — a runner with no recent time, any
   advanced runner (no derived easy pace) or a first-timer keeps it, since nothing else could
   bound them in kilometres. The number for the lifted case is still pending calibration. Race
   plans carry `Plan.readinessPath`; a first-timer plan discloses why it took that path and, on a
   runway under the research's first-timer minimum, that it is a completion plan rather than full
   preparation. **Every tier's plan is coach-authored and deterministically bounded — that
   is never removed.** What scales across tiers is how much of the runner the plan reasons about
   and how much it explains, never how much of the coach's judgment is taken away; step 9's clamp
   applies to both engines' output.
6. **Free tier stops here.** The library plan (or, for the uncovered shape above, a template plan)
   plus effort descriptions only. No AI call, ever.
7. **Pro/Elite — one Claude call** (`claude-sonnet-5`). **Shipped 2026-08-10, narrower than
   originally sketched here.** Pace, HR zone/RPE, and every distance are already final by this
   point — the skeleton (step 5) is built at `density: 'paid'` for both Pro and Elite, so
   `loadRules.ts`/`paceDerivation.ts` have already computed and clamped every number the coaching
   library calls "personalization." The model is asked for exactly one thing the skeleton cannot
   supply: prose. A forced tool call (`submit_plan_personalization`) whose schema has no numeric
   field returns a `coachIntro`, a weekly "why" (Pro and Elite), and — Elite only — a per-workout
   "why". `mergePersonalization()` (`workers/src/lib/planPersonalizationPrompt.ts`) copies only
   those strings onto the skeleton, matched by `weekNumber`/`dayIndex`; every other field is
   copied unchanged, so there is no code path by which the model's answer can carry a number.
   `engine: 'ai'` is never emitted in v1; every paid plan is skeleton-constrained `hybrid` (see
   `planTypes.ts`'s `Engine` comment). **Not implemented, and no longer planned as originally
   written:** the "one representative week per phase" + step-8 expander below, and SSE streaming —
   both existed to fit a whole week's *structure* into one response cheaply, which a prose-only
   response doesn't need; `computeMaxTokens()` scales the token ceiling with plan length instead.
8. **Deterministic expander — NOT BUILT, and not needed by what shipped in step 7.** This step
   stays documented as the design's original intent (materializing every calendar week from a
   handful of AI-personalized representative weeks), in case a future revision of step 7 goes back
   to emitting structure. The shipped step 7 above never produces partial-plan structure that would
   need expanding — every week already exists, from the skeleton — so this step is a no-op today.
9. **Clamp** — `loadRules.ts` re-checks every week (weekly increase cap, deload band 15–25%,
   long-run share/spike/time caps) identically across all three tiers. A model cannot emit an
   unsafe week because this code rejects the number before the user sees it.
10. **Validate structurally, loosely** — shape only. Fail → retry once. Fail again → fall back to
    the pure template plan, `is_fallback: true`, rendered at Free density.
11. **Settle** the reserved `plans` row (immutable plan JSON, `tier_at_generation`, `engine`,
    `is_fallback`, `idempotency_key`) and return `{ plan, planId, isFallback, quotaConsumed }`.

    Because the quota slot is *reserved* at step 3 and the plan document only arrives at step 11,
    every row has a lifecycle: `reserved` → `settled` or `released`. **A reservation is settled or
    released on every exit path**, including an unexpected throw — a slot silently held by a
    crashed generation is the one quota bug a user can neither see nor work around. A reservation
    that outlives its TTL stops being counted at read time, which is what removes the need for the
    sweep cron the Postgres design would have wanted. `tier_at_generation`, `engine`, and
    `is_fallback` are stamped by the server over whatever the plan carried: they decide how the
    plan renders forever, so neither a model nor a client may name them.

The deterministic load-rule clamp (volume caps, deload cadence, long-run caps) applies identically
to all three tiers — while building the plan for Free (the library's own doses are bounded by the
same `loadRules.ts` arithmetic), and as a post-generation clamp on Claude's output for Pro and
Elite. See
[`docs/reference/plan-generation.md`](reference/plan-generation.md) for why: selling the top tier
as the one with the guardrail removed would be backwards.

Inside the deterministic template engine, both plan-building paths call `clampLongRun()`, but they
preserve their intended arithmetic. The generic path supplies `longRunShareCap(level, runCount,
raceDistance)` and `maxSingleRunKm(level, raceDistance, { readiness, easyPaceSecPerKm })` as the
share and absolute overrides (see `docs/reference/coaching/load-rules.md` for both marathon rules),
and rounds the 1.10× spike ceiling up to a renderable whole kilometre. On a generic non-deload peak
week it also derives a minimum long-run candidate as
`Math.ceil((peakTrainingWeekKm - qualityKm) / (easyCount + 1))`, where the inputs describe the
already-rendered pre-peak high-water mark and the scheduled quality/easy slots. That candidate is
only a capacity floor: `clampLongRun()` retains final authority, and the resulting rendered state
continues into later peak-deload and taper weeks. The separate pre-clamp starting candidate is
floored against the quality sessions the layout actually schedules (`retainedQuality`), so a three-
or four-day week is never floored on the Q2 interval it drops. The coach-authored golden
5K path uses the flat per-level share table, the flat absolute table, and the raw fractional spike
ceiling. Generic easy runs are
capped at the final clamped LR distance. Quality/tempo sessions are not: the safety cap may put LR
below one of them rather than rewriting the authored stimulus. `reconcileVolumeToTarget()` trims
whole kilometres without dropping scheduled training runs; an extremely small target can therefore
remain above target when every session has reached its 1 km floor.

Race-day distance is not charged against the pre-race taper budget. Both paths derive that budget
from `RACE_WEEK_PRE_RACE_SHARE`; on a generic low-volume/high-frequency plan, the engine schedules
only as many pre-race runs as the budget can fund at the existing 2 km non-filler threshold and
leaves the other slots as rest. The original layout still governs placement, so Race Day remains
Day 7 and SR is the final pre-race run. Normally funded audit profiles and the golden fixture keep
their existing numeric schedule; the golden LR `effortDescription` intentionally carries the
revised definition that no longer promises it is the week's longest run.

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
| `ANY /api/auth/*` | — | better-auth's own | better-auth's own | Sign-up, sign-in, sign-out, session, OAuth callbacks. Email/password and Google both work in production (Google since 2026-08-09 — see `docs/change_log.md`). |
| `GET /health` | none | — | `{ ok: true }` | Liveness. Touches no database. |
| `POST /api/generate-plan` | session | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes?, idempotencyKey }` | `{ plan, planId, isFallback, quotaConsumed }`, or `402` over-quota / `403` anon / `409` intake-required | Enforces tier + quota server-side, branches by tier, validates, persists. `raceDistance` is validated whenever it is present, on either goal type — a `duration` request legitimately carries one for a runner with a target distance and no date. A duplicate `idempotencyKey` returns the existing plan instead of generating twice. Free gets the template plan (since 2026-08-04). Pro/Elite call the personalization prompt (bound since 2026-08-10) but, with no `ANTHROPIC_API_KEY` configured anywhere yet, still fall back to the same template today (`isFallback: true`, quota-exempt) — see "Current — `generate-plan`" above. `quotaConsumed` tells the client whether this fallback counted against the tier limit, so `FallbackNotice` can pick `counted` vs `exempt`. |
| `GET /api/quota-status` | session | — | `{ tier, used, limit, periodEnd }` | Drives Home's and Settings' "N of M plans used" line (`src/lib/quotaDisplay.ts`'s `formatQuotaLine()`, consumed by both since 2026-08-05). `used` counts **non-fallback** plans in the current purchase-anchored period, server-side, never a client counter. `periodEnd` is `null` for Free (lifetime allowance) and also `null` while the temporary `ALL_USERS_UNLIMITED_ACCESS` override is on (see below) — the UI must not render a countdown for either. |
| `POST /api/purchase-tier` | session | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart: string \| null, periodEnd: string \| null }` | v1 dummy flow, called from `src/app/paywall.tsx` (new 2026-08-05) with honest "test upgrade, no payment required" copy. v2 swaps `source` to `"revenuecat"` and verifies the receipt — same route, same table write. `source: "revenuecat"` is refused in v1 rather than trusted. |
| `POST /api/delete-account` | session | — | `{ deleted: true }` | Really deletes; no soft-delete flag, because the app's own copy promises erasure. The only route that deletes a plan. Called from Settings' Delete Account flow (new 2026-08-05), followed client-side by `authClient.signOut()` to invalidate the local session store. |
| `GET /api/intake` | session | — | `{ intake }` or `{ intake: null }` | Was a direct client read under Supabase. |
| `PUT /api/intake` | session | `IntakeResponses` | `{ saved: true }` | Was a direct client upsert under Supabase. |
| `GET /api/plans` | session | — | `{ plans: [summary] }` | My Plans. Summaries only — full documents would be megabytes for a heavy user. |
| `GET /api/plans/:id` | session | — | `{ plan, planId, isFallback, quotaConsumed }` or `404` | Someone else's plan id is a `404`, not a `403`: it does not exist to you. |

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

## Current — visual direction ("Instrument", `theme.ts`)

> **Source of truth: [`docs/design/instrument-visual-system.md`](design/instrument-visual-system.md)**
> (captain-approved 2026-09-03, replacing "Trailhead"). Every hex, the full contrast tables, the
> type scale and the ornament rules live there and in `src/constants/theme.ts`'s own header
> comment; this section is a summary and never the authority — the tables in particular are not
> duplicated here. That document supersedes `docs/design/frontend-design-brief.md` Parts 2 (tokens)
> and 3 (the ribbon/wave motif) — the rest of the brief still governs. Where the two disagree about
> a *value*, Instrument wins; about a *rule*, the brief wins.
>
> **Instrument lives on `fm/v22-redesign-theme-onboarding` and is not merged to `main`.** On
> `main`, `theme.ts` is Trailhead (merged as PR #82, plus the fidelity follow-up #83); this section
> describes the branch. **Only the three signed-out screens have been seen rendered** — onboarding,
> sign-in and sign-up, in both schemes, on Expo web at phone size. No screen has been run on a
> device or simulator, and the signed-in screens have never been seen rendered in either system.

`src/constants/theme.ts` holds the Instrument tokens: a near-monochrome, cool-scientific field —
white and graphite in light mode, deep charcoal in dark — carrying every button, rule and piece of
chrome in near-black, with one much brighter highlight in it. It is a house style, shared with the
sibling app V2.3 ("Pace AnalysisAI"). `Spacing` runs half=2, one=4, two=8, three=16, four=24,
five=32, **six=48**, seven=64; `MaxContentWidth = 800` is unchanged from the scaffold.
`BottomTabInset`'s value is likewise unchanged, but as of 2026-07-12 (issue #32 finding 8) it
carries a docblock explaining why it still has zero call sites: it models a tab bar that *floats
over* content, and the real tab bar (`(tabs)/_layout.tsx`) lays out in normal flow instead, so
applying the inset today would add trailing void, not clearance — see `docs/mvp-progress.md`'s
"Known debt" for the full reasoning.

- **Bases**: white `#FFFFFF` (light) and deep cool charcoal `#0E1317` (dark), plus a
  `surface.inverse` slab used dark in *both* schemes — the Paywall's pricing cards, whose edge
  comes from `grid.inverseHairline` rather than from lightness separation.
- **Two-tier accent, theme-invariant.** `Accent.field` (`#0A0E13`) is a near-black slab;
  `Accent.signal` (`#A8F0FF`) is the ONE bright highlight — icy cyan, locked — spent on exactly one
  call to action per screen and on the onboarding pulse trace, **never in navigation**, and never
  anywhere else. Several screens spend no accent at all: a destination is not a call to action.
  **The cyan is never a fill**, and that is the single most load-bearing measurement in the system:
  it is **1.27:1** against a white page, so a cyan button would have no visible boundary. The
  primary action is therefore a near-black slab with a 1.5pt cyan edge and a cyan label, identical
  in both schemes, and its boundary is carried by a different channel in each — **19.35:1** in
  light (the slab against the page), **14.74:1** in dark (the cyan edge; the slab itself is only
  **1.04:1** there, deliberately). Unlike Trailhead's scheme-keyed ember there is nothing to
  resolve, so `useTheme()` returns `Accent` unresolved. `Accent.field` is also
  `Colors.light.surface.inverse` and the same near-black as the pulse trace's own field: every dark
  plane in the app is one plane, so a primary action on a pricing slab reads as an inset in it
  rather than as a second, slightly different black.
- **Effort scale** — the palette *is* the information, not decoration. Instrument re-tuned all ten
  hues into a cooler key (steel blue / sea green / brass / rust / raspberry), each keeping its
  identity and its place in the ordering. Two constraints bound the values: every one sits at
  **4.92:1 or better against both `surface.base` and `surface.raised`** (Trailhead's light ramp sat
  at 4.02–4.50 against `base` with nothing checked against `raised`, which is what issue #70
  reported), and no hue may collide with `Accent.signal`, measured as CIE76 ΔE in Lab rather than
  as a contrast ratio — a ratio is blind to hue and would pass an icy-cyan `recovery`. `barHeight`,
  the mandatory non-hue accessibility channel, is still computed as
  `0.4 + 0.15 × EFFORT_ORDINAL[level]` against `planTypes.ts`'s ordinal rather than hand-written
  per level (issue #32 findings 4 and 7, 2026-07-12).
- **Contrast is enforced, not documented.** `src/constants/__tests__/theme.contrast.test.ts`
  recomputes every ratio from the hexes in `theme.ts` and asserts it against that token's floor,
  including the three values that are deliberately *below* it (`progress.disabled`, the signal on a
  light page, the field on a dark one), asserted as upper bounds. A last check counts the opaque
  tokens in `Colors`, so a new hex cannot be added without being given a floor.
- **Interaction**: one `PressedOpacity` token (`0.7`) for every `Pressable`'s press-dim, added
  2026-07-12 (issue #32 finding 3) so the value can't fork across components the way it had in
  `index.tsx` and `WeekAccordion.tsx`. Distinct from `LockedOpacity` (`0.45`), which is the
  *resting* dim of a surface the runner cannot use, not press feedback.
- Type: unchanged from Trailhead — Big Shoulders Display for display and every numeral (running is
  numbers — distance, pace, splits), Public Sans for body and UI chrome, Space Mono for pace, HR
  and all-caps labels. Scale 13/15/17/20/24/32/44. Radii tightened again (control 10→8, card 16→14):
  an instrument panel is squarer than a paper metaphor.
- **The accent rule is carried by the module graph, not by review.**
  `src/components/ui/ActionButton.tsx` (`PrimaryAction`/`SecondaryAction`/`ActionDivider`/
  `LinkAction`) is the one implementation of the treatment; `PrimaryAction` *is* the signal, so
  "one accent per screen" reduces to how many of them a screen renders. It replaced eight
  hand-rolled button stylesheets.
- **Signature element — the route line**: a thin contour/elevation stroke
  (`src/components/brand/RouteLine.tsx`, geometry in `src/lib/routeProfile.ts`), carried through
  Home, My Plans, Plan view and the Paywall in two variants (`header` and `card` — the third,
  `hero`-height one went with the dusk field it was sized for, since the signed-out screens now
  carry the pulse trace, which draws its own geometry). It survived the recolour — it was only ever
  a thin monochrome stroke, and now reads as a plotted trace. The **per-week effort ribbon** inside a
  plan is not ornament and stays (`src/components/plan/WeekAccordion.tsx`) — it encodes real data;
  the macro periodization wave (`mvp-blueprint.md` Part 3) is not built and is no longer planned.
- **One deliberate exception**: the signed-out screens carry a near-black pulse-trace field with an
  icy-cyan ECG-style waveform — a tall `cover` on onboarding, the short `band` height on sign-in and
  sign-up. The field carries only the mono wordmark; the headline sits on the page below it, since
  the real animated component is fixed-height and display copy inside it would clip.
  Everything past the session gate is near-monochrome. The screens still mount
  `src/components/onboarding/PulseTraceSlot.tsx`, a marked integration point rendering the animation's
  *static end state*; the animation itself (`<PulseTraceHero>`) now lives on this branch, so the
  swap is one import line in `(auth)/onboarding.tsx` — see that slot's header for the exact change.
- **The signature animation — the pulse trace.** `src/components/brand/PulseTraceHero.tsx`: an
  ECG-style icy-cyan trace that draws itself across its own near-black field — self-drawing on
  mount (`onSettled`, with a fallback ceiling timed from layout) or driven by a scroll
  `SharedValue` with spikes at section boundaries, reduced-motion aware, and identical in light and
  dark mode, since it paints its own field. Scroll-driven callers go through `usePulseTraceScroll`,
  which seeds progress from layout as well as scroll — a handler-only integration shows a blank
  field on any page shorter than its viewport. Geometry is pure and tested in
  `src/lib/pulseTrace.ts`. **Its palette, timings and field heights live in
  `src/constants/pulseTrace.ts`, not `theme.ts`**: it was built in parallel with the Instrument
  token rewrite, so the two could not share a file without colliding mid-flight. The hexes agree —
  `PulseTracePalette.field`/`.trace` are `Accent.field`/`Accent.signal` (`#0A0E13`, `#A8F0FF`) —
  and folding the constants into a re-export from `theme.ts`, which also closes the one-sided
  contrast pin, is the follow-up now that both branches have landed. It reads only the
  scheme-independent `Spacing` and `Stroke` from `theme.ts`. `/dev/pulse-trace` (dev builds only)
  renders both drive modes. Integration guide:
  [`docs/design/pulse-trace.md`](design/pulse-trace.md).
- **React Navigation's own chrome is tokened too, not just the screens built on top of it.**
  `src/constants/navigation-theme.ts` bridges the same `Colors` tokens into the `Theme` shape
  `expo-router` re-exports (`background`→`surface.base`, `card`→`surface.raised`,
  `text`→`text.primary`, `border`→`hairline`, `primary`→`text.primary`, `notification`→
  `status.error`), so `_layout.tsx`'s `ThemeProvider` never falls back to the library's own stock
  `DefaultTheme`/`DarkTheme` palette for transition underlays, header defaults, or the back-swipe
  reveal (closes issue #27, a 2026-07-11 frontend-audit finding). `primary` deliberately maps to
  `text.primary`, not the accent — the signal stays reserved for the single per-screen
  forward-action.
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
  **The aesthetic was replaced by Trailhead on 2026-09-01 and by Instrument on 2026-09-03** (see
  "Current — visual direction"). The banned list still governs everything past the session gate.
  The signed-out pulse trace is the one sanctioned departure from it — an icy-cyan waveform that
  draws itself once on a near-black field. It is scoped as its own named exceptions in
  `src/constants/pulseTrace.ts`'s `PulseTraceMotion`: the draw runs once, the ambient sweep runs
  only along an already-drawn trace, neither may be borrowed by another component, and under
  reduced motion only a scroll-driven trace still moves — because that motion is the runner's own
  scrolling. The screens still render `PulseTraceSlot`'s static end state until the one-line swap.
- **Onboarding is a scroll-down read, and its sections deliberately do not fade or rise on
  scroll** (2026-09-03). That is not an oversight against the direction above: a second motion
  moment on the same screen competes with the signature one, and the scroll itself is already the
  mechanic. It is still a plain, Reanimated-compatible `ScrollView`, so nothing is precluded later.
