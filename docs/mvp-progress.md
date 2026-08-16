# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-08-15 (later) — the captain phone-tested the core loop and called the
homepage and intake "very very confusing": intake was effectively asked twice, a race target was
mandatory, and the numeric keyboards lacked the `:` and `-` the fields demanded. All three
reproduced on an iOS 26.5 simulator and are fixed; see
[`change_log.md`](change_log.md#2026-08-15-later--intake-asked-once-race-target-optional-structured-numeric-inputs)
for the full account.

- **Intake asked once.** Home no longer re-asks goal type / race distance / race date. It reads the
  target off the saved intake and asks only for a plan length, and only when there is no race date
  to derive one from. `src/lib/planRequest.ts` is the pure module that owns that decision.
- **A race target is optional end to end.** Home's "Select a race distance." block is gone. Two
  engine defects behind it are fixed in `src/lib/planTemplates.ts`: the silent `?? '5k'` default is
  removed, and a plan with no race no longer emits a `taper` phase or interpolates the taper tail of
  the canonical load curve (it used to finish *below* the volume it started at). Race plans are
  unchanged, golden fixture included.
- **A past race date is refused on both screens.** Home does not send the request (so no quota slot
  is charged for the one-week plan `weeksUntilRace`'s floor would otherwise produce) and intake does
  not save the date; each says why and names the control that fixes it. Race day itself, and a blank
  date, are both still valid. `src/lib/planRequest.ts` owns the decision and both messages.
- **A no-race plan never ends on a deload** — captain's coaching ruling; the every-N-weeks cadence
  yields for the final week only, and only for `isRacePlan === false`. Known limitation, pinned by a
  documenting test: a 4-week no-race plan still finishes below its opening volume, because at that
  length the canonical curve's own dip lands on week 2 and `clampWeeklyVolume`'s growth ceiling — a
  safety rule, deliberately not bent — cannot recover it.
- **`raceDistance` is validated whenever present, on any goal type**, since the client now sends it
  with `goalType: 'duration'` too; `racePhaseWeights` is exhaustive rather than silently falling
  through to the marathon weights.
- **Numeric inputs are structured.** New `src/components/inputs/` splits dates into `YYYY - MM - DD`
  and times into `H : MM : SS` with the separators printed rather than typed, and filters every
  keystroke via `src/lib/fieldInput.ts` — `keyboardType` alone restricts nothing, which is how the
  letter `v` reached the intake AGE field on the simulator.
- **Verified by hand on an iOS 26.5 simulator**, headlessly via `simctl`: Home in both the race and
  no-race states, and the keyboard each numeric field raises. **Not verified: Android** — no Android
  SDK is installed on this machine, so the `number-pad`/`decimal-pad` choice rests on the React
  Native contract for those two values (both supported on Android; `numeric` deliberately avoided,
  as it differs across platforms).
- **Open for the captain (item 4 of the brief, report-only, no redesign done):** what is still
  confusing about Home once 1–3 are fixed. Findings are in the task report — headline items are the
  quota line being the only status text, `NOTES (OPTIONAL)` having no effect on Free tier, Home
  showing nothing about plans already generated, and "Change" silently meaning "reopen the whole
  10-field intake".

Previous entry: 2026-08-10 (later) —  Ian reported two production sign-in bugs blocking him from
using the deployed app: email sign-up failed `"Invalid origin"`, and Google sign-in failed
`"Invalid callback URL"`. Both reproduced against the **live deployed Worker**, not the local test
suite (see "the harness gap" below), and both are now fixed in `workers/src/auth.ts` and
`workers/wrangler.toml` — **still needs `wrangler deploy --env production` from the captain's own
machine to take effect; nothing is fixed in production until that deploy happens.**

- **Bug 1 — email sign-up `INVALID_ORIGIN`.** Root cause has two parts, and the fix needs both:
  (1) better-auth's own `trustedOrigins` never read `CORS_ALLOWED_ORIGINS` — a browser origin could
  clear the CORS allowlist in `cors.ts` and still be rejected by better-auth's separate origin/CSRF
  check. Fixed by folding `CORS_ALLOWED_ORIGINS` into `trustedOrigins` in `auth.ts`. (2) That fold
  alone does not fix the reported failure: `index.ts`'s `normalizeAllowedBrowserOrigin()` already
  rewrites any origin *already in* `CORS_ALLOWED_ORIGINS` to `BETTER_AUTH_URL` before better-auth
  ever sees it, so the fold only matters for an origin CORS never allowed in the first place — and
  `[env.production.vars] CORS_ALLOWED_ORIGINS` in `wrangler.toml` listed only the deployed origin
  itself, not `http://localhost:8081`/`19006` (the origins `npm run web` actually uses, since
  `.env`'s `EXPO_PUBLIC_API_BASE_URL` points straight at the deployed Worker — there is no
  separately hosted production web build). Those origins were dropped from the production list in
  the 2026-08-09 Google-sign-in fix and never restored; now added back.
- **Bug 2 — Google sign-in `INVALID_CALLBACK_URL`.** Root cause, found entirely by reading code
  (`@better-auth/expo`'s and `expo-linking`'s source, not from device testing): Expo Go — the only
  way to run this app on a device today, since no EAS dev client exists — ignores the app's
  registered `paceblueprint://` scheme and always builds deep links with the fixed `exp://` scheme,
  so the OAuth `callbackURL` better-auth receives is `exp://<lan-ip>:<port>/--/`. `@better-auth/expo`
  already auto-trusts `exp://`, but only `if (process.env.NODE_ENV === 'development')`, and
  Wrangler's esbuild bundling bakes that literal to `'production'` for `wrangler deploy` (only
  `'development'` for `wrangler dev`) — so the plugin's own fallback is silently absent from every
  deployed Worker, dev or not. Fixed by adding `'exp://'` to `auth.ts`'s `trustedOrigins`
  unconditionally, rather than relying on the plugin's env-gated default.
- **The harness gap.** `workers/test/worker.test.ts`'s pre-existing "allows an auth POST from an
  allowlisted Expo web origin" test could not have caught either regression: `vitest.config.ts`
  pins `CORS_ALLOWED_ORIGINS` to already contain the one origin the test uses, so
  `normalizeAllowedBrowserOrigin()` always neutralizes it before better-auth is reached — the test
  passed identically with or without the `trustedOrigins` fold, and never touched
  production-shaped config at all. Its comment now says so explicitly. Four new tests in
  `worker.test.ts` (a new `describe('the 2026-08-10 production INVALID_ORIGIN bug')` block) drive
  `createAuth()` and `normalizeAllowedBrowserOrigin()` directly against production-shaped env vars —
  proven to fail against the pre-fix code (both `wrangler.toml`'s old value and `auth.ts`'s old
  `trustedOrigins`) and pass against the new. One new test in `social-auth.test.ts` does the same
  for the `exp://` callback fix. 130 `workers/` tests pass (125 existing + 5 new); 326 root tests
  pass; typecheck and lint clean on both sides.
- **What's still not provable from here:** whether the OAuth consent screen's publishing status
  (Testing vs. production) or the client secret itself (only exercised at the token exchange) are
  also blocking Google sign-in remains open — see "Blocked / awaiting a decision" below. Neither
  was ruled out or in by this pass; both need one real device sign-in after the deploy.

Previous entry: 2026-08-10 — `deps.ts`'s second swap (the Pro/Elite personalization prompt) is
now bound: `workers/src/lib/planPersonalizationPrompt.ts` is the real `PromptBuilder`, replacing
the typed-`null` placeholder. **Deliberately narrower than `docs/reference/plan-generation.md`'s
original "one representative week per phase + deterministic expander" sketch** — see that file's
updated status note and the new module's own header for the reasoning. In short: the template
skeleton (`createTemplateSkeletonBuilder()`) already computes every week's distances, phase, and —
at `density: 'paid'`, which both Pro and Elite use — every workout's pace and HR zone/RPE from
`loadRules.ts`/`paceDerivation.ts`, safety-clamped, before this file is ever reached. What Pro/Elite
still lack is the coach's-reasoning prose (`Plan.coachIntro`, `Week.why`, and — Elite only —
`Workout.why`), so that is the *only* thing the new prompt asks the model for: a forced tool call
(`submit_plan_personalization`) whose schema has no numeric field at all, just `weekNumber`/
`dayIndex` (to find the matching skeleton slot) and `why` strings. `mergePersonalization()` then
copies exactly those strings onto the skeleton and nothing else — there is no code path by which a
model answer can change a distance, a pace, an HR zone, an RPE, a phase, or a deload flag. Wired
into `generate-plan`'s existing tier branch with no other change: Free still never calls the model
(`generate-plan-flow.ts` step 6); Pro/Elite call `createPlanPersonalizer(modelCaller,
planPersonalizationPromptBuilder)`, which already had its validate → retry-once → fall-back-to-
template control flow built and tested (`planEngine.test.ts`). **Still blocked on the same thing as
before: `ANTHROPIC_API_KEY` is not set anywhere** (`wrangler secret put` needs the captain's own
Cloudflare login — "Blocked / awaiting a decision" below), so `resolveModelCaller` still binds
`createUnconfiguredModelCaller` and every Pro/Elite generation today still serves the honest,
quota-exempt template fallback — the prompt is correct and tested, but has never made a live call
and cannot until the key exists. New `workers/test/planPersonalizationPrompt.test.ts` (19 cases):
request shape (forced tool call, `claude-sonnet-5`, no `temperature`/`top_p`/`top_k`, no numeric
field sent to the model at all), structural extraction, and — the case that matters most —
`mergePersonalization` proven never to touch a structural/numeric field, never to mutate the
skeleton, and to truncate an oversized response rather than store it unbounded. 125 `workers/`
tests pass (106 existing + 19 new); 326 root tests pass, typecheck and lint clean on both. **Decided
and deliberately out of scope in this pass:** `GeneratePlanRequest`'s missing `goalTimeSec` field
(flagged below and in "Known debt and risks") does not block this feature — the personalizer reads
`intake.goalTimeSec`, the value already stored at intake time and already consumed by
`buildTemplatePlan()` to build the skeleton this prompt personalizes, so the prompt sees a correct
goal time in every case that reaches it today. The *per-generation* override the flagged gap is
about (letting one generation declare a different goal time than intake's saved default) is a
separate, narrower fix left for its own pass. Payments/IAP, the App Store pipeline, branding, and
Apple Sign-In were not touched, per standing scope.
Previous entry: 2026-08-09 — Google sign-in was reported dead in the app; diagnosed against the
**live deployed Worker**, not by reading code. `POST /api/auth/sign-in/social` on
`https://pace-blueprint-production.i78979848.workers.dev` answers
`{"message":"Provider not found","code":"PROVIDER_NOT_FOUND"}` (HTTP 404), while email/password on
the same origin correctly answers `401 INVALID_EMAIL_OR_PASSWORD` and `/api/quota-status` answers
`403 unauthenticated` — so the Worker, D1, and `BETTER_AUTH_SECRET` are all live and only the Google
provider is missing. **Root cause: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were never set on the
deployed Worker**, so `buildSocialProviders()` returns `{}` and better-auth never registers the
provider. It is not a code regression, not a redirect-URI mismatch, and not the leaked secret being
revoked (a leaked-but-unrevoked secret would still authenticate — and none is in play, because none
is deployed). **Captain-only to fix** — see "Blocked / awaiting a decision". Two things did get
fixed in code, both of which would have broken Google sign-in *again* immediately after the secrets
landed: (1) the committed `[env.production.vars] BETTER_AUTH_URL` still read
`https://pace-blueprint.workers.dev`, which is not the deployed origin — better-auth derives the
OAuth `redirect_uri` from it, so any redeploy from a clean clone would have failed with
`redirect_uri_mismatch`; `[env.production]` also had no D1 binding at all (named environments do
not inherit top-level bindings), so such a deploy would have had no database. **Fixed the same day:**
the captain added the redirect URI and set both secrets, and `sign-in/social` now returns a real
`accounts.google.com` URL that Google answers with a live sign-in page — see the change-log entry
for what that check does and does not prove. (2)
`workers/vitest.config.ts` let `BETTER_AUTH_URL`/`APP_SCHEME` come from a developer's gitignored
`.dev.vars`, so the OAuth-origin tests were asserting against whatever untracked values happened to
be on that machine; both are now pinned in the config. Credentials are also trimmed now, so a
`wrangler secret put` newline can't register a provider that then fails as `invalid_client`. New
`workers/test/social-auth.test.ts` (7 cases) covers provider-absent, provider-registered (asserting
the exact `client_id` and `redirect_uri` handed to Google), one-of-two, blank/whitespace, and the
`paceblueprint://` deep-link `trustedOrigins` round trip; verified to fail against the old code.
324 root tests and 93 `workers/` tests pass. Full account: `docs/change_log.md`'s 2026-08-09 entry.
Previous entry: 2026-08-07 — phone testing over `expo start --tunnel` hit
`TypeError: Network request failed` and could not get past sign-in. Root cause was environmental —
`EXPO_PUBLIC_API_BASE_URL` pointed at `http://localhost:8788`, and a loopback address means *the
device running the app*, so a phone can never reach a Worker on the developer's computer (tunnel
mode forwards Metro, not the Worker); the port was drifted from `wrangler dev`'s 8787 as well. The
code defects it exposed are fixed: the auth screens' four handlers had no `try`/`catch`, so a
transport failure became an unhandled rejection *and* a spinner that never cleared (better-auth's
`{ error }` return only covers responses that arrived — `@better-fetch/fetch` lets a transport
rejection escape), and `apiFetch` let `fetch`'s bare `TypeError` through so an unreachable backend
surfaced as "Could not load your plans." New pure `src/lib/apiErrors.ts` splits `ApiError` (the
server refused) from `NetworkError` (nothing answered) and adds `describeError`, which all nine
screen catch sites now use; when the base URL is loopback the message names that specifically.
`.env.example` documents the per-device-type correct value. 318 tests pass (294 + 24 new),
typecheck and lint clean; no `workers/` change. **Still captain-only:** which reachable backend a
phone should point at — LAN against `wrangler dev`, or a deployed Worker. Full account:
`docs/change_log.md`'s 2026-08-07 entry. **Since resolved the same day:** the captain ruled for
deploying the Worker rather than a LAN address, so on-device testing waits on the existing
`wrangler deploy` gate and `EXPO_PUBLIC_API_BASE_URL` becomes the deployed `https://` URL.
Previous entry: 2026-08-05 — a client-only batch lands the Settings tab, the dummy paywall, and
the goal-realism UI, and fixes Intake's dead-end save, closing GitHub issues #12 and #15, "Next"
step 9 below (quota UI + dummy paywall), and a launch-readiness audit's "goal-realism UI half not
built" doc-vs-code drift finding (external to this repo). `src/app/(tabs)/settings.tsx` is now the
fourth tab: tier + quota display (`GET /api/quota-status`, new pure `src/lib/quotaDisplay.ts`),
sign-out (moved off Home), and Delete Account (native confirm → `deleteAccount()` →
`authClient.signOut()` to invalidate the local session). `src/app/paywall.tsx` is a new `Stack`
route reached either from Home's `generate-plan` action on a `402 over_quota` response or
proactively from Settings, calling `purchaseTier('pro' | 'elite')` with honest "test upgrade, no
payment required" copy. Intake now calls `router.replace('/(tabs)')` after a successful save
instead of leaving the runner on the same screen, and its exit-header label reads "Done" instead of
always "Skip for now" once intake exists. Home now prefills `raceDistance`/`raceDate` from saved
intake (once per mount). A new `GoalRealismNotice` component surfaces `Plan.goalRealism` on the
plan screen and as a live read-only preview at both goal-entry points (Intake, Home — Home's
preview only shows when the panel's selected race distance still matches the one the saved goal
time was recorded against). **Corrected 2026-08-15:** the immutable plan now shows the notice for
both warned outcomes, including an `ambitious` goal that was honoured rather than capped; Intake's
ambitious copy now says the entered pace is kept instead of falsely promising a sustainable-pace
adjustment. 278 tests pass (272 + 6 new for `quotaDisplay.ts`), typecheck and lint
clean; no `workers/` change in this batch. **Not touched, deliberately:** the backend deploy
(captain-only) and the Pro/Elite AI-generation prompt (still the one unbound seam in
`workers/src/deps.ts`) — only the free-tier template engine plus this client polish landed. Full
account: `docs/change_log.md`'s 2026-08-05 entry (the newest one, above the Google OAuth entry).
Previous entry: 2026-08-05 — Google OAuth's credentials are provisioned and verified working in
local dev: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are in `workers/.dev.vars`, and
`POST /api/auth/sign-in/social` against `wrangler dev` returns a real Google authorization URL
that Google's own server accepts (a real sign-in page, not `invalid_client`). Production is not
done — the captain still has to run `wrangler secret put GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
themselves — and the client secret should be rotated in Google Cloud Console before that, since it
was pasted in plaintext into a chat pane earlier the same session. Full account:
`docs/change_log.md`'s 2026-08-05 entry.
Previous entry: 2026-08-05 — a UX audit fix batch closed Findings 1-5 of a 7-finding external audit report (`v22-ux-audit-r1`; Findings 6-7 out of scope, untouched). The tab bar no longer shows React Navigation's dev-only `MissingIcon` placeholder (`tabBarIcon: () => null` on all three tabs); Google sign-in shows "Google sign-in isn't available yet." instead of the raw `PROVIDER_NOT_FOUND` backend string (button stays visible; at the time of this fix, OAuth credentials were still not configured — since resolved, see the entry above); the plan view gained a one-line effort-color legend so sighted users get the same info screen readers already had via `describeDays()`; My Plans dropped the internal `plan.engine.toUpperCase()` ("TEMPLATE") label from user-facing copy; and Intake/Home's `raceDate`/`goalTime`/`recentTime` fields gained as-you-type masking and inline validation instead of raw free-text — deliberately not a native date/time picker (a new dependency, out of scope, logged as a possible follow-up). A code-review pass caught and closed a related gap in the same commit: an incomplete race date (e.g. `"2026-09"`) previously passed submit-time validation silently. 272/272 tests pass. Full account: `docs/change_log.md`'s 2026-08-05 UX audit fix batch entry.
Previous entry: 2026-08-05 — phone testing fixed three onboarding UX problems: signed-out launches now default to Sign Up (with the existing returning-user Sign In link retained); Intake has an always-visible "Skip for now" header action that replaces to Home, whose existing missing-intake state lets the runner resume later; and the race-date label now explicitly says optional, matching its payload and validation behavior. The deliberate post-signup `router.replace('/intake')` remains because it avoids the protected-route unmount race documented in `src/lib/postSignupRedirect.ts`. Focused auth-default and Intake-exit regression tests were added.
Previous entry: 2026-08-04 — the first end-to-end user loop is wired up (intake screen, the
generate-plan action, the plan view rendering real generated plans alongside the permanent golden
fixture, and a My Plans list), and an E2E verification pass over that loop found and fixed four
bugs: a sign-up → Intake redirect race (new `src/lib/postSignupRedirect.ts`), a long-run distance
floating-point display bug in `planTemplates.ts` (fixed by flooring, not rounding, each iteration),
My Plans staleness on tab revisit (`useFocusEffect` instead of a mount-only `useEffect`), and an
unrounded Race Day distance for Half/Marathon (`raceDayWorkout()` now wraps the summed distance in
`Math.round()`; the exact race distance stays spelled out in the workout's `structure` string). All
four are verified, unit-tested and/or re-verified live against `wrangler dev`. 270 root tests + 86
`workers/` tests pass clean. Full account: `docs/change_log.md`'s 2026-08-04 entry.
Previous entry: 2026-08-03 — client-side auth lands (`06b1f89`): `src/lib/apiClient.ts` (better-auth's
Expo client + typed fetch wrappers for every `/api/*` route), `src/app/(auth)/sign-in.tsx` +
`sign-up.tsx` (email/password; a "Continue with Google" button is wired but inert), and a
`Stack.Protected` gate in `src/app/_layout.tsx` so no route is reachable without a session — the
app now has no anonymous browsing at all, matching every `/api/*` route already 403ing anonymously.
Verified against `wrangler dev` at the curl level (sign-up, sign-in, anonymous 403, wrong-password
401) and by driving the running app (Expo Go/iOS Simulator + briefly web): unauthenticated launch
redirects to `/sign-in`, sign-in navigates into `(tabs)`, and a temporary "Sign out" button on Home
(no Settings-lite screen exists yet to host it) redirects back to `/sign-in`. Google OAuth was the
only remaining blocker at the time — **resolved in local dev 2026-08-05: see that entry below.**
The captain's `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (`workers/src/auth.ts`'s TODO) are now
provisioned and verified working against `wrangler dev`; only production's `wrangler secret put`
remains. Also
fixed in the same commit, unrelated to auth: a stale `metro-config` subpath import in
`metro.config.js` that was blocking `expo start` entirely. This lands on top of the same day's
deload-cadence ruling: Ian's ratified "pro runners = 3 weeks, beginners = 4" — the engine already
keyed cadence to experience — `deloadEveryWeeks()` resolves the source's per-level Deload trigger
table to advanced 3 / beginner 4 / intermediate 4, and the 50+ mandatory 3-week rule still wins over
every level — and `planTemplates.ts` now calls through that single shared function instead of
inlining the same expression. Regression tests added on the golden and generic paths plus the unit
suite: under-50 advanced → `[3, 6, 9]`, under-50 beginner → `[4, 8]`, 50+ any level → `[3, 6, 9]`,
intermediate unchanged. Also settles the source's open beginner-cadence gap in `workout_library.md`.
Typecheck, lint, and all 248 tests pass.
Previous entry: issue #3's pure TypeScript plan-generation engine landed:
`paceDerivation.ts` + `planTemplates.ts`; bundled issues #22/#23 fixed; both red-first suites
un-quarantined. Typecheck, lint, and tests pass. This lands on top of the 2026-08-02 backend move:
**the backend is Cloudflare — D1 + Workers + better-auth, in `workers/`** — a captain's decision
over a Supabase project-slot constraint and a genuinely-free stack; the relational design was
ported, not re-decided. Auth, the quota ledger, `quota-status`, `purchase-tier`, `delete-account`,
intake, and plan reads all work end to end against `wrangler dev`, offline, with no Cloudflare
account. `generate-plan` is wired end to end but still returns `503 engine_unavailable` and
consumes no quota, because `workers/src/deps.ts` has not yet been swapped to call the
now-existing `src/lib/planTemplates.ts` — that wiring is the remaining gap. Two shared pure
modules, `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts`, are imported by both the app and the
Worker. 75 vitest tests in `workers/`. Nothing deployed, no secret set — see "Blocked" below.
Previous entry: 2026-07-12 integration pass: Ian's round-2 coaching sign-off closes issues #34,
#19 and #29; goal-realism ruled, closing #33; app named **Pace Blueprint** (#35); units ruled
km-only (#36); doc stale-reference sweep (#37). `main` returned to green by quarantining the two
orphaned TDD suites (#41). `formatSecPerKm` pace-rounding carry bug fixed, closing #28, adding the
first test suite under `src/components/`. Screen-reader gaps fixed, closing #31 — pace bands spoken
as words, race day announced, plus three code-review-caught defects, including collapsing the m:ss
formatter #28 fixed into one shared `formatSecPerKm()` so the two readouts can't drift apart.
`FallbackNotice` gains a required quota-copy `variant` prop, closing issue #30 (issue #45 filed for
the still-open follow-up). React Navigation's chrome now derives from `theme.ts`'s tokens instead
of leaking the library's own stock palette, closing #27. Issue #32's frontend polish batch closed —
nine of eleven findings fixed, two dispositioned (rejected / already stale). 121 tests passing, up
from 82. Issue #22 remains open.)

---

## Status at a glance

| Milestone | State |
|---|---|
| M1 — Foundation (account → empty Home) | **In progress.** Server (auth + schema + account routes) is deployed on Cloudflare (`workers/`, live `production` environment); client-side email/password and Google OAuth both work in production (Google since 2026-08-09) |
| M2 — Intake (questionnaire persists) | **In progress.** Intake screen now exists, wired to `GET`/`PUT /api/intake` |
| M3 — Plan engine (3 tiers produce valid plans) | **In progress.** Pure template/pace engine now wired into the Worker's `generate-plan` route and the client's generate-plan action; the plan view renders a real generated plan (via `GET /api/plans/:id`) alongside the permanent static golden fixture |
| M4 — Tiers & quotas (server-side, unbypassable) | **In progress.** The quota ledger, atomic gate, fallback exemption, `quota-status` and `purchase-tier` are built and tested server-side; a Settings tab now displays tier/quota and a dummy paywall now lets a runner call `purchase-tier` (2026-08-05) |
| M5 — My Plans (history) | **In progress.** A My Plans tab lists plans off `GET /api/plans` |
| M6 — Polish & TestFlight | **In progress.** First real onboarding screen landed 2026-08-08 (`(auth)/onboarding.tsx` + an animated week-ribbon hero), alongside a fix for the sign-up form blanking itself mid-typing |

**The honest summary:** planning, design, and domain research are done to an unusual depth, and
Phase 0's paper-reconciliation pass is now done too. **As of 2026-08-02 there is also a real
backend** — `workers/`, on Cloudflare D1 + Workers + better-auth — with auth, the quota ledger, and
the account routes working end to end against local emulation. **As of 2026-08-03 the pure
client/shared plan engine also exists.** `src/lib/paceDerivation.ts` derives Riegel equivalents,
training pace bands, and the ruled goal-realism/cap result; `src/lib/planTemplates.ts` builds
deterministic template plans and reproduces the approved 12-week 5K fixture exactly.
`clampWeeklyVolume()` now names and uses the last loading week, and the golden week-8 output is
30 km. The former red-first suites run normally, with typecheck and lint clean. **The wiring
between the two landed 2026-08-04**: `workers/src/deps.ts` now binds `generate-plan`'s skeleton
builder to `src/lib/planTemplates.ts` (`createTemplateSkeletonBuilder()`), so `generate-plan`
returns a real plan instead of `503`, and the plan screen renders it via `GET /api/plans/:id`. The
Pro/Elite personalization prompt — `deps.ts`'s second seam — was bound on 2026-08-10, so both plan-
engine seams now take real implementations and no seam is left on a typed *unavailable*. M3 is
complete for the deterministic/template path and for the personalizer's code; the one remaining gap
is `ANTHROPIC_API_KEY`, unset everywhere, so paid-tier requests still receive the quota-exempt
template fallback.

`planTypes.ts`, `loadRules.ts`, and (as of the 2026-07-11
review-and-refine cycle) `notation.ts` are the app's `lib/` layer — shared vocabulary, safety
arithmetic, and run-type/structure-string notation, all pure and tested (83 lib-layer tests, up
from 64, after Ian's 2026-07-12 round-2 rulings on issue #34 added the long-run deload-week
measurement fix (ruling R1c) and the race-day/strides test coverage, plus issue #32's
strides-label regression test; the project total is **121 across 7 suites** as of the same day's
`formatSecPerKm` carry-boundary fix (issue #28, which added the first test suite under
`src/components/`), issue #31's screen-reader accessibility fixes, issue #27's navigation-theme
suite under `src/constants/`, and issue #32's `theme.effort.test.ts`, which together took the
project total 82 → 93 → 107 → 117 → 121). A golden fixture (`src/lib/fixtures/examplePlan.ts`), a rendered
plan screen (`src/app/plan/[id].tsx` and `src/components/plan/`), and an abbreviations glossary tab
(`src/app/(tabs)/glossary.tsx`) exist and render that fixture — but nothing generates a plan from an
intake yet. `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts`, the actual generation logic,
are still unwritten; two TDD test suites for them exist and intentionally fail to compile on the
missing modules (`npm run typecheck` and `npm run lint` are red for the same reason — expected, not
a regression). **What changed 2026-07-12: every coaching question blocking that engine's build is
now answered.** Issue #19's HIGH-severity long-run-cap conflict — the golden plan's own numbers
breached the coded cap — is closed; the abbreviation set, race-day notation (issue #29), strides
placement, the Daniels brake, and peak volume are all signed off. The gap between "designed" and
"working" is smaller than it was, but the engine itself is still ahead. Two coaching/code questions
remain genuinely open and unrelated to this pass: issue #22 (`clampWeeklyVolume` comparing against
the literal previous week) and issue #33 (goal-realism handling).

---

## Done

### Planning and specification
- [x] `planning/01-brainstorm.md`, `02-product-requirements.md`, `03-engineering-requirements.md`, `README.md`
- [x] Tiers, quotas, user flow, and six milestones each with a "done" definition
- [x] `docs/architecture.md` — route tree, DB schema draft, API table, `generate-plan` design

### Infrastructure
- [x] Env layout correct and **verified**: `.env` (client) and `workers/.dev.vars` (server) are both
      gitignored and untracked; no secret is committed; `ANTHROPIC_API_KEY` is server-side only and
      read in exactly one file, `workers/src/lib/model.ts`
- [x] `gh` 2.96.0 installed; `wrangler` 4.118 available via `npx`
- [ ] **Cloudflare account resources — none created.** `wrangler login`, `wrangler d1 create`,
      `wrangler secret put`, `wrangler deploy`: all the captain's, all unrun. See "Blocked" below.
- ~~Supabase project `v2.2_plan_generation`~~ — **superseded 2026-08-02.** The backend is Cloudflare
  now (`workers/`); the Supabase project is unused, and `supabase/` is dead scaffold kept for
  reference. Google OAuth and email/password were enabled on it and were not carried over:
  better-auth does email/password today, and Google runs on a fresh client id/secret from the
  captain — provisioned and verified in local dev 2026-08-05 (see that entry below).

### Code
- [x] **Sign-up no longer blanks itself mid-typing, and onboarding exists (2026-08-08).** Two
      defects on the auth screens plus a new screen in front of them — full account in
      `docs/change_log.md`'s 2026-08-08 entry. In short: `_layout.tsx` gated render on better-auth's
      `isPending`, which is re-raised on every background session refetch *while signed out*, so the
      `return null` unmounted the whole tree and wiped the form (fixed by the latch in
      `src/lib/sessionGate.ts`, regression-tested); and both auth screens centred their content with
      no scroll container, so a keyboard could push the title or the submit button permanently off
      screen (fixed with `KeyboardAvoidingView` + `ScrollView`). New: `(auth)/onboarding.tsx` and
      `src/components/onboarding/HeroRibbon.tsx`, an animated build of the app's own week-ribbon
      motif, reduced-motion aware, built entirely from existing `theme.ts` tokens
- [x] Expo SDK 54 scaffold — TypeScript strict, expo-router, `@/*` path alias
- [x] **`workers/` — the Cloudflare backend spine (2026-08-02).** better-auth on D1 (email/password,
      Bearer sessions), `migrations/` for both better-auth's tables and the app's, the quota ledger
      with its atomic gate and reserve→settle/release lifecycle, and the routes `generate-plan`,
      `quota-status`, `purchase-tier`, `delete-account`, `GET/PUT /api/intake`,
      `GET /api/plans[/:id]`. Tested in real `workerd` against real D1 — run
      `npm --prefix workers test` for the current count. Verified end to end against
      `wrangler dev`, offline. `generate-plan` returns `503 engine_unavailable` (and charges nothing)
      until the plan engine exists. Details: [`workers/README.md`](../workers/README.md)
- [x] `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts` — pure, shared by the app and the Worker,
      as `planning/03-engineering-requirements.md` requires by name. 18 unit tests
- [x] ~~`src/lib/supabase.ts`~~ — **legacy since 2026-08-02**, nothing imports it. Kept, not deleted,
      alongside its now-built replacement (see the next bullet).
- [x] **Client-side auth against `workers/` — done 2026-08-03 (`06b1f89`).** `src/lib/apiClient.ts`
      wraps better-auth's Expo client (`authClient` — session persisted via `expo-secure-store`)
      plus typed fetch wrappers for every non-auth `/api/*` route; `src/app/(auth)/sign-in.tsx` and
      `sign-up.tsx` do email/password plus a "Continue with Google" button — **as of 2026-08-05
      the captain's Google OAuth credentials are provisioned and verified working against local
      dev** (production's `wrangler secret put` still pending, see that day's entry below);
      `src/app/_layout.tsx` gates the whole route tree behind a session with Expo Router's
      `Stack.Protected` — no anonymous browsing at all.
      `workers/src/auth.ts` gained the `expo()` server plugin to support this. Verified against
      `wrangler dev` at the curl level and by driving the actual running app (unauthenticated
      launch → `/sign-in`, sign-in → `(tabs)`, sign-out → back to `/sign-in`); the sign-up screen
      was verified only via the shared backend curl test, not tap-tested live. Not built in this
      pass, deliberately: intake screen, plan generation UI, My Plans list, quota/tier display UI,
      visual polish. A documented TypeScript-peer-version cast lives in `apiClient.ts`'s header
      comment — see `docs/architecture.md`'s "Current — what exists in `src/`" for detail.
- [x] **The first end-to-end user loop — intake, generate-plan, plan view, My Plans — done
      2026-08-04, plus a same-pass bug-fix batch.** The intake screen now exists and is wired to
      `GET`/`PUT /api/intake`; a generate-plan action calls `POST /api/generate-plan`; the plan
      view (`src/app/plan/[id].tsx`) now renders a real generated plan via `GET /api/plans/:id`
      alongside the permanent static example-plan fixture; and a My Plans tab
      (`src/app/(tabs)/my-plans.tsx`) lists plans off `GET /api/plans`. An E2E pass over that loop
      found and fixed four bugs, all verified: (1) a sign-up → Intake redirect race, fixed with a
      new one-shot module-level flag, `src/lib/postSignupRedirect.ts`, consumed by the never-
      unmounting root `_layout.tsx` instead of relying on `sign-up.tsx`'s own effect to win an
      unmount race; (2) a long-run distance floating-point display bug in
      `src/lib/planTemplates.ts`'s convergence loop (e.g. `"5.666666666666667 km"`), fixed by
      flooring — never rounding up, which could re-breach a safety cap — each iteration; (3) My
      Plans going stale on tab revisit, fixed by switching its fetch to
      `useFocusEffect(useCallback(...))` since Expo Router tab screens stay mounted across
      navigation; (4) an unrounded Race Day distance for Half/Marathon (found by the
      re-verification pass itself), fixed by wrapping `raceDayWorkout()`'s summed distance in
      `Math.round()` — the exact race distance stays spelled out in the workout's `structure`
      string. 270 root tests + 86 `workers/` tests pass clean. Full account: `docs/change_log.md`'s
      2026-08-04 entry.
- [x] **Settings tab, dummy paywall, and goal-realism UI — done 2026-08-05, client-only, closes
      issues #12 and #15.** `src/app/(tabs)/settings.tsx` is the new fourth tab: tier + quota
      display (`GET /api/quota-status`, new pure `src/lib/quotaDisplay.ts`'s `formatQuotaLine()`),
      a Free-tier "Upgrade" entry point, sign-out (moved off Home), and a Delete Account flow
      (native confirm → `deleteAccount()` → `authClient.signOut()` to invalidate the local session
      store). `src/app/paywall.tsx` is a new `Stack` route calling `POST /api/purchase-tier` with
      honest "test upgrade, no payment required" copy, reached either from Settings or from Home's
      `generate-plan` action catching a `402 over_quota` response. Intake's dead-end save is fixed
      — `router.replace('/(tabs)')` after a successful save, and its exit-header label
      (`IntakeExitAction`, now taking an explicit `label` prop) reads "Done" once intake already
      existed on load or was just saved, "Skip for now" otherwise. Home now prefills
      `raceDistance`/`raceDate` from saved intake once per mount. New
      `src/components/plan/GoalRealismNotice.tsx` surfaces `Plan.goalRealism` on the plan screen
      for both warned outcomes (`ambitious` says the goal was honoured, `implausible` keeps the
      capped-goal explanation) and as a live read-only preview at both goal-entry points (Intake's
      goal-time field, Home's goal panel — Home's preview only shows when the panel's selected race
      distance still matches the one the saved goal time was recorded against, to avoid judging a
      stored goal time against a distance it was never set for). Intake's ambitious preview also
      says the entered pace is kept instead of promising an adjustment the engine does not make.
      This also closes
      a launch-readiness audit's "goal-realism UI half not built" doc-vs-code drift finding
      (external to this repo). 278 tests pass (272 + 6 new for `quotaDisplay.ts`), typecheck and
      lint clean; no `workers/` change. Full account: `docs/change_log.md`'s 2026-08-05 entry (the
      newest one, above the Google OAuth entry).
- [x] `src/lib/loadRules.ts` — deterministic safety arithmetic (see "Next" step 2)
- [x] `src/lib/notation.ts` — the code counterpart of `notation.md`: `RUN_TYPE_ABBREVIATIONS`,
      `UNABBREVIATED_RUN_TYPES`, `STRUCTURE_SHORTHAND`, and `expandLabel()` for screen-reader text.
      Shipped alongside the 2026-07-11 review-and-refine cycle 1 doc rebuild, not logged in
      `change_log.md` at the time — corrected in the cycle-2 entry.
- [x] `src/lib/fixtures/examplePlan.ts` — the 5K golden fixture rendered as real `Plan` data,
      **already resynced to cycle 2's doc corrections** (45 km week 9 with a 300 m interval jog,
      week-11 race-pace reps at goal pace, and the rest of the cycle-2 fixes). **Corrected in this
      doc-audit pass:** this file previously claimed the fixture was still stale against cycle 2
      — reading the actual file shows it wasn't. See `docs/change_log.md`'s new correction bullet.
- [x] Plan-rendering screens and components: `src/app/plan/[id].tsx`, `src/app/(tabs)/glossary.tsx`
      (the abbreviations glossary tab, sourced from `notation.ts`), and `src/components/plan/`
      (`WeekAccordion`, `WorkoutRow`, `EffortChip`, `ReadoutBracket`, `PlanNameplate`,
      `DisclaimerFooter`, `FallbackNotice`, `format.ts`) — render the golden fixture on a real
      screen, ugly-beyond-tokens caveats aside.
- [x] **Issue #32 frontend/code polish batch — nine of eleven findings fixed, 2026-07-12.** Applied
      to `src/components/plan/{WeekAccordion,PlanNameplate}.tsx`, `src/constants/theme.ts`,
      `src/hooks/use-theme.ts`, `src/app/(tabs)/index.tsx`, `src/lib/notation.ts`, and
      `src/lib/fixtures/examplePlan.ts`. Ribbon bars round top-only (rise from the baseline instead
      of floating above it); the ▴/▾ chevron is a drawn, fixed-weight glyph instead of a
      Unicode character riding on font-fallback weight; `PlanNameplate.tsx`'s metadata line now
      binds key→value with a colon and separates fields with `·` (was `·` doing both jobs,
      told apart only by whitespace — `docs/design/mvp-blueprint.md` Part 7 corrected to match, it
      was the origin of the ambiguity); a new `PressedOpacity` theme token replaces two hardcoded
      `0.7` press-dim values; `theme.ts`'s effort scale (`EffortLevel`, `EffortOrder`, `barHeight`)
      now derives from `planTypes.ts`'s `EFFORT_LEVELS`/`EFFORT_ORDINAL` instead of duplicating them
      (`planTypes.ts` itself untouched — still the source of truth); Home's `SafeAreaView` no longer
      reserves the bottom edge (matches `glossary.tsx`, the tab bar already owns it); a false
      provenance comment in `notation.ts` is corrected (comment only, no copy change); and
      `examplePlan.ts`'s `easyRun()` takes strides as an explicit parameter instead of inferring it
      from the structure string (fixture output byte-identical). **Two findings dispositioned, not
      fixed:** the Rule 10 disclaimer's "PACE" wording is rejected per Ian's existing 2026-07-12
      ruling (naming PR #40), not re-litigated; the "Home title" finding was already stale (Home has
      read "Pace Blueprint" since PR #40). **`BottomTabInset` stays intentionally uncalled** —
      documented in `theme.ts`'s docblock as parked until `tabBarStyle` ever goes `position:
      'absolute'`; see `docs/change_log.md` and "Known debt" below. Full account:
      `docs/change_log.md`'s 2026-07-12 issue #32 entry.
- [x] **`src/constants/navigation-theme.ts` — fixes GitHub issue #27 (2026-07-11 frontend-audit
      finding), done 2026-07-12.** `src/app/_layout.tsx` was feeding React Navigation's stock
      `DefaultTheme`/`DarkTheme` to `ThemeProvider`, which meant the library painted its own
      untokened colors (`rgb(242, 242, 242)` light background, `rgb(1, 1, 1)` dark, plus stock
      `card`/`text`/`border`/`primary`) onto chrome the app never styles directly — transition
      underlays, header defaults, the reveal behind an in-progress back-swipe — a visible seam
      against the chalk `#F7F7F4` canvas. `navigation-theme.ts` exports `NavigationLightTheme`,
      `NavigationDarkTheme`, and a `NavigationThemes: Record<ColorScheme, Theme>` lookup, each
      spreading the stock theme (keeping `dark`/`fonts`) but overriding every `colors` slot from
      `Colors` in `theme.ts`: `background`→`surface.base`, `card`→`surface.raised`,
      `text`→`text.primary`, `border`→`hairline`, `primary`→`text.primary` (deliberately not
      `Accent.hivis`, which the brief reserves for the single per-screen forward-action),
      `notification`→`status.error`. `_layout.tsx` now feeds `NavigationThemes[theme.scheme]` to
      `ThemeProvider`; `src/app/plan/[id].tsx` drops the now-redundant `headerTintColor` and keeps
      its deliberate `headerStyle` deviation from the nav theme's `card`, commented in place. New
      suite `src/constants/__tests__/navigation-theme.test.ts` (10 tests, first under
      `src/constants/`) guards against regressing to the stock literals.
- [x] **`FallbackNotice` gains a required `variant: 'exempt' | 'counted'` prop, closing issue
      #30.** It previously hardcoded the quota-exempt copy; both strings now live in the
      component, and the one caller (`src/app/plan/[id].tsx`) passes `variant="exempt"`
      explicitly, with a comment explaining why. The prop is required, with no default, by Ian's
      ruling — see `docs/change_log.md`'s 2026-07-12 entry. **Known gap, filed as issue #45:** the
      client can't yet derive the true variant from `Plan.isFallback` alone; blocked on
      `generate-plan` returning whether a fallback consumed quota (Phase 4).
- [x] **Intake age floor raised 10 → 13 (2026-08-03), captain's ruling.** `workers/src/routes.ts`'s
      `validateIntake` now rejects `age < 13`; new migration
      `workers/migrations/0003_raise_intake_age_floor.sql` moves the D1 `CHECK` constraint to
      match, rebuilding `intake_responses` and dropping any `age < 13` rows rather than
      grandfathering them. Clears Apple's 9+ rating floor, COPPA, and Texas SB2420. Full
      rationale: `docs/change_log.md`'s 2026-08-03 entry.
- [x] **213 passing tests across 10 suites (`jest-expo`) as of 2026-08-03.** This includes the
      formerly red-first `planTemplates.golden.test.ts` and `paceDerivation.test.ts` contracts,
      now un-quarantined and green. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
- [x] **`intake.injuries` now drives plan generation (2026-08-03) — fixes the plan-accuracy
      scout's Bug 1.** The scout found the field was read nowhere in `planTemplates.ts`: every
      injury combination, including all six original flags plus red-flag free text, produced a
      byte-identical plan to `['none']`. Two captain rulings closed the open design questions
      (both in `docs/reference/coaching/plan-structure.md`'s "Design rule" section): a red-flag
      injury produces a normal, volume-adjusted plan — the same mechanism as any other flag, not
      a separate return-to-running protocol generator (least-token option, still discloses
      clearly); and a new `plantar_arch` `InjuryFlag` closes the mandated finding B coverage gap.
      A declared flag now cuts the plan's first week's volume by its library-sourced percentage
      (knee/shin splints 15%, `injury_flags.md:29,49`; plantar_arch 20%, `:69`; the four flags
      lacking their own figure — ankle_achilles, it_band, hip_glute, lower_back — fall back to
      Rule 5's generic 20% Reduce Volume tier, `load_rules.md:185`; multiple declared flags take
      the largest, not additive). The Rule 10 injury disclaimer (previously nowhere in the
      codebase despite a declared knee injury) now attaches to `Plan.disclaimers` whenever
      `injuries` isn't `['none']`; a red-flag declaration (today, `ankle_achilles` — an
      interpretive call flagged for review, see `load-rules.md`) additionally carries a
      strengthened professional-evaluation disclaimer adapted from the source's own language.
      `injuryNotes` still never gates arithmetic. New `src/lib/__tests__/planTemplates.injuries.test.ts`
      plus additions to `loadRules.test.ts`. **256 passing tests across 14 suites**, `typecheck`,
      `lint`, and `test` all clean.
- [x] **Issue #28 fixed (2026-07-12): `formatSecPerKm`'s minute/second carry.**
      `src/components/plan/format.ts` rounded minutes and seconds independently, so a fractional
      pace could round seconds up to 60 without carrying into the next minute (359.6 s/km →
      `"5:60/km"` instead of `"6:00/km"`) — latent today since every pace in `examplePlan.ts` is an
      integer, but armed to fire the moment `paceDerivation.ts` or the AI path emits an unrounded
      pace band. Fixed by rounding the total seconds once, then splitting into minutes and seconds.
      New `src/components/plan/__tests__/format.test.ts` (11 tests) was the first test suite under
      `src/components/` — covering `formatPace` (both carry-boundary cases), `formatPlanDate`, and
      `describeDays`. **93 passing, up from 82, across 5 suites** at this point (still 2 suites
      excluded — see "Known debt and risks").
- [x] **GitHub issue #31 fixed (2026-07-12): three screen-reader gaps from the 2026-07-11 a11y
      audits, plus three further defects a code review caught while fixing them.** Pace bands now
      reach VoiceOver as words (new `speakPace()` in `src/lib/notation.ts` — "4:41 to 4:54 per
      kilometer" instead of the visible en-dash/"/km" notation); race day is no longer announced as
      a generic interval (`describeDays` in `src/components/plan/format.ts` special-cases the new
      exported `RACE_DAY_LABEL` constant); `accessibilityRole="link"` was added to Home's demo
      link, though the fix turned out to be redundant — expo-router's `Link asChild` already
      supplies `role: 'link'`, so the audit's finding 3 was mistaken. Code review then caught two
      live defects the fix hadn't yet covered: `speakStructure` was leaving a pace band embedded
      inside the structure string raw, so a single flattened VoiceOver label spoke the same band
      correctly once and as broken notation once — fixed via the same transform in
      `expandStructureTokens`; and issue #28/PR #46's already-fixed `:60` rollover bug in the m:ss
      formatter would otherwise have been re-introduced by `speakPace`'s own copy of the same
      arithmetic — instead of duplicating it, `formatSecPerKm()` was collapsed into one shared
      function in `src/lib/notation.ts`, consumed by both `formatPace` (visible) and `speakPace`
      (spoken), so the two readouts cannot drift apart again. `composeWorkoutLabel` moved out of
      `WorkoutRow.tsx` into the React-free `format.ts` so the composed label is unit-tested at its
      real call site (`src/components/plan/__tests__/format.test.ts`, extended with these cases on
      top of #28's) instead of only indirectly. **107 passing tests, up from 93 (still 5 suites)**;
      `typecheck`, `lint`, and `test` all clean. No coaching rule touched. Full account:
      `docs/change_log.md`'s 2026-07-12 entries. **A suspected pre-existing bug was found while
      tracing the Link and filed separately, not fixed here** — see "Known debt and risks" below.

### Repo hygiene
- [x] `AGENTS.md` rewritten as the agent-routing doc, committed (`60382cd`)
- [x] `main` in sync with `origin/main`, no stray branches or worktrees
- [x] **Full audit run.** No HIGH or exploitable findings. Secrets posture clean three ways
- [x] **DB audit run.** Live project matches the repo (nothing deployed); zero advisor lints
- [x] **All docs committed** (`7b4ae77`, 2026-07-10) — `docs/`, `planning/`, and this file are no
      longer untracked. The stale 🔴 risk recording the opposite is removed below.

### Phase 0 (`docs/mvp-build-prompt.md`) — done 2026-07-10
- [x] Repo hygiene committed (`7b4ae77`) — plan-shape spec, 5K golden fixture, build prompt itself
- [x] All 20 audit rulings (§0-B) applied across the doc set — see `docs/change_log.md`
- [x] Decision gate (§0-C) answered — 13 Ian decisions, recorded in `docs/change_log.md` and this
      file's "Decided" section below
- [x] **Model ID verified live**: `claude-sonnet-5` confirmed against the Anthropic Models API
      with the project's server-side key — real model ("Claude Sonnet 5," 1M input tokens, 128K
      max output)
- [x] **Ruling 2 re-check clean**: the 8→10-field intake change drops no coaching rule that
      wasn't already excluded for other reasons (every NOT-ported rule needs logging/wearables/
      sex data the two new time fields don't provide). The one real gap found — no numeric
      race-time → training-pace method in the source — is closed by decision 13 below.

**Phase 1 core engine completed 2026-08-03.** The remaining backend-free step is wiring the plan
view to `buildTemplatePlan()` instead of the static fixture; intake and server work follow.

### Design
- [x] `docs/design/frontend-design-brief.md` — token layer with **computationally verified** contrast,
      accessibility floor, motion system, full copy deck
- [x] `docs/design/mvp-blueprint.md` — "Instrument & Matter", eight screens, the measurement grid,
      the generation reveal
- [x] Caught and fixed: four of five effort hues failed the 3:1 bar in light mode → darker fills
- [x] Caught and fixed: the collapsed ribbon encoded effort by **colour alone**, violating the
      project's own rule → added the monotonic bar-height channel

### Domain
- [x] Located the coaching source of truth (Ian's McMillan-based library) — it is not ours to invent
- [x] Applicability filter defined: V2.2 has no run data, so most of ECHO's rules cannot run here
- [x] Independent fact-check produced **six corrections** (see `change_log.md`)
- [x] Market research: Strava discontinued its own plan builder and acquired Runna (July 2026);
      Runna has documented injury reports traced to an unconstrained algorithm
- [x] **Coaching library ported — done.** Seven files under `docs/reference/coaching/`
      (`00-README.md`, `load-rules.md`, `training-zones.md`, `workout-library.md`,
      `injury-rules.md`, `plan-structure.md`, `example-plan-5k-pro.md`), PACE-branded, filtered
      to what a one-time 10-field intake can drive, with the six evidence corrections applied.
- [x] **2026-07-11 market-research pass on published 5K plans done** — Higdon, McMillan, Daniels,
      Pfitzinger, RunnersConnect, Runna, Nike Run Club — run to check the coach's review against
      real coaching practice before fixing anything. Full findings cited inline in
      `workout-library.md` and `example-plan-5k-pro.md`.
- [x] **Ian's first coaching-quality review done: 3/10, five rulings applied.** Session sizing is
      now keyed to race distance, not weekly volume; reps are count × distance; race-pace-rep
      anchoring converges current-fitness → goal pace (superseding, not deleting, part of the
      2026-07-10 correction); run-type labels are abbreviated (new `notation.md`); HR zones and
      volume adherence were praised and left untouched. `example-plan-5k-pro.md` rebuilt under all
      five, and shipped with real code the same day: `src/lib/notation.ts`, the golden fixture,
      the glossary tab, and tests. Full account: `docs/change_log.md`'s 2026-07-11 entry.
- [x] **Review-and-refine cycle 2 done — docs and code both (2026-07-11, same day).** A code-review
      pass over cycle 1's rebuild found five internal contradictions and one coverage gap:
      week 9's interval recovery jog now follows `workout-library.md`'s own menu (44 → 45 km);
      the Daniels 10%-of-volume brake is re-scoped from an enforced rule to advisory context;
      "count × distance" is now stated consistently everywhere (it was inverted in three places);
      `notation.md`'s canonical structure-string example no longer anchors an `INT` session to
      goal pace; tempo-band phrasing is harmonized (15–30 min, this plan uses the 20–30 upper
      region) and `workout-library.md`'s "well under 10 km" is now "≤ 10 km"; and strides are
      extended to one easy day per loading week (research-sourced). **Code side also done, not
      merely flagged** — `src/lib/fixtures/examplePlan.ts`, `planTemplates.golden.test.ts`, and
      `paceDerivation.test.ts` all already assert cycle-2's numbers, including
      `paceDerivation.test.ts`'s replacement of the stale >10%-goal-improvement gate with a
      ruling-3-compliant goal-pace assertion and an `it.todo` for the still-open goal-realism
      question (Open item 5). **Corrected in this doc-audit pass** — this file previously said
      that code-side resync was still open; it wasn't. Full account: `docs/change_log.md`'s second
      2026-07-11 entry and its doc-audit correction bullet.
- [x] **Ian's round-2 coaching sign-off done (2026-07-12) — GitHub issue #34's eight-item queue
      ruled on in full, closing issues #19 and #29 alongside it.** R1: the long-run share cap's
      per-level ladder rises to a monotonic beginner 25% / intermediate 32% / advanced 35% — an
      Ian-authorised override of the source library, closing issue #19's HIGH finding that 9 of 11
      long runs breached the old 30% cap. **A code review then found a HIGH-severity hole in R1's
      deload-week wording ("deload weeks are exempt" would have let the AI-emittable `isDeload`
      field switch off the cap entirely) — Ian issued follow-up ruling R1c the same day: the cap
      is never removed for a deload week, it's measured against the last loading week's volume
      instead of the deload week's own reduced total.** R2: peak volume 48 km approved outright. R3: the Daniels 10%-of-volume brake is
      permanently advisory, never overriding the 5K quality-volume band's floor. R4: Rule 5's
      Monitoring tier is dropped from intake (kept as documented, unused, source content) — closes
      the last row of "Blocked / awaiting a decision" below. R5: the run-type abbreviation set is
      signed off exactly as written, including the known `RP`/`GP` layering wrinkle. R6: race-day's
      structure string becomes `WU 3 km · 5 km race · CD 2 km`, closing issue #29. R7: strides
      extend to both easy days of loading weeks 1, 2, 3, 5, 6, 7. R8: week 9's 300 m recovery jog
      is confirmed as correct. Applied to `src/lib/loadRules.ts`, `src/lib/fixtures/examplePlan.ts`,
      four test files, and five files under `docs/reference/coaching/`. Full account:
      `docs/change_log.md`'s 2026-07-12 entry. Issue #33's ruling was implemented in the engine on
      2026-08-03, and issue #22's clamp bug was fixed in the same build.
- [x] **Youth (under-18) HR-zone policy shipped (2026-08-06).** `v22-youth-policy-research-s1`
      researched under-18 training safety against sourced professional literature; captain
      approved only §6-A (suppress `hrZone` under 18, substitute RPE) and §6-E (a youth
      disclaimer), declining §6-B/C/D. See "Decided (2026-08-06)" below and
      `docs/change_log.md`'s same-date entry.

---

## In flight

**Nothing is currently in flight.** The pure engine and its test contracts are complete, and as of
2026-08-04 steps 4, 7, 8, and 10 below (plan view, intake, `generate-plan`, My Plans) are wired end
to end and E2E-verified. **As of 2026-08-05, step 9 (quota UI + dummy paywall) is also done** — see
"Done" below. The Pro/Elite personalization prompt noted in step 8 was bound on 2026-08-10, so the
one remaining critical-path item is provisioning `ANTHROPIC_API_KEY` (captain-only), without which
paid-tier requests still fall back to the quota-exempt template plan.

- **Cycle 1** (2026-07-11): Ian scored the rendered plan 3/10, five rulings applied. Docs rebuilt
  (`notation.md` added; `workout-library.md` and `example-plan-5k-pro.md` rewritten;
  `plan-structure.md`/`00-README.md` cross-referenced) **and** shipped with real code the same
  day: `src/lib/notation.ts`, the rebuilt golden fixture, the abbreviations glossary tab, and
  tests (64 passing). None of that code was logged in `change_log.md` at the time — corrected in
  the cycle-2 entry below.
- **Cycle 2** (2026-07-11, later the same day): a code-review pass over cycle 1's doc rebuild
  found five internal contradictions and one coverage gap (see `docs/change_log.md`'s second
  2026-07-11 entry for the full list — recovery-menu alignment, the Daniels-brake re-scope, the
  count × distance prose fix, the `INT`/`RP` anchor example fix, tempo-band phrasing, and the
  strides extension). **Docs side done, and — corrected in this doc-audit pass — the code side
  too:** `src/lib/fixtures/examplePlan.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`, and
  `src/lib/__tests__/paceDerivation.test.ts` all already assert cycle-2's numbers (week 9 at 45 km
  with a 300 m interval jog; `paceDerivation.test.ts`'s >10%-goal-improvement gate already replaced
  by a ruling-3-compliant goal-pace assertion plus an `it.todo` for Open item 5). This section
  previously said that resync was still pending, sourced from a change-log claim that was itself
  wrong by the time this pass checked the files — both are fixed now.

---

## Next — the critical path to a working MVP

Ordered so something is demoable as early as possible. Steps 1–4 produce a real plan on a real screen
with **no backend at all**.

1. [x] **`src/lib/planTypes.ts`** — **Done 2026-07-10.** Pure TypeScript, importable by the app and the
       edge functions. `pace` and `hrZone` are optional on `Workout`, so a Free plan — or any plan from
       a runner who gave no recent time — structurally *cannot* carry a measured numeral. The type
       system enforces the design's readout-bracket honesty rule.
2. [x] **`src/lib/loadRules.ts`** — **Done 2026-07-10.** Weekly volume cap, deload cadence and the
       35–45% band, long-run share cap, long-run spike cap, Daniels time cap, HR zones. 31 unit tests.
       `clampLongRun()` reports which ceiling actually bound.
3. [x] **`src/lib/planTemplates.ts`** (+ **`src/lib/paceDerivation.ts`**) — **Done
       2026-08-03.** The pure template engine reproduces the approved 12-week 5K plan exactly and
       accepts arbitrary week counts, available run days, starting weekly volume, and supported
       race distances. Pace derivation, goal realism, issue #22's last-loading-week clamp, and
       issue #23's 30 km week-8 output landed in the same build.
   - [x] **Un-quarantine the two TDD suites.** The Jest, TypeScript, and ESLint exclusions are
         removed; both suites run in the normal gate. Typecheck, lint, and 213/213 tests pass.
   - [x] **Fixture/test resync — already done, not still open (corrected in this doc-audit
         pass).** `src/lib/__tests__/paceDerivation.test.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`,
         and `src/lib/fixtures/examplePlan.ts` all already assert cycle-2's corrected numbers:
         week 9 at 45 km with a 300 m interval jog, and `paceDerivation.test.ts`'s
         >10%-goal-improvement gate already replaced by a test asserting ruling 3's goal-pace
         convergence (240 s/km), plus an `it.todo` naming the then-open goal-realism question
         (Open item 5) instead of inventing an answer to it. **That `it.todo` is now gone** —
         2026-07-12's ruling replaced it with real tests. This step, "In flight," and "Known
         debt" previously said this resync was still pending — it wasn't, by the time this pass
         read the actual files; see `docs/change_log.md`'s new correction bullet. What remains is
         writing `planTemplates.ts`/`paceDerivation.ts` themselves against these already-correct
         specs — tracked in step 3 above, not a doc/test sync problem.
4. [x] **Plan view rendering a real template plan — done 2026-08-04.** `src/app/plan/[id].tsx`
       now renders a real generated plan via `GET /api/plans/:id`, alongside the permanent static
       golden fixture (which stays the demo/example plan, not the route's default). E2E-verified
       against `wrangler dev`, including the same-pass long-run and Race Day distance fixes above.
5. [x] **Theme + fonts** — **Done.** `src/constants/theme.ts` replaced with the Instrument & Matter
       token system (commit `145d7e0`); stock template screens removed
       (`src/app/index.tsx` → `src/app/(tabs)/index.tsx`, rewritten; `explore.tsx` deleted);
       `expo-glass-effect` also removed in the same commit — the "Known debt" risk recording it as
       still-installed is stale and removed below. Not logged in `change_log.md` until this
       doc-audit pass; see its new 2026-07-10 (evening) entry.
6. [~] **The spine** — **Server half done 2026-08-02, client-side auth done 2026-08-03,
       on Cloudflare rather than Supabase.** `workers/` holds better-auth on D1, both migrations,
       and the account routes; there is no RLS to write because SQLite has none, so ownership moved
       into `workers/src/lib/store.ts` (see `docs/architecture.md` "Authorization without RLS").
       `src/lib/apiClient.ts` and `src/app/(auth)/` now let the app sign up, sign in, and sign out
       against it, gated by `Stack.Protected` in the root layout. **Google OAuth's client id/secret
       are now provisioned and verified working against local dev (2026-08-05)** — email/password
       already worked. **Still to do:** the production `wrangler secret put GOOGLE_CLIENT_ID`/
       `GOOGLE_CLIENT_SECRET` (needs the captain's own Cloudflare login), plus their `wrangler
       login`/`d1 create`/`deploy`.
7. [x] **Intake** (8 questions, or 10 with a target race, + review) persisting to
       `intake_responses` — **screen done 2026-08-04**, wired to the already-built server side
       (`GET`/`PUT /api/intake`, validated twice: readable message in the route, table CHECKs
       underneath).
8. [x] **`generate-plan`** — tier branch, quota check, validate, retry once, fall back, clamp, and
       the deterministic skeleton binding are now **all built, tested, and wired** — `POST
       /api/generate-plan` calls through to `src/lib/planTemplates.ts` via
       `workers/src/deps.ts`'s `createTemplateSkeletonBuilder()` and returns a real plan. The
       client action calling it, and the plan view rendering the result, landed the same pass (step
       4 above). **The Pro/Elite personalization prompt (`workers/src/deps.ts`'s second swap) is
       now bound too, as of 2026-08-10** (`workers/src/lib/planPersonalizationPrompt.ts`) — see
       "Known debt and risks" below for what still blocks it from making a live call.
9. [x] **Quota UI + dummy paywall — done 2026-08-05.** `src/app/(tabs)/settings.tsx` (the new
       fourth tab) shows tier + a quota line off `GET /api/quota-status` (new pure
       `src/lib/quotaDisplay.ts`) and a Free-tier "Upgrade" entry point; `src/app/paywall.tsx` (a
       `Stack` route) calls `POST /api/purchase-tier` with honest "test upgrade, no payment
       required" copy, reached from there or from Home's `generate-plan` action on a `402
       over_quota` response. Settings also gained sign-out (moved off Home) and a Delete Account
       flow. Full account: `docs/change_log.md`'s 2026-08-05 entry (the newest one).
10. [x] **My Plans** — **done 2026-08-04.** A My Plans tab (`src/app/(tabs)/my-plans.tsx`) lists
        plans off `GET /api/plans`, fetched via `useFocusEffect` so the list stays fresh across tab
        revisits (fixed in the same pass — see `docs/change_log.md`'s 2026-08-04 entry).
11. [ ] **Motion + polish**, last, because the reveal choreographs the finalised `Plan` types.
12. [x] **Abbreviations glossary tab.** **Done.** `src/app/(tabs)/glossary.tsx`, sourced from
        `src/lib/notation.ts`'s `RUN_TYPE_ABBREVIATIONS`/`UNABBREVIATED_RUN_TYPES`/
        `STRUCTURE_SHORTHAND` exports, which are themselves copied verbatim from `notation.md`.
        **Abbreviation-set sign-off (Open item 4, R5) landed 2026-07-12** — the set is confirmed
        exactly as written, so the copy this tab ships is no longer "proposed," it's final.
13. [ ] **Ian's rendered-plan review, round 2** (renumbered from "cycle 2" — that label belongs to
        the 2026-07-11 review-and-refine pass, docs and code both done, see "In flight"). **The
        paper half is done as of 2026-07-12 — every open coaching question is now ruled on.**
        Resolved via issue #34's batched queue: the abbreviation set (Open item 4, R5), the
        Daniels-brake question (Open item 6, R3 — permanently advisory), the strides extension
        (Open item 7, R7 — both easy days of two-easy-day loading weeks), peak volume (R2 — 48 km
        approved), and two items outside the original Open-item list that surfaced in the same
        sitting (the long-run share-cap conflict, R1, closing issue #19; race-day notation, R6,
        closing issue #29). Goal-realism (Open item 5) was ruled on the same day in its own pass —
        warn at 10%, cap the race-pace anchor at 15% — closing issue #33. **Still open, left
        unchecked:** the actual coach's sign-off on `planTemplates.ts`'s *rendered* numbers. That
        can't happen until step 3 above produces a real plan; a rendered plan needs a coach's yes,
        not just a passing test suite.

---

## Blocked / awaiting a decision

Only genuinely open items remain here. Everything resolved by the 2026-07-10 decision gate moved
to "Decided" below.

| Item | Blocks | Who decides |
|---|---|---|
| ~~`wrangler login`~~ | — | **Done.** Everything below it has since run |
| ~~`wrangler d1 create pace-blueprint`~~ | — | **Done.** The real `database_id` is now committed in `wrangler.toml` (an identifier, not a credential) |
| ~~`wrangler secret put BETTER_AUTH_SECRET`~~ / `ANTHROPIC_API_KEY` | any real model call | **Auth secret done** — proven live: production email sign-in returns a proper `401 INVALID_EMAIL_OR_PASSWORD` rather than the 500 a missing secret would cause. `ANTHROPIC_API_KEY` still open |
| ~~`wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (production)~~ | — | **Done 2026-08-09**, along with the production redirect URI. `sign-in/social` returns a real Google authorization URL and Google serves a live sign-in page against it. **Two open riders:** the client secret is only exercised at the token exchange, so one real sign-in from the app is still needed to prove it; and if the OAuth consent screen is in **Testing** status, only listed test users can complete sign-in (everyone else gets `access_denied` after entering their password). The secret was rotated first, so the deployed value is a fresh one |
| ~~Rotate the Google client secret~~ (`v22-launch-audit-r1-decision-google-secret-rotation`) | — | **Done 2026-08-09**, before the secret was deployed. The original was pasted in plaintext into a chat pane twice during provisioning; it was rotated in Google Cloud Console and only the new value was ever pushed to production, so the exposed credential was never live. Backlog item can be closed |
| `APP_SCHEME` = `paceblueprint://` | the OAuth return into the app | **Ian.** Matches `app.json`'s `scheme` and the `expoClient({ scheme })` call, and `trustedOrigins` acceptance of `paceblueprint:///` is now covered by `workers/test/social-auth.test.ts` — but still never verified against a real built app |
| ~~`wrangler deploy`~~ | — | **Done.** `https://pace-blueprint-production.i78979848.workers.dev` is live and answering |
| **Decided 2026-08-07: deploy the Worker.** How a phone reaches the backend — LAN against `wrangler dev` was the alternative and was declined; on-device testing waits on `wrangler deploy` (the row above) rather than a same-Wi-Fi workaround | all on-device testing; caused the 2026-08-07 `Network request failed` report | **Ian — ruled.** A loopback base URL is unreachable from a phone by construction, tunnel or not (see `.env.example`); once deployed, `EXPO_PUBLIC_API_BASE_URL` becomes the Worker's `https://` URL. The app now reports the unreachable case clearly instead of crashing, but cannot fix it |
| `wrangler deploy --env production` for the 2026-08-10 (later) `INVALID_ORIGIN`/`INVALID_CALLBACK_URL` fix | email sign-up and Google sign-in against the deployed Worker | **Ian.** The fix (`workers/src/auth.ts`, `workers/wrangler.toml`) is merged and tested but not live until redeployed — see the "Last updated" entry above |
| Google OAuth consent screen publishing status (Testing vs. production) — does it block real users, not just listed test accounts | Google sign-in for anyone other than a listed test user | **Ian**, in Google Cloud Console → OAuth consent screen. Not checkable or changeable by an agent |

None of the above blocks local work: everything in `workers/` runs offline against `wrangler dev`'s
Miniflare emulation with no account. The list is the exact Cloudflare counterpart of what the audit
called "the Supabase spine" — the same shape of gate, a different vendor.

**Password minimum length is decided, not blocked:** 8 characters, set in `workers/src/auth.ts`
(better-auth's `minPasswordLength`) and asserted by a test. It is ours to choose now, not something
to verify against a hosted provider's default.

**Resolved 2026-07-12, removed from this table:** whether Rule 5's "Monitoring" tier applies to a
one-time pre-run intake — Ian ruled it does not (R4, issue #34). Only the Immediate Stop and
Reduce Volume tiers are surfaced or actioned; Monitoring's triggers stay in `load-rules.md`/
`injury-rules.md` as documented, unused source content. See "Decided (2026-07-12)" below.

## Decided (2026-07-12) — GitHub issue #34, coaching sign-off queue closed

Full rationale for each ruling is in `docs/change_log.md`'s "2026-07-12" entry. This queue closed
issues #19 and #29 alongside #34; the separately tracked #22/#33 implementations landed later with
issue #3 on 2026-08-03.

| Item | Decision |
|---|---|
| Long-run share cap vs. the golden plan (issue #19) | **R1 — per-level ladder raised and made monotonic**: beginner 25% (unchanged), intermediate 32% (was 30%), advanced 35% (was 30%). Ian-authorised override of the source library's figures, not a port. **Follow-up ruling R1c (same day, from a code-review finding):** the cap is never removed for a deload week — it's measured against the last loading week's volume instead of the deload week's own reduced total (still bound by the spike, absolute, and time caps; an unsubstantiated deload claim is capped as an ordinary loading week). |
| Peak weekly volume, 48 km | **R2 — approved on its own merits.** `weeklyLoad` stays `[34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28]`. |
| Daniels' 10%-of-weekly-volume brake, low-volume override | **R3 — permanently advisory, never enforced, never overrides the 5K quality-volume band's floor**, not even for a low-volume runner. |
| Rule 5's "Monitoring" tier at intake | **R4 — dropped from intake entirely.** Only Immediate Stop and Reduce Volume are surfaced/actioned; Monitoring's triggers stay documented as unused source content. |
| Run-type abbreviation set | **R5 — signed off exactly as written**: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, Strides always spelled out, Race Day never abbreviated — including the known `RP`-vs-`GP` layering wrinkle. |
| Race-day structure string (issue #29) | **R6 — `WU 3 km · 5 km race · CD 2 km`.** Replaces the ungrammatical `5 km warm-up/cool-down + 5 km race`; no new notation token. |
| Strides placement | **R7 — both easy days of loading weeks 1, 2, 3, 5, 6, 7** (up from one day/week). Weeks 9/10 keep one day; week 11's taper is left alone; deloads 4 and 8 stay strides-free. Volume-neutral. |
| Week 9's interval recovery jog | **R8 — 300 m jog confirmed**, the library's 300–400 m menu for 600 m reps stands. Week 9 stays 45 km. |

## Decided (2026-07-10) — decision gate closed

Full rationale for each is in `docs/change_log.md`'s "2026-07-10 (Phase 0)" entry.

| Item | Decision |
|---|---|
| Goal-vs-recent improvement threshold | ⚠️ **Superseded twice — see "Goal-realism handling" in the 2026-07-12 row below for the behavior that is actually live.** As originally decided (R-A addendum): 10%, gating race-pace session targets only — beyond 10%, goal-pace sessions would use the recent-time-equivalent pace instead. Ruling 3 (2026-07-11) retired that pace gate; the 2026-07-12 goal-realism ruling reuses the 10% number for a *warning* line, not a pace gate. The one part that never changed: training paces are **unconditionally** recent-time-derived — the goal never drives everyday paces, at any threshold. |
| "Experienced" maps to intermediate or advanced? | **Intermediate** (kept as coded) — safer, tighter caps. |
| Intermediate deload cadence | **4 weeks** (kept as coded); 50+ still always forces 3. |
| Shape of the intake `injuries` field | Closed-set `InjuryFlag` flags + optional free-text notes (length-limited/sanitized). Flags alone drive Rule 5's triage; notes inform paid prompts only. **Set now includes `plantar_arch` (2026-08-03) — see the 2026-08-03 row below.** |
| Where Rule 10 disclaimers render | Static footer section on every plan view + one line in the generating modal's fine print. |
| Elite extras | **Cut for MVP.** Elite = richest personalization prompt + per-workout "why" only; `Plan.extras` can carry them later without a schema change. |
| iPad / tablet a v1 target? | **No — phone-only v1.** iPad and desktop/computer support move to v2 (Ian: "phone only for phase 1, then ipad and computer in phase two"). |
| Paywall + Settings in MVP? | **Restored.** Minimal dummy paywall + settings-lite (sign out, tier display, restore), in the blueprint's reserved third tab slot. **Built 2026-08-05** — `src/app/(tabs)/settings.tsx` (tier, quota, sign-out, delete account) and `src/app/paywall.tsx` (dummy `purchase-tier` call); "restore purchases" itself has no counterpart yet since v1's IAP is dummy-only, not a real store receipt. |
| Does a fallback plan burn quota? | **Not the first 3 in a period** (`is_fallback` filter in both `generate-plan` and `quota-status`; `notes` length-limited and sanitized). **A 4th+ fallback in the same period keeps the already-reserved slot (R-B addendum)** — nobody is refused, but that attempt counts against quota, and the fallback card must say so. |
| Free-tier configure gating | Free sees all options; out-of-tier selections render locked and route to the paywall on tap — never a dead disabled button. |
| "Next workout" / "current week" card | **Dropped.** Home shows the plan link + quota state only. No current-week arithmetic exists in v1. |
| Red-flag injury protocol representation | ⚠️ **Superseded 2026-08-03 — see the 2026-08-03 row below.** As originally decided: rendered as a conservative fixed-length plan whose weeks carry the protocol's phases, plus a pain-gated-progression `extras` `PlanSection`, plus Rule 10 disclaimers. Does not consume quota. Never built; the captain ruled for the simpler alternative when Bug 1 (the field having no effect at all) was fixed. |
| Pace-derivation method | Cross-distance equivalency via the Riegel formula (`T2 = T1 × (D2/D1)^1.06`); training paces anchored to the source's own relative rules. Any remaining numeric gap goes back to Ian — nothing invented. |

## Decided (2026-07-12)

Full rationale for each row in `docs/change_log.md`'s 2026-07-12 entries.

| Item | Decision |
|---|---|
| App name (issue #35) | **Pace Blueprint** — a PACE-family sibling to V2.3 "Pace AnalysisAI" (`com.ian.paceanalysisai`). Chosen over "Pace Blocks," "Pace Plans," and "Pace Builder." A blueprint is a precise document you build from and don't edit — matching this app's immutable plans (2026-07-10 decision) — and carries no AI hype, matching the Instrument & Matter aesthetic (data is the decoration; glow is banned). |
| Identifiers (shipped, not just the art) | `app.json` `expo.name` → `Pace Blueprint`, `expo.slug` → `pace-blueprint`, `expo.scheme` → `paceblueprint`, `expo.ios.bundleIdentifier` → `com.ian.paceblueprint`, `expo.android.package` → `com.ian.paceblueprint` (newly added); `package.json` name → `pace-blueprint`; Home title in `src/app/(tabs)/index.tsx` → "Pace Blueprint." `package-lock.json` regenerated. |
| Why the name landed now, not M6 (revises issue #35's own premise) | The issue said the name was "needed by M6, not before" — true of the *art*, not the *identifiers*. `scheme` and the bundle ID are load-bearing for Supabase OAuth redirects and Apple/Google sign-in callbacks. Auth doesn't exist yet, EAS isn't linked (no `eas.json`, no `projectId`), and the scheme had zero references in code — so renaming today cost one edit, versus reconfiguring the Supabase redirect allowlist and the Google/Apple OAuth configs after auth ships. **Consequence:** the deep-link scheme is now `paceblueprint://`, not `v22workoutplangenerator://` — issue #5's redirect-allowlist item must use the new scheme. |
| Rule 10 disclaimer wording | Stays as-is — keeps the word "PACE" (the family brand is the entity providing coaching guidance; Pace Blueprint is one surface of it). `docs/reference/coaching/**` was NOT edited. Issue #32's claim that the fixture disclaimer was "fossilizing a placeholder" was mistaken — it's correct as written. |
| Distance/pace units — km vs miles (issue #36) | **Kilometres, everywhere, permanently. No unit toggle; units are never user-selectable.** Intake asks weekly volume in km; plans render distances in km and paces in sec/km. Imperial is **out of scope**, not deferred — not an open product question blocking intake. The code (`src/lib/planTypes.ts`, `src/lib/loadRules.ts`) was already km-canonical; only `docs/design/frontend-design-brief.md`'s stale `/mi` copy needed fixing. |
| `FallbackNotice` quota-copy variant, default or required? (issue #30) | **Required, no default** — Ian rejected the issue's own suggested fix (default to `exempt`), since a default is exactly what would let a bare `<FallbackNotice />` keep compiling while still stating a false quota claim to a runner past the 3-per-period cap. `variant: 'exempt' \| 'counted'` (`FallbackVariant`) now carries both copy strings; the one caller, `src/app/plan/[id].tsx`, passes `variant="exempt"` explicitly. The client can't yet derive the true variant server-side — filed as issue #45, blocked on `generate-plan` (Phase 4). |

### Goal-realism handling (issue #33)

Closes Open item 5 and GitHub issue #33; implementation landed with issue #3 on 2026-08-03. Full
reasoning, worked cases, and the type contract:
[`docs/superpowers/specs/2026-07-12-goal-realism-design.md`](superpowers/specs/2026-07-12-goal-realism-design.md).

| Item | Decision |
|---|---|
| Goal-realism handling — warn, cap, or trust an implausible goal? | **Two bands: warn, then cap.** Riegel-equivalent the recent performance to the goal distance and measure the implied improvement. **≤10% → `realistic`**, silent, race-pace (`RP`) sessions anchor at the raw goal pace. **10–15% → `ambitious`**, warn, but `RP` *still* anchors at the raw goal pace — ruling 3 holds even under a warning. **>15% → `implausible`**, warn **and cap** the `RP` anchor at the recent-equivalent improved by exactly 15%. Boundaries are inclusive at the top of each band; the cap engages only strictly above 15%. |
| Do the thresholds scale? | **No — flat for every runner.** No scaling by age, experience, or plan length. The source gives no per-week or per-age improvement rate to port, and inventing one would be exactly the fabricated coaching number this project forbids. Scaling stays available as an additive change if round-2 review shows flat is too crude. |
| Where the warning appears | **Both goal-entry points *and* the plan**, from one shared pure `assessGoalRealism()`. The client warns at the intake review screen *and* the configure modal (goal time travels per-generation), so the runner learns their goal is a stretch **before** spending a generation — on Free, that is 1 of 3. The engine calls the same function to cap the anchor and stamps the verdict onto the immutable plan (`Plan.goalRealism`), so the plan explains its own numbers. Same function both sides ⇒ warning and cap cannot disagree. The warning is advisory and **non-blocking**. |
| Provenance | **Both thresholds are Ian's own.** The coaching source has no goal-realism rule — `COMPLETENESS.md` lists "goal unrealistic for current fitness" under what the library is *missing*. Nothing here is portable from McMillan, and nothing here may be changed without him. |
| Blast radius | Training paces (easy/tempo/interval) stay **unconditionally** recent-derived at any goal size. A fantasy goal cannot corrupt everyday paces — the entire exposure is the `RP` session target, which is why capping one number is a sufficient fix. |

**Implemented in code:** the shared types and contract tests landed 2026-07-12;
`src/lib/paceDerivation.ts` landed 2026-08-03 with the exact ruled threshold and cap arithmetic.
**The client-facing warning landed 2026-08-05** — `GoalRealismNotice` on the plan screen, plus a
live preview at both goal-entry points (Intake, Home), closing the gap between this ruling and what
the runner actually saw. **Corrected 2026-08-15:** the plan-screen branch now includes both
`ambitious` and `implausible`; ambitious copy explicitly says the declared goal pace was kept, and
Intake no longer claims that ambitious goals are adjusted. See `docs/change_log.md`.

## Decided (2026-08-06) — youth (under-18) HR-zone policy, `v22-youth-policy-research-s1` §6-A/E

Captain approved **only** item A of the research report's five youth proposals; B (rest-day
floor/end-of-plan break), C (absolute volume ceilings), and D (race-distance gate) were
explicitly declined — evidence judged too thin (C) or not this task's scope (B, D) — and remain
unimplemented. Full report: `v22-youth-policy-research-s1/report.md` §6.

| Item | Decision |
|---|---|
| §6-A — suppress `hrZone` under 18 | **Implemented.** Never emitted on any tier below age 18; substituted with RPE (`loadRules.ts`'s `rpeForZone`) using the coaching library's own already-ported RPE scale — no new content invented. See `docs/change_log.md`'s 2026-08-06 entry. |
| §6-E — under-18 disclaimer | **Implemented**, captain's exact sign-off text (mid-task addition, same ruling round), appended to `Plan.disclaimers` whenever `age < 18`. |
| §6-B/C/D | **Declined for now.** Not implemented; no code changed for these. |

## Decided (2026-08-03) — injury-handling task brief

Closes the plan-accuracy scout's Bug 1 and mandated finding B. Full rationale:
`docs/reference/coaching/plan-structure.md`'s "Design rule" section and `load-rules.md`'s
"Per-flag volume reduction" section.

| Item | Decision |
|---|---|
| Red-flag injury plan shape | **The simpler of the scout's two options** ("whichever uses the least amount of tokens but still maintain professionality"): a red-flag declaration produces a normal, volume-adjusted plan — the same mechanism as any other closed-set flag — not a separate return-to-running protocol generator. Still discloses clearly: a strengthened professional-evaluation disclaimer attaches on top of the standard Rule 10 injury disclaimer, adapted from the source's own language, not invented. Supersedes the "Red-flag injury protocol representation" row above. |
| `plantar_arch` closed-set flag | **Added**, resolving mandated finding B. Wired at its library-prescribed 20% reduction (`injury_flags.md:69`). |
| Which flag(s) count as "red-flag" for the disclaimer | **`ankle_achilles`, today** — an interpretive judgment call, not a literal source label (the source only ever labels the stress-fracture/bone-pain pattern and the female-athlete-triad pattern "RED FLAG"; neither has a closed-set equivalent). Achilles is the one covered pattern carrying the source's own "(HIGH PRIORITY)" label. Flagged for captain review in `src/lib/loadRules.ts`'s `RED_FLAG_INJURIES` and `load-rules.md`. |
| Per-flag volume-reduction percentages for flags with no body-specific source figure (`ankle_achilles`, `it_band`, `hip_glute`, `lower_back`) | **Fall back to Rule 5's generic "Reduce Volume Triggers" tier, 20%** (`load_rules.md:185`) — the source's own number for a declared injury lacking its own pattern-specific figure, not an invented one. |

## Decided (2026-08-06) — plan-accuracy fix batch

Closes four decisions registered by the plan-accuracy scout
(`/Users/Guestyyyyyyyy/firstmate/data/workout-v22-plan-accuracy-s1/report.md`) and the Apple/kids
guidelines scout (`/Users/Guestyyyyyyyy/firstmate/data/v22-apple-kids-guidelines-research-s1/report.md`).

| Item | Decision |
|---|---|
| `red-flag-injury-plan-shape` | **Superseded the 2026-08-03 ruling above.** A red-flag injury still produces a normal, volume-adjusted plan — never a separate return-to-running protocol — but its reduction is now a flat **15%, applied to every week of the plan**, not the ordinary flag's week-1-only per-flag percentage. Implementation: `src/lib/loadRules.ts`'s `RED_FLAG_VOLUME_REDUCTION_PCT` / `redFlagVolumeReductionPct()`, wired into `applyInjuryVolumeAdjustment()` in `planTemplates.ts`. Full rationale: `docs/reference/coaching/plan-structure.md`'s "Design rule" section. |
| `plantar-arch-injury-flag` | **Already shipped** in the 2026-08-03 batch above — confirmed still wired through `planTypes.ts`, `workers/src/routes.ts` validation, `src/app/intake.tsx`'s picker, and `loadRules.ts`'s reduction table. No further change needed. |
| `fifty-plus-golden-deload-weeks` | **Weeks 4, 8, and 12** are deload weeks for 50+ runners on the golden 12-week 5K path — not the generic every-3-weeks modulo (which would land on 3/6/9). This is a golden-path-only override; the generic path's every-3-weeks-for-50+ cadence is unchanged. Week 12 (the race week) is flagged `isDeload: true` in addition to its existing race-day structure. Implementation: `buildCanonicalFiveKWeek()` in `planTemplates.ts`. |
| `age-floor` (App Store declared minimum age) | **13**, unified with the backend intake validator. The two were briefly treated as separate (the backend floor had been raised to 13 in an earlier, unrelated commit — `8acc27c` — while a prior ruling had separately declined touching it), but the captain resolved that tension mid-task: both the backend validator (`workers/src/routes.ts:210`, already `age < 13`) and the App Store Connect age-rating questionnaire answer are 13. There is no in-repo App Store Connect config to edit — `eas init` has never been run (`docs/apple-dev-blocked.md`) — so the declared floor is recorded here as the value to use once submission is set up; the questionnaire itself remains a captain's-account action at submission time. |

---

## Latest — 2026-08-09 comprehensive audit and captain test mode

The full frontend/Worker audit receipt is [`audit-2026-08-09.md`](audit-2026-08-09.md). Web CORS and
web cookie storage now work, stale route types no longer break clean typechecks, request/intake
validation is aligned across client/Worker/D1, fallback quota messaging is accurate per plan, and
Expo Doctor is clean. `ALL_USERS_UNLIMITED_ACCESS = "true"` is intentionally enabled in
`workers/wrangler.toml`: all authenticated accounts are temporarily Elite with unlimited plans for
the captain's test pass. Set it to `"false"` before real users arrive; normal entitlements remain
intact underneath.

## Known debt and risks

### Found 2026-08-08 while fixing the sign-up form, deliberately NOT fixed on that branch

- 🟢 **Resolved 2026-08-09: browser access to the Worker.** `workers/src/cors.ts` now answers
  credentialed preflights from an exact origin allowlist and adds CORS headers to auth/API
  responses, while unknown origins fail closed and native requests without `Origin` stay
  unaffected. `src/lib/apiClient.ts` now uses a no-op Expo-plugin storage adapter on web and lets
  the browser send its HttpOnly cookie with `credentials: include`; native keeps SecureStore.
  The old CORS-specific network-message misdiagnosis no longer occurs in the supported local flow.
- 🟢 **Resolved 2026-08-09: server-revoked sessions clear the local authenticated shell.**
  `src/lib/apiClient.ts` maps an authoritative `403 unauthenticated` response to a best-effort
  `authClient.signOut()` before returning the original `ApiError`, so a foregrounded app no longer
  remains visually signed in after server revocation.
- 🟠 **The effort hexes have no contrast headroom — tracked as [issue #70](https://github.com/IanQiu979/WorkoutGenerationv2.2/issues/70).**
  Four of the five light effort hexes sit barely above the brief's 3:1 floor *at full opacity*
  (`easy` is 3.0045:1), so there is no headroom for an opacity dip; and dark `interval` (#C6402F on
  #14171C) is 3.57:1 at full opacity and **2.32:1 at the 0.7 dark floor**, so the dark floor is not
  justified by the numbers either. Both want `design-system` to revisit the effort scale, which
  ripples into plan view (`WeekAccordion.tsx`, the scale's primary consumer) — hence its own issue
  rather than a bullet here. Neither was introduced by the 2026-08-08 change.
  **Not open for the onboarding hero:** the captain ruled 2026-08-08 that its shimmer is
  dark-mode-only and final, with the contrast floor untouched. That behaviour is settled; only the
  palette question above is outstanding.
- 🟡 **Onboarding replays on every signed-out session, not just first install.** `(auth)/index.tsx`
  is the anchor for all of them, so a returning user who signed out sees the hero again. Deliberate
  for now — the sign-in link on that screen is the skip — but persisting a "has seen onboarding"
  flag is an open product decision, and there is precedent for the pattern (the wave's stroke-draw
  is gated on a persisted set of plan IDs).

### Standing

- 🔴 **`wrangler secret put ANTHROPIC_API_KEY` has never been run** (nor its Supabase predecessor).
  Nothing anywhere has an Anthropic key. This is not currently *breaking* anything — with no key the
  model caller returns a typed `not_configured` and the pipeline serves the template plan as a
  quota-exempt fallback — but it is now the **only** remaining blocker on paid tiers ever being
  paid-tier: as of 2026-08-10 the Pro/Elite personalization prompt itself is built, bound, and
  tested (`workers/src/lib/planPersonalizationPrompt.ts`, `deps.ts`'s second swap) — it has simply
  never made a real network call, because there is no key for it to call with. The moment the
  captain runs `wrangler secret put ANTHROPIC_API_KEY --env production` (and the local `.dev.vars`
  equivalent for `wrangler dev`), Pro/Elite generation starts calling Claude for real with no other
  code change.
- 🔴 **No Cloudflare account resources exist.** `wrangler login` is interactive and unrun, so
  `wrangler d1 create`, `wrangler secret put`, and `wrangler deploy` are all unrun too, and
  `wrangler.toml`'s `database_id` is a deliberately fake placeholder. Local work is unaffected —
  `wrangler dev` and the test suite need no account — but nothing is reachable from a phone. Full
  list in "Blocked" above.
- 🟢 **Resolved 2026-08-04: `generate-plan` can now actually generate a plan.** The deterministic
  skeleton binding (`workers/src/deps.ts` → `createTemplateSkeletonBuilder()` →
  `src/lib/planTemplates.ts`) landed, so the route, quota gate, idempotency, validation, and
  fallback that were already built and tested now serve a real plan instead of `503
  engine_unavailable`.
- 🟢 **Resolved 2026-08-10: the Pro/Elite personalization prompt is written, bound, and tested.**
  `workers/src/lib/planPersonalizationPrompt.ts` is `deps.ts`'s second swap — `planEngine.ts`'s
  `createPlanPersonalizer` now receives a real `PromptBuilder` instead of `null`. It never re-emits
  a number: the model is asked only for `Plan.coachIntro`/`Week.why`/(Elite) `Workout.why` prose via
  a forced tool call, and `mergePersonalization()` copies those strings onto the already-clamped
  skeleton with no path for anything else to change. **What's left:** no `ANTHROPIC_API_KEY` exists
  anywhere (see the 🔴 item above), so `resolveModelCaller` still binds
  `createUnconfiguredModelCaller` and every call today answers `not_configured` — Pro/Elite
  generation still falls back to the honest, quota-exempt template plan, exactly as designed for
  "the backend not being finished," but the remaining gap is now purely the missing secret, not
  missing code.
- 🟢 **Resolved 2026-08-03: the client can now talk to `workers/`.** `src/lib/apiClient.ts` and
  `src/app/(auth)/` (email/password sign-in/sign-up, `Stack.Protected` session gate) landed in
  `06b1f89`. **Google OAuth resolved in local dev 2026-08-05** — credentials provisioned and
  verified working against `wrangler dev`. **`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were
  provisioned on the named `production` Worker on 2026-08-09**, and the provider-registration probe
  against it returns a real Google authorization URL instead of `PROVIDER_NOT_FOUND`. That proves
  registration only: the client secret itself is exercised nowhere but the token exchange, and the
  OAuth consent screen's publishing status is unknown — both remain unverified in production and
  need the captain's Google-side and in-app check. No screen yet
  consumes `apiClient.ts`'s other wrappers (`quota-status`, intake, plans, `generate-plan`) —
  those land with the screens that need them.
- 🟡 **`supabase/` and `src/lib/supabase.ts` are dead code** kept deliberately (2026-08-02) so the
  earlier design stays readable. Deleting them is its own decision, and the `@supabase/supabase-js`
  dependency is still in `package.json` for the same reason.
- 🟠 **Apple Sign-In is not configured — and is now formally parked.** App Store rules require it
  once Google sign-in is offered in production, but configuring it needs an Apple Developer
  Program membership (App ID + Services ID + key) that Ian does not hold yet. Carved out of issue
  #7 on 2026-07-12 and recorded in [`apple-dev-blocked.md`](apple-dev-blocked.md); issue #7's
  remaining scope (email/password, Google OAuth, session routing) is unaffected and still workable
  today. **Google sign-in is now live in production (2026-08-09, see `change_log.md`), so the Apple
  requirement is active, not theoretical** — it binds at App Store submission, which is now the
  actual blocker rather than a future one.
- 🟡 **Suspected pre-existing bug: Home's demo link may render with no border, no 48pt tap target,
  and no pressed state (found while tracing the Link for issue #31, filed as issue #51).**
  expo-router's `Link asChild` (`src/app/(tabs)/index.tsx`) uses a Radix Slot whose `mergeProps`
  spreads `style` as an *object*, but the wrapped `Pressable`'s `style` prop is a *function*
  (`({ pressed }) => [...]`) — spreading a function yields `{}`, silently dropping every rule the
  function would have returned. Derived from reading the source, not device-verified.
- 🟡 **Race date/goal time/recent time are masked text input, not a native picker (UX audit
  Finding 5, `1c1e174`).** Intake and Home mask keystrokes and validate inline, but a real
  `@react-native-community/datetimepicker` was deliberately withheld — a new dependency is HIGH
  tier under `AGENTS.md`'s routing rules and needs a `dependency-auditor`-led chain and explicit
  sign-off, not bundled into a UX-copy batch. Revisit if masked text proves error-prone in use.
- 🟠 **Deep-link scheme `paceblueprint://` still unverified against a built app.** It is now
  configured as `APP_SCHEME` in `workers/wrangler.toml` and passed to better-auth's
  `trustedOrigins`, so there is no third-party allowlist to update any more — but the value itself
  was renamed from `v22workoutplangenerator://` in the 2026-07-12 identifier rename and has never
  been checked against what the app actually registers. Confirmed 2026-08-05 that `APP_SCHEME`
  matches `app.json`'s `expo.scheme` (`paceblueprint://` both places) and that
  `BETTER_AUTH_URL`'s redirect URI is correctly registered with Google — what's still unverified is
  an actual interactive login carrying the deep link back into a running app; that needs a human
  clicking through Google's consent screen, which wasn't done here.
- 🟠 **`GeneratePlanRequest` has no `goalTimeSec` field, so the per-generation goal cannot reach the
  engine at all (found 2026-07-12).** `docs/mvp-build-prompt.md:332` promises that race
  distance/date/goal-time *travel per-generation* — "intake's stored race is a default, not the
  authority" — but `src/lib/planTypes.ts`'s `GeneratePlanRequest` carries only `raceDistance`,
  `raceDate`, `durationWeeks`, `notes`, and `idempotencyKey`. The goal-realism check is defined
  against the goal time, so it cannot run server-side until this is fixed. Belongs to the
  `generate-plan` contract (issue #9, `api-designer`) — flagged, deliberately not fixed under the
  goal-realism ruling.
- 🟡 **The configure-modal design spec never mentions goal time (found 2026-07-12).**
  `docs/design/frontend-design-brief.md:564` describes the modal as distance chips + a date picker
  only, which contradicts `mvp-build-prompt.md:332` and leaves the goal-realism warning's second
  home unspecified. The warning must appear at *both* goal-entry points, so the modal needs a
  goal-time control and its advisory copy. Resolve when M4's configure modal is built (issue #13).
- 🟢 **Resolved 2026-08-09: plan fallback quota copy is accurate.** Plan reads and generation now
  return `quotaConsumed`; `src/app/plan/[id].tsx` maps it to `FallbackNotice`'s required
  `counted|exempt` variant instead of hardcoding the common case.
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **`BottomTabInset` stays deliberately uncalled (issue #32 finding 8, 2026-07-12).** It models a
  tab bar that *floats over* content; the real tab bar (`src/app/(tabs)/_layout.tsx`) sets no
  `position: 'absolute'` on `tabBarStyle`, so React Navigation lays it out in normal flow and a tab
  screen's viewport already ends where the bar begins — padding by this constant today adds
  trailing void, not clearance. **A first attempt at this batch wired it into the Glossary's scroll
  padding and was reverted** (it silently grew Android's bottom gap from 48pt to 80pt for no
  benefit). It becomes correct — and should be applied to every scrolling tab screen at once — only
  if `tabBarStyle` ever goes `position: 'absolute'`; whoever builds Home/My Plans' real scrolling
  content next should read this before reaching for the constant. Full reasoning in `theme.ts`'s
  docblock at the constant's definition.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **App art is still stock Expo — unblocked by the name decision, not yet done.** The icon,
  wordmark, splash artwork, and store listing copy are all still placeholders; needed at M6, not
  before. `app.json` also still carries stock Expo blue — `#208AEF` (splash `backgroundColor`) and
  `#E6F4FE` (Android `adaptiveIcon.backgroundColor`) — which clashes with the Instrument & Matter
  token system (commit `145d7e0`). Pull both colors from `src/constants/theme.ts` when the art
  lands.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
- 🟠 **Google OAuth client secret should be rotated before shipping (found 2026-08-05).** The
  captain pasted the real `GOOGLE_CLIENT_SECRET` in plaintext into a chat pane twice while
  provisioning it — it is now in `workers/.dev.vars` (gitignored, never committed or logged), but
  the plaintext exposure itself means it should be treated as compromised. Recommend rotating it
  in Google Cloud Console once the credentials are confirmed stable; that rotation is the
  captain's call, not done as part of this change.
