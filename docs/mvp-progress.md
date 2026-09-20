# MVP Progress

> The single place to see where V2.2 actually is. **Current state** below is the one home for
> "how it is now"; the dated entries under it are the immutable record of how it got here. Never
> rewrite a dated entry to carry a newer fact — if one is superseded, Current state is what
> corrects it. Updated after every exchange that changes a decision or completes work. If this
> file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

## Current state

> The single place to look for "how it is now" — the milestones and the facts below, nothing else
> in this file. Detail registers this section points at: per-item records in **Done**, the roadmap
> in **Next**, captain-only open items in **Blocked**, decision records in **Decided**, and risks
> in **Known debt**. Test counts were re-verified by running the suites on 2026-08-17; the dated
> entries below record what each point in time showed, this section is the current one.

### Milestones

| Milestone | State |
|---|---|
| M1 — Foundation (account → empty Home) | **In progress.** Server (auth + schema + account routes) is deployed on Cloudflare (`workers/`, live `production` environment); client-side email/password works in production, and Google is registered in production since 2026-08-09 (registration only — see "How it is now" for the two unproven riders). Password reset and email verification are built and tested end to end as of 2026-09-20 (issue #94) but **inert until the captain configures a mail provider** — `docs/email-setup.md`; see "How it is now" and "Blocked" |
| M2 — Intake (questionnaire persists) | **In progress.** Since 2026-09-20 the intake is mandatory on first entry (Home pushes a runner with no intake on file to it; no Cancel, no swipe-back until a plan exists), starts blank on every entry, asks the plan length itself when no race date fixes it, requires a target race distance, and ends in the one "Create plan" that saves and generates in a single press. Home asks nothing (`src/lib/planRequest.ts`) — see "How it is now" |
| M3 — Plan engine (3 tiers produce valid plans) | **In progress.** The engine splits by tier as of 2026-09-09: Free is served entirely from the 40-plan deterministic library (`src/lib/planLibrary/`), paying tiers keep the template/pace engine as the AI skeleton. Both are wired into the Worker's `generate-plan` route and the intake's "Create plan" press (Home's until 2026-09-20); the plan view renders a real generated plan (via `GET /api/plans/:id`) alongside the permanent static golden fixture. Paid tiers still serve the quota-exempt template fallback — see "How it is now" |
| M4 — Tiers & quotas (server-side, unbypassable) | **In progress.** The quota ledger, atomic gate, fallback exemption, `quota-status` and `purchase-tier` are built and tested server-side; Home now leads with the server-backed tier/quota line, Settings also displays it, and a dummy paywall lets a runner call `purchase-tier`. Since 2026-09-20 that dummy purchase is gated server-side to trusted testers (`workers/src/dummyPurchase.ts`): production as committed has it off with an empty allowlist, and the paywall renders `quota-status`'s `purchasesAvailable` rather than deciding — see "How it is now" and "Blocked" |
| M5 — My Plans (history) | **In progress.** My Plans keeps the permanent Example Plan, lists generated plans off `GET /api/plans`, and links MOST RECENT to the newest generated plan; there is no contradictory empty state |
| M6 — Polish & TestFlight | **In progress.** The visual system is **Blueprint** (2026-09-14, `fm/v22-animations-lane3`): the captain's V22 theme sheet plus the six approved build animations, replacing Instrument (2026-09-03, on `main`) which replaced Trailhead. Every screen — signed-out and signed-in — has now been rendered on Expo **web** at 393×852 and compared against the approved Claude Design pages (the visual-match pass, 2026-09-14); no screen has ever been run on a real iOS or Android device or simulator. See "How it is now". The first EAS build exists as of 2026-09-19 — an Android **development-client** .apk (build `9ca20e4e`, issue #93's Android half; recipe, artifact URL and the Google-sign-in config check in `docs/build.md`); it has not yet been installed and exercised on a phone, and iOS/TestFlight still waits on the Apple Developer Program |

### How it is now

- **"The plan builds itself" — the V22 build animations are in, the theme is Blueprint, and the
  heartbeat/graph motif is gone from the whole app (2026-09-14, `fm/v22-animations-lane3`).** The
  six captain-approved Claude Design pages (`V22-01` … `V22-06`, 2026-09-13) are rebuilt natively
  in Reanimated from one shared vocabulary (`src/lib/buildMotion.ts`, `src/lib/weekStrip.ts`,
  `src/components/build/`): the onboarding hero (a week strip draws itself, blocks snap in, the total
  counts, three faint weeks stack below), the three step pieces and the button that draws itself
  in, the survey intro before a first intake, the Home tier row's header mark (fills to the
  current week's elapsed days — `src/lib/planProgress.ts`; the app logs nothing, so elapsed is what
  "completed" can honestly mean), the My Plans hero built from the runner's real first week, and
  the three static plan-detail screens (overview → week → session/rest day) that replace the
  accordion view. Each plays once and holds its end frame; reduced motion shows the end frame
  directly. `theme.ts` is now the captain's `V22 theme.md` — one near-black field (the app renders
  the dark scheme only; the light palette is kept and still contrast-tested), ink for headings,
  numbers and the primary button's fill (the icy cyan went with the pulse trace), two session
  colours for bars and tiles only, Barlow Condensed / IBM Plex Mono / IBM Plex Sans. `PulseTraceHero`,
  `PulseTraceSlot`, `RouteLine`, `routeProfile`, both `pulseTrace` modules, `/dev/pulse-trace` and
  `docs/design/pulse-trace.md` are deleted; sign-in and sign-up carry nothing; the Home tab glyph is
  the strip. **Verification:** the Opus visual-match pass compared every screen's end frame
  pixel-over-pixel against the approved pages on Expo web at 393×852 and sampled the motion
  in-page against the pages' timings (one divergence found and fixed, the survey intro's W1 label);
  root gate green at 48 suites / 870 tests. Still never run on a device or simulator. Full account:
  `change_log.md`, 2026-09-14; token summary: `architecture.md` "Current — visual direction".
- **Tab returns no longer flash a redundant loading state (2026-09-12).** Expo Router SDK 57 keeps
  the four bottom-tab screens mounted. Home, My Plans, and Settings still refresh through
  `useFocusEffect` whenever they regain focus, but now render the last successful intake, plan list,
  or quota immediately while that request runs; Glossary has no fetch and is unchanged. The full
  spinner is reserved for the first load with no successful data. A successful `null` intake and
  empty plan list count as loaded, and refresh failures retain the cached UI. The rendered My Plans
  regression test exercises two focus cycles on one mounted renderer and holds the second refresh
  unresolved while asserting the cached plan remains visible with no `ActivityIndicator`. Root
  verification is green at 42 suites / 851 tests; no manual device test was performed.
- **Backend is live and reachable from a phone.** Cloudflare D1 + Workers + better-auth in
  `workers/`, deployed to the named `production` environment at
  `https://pace-blueprint-production.i78979848.workers.dev`. `wrangler login`, `wrangler d1
  create`, `wrangler deploy --env production`, and the `BETTER_AUTH_SECRET` / Google OAuth
  `wrangler secret put`s have all run. Auth, the quota ledger, intake, and plan reads/generation
  work end to end. Row-by-row captain-only status: "Blocked" below.
- **Auth: email/password works; Google is registered, with two unproven riders.** The
  `sign-in/social` probe against the live Worker returns a real Google authorization URL (the
  provider is registered). Still unproven in production: the client secret at the token exchange,
  and the OAuth consent screen's publishing status (Testing blocks everyone but listed test
  users). The 2026-08-10 `INVALID_ORIGIN` / `INVALID_CALLBACK_URL` fix is merged and tested but
  **not redeployed**, so those code fixes are not live until the captain runs `wrangler deploy
  --env production`. The `paceblueprint://` deep-link scheme matches `app.json` but has never been
  exercised by a real built app.
- **Delete account now re-confirms with the account's own password, matching V2.3
  (2026-09-20, `fm/v22-delete-account-password`, change-list item 10).** `POST /api/delete-account`
  checks identity server-side rather than trusting the session alone: for an account with a
  `providerId = 'credential'` row (`D1PlanStore.getCredentialPassword`), the request must carry the
  correct `password`, verified with the same `verifyPassword` (`better-auth/crypto`) sign-in itself
  uses, or the call is `401 invalid_password` and nothing is deleted — and five wrong passwords in
  15 minutes (per user or per connecting IP, `workers/src/lib/attemptThrottle.ts`) make it
  `429 rate_limited` before anything is verified; a Google/OAuth-only account keeps the
  pre-existing confirm-only behavior unchanged. Settings decides which confirmation UI to
  show via `accountHasPassword()` (reads better-auth's `/list-accounts`, fails closed to "assume a
  password is required" on any read error) — a credential account gets the new
  `src/components/settings/DeleteAccountDialog.tsx`, an OAuth-only account keeps the existing
  `confirmDestructive` native alert / web `confirm()` from issue #96. Tested end to end against
  real D1 and real better-auth in `workers/test/worker.test.ts` (missing/wrong/correct password,
  plus a simulated passwordless account), `workers/test/store.test.ts`, and
  `src/components/settings/__tests__/DeleteAccountDialog.test.tsx`. **Implemented and tested, not
  yet deployed** — the Worker change needs `wrangler deploy --env production` from the captain
  before it takes effect live; the currently deployed Worker still deletes on a bare session, no
  password asked. Detail: `change_log.md`, 2026-09-20.
- **The v1 dummy purchase is trusted-testers-only, decided on the server (2026-09-20,
  `fm/v22-test-purchase-gate`).** `POST /api/purchase-tier` refuses `403 purchases_unavailable`
  unless `DUMMY_PURCHASE_ENABLED === "true"` (local/dev's `wrangler.toml [vars]` only) or the
  session's email is on `DUMMY_PURCHASE_ALLOWLIST` (exact, case-insensitive; both non-secret
  vars, read only in `workers/src/dummyPurchase.ts`). `[env.production.vars]` leaves the switch
  absent and the allowlist empty, so production ships with the purchase off for everyone. The same
  decision reaches the app as `purchasesAvailable` on the `quota-status` payload the paywall
  already fetches; `src/lib/purchaseAvailability.ts` turns it into pending / available /
  unavailable and `src/app/paywall.tsx` hides the "Choose" buttons and shows "Test upgrades are
  limited to invited testers right now." when unavailable — the client never decides. **Not live
  until the captain redeploys** (see "Blocked"); until then the deployed Worker still runs the
  ungated route. Admitting a production tester is a committed-file edit plus
  `wrangler deploy --env production`, and only after that tester's account exists — the runbook
  and the reason are `workers/README.md` → "The v1 dummy purchase gate". Detail: `change_log.md`,
  2026-09-20.
- **Password recovery and email verification are built, tested, and switched off (2026-09-20,
  issue #94, `fm/v22-password-recovery-94`).** The Worker sends two transactional mails through a
  provider-agnostic sender (`workers/src/lib/mail.ts`: a `ResendAdapter` over Resend's HTTP API
  when `RESEND_API_KEY` **and** `MAIL_FROM` are both set, otherwise a `ConsoleAdapter` that logs
  one redacted line and sends nothing). `workers/src/auth-email.ts` resolves that per request and
  wires better-auth's `sendResetPassword` / `sendVerificationEmail`; sessions are revoked on a
  reset, verification mail goes out on sign-up only when mail is configured, and sign-in is gated on
  a verified address only when `MAIL_VERIFICATION_REQUIRED = "true"` **and** mail is configured
  (`verificationRequired = mailConfigured && flag`; the flag is `"false"` in both `[vars]` and
  `[env.production.vars]`). The app reads both booleans from the new public `GET /api/email-status`
  — the only unauthenticated app route besides `/health` — and is honest about them:
  `(auth)/forgot-password` shows *"Password reset isn't available yet — this server can't send
  email"* in place of the form until the captain configures a provider; the Home banner
  (`src/components/auth/VerifyEmailBanner.tsx`) renders only for an unverified account on a
  mail-capable Worker. Every mailed link is the Worker's own URL: it spends the token server-side
  and `302`s to the app's `callbackURL` (`src/lib/authEmail.ts` builds it through `expo-linking`,
  so it is `paceblueprint://…` in a built app, `exp://…/--/…` in Expo Go, `http://localhost:8081/…`
  on web — all three already in `trustedOrigins`). `src/app/reset-password.tsx` and
  `verify-email.tsx` sit at the root, **outside both `Stack.Protected` groups**, so a cold deep
  link renders in either session state. Sign-in gained "Forgot your password?" and, on
  `EMAIL_NOT_VERIFIED`, an explicit resend; sign-up passes the verify callback and shows "Check
  your inbox" when the Worker withholds the session. **Nothing has sent a real mail yet** — the
  domain, DNS and both secrets are the captain's (`docs/email-setup.md`); no test sends mail
  (`workers/vitest.config.ts` blanks both secrets); and the built-app deep link has never been
  opened on a device, the same unproven class as the `APP_SCHEME` row. All of the flow's
  user-facing copy awaits the captain's certification — "Blocked" lists every string. Full account:
  `change_log.md`, 2026-09-20.
- **Issue #89's privacy-policy surface is implemented, but its public URL is not yet proven live
  (2026-09-19).** [`docs/privacy-policy.md`](privacy-policy.md) is the source of truth and names
  Ian Qiu, a sole trader based in Thailand, as controller. Settings now has a **Legal → Privacy
  policy** row that opens the pinned target URL,
  `https://ianqiu979.github.io/Ai-Customized-Running-Plan-App/privacy-policy/`. The narrowly scoped
  `publish-legal-pages.yml` workflow renders only that policy into an otherwise-empty GitHub Pages
  artifact with GitHub's official Jekyll build action after a qualifying push to `main`; until a
  Pages deployment succeeds, the URL must not be described as live. The policy can point to in-app
  erasure because Delete account already shipped through PR #117. Its age posture is 13+ and, for ages 13–17,
  parent/guardian consent; that consent is now recorded, not just stated (2026-09-19) — the intake
  screen requires a checkbox for a 13–17 runner, and `PUT /api/intake` (`workers/src/routes.ts`'s
  `handlePutIntake`) refuses the save without it and otherwise writes a consent event (timestamp +
  `PRIVACY_POLICY_VERSION`) to the new `guardian_consent` table
  (`workers/migrations/0004_guardian_consent.sql`) in the same D1 batch as the intake row.
  It treats linked intake/plans as health/fitness data without claiming the injury picker records
  explicit consent, and documents GitHub Pages metadata plus Cloudflare/Anthropic retention.
  Since 2026-09-21 (change-list item 11) the rendered page uses the app's own Blueprint theme
  (`docs/privacy-policy-theme/`) instead of the generic default Jekyll theme the captain saw on his
  phone — same policy text, same URL, same trigger conditions, only the rendering changed; mirrors
  V2.3's PR 239 for its own theme. Detail: `change_log.md`, 2026-09-21.
- **Plan engine is fully wired, and every distance now gets its own training shape.** The pure
  template/pace engine (`src/lib/planTemplates.ts` + `src/lib/paceDerivation.ts`) is bound into
  `generate-plan` via `workers/src/deps.ts`; the plan view renders real generated plans. As of
  2026-09-06, 10K/half/marathon each have their own weekly-volume and long-run curves instead of a
  scaled 5K curve — see "Decided (2026-09-06)" below. Marathon's long-run ceiling is now
  distance-aware too: intermediate/advanced race plans use the captain's final 35% share cap,
  and — since 2026-09-07 — their separate absolute kilometre ceiling is lifted **only** for a
  `prepared` runner whose easy pace makes the 180-minute time cap enforceable; a runner with no
  recent time, any advanced runner (no derived easy pace), and any first-timer keep the level's own
  ≤25 / ≤35 km cap, so an advanced marathoner is always bounded at 35 km (a 110 km/week advanced
  marathoner with no recent time rendered 38 km before the fix). The number itself is still
  captain-pending. Race plans also carry `Plan.readinessPath`, and a first-timer plan says which
  capacity check sent it there and, on a runway under the research's first-timer minimum, that it
  is a completion plan rather than full preparation. A 50 km/week, 16-week intermediate plan now
  peaks at 11/24/24/24 km for 3/4/5/6 days, with the constrained three-day shape disclosed and a
  fourth running day recommended — see "Decided (2026-09-07)", "Decided (2026-09-06, later)",
  "Blocked" and "Known debt". Generic non-deload peak weeks now derive an algebraic long-run
  capacity candidate from the already-rendered pre-peak high-water mark, retained quality distance,
  and easy slots; the existing safety ceilings retain final authority. With that capacity floor in
  place, the pre-clamp `longRunStartFloor` now reads `retainedQuality` too, so a three- or four-day
  week is no longer floored on the Q2 interval it never schedules (348 of 22,000 swept plans move,
  each by a 1 km long-run drop). Both halves of GitHub issue #99 have landed. The sweep's residual
  peak-below-base offenders were ruled on 2026-09-19 (issue #103): the invariant is peak high ≥
  **base** high, a peak under a mid-build spike is tolerated when the plan discloses it, and two
  engine fixes (taper-aligned curve sampling, held long-run curves) took the sweep from 458 to 348
  such plans with none entering. **On 2026-09-20 the captain ruled the two residual families
  away — the sweep is at 0** (`fm/v22-engine-rulings-r2`): the beginner long-run share margin is
  1.2 (40% at three runs, 30% at four) and a 12-week/4-day 5K intake declaring ≥50 km/week is served
  generically rather than by the golden curve; the exact-membership mask is all-clear, disclosed
  build spikes 32 → 4. The same pack of rulings made the **Free library's peak phase its
  highest-volume block** (`HOLD` at the top of § 5's 95–100% band, weeks reconciled exactly to
  target, phases labelled from rendered volume by `derivePhases`; 17,600-plan sweep in
  `engine.progression.test.ts`, 0 peak-below-build / 0 peak-below-base / 0 backward phase steps —
  before it, every sampled Free plan had its highest week labelled `build`), put **race day at the
  bare race distance on both tiers** (paid race day 5 / 10 / 21.1 / 42.2 km, warm-up and cool-down
  in the structure string only; the golden fixture's race week is 23 km, not 28), made INJ-6's
  Day-7 pin a cap (issue #119 closed — rest weeks shorten the long run first on `lower_back` too)
  and confirmed #106's cut-once shape. Still open from that pack: the 150 paid plans whose
  one-week "peak" phase is a cadence rest week, pinned as a ceiling (`PEAK_ONLY_REST_CEILING`) —
  "Blocked" below; `docs/change_log.md` 2026-09-20; `scripts/render-coach-pack.js` re-renders
  the sign-off pack offline. A paid plan with a distance but no date now keeps
  `raceDistance` and is titled a Base Plan (issue #76), and the three source ports carry the 15–25%
  supersession note (issue #101) — `docs/change_log.md` 2026-09-19. **Rest weeks shorten the long run first
  (2026-09-12):** the skeleton's recovery weeks now size Day 7 at `loadRules.ts`'s
  `deloadLongRun` (§ 9's 60–70% of the preceding long run — the band the Free library already
  used) instead of leaving it on the loading curve while the easy runs absorbed the whole cut; the
  captain's audited `14 + 2 + 3 km` rest week was the pre-2026-09-06 band on top of that, and the
  last-deployed Worker still predates both fixes. Two property suites pin every rest week on both
  engines — `docs/change_log.md` 2026-09-12.
  The Pro/Elite personalization prompt is built, bound, and tested
  (2026-08-10) but has **never made a live model call**: `ANTHROPIC_API_KEY` is unset everywhere,
  so paid-tier requests still serve the honest, quota-exempt template fallback. That key is the
  **only** remaining critical-path item — detail in "Known debt" 🔴 and "Blocked".
- **Free's engine is the 40-plan deterministic library (2026-09-09).** Per the captain's ruling of
  2026-09-06 the engine splits by tier: Free users get the 40-plan library as their entire product,
  paying users get the AI curve generator, and the library is neither a fallback for the generator
  nor a parameter source for it. `src/lib/planLibrary/` ports
  `planning/research/plan-blueprint-examples.md`'s "V1 deterministic template library" — the
  register and dose ladder, the volume state machine, the placement layouts, the four canonical
  week-by-week calendars (5K/12, 10K/14, half/16, marathon/24), the H0–H4 injury state machine with
  all seven modules, and § 20's resolution order — with 65 tests.
  `workers/src/lib/planEngine.ts` routes `tier === 'free'` there; `planTemplates.ts` is untouched
  and remains the paid skeleton. **The six coaching questions the port raised were all answered by
  Ian on 2026-09-10** and are recorded as settled rulings in
  [`docs/reference/coaching/free-engine-open-questions.md`](reference/coaching/free-engine-open-questions.md).
  Two consequences of those rulings are deliberate, not gaps: every runner takes § 7's conservative
  END default until intake captures a second recent performance (so the 20 SPD plans stay
  unreachable, with the 5% Riegel margin banked for then), and any declared injury maps to H1 until
  § 15's six-field injury intake exists (so H2–H4 are implemented and tested but unreachable).
  **Free now requires a target race distance**; a race date stays optional on every tier.
- **The golden 5K path admits only the cadence it was authored for (2026-09-16, audit §1.3
  closed).** `buildTemplatePlan` routes a 12-week / 4-day / 5K race intake onto the coach-authored
  curve only on the 4-week recovery cadence or the 50+ ruling's 4/8/12; the under-50 advanced
  runner's 3-week cadence is served by `buildGenericWeek`, cadence intact, so its rest weeks are
  now 15–25% cuts instead of loading weeks flagged as rest (they had gone up 14–51%). Paid-tier
  skeleton only; Free and the example-plan fixture are untouched. Captain's `golden-cadence3-route`
  ruling — see "Decided (2026-09-16)"; pinned by `planTemplates.goldenDeload.test.ts`.
- **The first-plan path is sign-up → intake (unskippable) → Create plan → plan → Home
  (2026-09-20, `fm/v22-intake-flow-rework`, captain's phone-test rulings).** The intake is the
  only place a question is asked and the only place a plan is created. Home reads
  `GET /api/intake` on focus and pushes a runner with no intake on file to `/intake` (a failed
  fetch never redirects); the root layout's post-signup redirect is now a `push` too, so `(tabs)`
  stays underneath. A first entry has no Cancel, swipe-back off and `beforeRemove` refused until
  the plan exists; a re-entry from Home's "Create a new plan" has a Cancel back to Home. The form
  starts blank every time (`GET /api/intake` is read for a boolean only, never to prefill), asks
  the plan length itself while the race date is blank (`needsPlanLength`, live; default 12),
  requires a target race distance ("Choose your target race distance."; race date and goal time
  stay optional, labelled so), names the field on every validation error, and ends in one "Create
  plan" that runs `PUT /api/intake` then `POST /api/generate-plan` and replaces itself with
  `/plan/[id]` so the plan's back arrow lands on Home. `over_quota` → `/paywall` with the quota, a
  terminal `invalid_request` re-mints the idempotency key — exactly as Home used to. Home now
  shows the tier · quota header, the **subscription box first** (header mark, tier, plans used,
  "See plans →"), a CURRENT PLAN summary row for the newest plan (`N WEEKS · WEEK k`, opens it),
  the one "Create a new plan" CTA, and the My Plans row. Gone from Home: the "YOUR TARGET" card
  and "Change" link, the plan-length field, the Notes field and its Free-tier `LockedPanel`, the
  "ON PRO & ELITE" `PlanContentTeaser` (both components deleted), the goal-realism preview and
  every generate branch; gone from the intake: "Skip for now" / "Done" and prefilling. The
  per-plan Notes field was dropped, not moved (`notes` is sent empty; `injuryNotes` still reaches
  the model). Worker, contract and plan engines untouched. A no-race plan never ends on a deload;
  a past race date is still refused before anything is saved or charged (race day and a blank date
  remain valid); numeric inputs are structured (`src/components/inputs/` + `src/lib/fieldInput.ts`).
  Root gate green at 62 suites / 1017 tests. Detail: `change_log.md`, 2026-09-20.
- **Home and navigation follow the captain's 2026-09-12 audit, as re-cut on 2026-09-20 (bullet
  above).** Home's header shows tier and server-backed quota in place of the static product
  eyebrow. My Plans always has the Example Plan, never says the library is empty, and links MOST
  RECENT to the newest generated plan. The four tabs are icon-only but retain explicit
  screen-reader labels. Glossary definitions keep their existing `notation.ts` content behind
  independent, collapsed-by-default, accessible disclosure rows.
- **The design system was "Instrument" from 2026-09-03 to 2026-09-14 — superseded by Blueprint
  (first bullet above) for colour, type and the accent; its rules carry over.** The record below
  is kept as written on 2026-09-03/04, and the pulse trace it describes is now deleted.
  Trailhead *did* land on `main` (PR #82, plus the fidelity follow-up #83), so `main`'s
  `src/constants/theme.ts` is warm chalk and espresso ink with a scheme-aware ember accent, a
  route-line contour, and a dusk gradient on the signed-out screens. **Instrument replaced it on
  2026-09-03 and is unreleased**, on `fm/v22-redesign-theme-onboarding`: near-monochrome and
  cool-scientific — white and graphite in light mode, deep charcoal in dark — adopted as a house
  style shared with the sibling app V2.3. Its accent is two-tier and theme-invariant: a near-black
  slab (`Accent.field`) carrying one locked icy-cyan signal (`Accent.signal`) that is spent on
  exactly one call to action per screen and on the onboarding pulse trace, and **is never a fill**
  (it measures 1.27:1 against a white page, so a cyan button would have no visible edge — the
  primary action is a near-black slab with a cyan edge and label instead). The effort ramp was
  re-tuned cooler with real headroom (tightest 4.92:1, against *both* `surface.base` and
  `surface.raised`), and the floors are now **enforced by a test** that recomputes every ratio from
  `theme.ts`'s own hexes — the enforcement issue #70 was missing. The dusk gradient is retired; the
  bold moment is now the pulse trace, whose animation lives on a parallel branch and is not here
  yet. Onboarding is rebuilt as a scroll-down read, sign-in and sign-up carry the same field at
  `band` height and finally have a link back to onboarding, and one `ActionButton` module replaces
  eight hand-rolled button stylesheets. After the first persisted plan, Free-tier Notes stay
  locked in the UI, as under Trailhead — a display correction, not new enforcement, since Free is
  template-only and those notes were already discarded server-side. Before that first plan, the
  Notes and paid-content panels are hidden entirely. Source of truth for every value:
  [`docs/design/instrument-visual-system.md`](design/instrument-visual-system.md), which supersedes
  `frontend-design-brief.md` Parts 2 and 3 and replaces the deleted `trailhead-visual-system.md`.
  Full account: `change_log.md`, 2026-09-03 (later). **What has and has not been looked at:** the
  three signed-out screens (onboarding, sign-in, sign-up) were rendered and checked in both schemes
  against the Expo **web dev server** at 430x932 on 2026-09-03, which is the only screen-rendering
  verification this project has ever had; no screen has been run on a real iOS or Android device or
  simulator, and the signed-in screens have still never been seen at all. Note this is the dev
  server, not `npx expo export` — the static export does not inline the root `.env`, so that bundle
  throws `Missing EXPO_PUBLIC_API_BASE_URL` and never hydrates. The branch has now had a review
  pass, and its findings were fixed (`change_log.md`, 2026-09-04). **The captain's 2026-09-12
  first-time-user audit then found the signed-out journey too wordy.** Onboarding, the auth hand-off
  and the Intake start now use shorter copy while keeping the Instrument visuals, components,
  layout, animation behaviour and 01/02/03 structure unchanged. Pro/Elite pace wording now makes
  its real condition explicit: the runner must supply a recent time.
- **The pulse trace — retired 2026-09-14 (see the first bullet); the record below is historical.**
  Built 2026-09-04 on `fm/v22-redesign-animation-r2`: `src/components/brand/PulseTraceHero.tsx`,
  an ECG-style icy-cyan trace drawing itself across its own near-black field, self-drawing on mount
  or driven by a scroll `SharedValue` (through `usePulseTraceScroll`, which seeds from layout as
  well as scroll — a handler-only integration is blank on any page shorter than its viewport),
  reduced-motion aware, with its geometry pure and tested in `src/lib/pulseTrace.ts`. Its colours,
  timings and field heights live in `src/constants/pulseTrace.ts` rather than `theme.ts` because
  the two were written in parallel; the hexes agree with `Accent.field`/`Accent.signal`, and
  folding them into a re-export — which also closes the one-sided contrast pin — is the follow-up.
  The auth screens still render `PulseTraceSlot`'s static end state; swapping it is one import line
  (see that file's header). Seen rendered on web in both modes; the dev-only `/dev/pulse-trace`
  preview shows both drive modes. Guide for the worker who mounts it:
  `docs/design/pulse-trace.md` (deleted with the trace on 2026-09-14); full account: `change_log.md`,
  2026-09-04.
- **Test-mode override:** `ALL_USERS_UNLIMITED_ACCESS = "true"` still sits in the top-level
  `[vars]` of `workers/wrangler.toml` (the committed `[env.production.vars]` value is `"false"`),
  so the captain's test pass runs with every account Elite and the quota gate bypassed. Set the
  top-level value to `"false"` before real users arrive. Recorded in "Latest — 2026-08-09".
- **Test counts:** 1067 root tests across 66 suites and 195 `workers/` tests across 11 files on
  `fm/v22-delete-account-password`, verified by running both gates there on 2026-09-20 after the
  same-day review follow-up (which added `workers/test/attemptThrottle.test.ts`). Earlier
  figures, for the record: 1017 root tests across 62 suites on `fm/v22-intake-flow-rework`
  (verified by running the root gate there on 2026-09-20) and 174 `workers/` tests across 10 files
  on `fm/v22-password-recovery-94`, verified by running the Workers gate there the same day; 999
  root tests across 60 suites on `fm/v22-password-recovery-94`
  (2026-09-20); 899 root tests across 52 suites on `fm/v22-delete-account-web-noop-96` (after rebasing onto #116),
  verified by running the root gate there on 2026-09-16; 870
  root tests across 48 suites on `fm/v22-animations-lane3`, verified by running
  the root gate there on 2026-09-14; 785 root tests across 39 suites on `fm/v22-3day-peak-below-base`, verified by
  running `npm test` there on 2026-09-09 (778 across 38 suites on
  `fm/v22-distance-specific-plans`, 2026-09-07, after the rebase onto #88); separately, 832 root
  tests across 40 suites on `fm/v22-library-free-engine`, also verified by running `npm test` there
  on 2026-09-09 (778 across 38 on `fm/v22-distance-specific-plans` before the library landed); 511
  across 32 suites on
  `fm/v22-redesign-theme-onboarding` (2026-09-04); `main`'s figure is the 469 across 29 suites
  recorded in the 2026-09-01 and 2026-09-03 entries below. `workers/` was 141 tests across 7 files
  before #94's three new files (`npm --prefix workers test`, verified 2026-09-09). Typecheck clean on both sides and root lint clean (`workers/` has no lint script — its
  gate is typecheck + test). The dated entries below record each point in time's counts — this line
  is the current one.
- **Verified by hand on an iOS 26.5 simulator**, scoped to the 2026-08-15 check: Home in both the
  race and no-race states, and the keyboard each numeric field raises. Android is unverified — no
  Android SDK on this machine, so the `number-pad`/`decimal-pad` choice rests on the React Native
  contract for those two values.

---

**Last updated:** 2026-09-20 — delete account now re-confirms with the account's password before
deleting (`fm/v22-delete-account-password`, change-list item 10 — see "How it is now" and
`change_log.md`; implemented and tested, not yet deployed). The same day: the intake-flow rework
(`fm/v22-intake-flow-rework`: the intake is mandatory on first entry, starts blank, asks the plan
length, requires a target distance and creates the plan; Home only shows the subscription box, the
newest plan and "Create a new plan" — see "How it is now" and `change_log.md`); the v1 dummy
purchase was gated server-side to trusted testers on `fm/v22-test-purchase-gate`; and, earlier,
password recovery and email verification (issue #94) landed on `fm/v22-password-recovery-94`. The
bullets below are the #94 record.

- **The Worker can mail, but only once the captain says so.** `workers/src/lib/mail.ts` is a
  provider-agnostic `sendMail` with a `ResendAdapter` (used when `RESEND_API_KEY` and `MAIL_FROM`
  are both set; logs an HTTP status on failure, never a provider body) and a `ConsoleAdapter`
  (logs `mail_skipped_unconfigured` with the subject only — never the recipient, link or token).
  `workers/src/auth-email.ts` picks one per request and hands better-auth its reset and
  verification senders; `advanced.backgroundTasks` runs them through `ctx.waitUntil`.
- **Verification is opt-in twice over.** `emailVerification.sendOnSignUp` follows
  `mailConfigured`; `emailAndPassword.requireEmailVerification` follows
  `verificationRequired = mailConfigured && MAIL_VERIFICATION_REQUIRED === 'true'`, and that flag
  is `"false"` in both Wrangler environments. `sendOnSignIn` is deliberately off — the app cannot
  pass `callbackURL` on `sign-in/email` (on web the client's redirect plugin would navigate to it
  after success), so an auto-sent sign-in link would carry better-auth's default `/` callback, the
  Worker root, a JSON 404. The sign-in screen resends explicitly through
  `send-verification-email` with the app's own `/verify-email` callback instead.
- **One new public route.** `GET /api/email-status` → `{ mailConfigured, verificationRequired }`,
  booleans only, `cache-control: no-store`, no session — the forgot-password screen and the Home
  banner read it so they never promise a mail the Worker cannot send.
- **The client half is pure where it decides and thin where it renders.** `src/lib/authEmail.ts`
  (28 tests) builds the callbacks through `expo-linking`, resolves each landing screen's entry
  state from its `?token=` / `?error=` params, holds the password-match check (the 8-character
  minimum stays server-side, as on sign-up) and every copy string. `src/lib/apiClient.ts` adds
  `getEmailStatus()`, `resendVerificationEmail(email)` (the one caller of
  `send-verification-email`) and `useSessionUser()` — a typed door onto `user.email` /
  `user.emailVerified`, since the existing `expoClient` cast types `useSession().data` as `never`.
  New screens: `(auth)/forgot-password.tsx`, and `reset-password.tsx` / `verify-email.tsx` at the
  root, outside both `Stack.Protected` groups (`src/app/_layout.tsx`) because a deep link opens in
  either session state and guarding them would drop the token. `src/components/auth/VerifyEmailBanner.tsx`
  sits under Home's header, calm `FallbackNotice` treatment, `SecondaryAction` resend.
- **Tests never send mail, and the round trips are real.** `workers/vitest.config.ts` blanks both
  secrets regardless of `.dev.vars`. `workers/test/auth-email.test.ts` drives verify and reset end
  to end against D1 — the `302` to `paceblueprint://reset-password?token=…`, session revocation on
  reset, a generic `200` for an unknown address, an untrusted redirect refused `403`, log
  redaction, and the unverified sign-in refused *without* mailing while the explicit resend carries
  the app's callback. `mail.test.ts` covers both adapters, `email-status.test.ts` the route. Root
  gate: typecheck, lint (0 problems), 999 tests across 60 suites; Workers gate: 174 across 10 files.
- **What this does not prove.** No real mail has been sent (the domain, DNS and secrets are the
  captain's — `docs/email-setup.md`), and the built-app deep link has never been opened on a
  device. Every user-facing string in the flow is uncertified — see "Blocked".

Previous entry: 2026-09-12 — the captain's Home and navigation audit batch is implemented,
without new design assets and without touching the heartbeat/graph animations, onboarding or auth
screens.

- **Home leads with the task and the runner's current account state.** "Create plan" moved from
  below the rest of the form to immediately under the header. The header's static "Pace Blueprint"
  eyebrow is now the current tier plus `formatQuotaLine()`'s server-backed used/limit reading; the
  duplicate stat plate lower down was removed.
- **Subscription surfaces wait for real plan state.** The old gate was only "quota has loaded," so
  Notes and the paid-content teaser could appear before a runner had generated anything. Home now
  reads `GET /api/plans` on focus and hides every Notes/subscription panel until at least one plan
  is persisted. After that point paid tiers see editable Notes, while Free sees locked Notes and
  the Pro/Elite teaser. A transient list failure does not clear a previously confirmed plan state.
- **My Plans has no fictional empty state.** Its permanent Example Plan remains available even
  when `GET /api/plans` returns an empty list, so "Nothing here yet" was contradictory and is gone.
  When generated plans exist, MOST RECENT is a link to the actual newest id by `max(createdAt)`,
  independent of response ordering.
- **Navigation is visually compact and remains accessible.** The tab bar shows only the four
  existing icons and the active ink tick, with explicit Home / Glossary / My Plans / Settings
  labels retained for screen readers. Glossary rows now show only the abbreviation or term until
  their arrow is pressed; each full definition expands inline independently, with button role,
  expand/collapse hints and `accessibilityState.expanded`.
- **The state changes have tests that can go red.** The new Home suite proves disclosures are
  absent before a saved plan and appear after a refocus finds one; the My Plans suite proves the
  permanent example/no-empty-state contract and resolves the latest link from an unsorted list;
  the Glossary suite proves definitions are absent before expansion and that each disclosure
  toggles independently. Files: `src/app/(tabs)/__tests__/{home,my-plans,glossary}.test.tsx`.

Previous entry: 2026-09-09 (later) — the two-part fix behind GitHub issue #99 is complete:
Task 1 gave generic peak weeks an algebraic capacity floor, and Task 2 corrected
`longRunStartFloor` to read `retainedQuality`. The visual system was replaced
again on 2026-09-03 (later). **Instrument** — a
near-monochrome, cool-scientific house style shared with V2.3 ("Pace AnalysisAI") — supersedes
Trailhead, two days after Trailhead merged to `main`. Captain-approved and grilled in detail before
the work. On `fm/v22-redesign-theme-onboarding`, **not merged**; full account in
[`change_log.md`](change_log.md), 2026-09-03 (later), and every value in the new
[`docs/design/instrument-visual-system.md`](design/instrument-visual-system.md).

- **The accent is two-tier and theme-invariant, and the cyan is never a fill.** `Accent.field`
  (`#0A0E13`) is a near-black slab; `Accent.signal` (`#A8F0FF`) is the one bright highlight, locked,
  spent on exactly one call to action per screen and on the onboarding pulse trace. The cyan
  measures **1.27:1** against a white page, so a cyan button would have no visible boundary at all
  — the primary action is a near-black slab with a 1.5pt cyan edge and a cyan label, identical in
  both schemes, whose boundary comes from a different channel in each (**19.35:1** in light, the
  slab against the page; **14.74:1** in dark, the cyan edge, since the slab itself is **1.04:1**
  there on purpose). `Accent.field` is also `Colors.light.surface.inverse` and the pulse trace's own
  field, so every dark plane in the app is one plane.
- **The effort ramp was re-tuned cooler, with headroom, and the ratios are now enforced by test.**
  Steel blue / sea green / brass / rust / raspberry — hue identity and ordering held, only hue-angle
  and lightness moved. Tightest value is **4.92:1 against both `surface.base` and `surface.raised`**
  (Trailhead's light ramp sat at 4.02–4.50 against `base` with nothing checked against `raised`,
  which is what **issue #70** reported), and collision with the signal colour is measured as CIE76
  ΔE in Lab — floor 25, tightest 28.3 — because a contrast ratio is blind to hue and would pass an
  icy-cyan `recovery`. New `src/constants/__tests__/theme.contrast.test.ts` recomputes every ratio
  from `theme.ts`'s hexes and asserts it against that token's floor — the deliberately sub-floor
  values as upper bounds, plus a guard that no opaque token escapes the table. That is the
  enforcement issue #70 was missing. **Issue #70 is not claimed closed** — it has not been verified
  closed on GitHub.
- **Retired:** `DuskGradient`, `DuskHero`, `DuskSpark`, `Motion.duration.reveal`/`.ambient`,
  `RouteLine`'s dusk-only `hero` variant, and the scheme-keyed `Accent`; `accent.ember`/`onEmber`
  are now `accent.field`/`accent.signal`. Radii tightened again (control 10→8, card 16→14). `docs/design/trailhead-visual-system.md` is deleted,
  superseded by the Instrument doc.
- **Onboarding is rebuilt as a scroll-down flow** — pulse-trace cover, a "SCROLL" cue, three
  numbered hairline-separated beats (the intake / the plan / the price), then the single CTA with
  the sign-in skip as its peer. Not swipeable cards, and **the sections deliberately do not fade or
  rise on scroll**: a second motion moment competes with the signature one, and the scroll itself is
  already the mechanic. Sign-in and sign-up take the same treatment at `band` height and both gained
  a "Back to the start" link — there was previously no way back to the only pre-auth screen except
  the OS back gesture. The Paywall's RECOMMENDED badge went monochrome so the recommended tier's
  button stays the screen's only signal.
- **Two new components carry rules review used to carry.**
  `src/components/ui/ActionButton.tsx` collapses eight hand-rolled button stylesheets into one
  module, so "one accent per screen" is a question about imports. `src/components/onboarding/PulseTraceSlot.tsx`
  is a marked INTEGRATION POINT rendering the *static end state* of `<PulseTraceHero>`, the
  signature animation being built in parallel on `fm/v22-redesign-animation` — **that animation is
  not on this branch**, so nothing moves yet; the swap is one import line when it lands.
- 511 root tests across 32 suites pass, typecheck and lint clean (re-verified 2026-09-04, after the
  review fix round below). No `workers/` change. **The three signed-out screens have been seen
  rendered** — onboarding, sign-in and sign-up, in both schemes, on Expo web at 430x932 — but no
  screen has been run on a device or simulator, and the signed-in screens have still never been
  looked at. This branch has now had a review pass, and its findings were fixed (see
  `change_log.md`'s 2026-09-04 addendum).
- **2026-09-04 — review fix round, two behavior changes.** Onboarding's "Get started" now releases
  on a bounded 4s ceiling if `<PulseTraceHero>`'s `onSettled` never fires, so the only forward
  action out of the signed-out landing screen cannot hang forever on a component that lives on
  another branch; the captain's standing constraint that the hero settles *before* the CTA is
  interactive is unchanged — the ceiling only bounds the wait. And the four pre-auth links inside
  `(auth)` moved from `router.push` to `router.navigate`, so a sign-in ↔ sign-up ↔ onboarding round
  trip pops to the existing route instead of pushing a duplicate, scroll-reset copy of it.

Previous entry: 2026-09-03 — the captain reported sign-in/sign-up "not working at all" and
`expo start --tunnel` broken, blocking him from testing the app at all. Both diagnosed and fixed.

- **Root cause of the auth failure: a stale `.env.example`, not the backend.** The deployed Worker
  was and is healthy — direct probes against
  `https://pace-blueprint-production.i78979848.workers.dev` succeeded for `/api/auth/ok`,
  sign-up, and sign-in throughout. The client's `.env` had `EXPO_PUBLIC_API_BASE_URL` pointed at
  `http://localhost:8787`, and nothing was listening there (`wrangler dev` was not running) — the
  second recorded hit of this exact class of bug (the first is the 2026-08-07 entry below). That
  earlier fix corrected a developer's *local* `.env` and documented the trap, but never changed
  the committed **template** those `.env`s are copied from — `.env.example` still said the Worker
  was "not set yet" and defaulted to a loopback address. Fixed `.env.example` to default
  `EXPO_PUBLIC_API_BASE_URL` to the deployed Worker's `https://` URL for every device type
  (matching the 2026-08-07 ruling to deploy rather than use a LAN address), so a fresh `.env`
  copied from the template now works out of the box. No code changed — `src/lib/apiClient.ts` and
  the auth screens' error handling were already correct from the 2026-08-07 fix.
- **Verified live, end to end, through the real client.** Built the app for web
  (`expo start --web`) against the corrected `.env`, loaded it in a real browser, and drove the
  actual sign-up form via its real React state (not a bypass): a new account
  (`FM Test` / `fmtest+…@example.com`) was created through the real `authClient` call to the
  deployed Worker, and immediately signing in with those same credentials against the Worker
  succeeded (`200`, real session token, real `createdAt`). The compiled app bundle was also
  inspected directly and confirmed `EXPO_PUBLIC_API_BASE_URL` bakes in as the deployed Worker's
  URL, not the old loopback value. Device/simulator testing via Expo Go was attempted but blocked
  by an unrelated environment mismatch (this machine's Expo Go build is for SDK 57; the project is
  SDK 54) — not a defect in this fix.
- **The tunnel itself was not broken.** `expo start --tunnel` was run repeatedly and monitored for
  several minutes at a time: it connects on the first attempt and stays connected, with no
  disconnect/reconnect churn observed. A real device flow (iOS Simulator + Expo Go) fetched the
  bundler manifest through the live tunnel URL successfully — the connection carried real traffic
  correctly. **One contradictory observation, kept on the record:** an earlier diagnosis-only
  session on this branch (commit `77cd1c0`, whose `docs/wip-auth-tunnel-diagnosis.md` scratch file
  has since been deleted) did see the tunnel drop and reconnect during one run — `Tunnel connection
  has been closed…` followed by another `Tunnel connected.` This session's re-testing (multiple
  runs, several minutes each, plus the Simulator round trip above) did not reproduce that churn, and
  nothing in this repo changed between the two sessions that could explain the difference, so it
  is best read as occasional flakiness on Expo's shared tunnel backend rather than a repo defect.
  The working theory for the captain's "`--tunnel` is broken" report is the auth root cause above,
  not the tunnel: `expo start --tunnel` forwards Metro, never the Worker (documented in
  `AGENTS.md`'s guardrails), so even a perfectly working tunnel could not have let a phone sign in
  while `EXPO_PUBLIC_API_BASE_URL` pointed at a dead loopback address — indistinguishable from "the
  tunnel doesn't work" from the captain's seat. Now that the base URL is fixed, `--tunnel` should
  let a phone complete the same live auth flow just verified on web. Noted for the record: the
  tunnel runs on `@expo/ngrok`'s bundled legacy `ngrok-bin@2.3.42` binary against Expo's own shared
  `exp.direct` backend (a fixed authtoken baked into `@expo/cli`, not the captain's personal ngrok
  account) — an external dependency this repo does not control. If it becomes flaky in day-to-day
  use, the supported escape hatch is `EXPO_PACKAGER_PROXY_URL` pointed at a self-run tunnel (the
  captain already has a working, authenticated `ngrok` v3 install at `/opt/homebrew/bin/ngrok`) —
  not implemented since the shared tunnel tested stable.
- 469 root tests pass, typecheck and lint clean; no `workers/` change (nothing in `workers/` was
  touched — the defect was entirely in the client-side env template).

Previous entry: 2026-08-15 (later) — the captain phone-tested the core loop and called the
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

**Last updated:** 2026-08-15 — Google sign-up was audited end to end after a phone failure left
all live auth tables empty. The live Worker has all three required auth secret bindings and starts
a Google URL with the exact production callback; Google serves its real sign-in page. Email/password
was re-proved live (credential user/account/session created, then removed). The remaining interactive
Google consent/token-exchange proof needs the captain's Google account, so no Google D1 row is
claimed yet. Client OAuth is now explicit and observable: browser cancel/denial/callback errors are
shown, the session cookie is verified and the reactive session refreshed before reporting success,
and social sign-up uses the same post-signup redirect as email. Worker callback errors are logged
without secrets, fake OAuth test bindings are committed/pinned instead of inherited from `.dev.vars`,
and [`google-oauth-runbook.md`](google-oauth-runbook.md) gives the exact console settings, rotation,
and D1 proof steps. Captain-only checks: Google Auth Platform → Audience must be Production or list
his exact account as a test user; Credentials → the deployed client must be Web application with
`https://pace-blueprint-production.i78979848.workers.dev/api/auth/callback/google`; because secret
values cannot be read back, re-set `GOOGLE_CLIENT_SECRET --env production` from that same client if
there is any doubt after its rotation, then deploy `--env production`.

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
- [x] **Expo SDK 57 patch bumps — done 2026-09-16.** `npx expo install --fix` brought the 14
      Expo packages `expo-doctor` flagged on 2026-09-12 to their expected SDK 57 patches
      (`expo ~57.0.23`, `expo-router ~57.0.21`, …); `expo-doctor` 21/21, root gate clean
      (48 suites, 874 tests). `package.json` is the source of truth for versions. Detail:
      `docs/change_log.md`, 2026-09-16.
- [x] **Expo SDK 54 → 57 upgrade — done 2026-09-05.** Client-only (`workers/` untouched), one major
      version at a time (54→55→56→57) per this repo's upgrade etiquette. Now on `expo ^57.0.20`,
      `react-native 0.86.3`, `react 19.2.3`, `expo-router ~57.0.19`, `react-native-reanimated
      4.5.1`/`react-native-worklets 0.10.1` — `package.json` is the source of truth. SDK 56's
      expo-router fork away from `@react-navigation/*` was handled with Expo's own codemod, which
      also retired the V2.2-specific landmine of `@react-navigation/native` never being a declared
      dependency. `expo-doctor` 21/21; typecheck/lint/all 545 tests clean. Full account, including
      the non-obvious fixes (removed `regenerateDeclarations`, `absoluteFillObject` →
      `absoluteFill`, React Compiler-readiness lint false positives, `@better-auth/expo`'s web
      storage stub, the `typescript` pin defended via `expo.install.exclude`): `docs/change_log.md`,
      2026-09-05. **Verified beyond the suite:** launched in real Expo Go 57.0.9 (self-reporting
      SDK 57.0.0) on an iOS Simulator — reaches the signed-out landing screen with the pulse-trace
      hero rendering correctly, zero Metro errors. **Still not exercised:** the sign-in submission
      tap-through (no touch automation installed, and no `wrangler dev` running) — see "Known debt"
      below.
- [x] **Cloudflare account resources created.** `wrangler login`, `wrangler d1 create`,
      `wrangler deploy`, and the `BETTER_AUTH_SECRET` / Google OAuth `wrangler secret put`s have all
      run; `ANTHROPIC_API_KEY` has not. "Blocked / awaiting a decision" below is the row-by-row
      status.
- ~~Supabase project `v2.2_plan_generation`~~ — **superseded 2026-08-02.** The backend is Cloudflare
  now (`workers/`); the Supabase project is unused, and `supabase/` is dead scaffold kept for
  reference. Google OAuth and email/password were enabled on it and were not carried over:
  better-auth does email/password today, and Google runs on a fresh client id/secret from the
  captain — provisioned and verified in local dev 2026-08-05 (see that entry below).

### Code
- [x] **Intake-flow rework — the intake is mandatory, blank, and creates the plan (2026-09-20,
      `fm/v22-intake-flow-rework`).** Home (`src/app/(tabs)/index.tsx`) gates first entry on
      `GET /api/intake` and is reduced to the subscription box, the newest plan's summary row,
      "Create a new plan" and the My Plans row; `src/app/intake.tsx` starts blank, refuses to be
      left on a first entry until a plan exists, asks the plan length while the race date is
      blank, requires a target distance, and ends in "Create plan" (`putIntake` → `generatePlan`
      → replace to `/plan/[id]`), re-cut on `ScreenHeader` (new `action` slot) in five Blueprint
      sections. `src/components/home/` (`LockedPanel`, `PlanContentTeaser`) deleted;
      `planRequest.ts` loses `describePlanTarget` and Home's stale-date message; the root layout's
      post-signup redirect is a `push`. Tests: `home.test.tsx` rewritten, new
      `src/app/__tests__/intake-flow.test.tsx` (the eighth rendered-screen exception),
      `intake-guardian-consent`, `intake-exit`, `render` and `planRequest` suites updated. Worker
      untouched. Root gate: 62 suites / 1017 tests. Detail: `docs/change_log.md`, 2026-09-20.
- [x] **Five plan-engine rulings from the coach sign-off pack (2026-09-20,
      `fm/v22-engine-rulings-r2`; issues #103, #119, #106).** Free library: the peak phase is
      the plan's highest-volume block — `VOLUME_STATE_TARGETS.HOLD.target` at the top of § 5's
      band (1.0), `buildWeek` reconciled exactly to target, `derivePhases` labelling base / build /
      peak / taper from rendered volume (`src/lib/planLibrary/engine.ts`, `registry.ts`); new
      `engine.progression.test.ts` sweeps 17,600 Free race plans for 0 peak-below-build,
      0 peak-below-base, 0 backward phase steps, 0 band / share-cap / 180-minute breaches (was
      5,690 / 14,415 / 14,575 on the first three). Race day headlines the bare race distance on
      both tiers (`raceDayWorkout` no longer adds `RACE_DAY_PADDING_KM`; golden fixture race week
      28 → 23 km, `src/lib/fixtures/examplePlan.ts` updated). INJ-6's Day-7 pin is a cap
      (`min(source, LR-low)`), closing #119; `engine.recovery.test.ts` sweeps `lower_back` on all
      three invariants. #103's residual families: `LONG_RUN_SHARE_MARGIN.beginner` 1.1 → 1.2 and
      `GOLDEN_FIVE_K_MAX_WEEKLY_KM = 50` route ≥50 km off the golden path — the 22,000-plan mask is
      all-clear (348 → 0), disclosed build spikes 32 → 4, the 150 peak-only-rest plans pinned as a
      ceiling for the captain. #106's cut-once shape confirmed, no code. New
      `scripts/render-coach-pack.js` re-renders the pack offline. Coaching records:
      `plan-structure.md`, `injury-rules.md`, `load-rules.md`, `notation.md`,
      `example-plan-5k-pro.md`, `free-engine-open-questions.md`. Gates: 1,022 root / 181 Workers,
      green. Detail: `docs/change_log.md`, 2026-09-20.
- [x] **The v1 dummy purchase gated to trusted testers, server-side (2026-09-20,
      `fm/v22-test-purchase-gate`).** `workers/src/dummyPurchase.ts` (the sole authority, reading
      the two non-secret `wrangler.toml [vars]` `DUMMY_PURCHASE_ENABLED` / `DUMMY_PURCHASE_ALLOWLIST`
      typed on `env.ts`), `handlePurchaseTier` refusing `403 purchases_unavailable`, `quota-status`'s
      new `purchasesAvailable`, `src/lib/purchaseAvailability.ts` and the paywall's hidden
      buttons / "invited testers" notice. Worker tests for enabled, disabled-but-allowlisted,
      disabled-and-refused, no-substring-match and the `quota-status` flag; a jest suite for the
      client parsing. Runbook: `workers/README.md` → "The v1 dummy purchase gate". Detail:
      `docs/change_log.md`, 2026-09-20.
- [x] **Issue #94 — password recovery and email verification, built on both sides and off by
      default (2026-09-20; sending real mail awaits the captain's provider setup).** Worker:
      `workers/src/lib/mail.ts` (provider-agnostic `sendMail`, `ResendAdapter` / `ConsoleAdapter`),
      `workers/src/auth-email.ts` (`resolveAuthMailRuntime` → `{ sendMail, mailConfigured,
      verificationRequired }`, the two mail templates), better-auth in `workers/src/auth.ts` wired
      for `sendResetPassword`, `revokeSessionsOnPasswordReset`, `requireEmailVerification`
      (only when mail is configured *and* `MAIL_VERIFICATION_REQUIRED = "true"`), `sendOnSignUp`
      (only when mail is configured) and `sendOnSignIn: false` (deliberate — see the "Last
      updated" entry), a reset-token-redacting error logger, and the public
      `GET /api/email-status`. Client: `src/lib/authEmail.ts` (pure, 28 tests), `getEmailStatus` /
      `resendVerificationEmail` / `useSessionUser` in `apiClient.ts`, `(auth)/forgot-password.tsx`,
      root `reset-password.tsx` and `verify-email.tsx` outside both `Stack.Protected` groups,
      `components/auth/VerifyEmailBanner.tsx` on Home, and the sign-in / sign-up additions. Three
      new Worker test files (`mail`, `email-status`, `auth-email` — real D1 round trips, no mail
      ever sent). Runbook: `docs/email-setup.md`. Gates: 999 root / 174 Workers, green. Detail:
      `docs/change_log.md`, 2026-09-20.
- [x] **Issue #89's privacy policy, publication path and in-app link are implemented
      (2026-09-19; publication still awaits a successful deployment).**
      `docs/privacy-policy.md` is the policy's one source of truth; it identifies Ian Qiu, sole
      trader in Thailand, as controller, documents
      the already-shipped Settings → Danger zone → Delete account flow (PR #117), and states the
      13–17 parent/guardian-consent posture. As of this same date the consent-recording flow has
      also shipped (see the "Current state" bullet above): a required intake checkbox plus a
      server-recorded consent event, so the policy's text and the code now agree. It treats linked
      intake/plans as health/fitness data without claiming the injury picker itself records a
      GDPR Article 9 consent event, and states the actual overwrite/deletion boundaries and provider
      retention. `.github/workflows/publish-legal-pages.yml` runs only on `main` when the policy or
      workflow changes (or by manual dispatch), uses GitHub's official Jekyll action to render only
      the staged policy into an otherwise-empty Pages artifact, and targets
      `https://ianqiu979.github.io/Ai-Customized-Running-Plan-App/privacy-policy/`. Settings gained
      an accessible Legal link that navigates the same tab on web and uses an in-app browser with
      an OS-link fallback on native; every failure renders visibly;
      `legal.test.ts` pins the controller identity, age posture, workflow source/output path and app
      URL together. The target URL is **not yet claimed live**: a successful Pages run is still
      required.
- [x] **The published privacy policy renders in the app's own Blueprint theme, not the generic
      default Jekyll theme (2026-09-21, change-list item 11).** New `docs/privacy-policy-theme/`
      (a `default.html` Jekyll layout, `style.css` transcribing `theme.ts`'s Blueprint dark tokens,
      and self-hosted OFL Barlow Condensed / IBM Plex Sans webfonts under `fonts/`);
      `publish-legal-pages.yml` now stages that theme and renders `docs/privacy-policy.md` through
      it, with a new `docs/privacy-policy-theme/**` trigger path. Policy text is byte-identical, and
      the target URL and trigger conditions are unchanged. Verified with an actual local Jekyll
      build plus a rendered 390×844 screenshot; `legal.test.ts` extended to 7 tests for the new
      theme directory structure. Mirrors sibling repo running-form-v2.3's PR 239, same day, with
      V2.2's own theme rather than V2.3's palette. Detail: `change_log.md`, 2026-09-21.
- [x] **Issue #106 closed — a declared injury cuts a Free plan once, not every week
      (2026-09-19).** `src/lib/planLibrary/engine.ts` applied the § 17 module reduction to every
      week's target while later targets build on the previous (already cut) loading week, so a
      knee's 15% compounded to 29% of the healthy plan by week 12 and rest weeks fell to 68%. The
      cut now lands on the first loading week only (§ 17 "apply once", the paid skeleton's
      existing reading — the first non-`RECOVERY` week, so a `canonical + 1` plan's prepended rest
      week is untouched and week 2 takes the cut); rest weeks are back inside the 15–25% band and
      week 12 sits at 90% of healthy. New `engine.injury.test.ts` (issue intake, two named
      `canonical + 1` cases, and a register-wide sweep over all seven modules) and
      `engine.recovery.test.ts` extended from `H0` to `H0` + all `H1` modules. Progression mask
      untouched (758), no fixture changed. Surfaced #119 (`lower_back` Day-7 pin on rest weeks),
      left for the captain. Detail: `docs/change_log.md`, 2026-09-19.
- [x] **Audit §1.3 closed — the golden 5K path serves only the cadence it was authored for
      (2026-09-16, captain ruling `golden-cadence3-route`).** `FIVE_K_WEEKLY_LOAD` dips at weeks
      4 and 8, so `buildTemplatePlan` now admits a 12-week / 4-day / 5K race intake to
      `buildCanonicalFiveKWeek` only on the 4-week cadence or the 50+ 4/8/12; the under-50
      `competitive` runner goes to `buildGenericWeek`, keeping 3/6/9 (before: those flagged weeks
      were up 14–51%; after: cuts of 20/19/20% for the 60 km/week witness, peak 72 → 69 km). The
      50+ race week 12 stays flagged and is excluded from the band property. New
      `planTemplates.goldenDeload.test.ts` sweeps all eight golden-shape profiles; the progression
      mask was re-encoded once on the captain's authority, 770 → 758, with the two admitted
      offenders named. Detail: `docs/change_log.md`, 2026-09-16.
- [x] **Settings' "Delete account" confirms and deletes on web (2026-09-16, issue #96).** The
      row went through `Alert.alert`, which react-native-web implements as an empty method, so on
      web it produced no dialog, no deletion and no error. New `src/lib/confirmDestructive.ts`
      keeps the OS alert on native (unchanged: cancel + destructive "Delete") and asks the
      browser's own `window.confirm` on web; only an explicit confirm deletes, and a web runtime
      with no `confirm` throws instead of silently doing nothing. Pinned by
      `src/lib/__tests__/confirmDestructive.test.ts` (11 cases, both platforms via an injected
      runtime). Verified end to end on Expo web against a local `wrangler dev`: dismiss sends no
      request and the D1 row stays; accept sends `POST /api/delete-account` 200, signs out, and
      bounces to onboarding. A custom in-app sheet was considered and not built. Root gate (post-rebase onto #116): 52
      suites, 899 tests. Detail: `docs/change_log.md`, 2026-09-16.
- [x] **A font-load failure no longer strands the app on the splash screen (2026-09-16, issue
      #21).** `_layout.tsx` now reads `useFonts`'s error element and settles its readiness gate on
      a failed load as well as a successful one, so the splash is hidden and the app renders on
      system fonts instead of returning `null` forever. No user-visible signal by design; a
      `__DEV__` warning carries the error. Pinned by `src/app/__tests__/root-layout-font-gate.test.tsx`.
      Change log 2026-09-16.
- [x] **GitHub issue #25 closed (2026-09-16) — stale as filed; Home's "later build phases"
      placeholder and the demo link both left with PR #62.** The sample plan is My Plans' pinned
      `PlanListRow`, already a `link`. No source change; `home.test.tsx` gains three cases pinning
      that neither Home branch renders a placeholder capability claim and that every Home
      `Pressable` carries a role. Root gate: 51 suites, 888 tests. Detail: `docs/change_log.md`,
      2026-09-16.
- [x] **GitHub issue #24 closed (2026-09-16) — stale as filed; the Elite per-workout `why` is
      rendered and now proven.** `WorkoutRow` went with PR #111; the plan detail's day screen
      already renders `Workout.why` as its WHY section. No source change — the gap was that no
      fixture populated `Workout.why` (the example plan is Pro, and stays so), so the branch could
      never fail a test. New `src/app/plan/__tests__/day-why.test.tsx` (the fourth rendered-screen
      exception) derives an Elite week from `examplePlan` and pins the branch both ways. Root gate:
      49 suites, 879 tests. Detail: `docs/change_log.md`, 2026-09-16.
- [x] **Home and navigation layout audit batch (2026-09-12).** Home puts Create plan first, carries
      tier + server quota in its header, and reveals Notes/subscription panels only after
      `GET /api/plans` confirms a persisted generated plan. My Plans treats the permanent Example
      Plan as its baseline, has no empty-state copy, and links MOST RECENT to the newest generated
      plan. The four tabs are icon-only with explicit accessibility labels; Glossary definitions
      are collapsed by default and expand independently inline without changing their
      `notation.ts` content. Stateful renderer tests cover the persisted-plan transition, the
      example/latest-plan contracts and the disclosure transitions. No new design assets; no
      animation, onboarding or auth changes. Full account: `docs/change_log.md`, 2026-09-12
- [x] **Rest weeks are real, sane reductions on both engines (2026-09-12).** `loadRules.ts`
      owns `DELOAD_LONG_RUN_SHARE_MIN`/`_MAX` and `deloadLongRun`; `buildGenericWeek` sizes a rest
      week's long run from the last loading week's and bounds its easy runs by that long run;
      `planTemplates.deload.test.ts` and `planLibrary/__tests__/engine.recovery.test.ts` sweep
      every rest week on both engines against the same three invariants. Change log 2026-09-12.
- [x] **First-run copy reduced after the captain's 2026-09-12 audit.** The audit found that the
      onboarding journey overloaded a stranger with detail. Its cover and 01/02/03 beats now keep
      one headline and one support sentence each; the sign-up hand-off and Intake header are
      shorter. The price beat remains factual: Pro/Elite add paces only when the runner shares a
      recent time. Copy only — no font, colour, spacing, component, layout, animation or step-
      structure change.
- [x] **Free's plan engine is the 40-plan deterministic library (2026-09-09).**
      `src/lib/planLibrary/` — `registry.ts` (the 40 plan IDs, the workout vocabulary, the
      experience-dose ladder and operating limits, the weekly-volume state machine, the 3–7-day
      placement layouts, the long-run target ladder, the canonical durations 12/14/16/24, the
      recovery-cadence overlay), `calendars.ts` (the four canonical week-by-week calendars
      verbatim), `injury.ts` (the H0–H4 state machine, all seven injury modules, multiple-injury
      composition), `engine.ts` (`buildLibraryPlan`, the source document's resolution order plus its
      mandatory disclaimers) and `openQuestions.ts` (the six decisions the source does not make,
      isolated so nothing else guesses). 65 tests in
      `src/lib/planLibrary/__tests__/`. `workers/src/lib/planEngine.ts`'s
      `createTemplateSkeletonBuilder()` routes `tier === 'free'` to it; paid tiers keep
      `buildTemplatePlan` as the AI skeleton. A Free request naming no race distance at all — the
      one shape the register does not cover — is refused with `invalid_request`, quota released, per
      Ian's Q1 ruling of 2026-09-10; it is never defaulted onto a calendar or handed to the generic
      engine. Recovery-week depth stays at `loadRules.ts`'s 15–25%/target 20%. Full account in
      `docs/change_log.md`'s 2026-09-09 and 2026-09-10 entries
- [x] **The V22 build animations, the Blueprint theme, and the plan-detail rebuild (2026-09-14).**
      Six approved pages rebuilt natively in Reanimated (`src/components/build/`,
      `src/lib/buildMotion.ts`, `src/lib/weekStrip.ts`, `src/lib/planProgress.ts`), the theme
      replaced by the captain's `V22 theme.md`, the plan view rebuilt as overview → week → day, and
      the heartbeat/graph motif removed app-wide; visually matched against the pages on Expo web.
      Full account in `docs/change_log.md`'s 2026-09-14 entry
- [x] **The pulse trace animation was built (2026-09-04) — and retired 2026-09-14.** `src/components/brand/PulseTraceHero.tsx`
      (self-drawing or scroll-driven, reduced-motion aware, paints its own dark field), pure
      geometry in `src/lib/pulseTrace.ts` (23 tests), its own palette/timings in
      `src/constants/pulseTrace.ts` (not `theme.ts` — see "In flight"), 11 render smoke tests in
      `src/components/__tests__/pulseTraceHero.test.tsx`, and a dev-only preview at
      `src/app/dev/pulse-trace.tsx`. Built to be dropped into the rebuilt onboarding; mounts
      nowhere yet. Full account in `docs/change_log.md`'s 2026-09-04 entry
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
- [x] Expo SDK 54 scaffold — TypeScript strict, expo-router, `@/*` path alias (superseded by the
      SDK 54 → 57 upgrade, 2026-09-05 — see "Infrastructure" above)
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

**The V22 build animations and the Blueprint theme, on `fm/v22-animations-lane3` (2026-09-14).**
Built, gated and visually matched against the approved pages (see "Current state"); awaiting the
no-mistakes pipeline and a PR. What it does not do, on purpose: run on a device or simulator
(nothing in this project ever has), draw a segmented STRUCTURE bar on a session (the `Workout`
model carries `structure` as free text, so the page's segment bar has no data — a structured
segment model would be a plan-engine change, not a screen one), or mark days as done (the header
mark fills to *elapsed* days; a real day-marking flow is Ian's call). The Instrument redesign and
the pulse trace that preceded it are both landed-and-superseded history now, not open work.

Issue #89's implementation is complete; its remaining publication gate is a successful
`Publish legal pages` run after a qualifying push to `main`. Do not mark the target URL live before
that run succeeds. Issue #94 (password recovery + email verification) is likewise complete on
`fm/v22-password-recovery-94` and awaiting its PR; what remains on it is captain-only (the mail
provider, the verification flag, the copy certification — "Blocked"). Nothing else is in flight. The one remaining critical-path item — `ANTHROPIC_API_KEY`, without which
paid-tier requests serve the quota-exempt template fallback — is a captain-only action, not work
in progress; see "Current state" above and "Blocked" below. The 2026-07-11 coaching cycles 1 and 2 are
recorded under "Done" → "Domain" above, not here.

---

## Next — the critical path to a working MVP

Ordered so something is demoable as early as possible. Steps 1–4 produce a real plan on a real screen
with **no backend at all**.

1. [x] **`src/lib/planTypes.ts`** — **Done 2026-07-10.** Pure TypeScript, importable by the app and the
       edge functions. `pace` and `hrZone` are optional on `Workout`, so a Free plan — or any plan from
       a runner who gave no recent time — structurally *cannot* carry a measured numeral. The type
       system enforces the design's readout-bracket honesty rule.
2. [x] **`src/lib/loadRules.ts`** — **Done 2026-07-10; current deload policy updated
       2026-09-06.** Weekly volume cap, deload cadence and the current 15–25% band, distance-aware
       long-run share cap, long-run spike cap, Daniels time cap, HR zones.
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
         2026-07-12's ruling replaced it with real tests. This step and "Known debt" previously
         said this resync was still pending — it wasn't, by the time this pass read the actual
         files; see `docs/change_log.md`'s new correction bullet (the cycles themselves are
         recorded under "Done" → "Domain" above). What remains is writing
         `planTemplates.ts`/`paceDerivation.ts` themselves against these already-correct
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
       already worked. The production secret puts, `wrangler login`/`d1 create`/`deploy` have all
       since run (2026-08-09) — see "Current state" for the two unproven OAuth riders and the
       outstanding redeploy of the 2026-08-10 fix.
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
       "Current state" for what still blocks it from making a live call.
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
        the 2026-07-11 review-and-refine pass, docs and code both done, see "Done" → "Domain"). **The
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
| **`wrangler deploy --env production` for the dummy-purchase gate (2026-09-20, `fm/v22-test-purchase-gate`)** — until redeployed, the live Worker still serves the ungated `POST /api/purchase-tier` to any signed-in account, and its `quota-status` has no `purchasesAvailable` field (a client built from this branch renders that as unavailable, so the paywall's buttons stay hidden against the old Worker). Then, per tester: add the email to `DUMMY_PURCHASE_ALLOWLIST` in `[env.production.vars]` **only after that account exists** and redeploy — `workers/README.md` → "The v1 dummy purchase gate" | any Pro/Elite testing on production; closing the free-tier-upgrade hole for strangers | **Ian.** A committed `[vars]` edit plus deploy, never an agent (`AGENTS.md` → never run `wrangler deploy`) |
| **Mail provider for password reset and email verification (issue #94, 2026-09-20):** a Resend account and sending domain, its DNS records (DKIM, SPF/return-path, DMARC), and `wrangler secret put RESEND_API_KEY --env production` / `MAIL_FROM --env production`, then a redeploy — [`docs/email-setup.md`](email-setup.md) steps 1–5, `curl /api/email-status` is the proof | any real password-reset or verification mail. Until both secrets exist the Worker's `ConsoleAdapter` sends nothing, `GET /api/email-status` answers `mailConfigured: false`, forgot-password shows the honest "can't send email" message instead of a form, and the Home banner stays hidden | **Ian.** There is no Pace Blueprint domain yet, so this is also the domain decision; `MAIL_FROM` is the only place it appears in code. Nothing here can be done by an agent (`AGENTS.md` → never run `wrangler secret put`) |
| **Flip `MAIL_VERIFICATION_REQUIRED` to `"true"` in `[env.production.vars]` (issue #94, `docs/email-setup.md` step 6)** — a product decision, not a config chore. On: sign-up creates the account but no session and the app says "Check your inbox"; an unverified sign-in is refused `EMAIL_NOT_VERIFIED` with a resend offered. **Every existing password account has `emailVerified = 0` and would be gated at its next sign-in**; Google accounts are exempt (Google reports the address verified). The Worker honours the flag only when mail is also configured, so the order of this row and the one above cannot lock anyone out | whether an unverified address can sign in at all. Off, the feature is reset-only plus an optional Home banner | **Ian.** Warn testers before flipping, or leave it off until launch |
| **Copy certification for the whole auth-mail flow (issue #94).** None of these strings has been certified by the captain — flagged the same way as the 13–17 guardian-consent checkbox copy (2026-09-19). App copy, all in `src/lib/authEmail.ts` or the named screen's JSX: *authEmail.ts* — "Password reset isn't available yet — this server can't send email. Ask whoever runs it to reset your password." / "This reset link is invalid or has expired. Request a new one." / "This verification link is invalid or has expired." / "Passwords don't match." / "It expires in an hour."; *`(auth)/forgot-password`* — "Reset password", "Enter your email and we'll send a link.", "Send reset link", "Check your inbox", "If an account exists for {email}, a reset link is on its way. It expires in an hour.", "Back to Sign in"; *`reset-password`* — "New password", "Choose a new password for your account.", placeholders "At least 8 characters" / "Same again", "Set new password", "Password updated", "Sign in with your new password.", "Sign in", "Link expired", "Request a new link", "Back to Today"; *`verify-email`* — "Email verified", "You're all set.", "Sign in to continue.", "Continue", "Link expired", "Send a new link", "Sent. Check {email} for a new link.", "Sign in to request a new link", "Back to Today"; *`VerifyEmailBanner`* — "Verify your email", "We sent a link to {email}. Open it to confirm this address.", "Resend link", "Sent. Check {email} for the link."; *`sign-in`* — "Verify your email before signing in. Check your inbox for the link.", "Didn't get it? Resend the link", "Sent. Check {email} for the link.", "Forgot your password? Reset it"; *`sign-up`* — "Check your inbox", "We sent a verification link to {email}. Open it to finish creating your account, then sign in.", "Go to Sign in"; plus the generic failure fallbacks ("Could not send a reset link. Try again.", "Could not reset your password. Try again.", "Could not send the link. Try again."). Mail copy, in `workers/src/auth-email.ts`: subjects "Verify your Pace Blueprint email" / "Reset your Pace Blueprint password"; bodies "Verify email:" / "Reset password:" followed by the link, then "If you did not create this account, you can ignore this email." / "If you did not request this reset, you can ignore this email." | nothing functionally — the flow works with the copy as written. It blocks calling any of it final | **Ian.** Copy only; the code paths behind each string are tested and stay as they are |
| ~~**Beginner three-day 5K plans collapse to the tempo floor (issue #103 residual, 320 sweep plans).**~~ With one quality session at the 5K tempo's 8 km nominal (≈23% of the week), the beginner three-run share ceiling (`LONG_RUN_SHARE_MARGIN.beginner` 1.1 → 36.7%) and the no-easy-run-outgrows-the-long-run rule cap a week at ~86% of its target, so the growth base decays week on week to the tempo's 3 km floor: a 30 km/week beginner's 8-week 5K plan renders 25, 22, 17, 14*, 14, 11, **11**, 18. Options: raise the beginner share margin to ≥1.157 (1.2 gives 40% at 3 runs, 30% at 4 — a safety-ceiling loosening #103's own acceptance criteria reserve to the captain); give the generic 5K tempo the 10 km nominal the other distances use (a coaching dose); or accept and disclose | — | **Ruled 2026-09-20 (remedy A1):** `LONG_RUN_SHARE_MARGIN.beginner` is 1.2 — 40% at three runs, 30% at four, the flat 25% floor unchanged at ≥5. The family is gone from the sweep; `load-rules.md` carries the ruling |
| ~~**The golden 12-week/4-day 5K path at 50–110 km/week renders its peak under its base (issue #103 residual, 28 sweep plans).**~~ Authored at 35 km/week; scaled past ~50 km its two-easy-run base/build weeks and its one-easy-run, two-quality peak weeks both pin to the flat intermediate share cap, at 54 km and 48 km. Options: route declared volumes above the point where the caps bind off the golden path onto the generic curve (the same class of decision as `golden-cadence3-route`), or accept | — | **Ruled 2026-09-20 (remedy B1):** a declared `weeklyKm >= 50` (`GOLDEN_FIVE_K_MAX_WEEKLY_KM`) is served by `buildGenericWeek`; under 50 km the byte-pinned fixture is untouched. With A1, the 22,000-plan base-high mask is all-clear (348 → 0) |
| **150 paid plans whose "peak" phase is a single cadence rest week (issue #103 follow-up, named 2026-09-20).** 10- and 14-week 5Ks on every level and 8- and 10-week competitive halves: `allocatePhaseCounts` gives them a one-week peak and the deload cadence lands on it, so the plan has no loading peak at all. The fix that follows from the Free library's "peak is the highest block" ruling — shift the phase boundary a week earlier when the allocator's sole peak week is a cadence rest week — moves coaching content on this engine, because the phase label is an input that picks the peak interval session and the tempo's duration. Pinned as a ceiling (`PEAK_ONLY_REST_CEILING = 150`, shapes named in `planTemplates.progression.test.ts`) | a real peak block for those duration/cadence combinations on the paid skeleton | **Ian.** Whether the boundary shifts, and what sessions the shifted week carries, is a coaching call |
| Marathon's separate absolute single-run calibration for intermediate/advanced remains open. Since 2026-09-07 `maxSingleRunKm()` returns `Infinity` only for a `prepared` marathoner whose easy pace makes the 180-minute cap enforceable; everyone else (no recent time, advanced, first-timer) keeps the flat ≤25 / ≤35 km table, so the open question is now what number should replace the table for the prepared, pace-known case. The weekly-share number is settled at 35% and is not part of this blocker | the final marathon-specific absolute kilometre ceiling, and whether the unchanged 180-minute duration cap should remain the ultimate duration bound | **Ian.** `report-source.md` says the exact absolute policy is coaching judgment and notes McMillan sometimes permits up to four hours; this work settles the share at 35%, leaving only the absolute calibration and any future time-cap change open. The current 180-minute cap and 10% spike guard remain active. The fixed-position long-run-curve dips that used to land on loading weeks when resampled onto noncanonical durations are gone since 2026-09-19 — the generic path reads the curves with their loading block held at the running maximum (`holdRecoveryDips`), and rest weeks size their own long run from `deloadLongRun`. Valid deloads use the last loading week's denominator, so their displayed own-week ratio is not required to be ≤35%. |

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
Intake no longer claims that ambitious goals are adjusted. **Superseded 2026-09-20:** Home no longer
enters a goal, so the intake is the only pre-generation warning point (`getGoalRealismIntakeCopy`)
and the notice's future-tense `'preview'` variant is deleted; the plan-screen notice is unchanged.
See `docs/change_log.md`.

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

## Decided (2026-09-20) — five plan-engine rulings, coach sign-off pack round 2

Issues #103, #119 and #106, on `fm/v22-engine-rulings-r2`. The evidence was a coach sign-off pack
(four representative intakes × Free/paid, rendered on `main` that morning; `scripts/render-coach-pack.js`
reproduces it). Full account: `docs/change_log.md`'s 2026-09-20 entry; coaching records in
`plan-structure.md`, `injury-rules.md`, `load-rules.md` and `notation.md`.

| Item | Decision |
|---|---|
| The Free library's peak phase sat under a `build` week on every sampled plan | **The peak phase is the plan's highest-volume block, and phase labels follow volume.** `HOLD` holds the preceding loading week at the top of § 5's 95–100% band (1.0, not the 0.975 midpoint — no number outside the source's band), `buildWeek` reconciles the seven days to the target exactly, and `derivePhases` labels base (through the first rest week after a loading week) / peak (from the first loading week at the plan's highest loading volume to the taper, rest weeks included) / build (between) from the rendered volumes. A plan flat at its ceiling takes its final loading block as the peak; a 6- or 8-week completion plan with no loading block after base has no peak (1,355 of 17,600, a ceiling). New `engine.progression.test.ts`: 0 / 0 / 0 on peak-below-build, peak-below-base and backward phase steps, from 14,415 / 5,690 / 14,575. |
| Race day's headline distance, which differed by tier (paid 10 / 15 / 26 / 47 km, Free bare) | **The bare race distance on both tiers; warm-up and cool-down live in the `structure` string only.** `raceDayWorkout` drops `RACE_DAY_PADDING_KM` from `distanceKm`; the constant survives only to derive `RACE_WEEK_PRE_RACE_SHARE` (18/28). A paid race week no longer reads as a second peak; the golden fixture's race week is 23 km and Race Day is `notation.md`'s one exception to the headline convention. |
| #119 — INJ-6's "keep Day 7 at `LR-low`": cap or value | **A cap.** `min(ladder(source target), ladder('LR-low'))`, so a rest week's Day 7 takes `LR-recovery` and the cut lands on the long run first. `H2`/`H3`'s identical pin reads the same way. `engine.recovery.test.ts` sweeps `lower_back` on all three invariants. |
| #103's two residual families (320 beginner three-day 5K; 28 golden ≥50 km) | **Remedy A1: `LONG_RUN_SHARE_MARGIN.beginner` 1.1 → 1.2** (40% at three runs, 30% at four, flat 25% floor from five). **Remedy B1: a declared `weeklyKm >= 50` leaves the golden 12-week/4-day 5K path** (`GOLDEN_FIVE_K_MAX_WEEKLY_KM`). Sweep 348 → 0; the mask is tightened to all-clear on the captain's authority (a strict subset, so the "never add an offender" rule is intact); disclosed build spikes 32 → 4. **Named, not fixed:** the 150 plans whose one-week peak phase is a cadence rest week — the boundary shift the Free ruling implies moves coaching content on the paid engine, so it is his; pinned as a ceiling. |
| #106 — the shape of a declared injury's cut | **Confirmed: cut once on the first loading week, ramp back through the state machine.** No code change; recorded in `injury-rules.md` and `free-engine-open-questions.md`'s "Settled elsewhere". |

## Decided (2026-09-19) — three plan-engine rulings, `v22-plan-engine-captain-calls-r1`

Issues #76, #103 and #101, each re-verified against `main` before the change. Full account:
`docs/change_log.md`'s 2026-09-19 entry.

| Item | Decision |
|---|---|
| #76 — a paid plan with a race distance but no race date | **Keeps `raceDistance`, titled `"N-Week 10K Base Plan"`, mirroring the Free library.** `raceDate` is the only "a race is booked" signal; every reader audited, and the personalization prompt now says so explicitly. |
| #103 — which phase comparison is the product invariant | **The peak phase's highest loading week is never below the base phase's.** A peak under a mid-build loading spike is tolerated when disclosed with the standing one-sentence flag (`buildSpikeDisclosure`). Two mechanics fixes — taper-aligned curve sampling and held long-run curves — took the 22,000-plan sweep from 458 to 348 base-high offenders (old pre-peak metric 758 → 352), none entering; the mask in `planTemplates.progression.test.ts` now encodes the base-high invariant (348) and the tolerance property (32 disclosed spikes — those whose build spike is the plan's highest loading week — pinned as a ceiling). The 348 remaining are two families whose remedies are coaching/safety numbers — back to the captain; ruled the next day, see "Decided (2026-09-20)" above. |
| #101 — the 35–45% ruling annotations in the source ports | **One-line supersession note under each of the four annotations across the three files**, pointing at `load-rules.md` § Deload trigger and the `DELOAD_REDUCTION_MIN`/`_MAX` constants. Wording is the captain's to approve in the PR. |

## Decided (2026-09-16) — golden 5K path admission, `v22-core-purpose-audit-r1` §1.3

Closes the audit finding the 2026-09-06 §1.2/§1.4 task deliberately left open: on the golden
12-week / 4-day / 5K path, an under-50 advanced runner's flagged deload weeks (3/6/9, the pro
cadence) were loading weeks — `isDeload` came from the cadence, the volume from
`FIVE_K_WEEKLY_LOAD`'s array position, whose authored dips sit at weeks 4 and 8 only. Full
account: `docs/change_log.md`'s 2026-09-16 entry; coaching record:
`docs/reference/coaching/load-rules.md` § Deload trigger.

| Item | Decision |
|---|---|
| `golden-cadence3-route` — what to do with a recovery cadence the coach-authored curve was not written for | **Option A: the golden plan serves only a runner whose recovery cadence lands on its authored dips.** `FIVE_K_WEEKLY_LOAD`, `FIVE_K_LONG_RUNS` and the tempo/interval tables are one artefact for a runner who recovers on weeks 4 and 8, so `buildTemplatePlan` admits a 12-week / 4-day / 5K race intake to `buildCanonicalFiveKWeek` only on the 4-week cadence or the 50+ ruling's 4/8/12 (`FIVE_K_AUTHORED_DIP_CADENCE = 4`, one extra clause on `useGoldenFiveKShape`). The under-50 advanced runner is served by `buildGenericWeek` like every other intake off the path, 3-week cadence intact and rest weeks inside the 15–25% band. Rejected: authoring a week-3/6/9 recovery for the curve (option C — it needs tempo/interval doses the coach never wrote) and reversing the 2026-08-03 pro cadence (option B). No coaching content added. |
| Race week 12 for 50+, flagged `isDeload` by `fifty-plus-golden-deload-weeks` (2026-08-06) but carrying the 10 km race day | **Stays flagged; excluded from the reduction-band property rather than un-flagged.** Its volume includes race day, so it cannot satisfy a band; the UI keeps calling it a recovery week. |
| The 22,000-plan progression mask (`planTemplates.progression.test.ts`) | **Re-encoded exactly once, 770 → 758, on the captain's authority.** The reroute moved all 22 competitive / 4-day / 12-week / 5K matrix intakes onto the generic curve, removing 14 offenders and admitting two by name (`POST_BASELINE_NAMED_OFFENDERS`: competitive / 4 days / 40 km / 12 weeks, both recent-time variants — the generic path's #103-class shape). Any other addition is still a regression. |

## Decided (2026-09-10) — the Free library engine's six coaching questions, all answered

The six decisions `planning/research/plan-blueprint-examples.md` does not make, raised 2026-09-09
while porting the 40-plan library and answered the next day. Full write-up, with the question as it
was put alongside each ruling:
[`docs/reference/coaching/free-engine-open-questions.md`](reference/coaching/free-engine-open-questions.md).
Each ruling is one constant or function in `src/lib/planLibrary/openQuestions.ts`, keyed by the same
number, and that file remains the only place in `planLibrary/` allowed to hold a coaching value the
source document does not state.

| Question | Decision |
|---|---|
| **Q1** — what a Free user gets when intake names no target distance at all | **Require a target distance before generating on Free.** Not defaulted onto the 10K calendar, and not handed to `buildTemplatePlan` — that would put a Free user back on the paid tiers' skeleton and undo the 2026-09-06 tier split. The request is refused with `invalid_request` carrying `NO_RACE_DISTANCE_MESSAGE`, and the flow releases the quota reservation first, so it costs nothing — which matters, because Free's allowance is one plan for life. **Behaviour change:** the captain's 2026-08-15 "the race stage should be optional" report now governs the **paid tiers only**. A race *date* stays optional everywhere; it is the distance Free needs. Pinned by `workers/test/planEngine.test.ts`'s "no race named anywhere" suite, which now asserts both halves, and by a flow test proving no quota is charged. |
| **Q2** — what "materially stronger" means for § 7's SPD/END classification | **5% or more faster than the Riegel-predicted equivalent.** Banked as `SPD_MATERIALLY_STRONGER_PCT` for when intake takes a second recent performance; nothing consumes it yet and that is deliberate. Until then every runner takes § 7's own conservative default — the END lane with the first occurrence of each fast workout reduced one dose — so the 20 SPD plans stay unreachable from live intake. Expected, not a defect: the classifier needs an intake field, not a coaching ruling. |
| **Q3** — what numeric test counts as "already demonstrates the required base" when shortening | **`deriveReadinessPath`'s `prepared` verdict, approved as implemented, no new threshold.** A prepared runner loses the earliest removable loading weeks; a first-timer keeps preparation and loses the later ambitious weeks instead. Race week and the final taper survive every shortening. |
| **Q4** — targets inside the unnamed bands, what "eligible" means, and the six-day REG runner | **All three kept as implemented.** Band midpoints for `HOLD`/`TAPER-1`/`TAPER-2`/`RACE-WEEK` (arithmetic, not a new coaching number); a second hard session is **EXP/COMP only**, since REG's second is "only after demonstrated tolerance" and intake reports no tolerance signal; a REG runner requesting six days is clamped to five, the extra day becoming rest. |
| **Q5** — how to derive H0–H4 when `IntakeResponses` lacks § 15's six required fields | **Keep the H0/H1 default; § 15's six-field injury intake is NOT required before Free ships** — a separate future task. No declared injury → H0; any declared injury → H1, the mildest branch that still applies a module. H2–H4 stay implemented and tested but unreachable from live intake. `deriveInjuryState` is the single function the real intake replaces. |
| **Q6** — how the seven library codes with no `notation.md` label should render | **Approved as proposed, all ten mappings, including `MP` as *steady* and `RP10` as *interval*.** No new abbreviations — a notation entry is a notation ruling, not an engine decision. A test asserts no generated plan ever emits a label outside `notation.md`'s set. |

Two follow-ups fall out, neither needing a coaching ruling: intake could refuse a missing target
distance client-side before the server does (Q1), and § 15's six-field injury intake would make
H2–H4 reachable (Q5, explicitly deferred rather than dropped).

## Decided (2026-09-06) — distance-specific plans and the deload-band reversal

Closes the core-purpose audit's headline finding: every distance except the byte-pinned golden 5K
fixture read `FIVE_K_WEEKLY_LOAD`/`FIVE_K_LONG_RUNS`, scaled by the runner's own weekly km — a
marathon, half, or 10K plan was a 5K plan's curve wearing that distance's phase weights. Full
detail: `docs/change_log.md`'s 2026-09-06 entry.

| Item | Decision |
|---|---|
| No marathon/half/10K training content — every distance stretched the 5K curve | **Fixed.** New per-distance weekly-load/long-run curves (`TEN_K_*`, `HALF_*`, `MARATHON_*` in `planTemplates.ts`), shaped from the research's already-resolved architecture (canonical durations, recovery-week positions). Their raw targets climb from ~31% (5K) to ~50%+ (marathon) before safety clamps; generated intermediate/advanced marathon long runs are capped at 35%. Regression: `planTemplates.distanceSpecific.test.ts`. |
| Plan selection ignoring readiness (first-timer vs. prepared runner entering a race block) | **Fixed.** New `deriveReadinessPath()`, driven only by `weeklyKm`/`recentPerformance` — never `goalTimeSec` — shifts phase weighting toward more aerobic foundation for a runner who hasn't demonstrated a race block's prerequisites. Applies only to actual race entries, not no-race/duration plans. |
| Down-week reduction: McMillan's public 15–25% vs. V2.2's imported-examples 35–45% (flagged by `report-source.md`, escalated per this task's brief) | **Ian ruled, 2026-09-06, before being asked: use the published 15–25% figure, superseding the 35–45% ruling.** Recovery weeks are shallower across every generated plan now. See `docs/reference/coaching/load-rules.md` § Deload trigger for the full history and the confirmed interaction with the 2026-09-05 long-run-cap work (below) — the golden fixture's own weeks 4/8 long runs tightened from 8/10 km to 7/9 km as a direct, documented consequence, not a silent side effect. |
| Long-run ceilings (`loadRules.ts`'s `longRunShareCap`/`MAX_SINGLE_RUN_KM`) were level-based, not distance-based | **Fixed for weekly share; absolute calibration remains open.** Intermediate/advanced marathon race plans now use `MARATHON_LONG_RUN_SHARE_CAP = 0.35`; their separate absolute kilometre ceiling remains non-binding, while the 180-minute time cap and 10% spike guard remain active. Final 50 km/week, 16-week intermediate peaks at 3/4/5/6 days are 11/24/24/24 km. *Narrowed 2026-09-07: the ceiling is non-binding only for a prepared, pace-known runner — see "Decided (2026-09-07)".* |

## Decided (2026-09-06, later) — marathon long-run share made distance-aware; 35% final

The distance-aware plumbing was built on 2026-09-06; Ian then settled the share number at 35%
(`v22-distance-specific-plans`, `[key=marathon-longrun-share-cap]`). Full account:
`docs/change_log.md` and `docs/reference/coaching/load-rules.md`.

| Item | Decision |
|---|---|
| Raise the general intermediate/advanced long-run ceilings | **Rejected.** Would let a 5K runner take a marathon-sized long run — the correct value genuinely differs by goal distance. |
| Accept the current level-based ceiling as marathon's real limit | **Rejected.** 5-6 days/week is the most common marathon frequency, and that is exactly where the current ceiling is most wrong (8 km peak long run surveyed). |
| Add a distance-aware dimension to the ceilings | **Built.** `longRunShareCap()`/`maxSingleRunKm()` (`loadRules.ts`) both take `raceDistance`. Intermediate/advanced marathon race plans use a fixed 35% share cap; their absolute kilometre ceiling was `Infinity` unconditionally at this ruling (*narrowed 2026-09-07 to the prepared, pace-known case — see "Decided (2026-09-07)"*). `beginner` keeps its existing 14 km absolute ceiling and run-count-scaled share ladder — a deliberate, untouched safety floor for a first-timer's completion track. |
| Marathon weekly-share number | **Settled at 35%.** It is measured against the rendered loading week, or against the last loading week for a valid deload. The 50 km/week, 16-week intermediate survey peaks at 11/24/24/24 km for 3/4/5/6 days. The four-day plan is the headline genuine progression at 24 km, versus the old stretched-5K 19 km and audit observation of roughly 21 km. |
| Three-day marathon fixed point | **Disclosed, not hidden.** The sourced E + Q1 + LR layout and fixed Q1 dose leave an 11 km peak under 35%; generated plans state the limitation and recommend a fourth running day. At 3–4 days Q1 is retained and Q2 is dropped before easy support; 5+ days may retain Q2. |
| Separate absolute kilometre calibration | **Still held for Ian.** At this ruling `maxSingleRunKm()` was non-binding for every intermediate/advanced marathon race plan; *since 2026-09-07 it is non-binding only for a prepared runner with a pace* (see "Decided (2026-09-07)"). The existing 180-minute duration cap and 10% spike guard remain active; neither is weakened by the 35% ruling. |
| Noncanonical deload alignment | **Still unresolved.** Fixed long-run-curve dips do not realign to `deloadEveryWeeks` when resampled. The 35% cap limits magnitude, not that structural mismatch; valid deloads use the last loading week's denominator, so their displayed own-week ratio can exceed 35% without a breach. |

## Decided (2026-09-07) — the no-recent-time marathoner is bounded; readiness surfaced

The branch's ship gate, named by the captain: an advanced marathoner with no recent race time must
receive a bounded long run with the 35% cap actually binding. Commit `bd2b0b6` on
`fm/v22-distance-specific-plans`, rebased onto #88. Full account: `docs/change_log.md`'s
2026-09-07 (later) entry; enforcement detail in `docs/reference/coaching/load-rules.md` § "Long-run
cap, by level".

| Item | Decision |
|---|---|
| Marathon absolute-ceiling bypass applied to runners it could not protect | **Fixed.** The bypass was justified by "the 180-minute time cap and spike guard govern instead", which is false for a runner with no pace (no recent time; or advanced, for whom no easy pace is derived). `maxSingleRunKm(level, raceDistance, { readiness, easyPaceSecPerKm })` now returns `Infinity` only for a `prepared` runner whose easy pace makes the time cap computable; everyone else keeps `MAX_SINGLE_RUN_KM` (≤14 / ≤25 / ≤35 km, the blueprint's § 4 limits). A 110 km/week advanced marathoner with no recent time renders 35 km, not 38 km. An advanced marathoner's absolute ceiling is therefore always 35 km; the intermediate bypass can only matter through the time cap (35% of the 70 km intermediate weekly ceiling is under 25 km). |
| The 35% share cap | **Unchanged**, and proven to bind on the gate profile (`planTemplates.noRecentTime.test.ts`): advanced, marathon, 60 km/week, 5 days, 16 weeks — every long run ≤35% of its share denominator, loading weeks on `floor(0.35 × volume)`, peak 31 km in a 91 km week; with the share cap mocked away the same plan breaches 35%. |
| Separate absolute kilometre calibration | **Still held for Ian** — narrowed, not settled. What remains open is the number for the prepared, pace-known case; see "Blocked". |
| Readiness path visible to the runner | **Built.** `Plan.readinessPath` on race plans; a first-timer plan carries a disclosure naming the capacity check that sent it there (volume below `READINESS_WEEKLY_KM_THRESHOLD`, or no 10K-or-longer result for marathon) and, on a runway under `FIRST_TIMER_MIN_WEEKS` (12/12/16/16), a limited-preparation disclosure per the research's § 8 rules 3–4. Prepared runners get neither. Not coaching content: the numbers are the engine's own thresholds and the intake. |
| Three-day intermediate/advanced marathon plateau | **Known, unchanged** — disclosed by `THREE_DAY_MARATHON_DISCLAIMER`; see "Known debt". |

## Decided (2026-09-06) — long-run cap and race-week fixes, `v22-core-purpose-audit-r1` §1.2/§1.4

Closes the two core-purpose-audit findings that were pure rule-enforcement bugs, not coaching
content (`/Users/Guestyyyyyyyy/firstmate/data/v22-core-purpose-audit-r1/report.md`). The audit's
other findings (§1.1, §1.3, §1.5–§1.9 — per-distance training content, deload session shape) are
**not** touched by this work; they stay open, captain-content-blocked. *§1.3 was closed on
2026-09-16 — see "Decided (2026-09-16)" above.*

| Item | Decision |
|---|---|
| §1.2 — `clampLongRun()` unenforced on `buildGenericWeek` | **Fixed**: both generic and golden paths call `clampLongRun()`. Generic plans use the run-count-scaled share cap and rounded-up whole-kilometre spike ceiling; the coach-authored golden path retains the flat share table and raw spike ceiling. Generic easy runs track the final clamped LR, while quality/tempo sessions remain outside that easy-run ceiling and may be longer. The generated-plan regression suite also exercises the three-hour cap with a pace-known marathon. |
| Long-run share cap, low run counts (issue `longrun-share-cap-floor`) | **The cap always wins, and it now scales by weekly run count** (`loadRules.ts`'s `longRunShareCap`), not a flat per-level number. A flat cap is arithmetically impossible below a run-count-dependent threshold (an n-run week's largest entry is never under `1/n`) — exactly why the audit's beginner and 3-day profiles breached on every loading week. The three flat numbers in the table above (25%/32%/35%) remain the reference value at the golden fixture's 4-run week and the byte-pinned canonical 5K path's own cap, unscaled on purpose; every other path scales from there. Consequence: the long run is no longer guaranteed to be "the week's longest run" — `notation.md`'s LR row and `planTemplates.ts`'s `LONG_DESCRIPTION` no longer claim it. Full ruling and the before/after numbers: `docs/reference/coaching/load-rules.md`'s 2026-09-05 entry. |
| §1.4 — race week assembled from the race-day budget | **Fixed, including the low-volume follow-up**: pre-race days are sized off a share of the taper-curve target, bounded by the peak week's room above race day. If that budget cannot fund every requested day at 2 km, surplus workouts become rest rather than 1 km filler. Survivors are right-aligned into the latest pre-race slots so SR stays nearest race day; the 12 km/week, 6-day 5K case produces a 3 km and a 2 km run plus four rest days, on a 5 km budget (15 km peak week − 10 km race day), not five filler runs. Regression: `planTemplates.genericLongRun.test.ts` and `planTemplates.distanceSpecific.test.ts`. |

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
- 🟢 **Addressed in code, not verified closed on GitHub: the effort hexes' contrast headroom —
  [issue #70](https://github.com/IanQiu979/WorkoutGenerationv2.2/issues/70).** The hexes it reported
  (light values barely above 3:1 at full opacity; dark `interval` `#C6402F` on `#14171C`) no longer
  exist: the ramp was re-picked under Trailhead and re-tuned again under Instrument on 2026-09-03,
  where every value sits at **4.92:1 or better against both `surface.base` and `surface.raised`** —
  the headroom the issue asked for, and now measured against `raised` as well, which neither
  earlier system ever checked even though the tab bar and every card sit on it. The rule is also
  enforced rather than restated: `src/constants/__tests__/theme.contrast.test.ts` recomputes every
  ratio from `theme.ts`'s hexes and holds it to a floor. **Two caveats:** that
  work is on `fm/v22-redesign-theme-onboarding`, unmerged, and nobody has confirmed the GitHub issue
  is closed. **Not open for the signed-out hero:** the captain ruled 2026-08-08 that its shimmer is
  dark-mode-only and final, with the contrast floor untouched; that hero has since been replaced
  twice over regardless.
- ✅ **Onboarding still replays on every signed-out session, not just first install — deliberately —
  and now persists a "has seen onboarding" flag for a narrower purpose (captain's 2026-09-20
  ruling).** `(auth)/index.tsx` is still the anchor for every signed-out session, and a returning
  user who signed out still sees the hero again; the sign-in link on that screen remains the skip.
  What changed: `lib/onboardingVisit.ts` (AsyncStorage) now records whether onboarding has ever
  rendered on the device, and the screen reads it (`useFirstOnboardingVisit`) to decide whether
  scrolling is locked to one animation at a time. First-ever launch locks the `ScrollView` to
  whichever section is currently animating (the hero, then each step in turn) until that
  section's own build clock settles; every later visit, and any first visit under reduced motion,
  scrolls freely exactly as before. The flag never skips onboarding itself, only the lock.

### Standing

- 🟡 **A cross-origin web page does not keep the better-auth session cookie (observed
  2026-09-16 while verifying issue #96, pre-existing, not changed).** Expo web on
  `localhost:8081` talking to the deployed `workers.dev` origin does not retain the session cookie
  in the browser: `workers/src/auth.ts` deliberately sets no cross-domain cookie attributes
  (`SameSite` defaults to Lax), and `apiClient.ts` on web relies on the browser cookie rather than
  the bearer token. Same-site `localhost:8081` → `localhost:8787` (`wrangler dev`) works, which is
  why the delete-account verification ran against a local Worker. Whether a browser client should
  ever reach the deployed Worker cross-origin is an open question, not a bug fixed here.
- 🟡 **Three-day intermediate/advanced marathon plans plateau (confirmed 2026-09-07, unchanged by
  the rebase onto #88).** A 50 km/week, 16-week, 3-day intermediate marathon renders 32 km every
  loading week (26 km on deloads) and an 11 km long run in every week of the plan: the sourced
  E + Q1 + LR layout and fixed Q1 dose leave the 35% share cap nothing to grow into. The plan
  discloses it (`THREE_DAY_MARATHON_DISCLAIMER`, captain-ruled 2026-09-06) and recommends a fourth
  running day; it is not hidden, but it is not a progression either. Any fix is coaching content
  (a different three-day layout or Q1 dose), so it waits on Ian.
- 🟢 **Resolved 2026-09-09: the retained-quality floor correction landed — GitHub issue #99
  (filed 2026-09-08), Task 2 of two.** `buildGenericWeek`'s `longRunStartFloor` now derives from
  `retainedQuality` rather than the full `quality` array, so at three and four running days the
  long-run candidate is no longer floored on a Q2 interval session the week does not schedule. It
  could only land after Task 1: the inflated floor was masking the peak-progression undershoot that
  Task 1's `peakCapacityLongRunKm` now covers. Measured on the 22,000-plan sweep, 348 plans move
  and long runs drop 1 km where the unscheduled Q2 had been setting the floor; the 24-week witness
  (peak weeks 17–19 at 23/24/24 km with 9/9/9 km long runs) is unchanged, and the exact-membership
  mask gate passes, so no plan entered the offender set. Nobody has confirmed the GitHub issue is
  closed.
- 🟢 **Resolved 2026-09-20: `lower_back` (INJ-6) rest weeks now shorten Day 7 — GitHub issue
  #119.** The captain ruled "keep Day 7 at `LR-low`" a cap, not a value, so `engine.ts` takes
  `min(ladder(source target), ladder('LR-low'))` and a rest week's Day 7 takes `LR-recovery`
  beneath it (the issue's witness week 4: `2.7 2.7 4.5L` → `3.4 3.5 2.9L`, total still 80%).
  `engine.recovery.test.ts` sweeps `lower_back` on all three invariants; `TOTAL_BAND_ONLY` is
  gone. Nobody has confirmed the GitHub issue is closed.
- 🟢 **Resolved 2026-09-20: the 22,000-plan base-high sweep is at 0 — GitHub issue #103's two
  named families ruled.** History of the counts: 954 broad / 470 literal before #99's Task 1,
  770 / 470 after it, 758 broad after the 2026-09-16 golden reroute; the 2026-09-19 ruling made
  peak-high ≥ **base**-high the invariant (458 that morning, 348 after the two mechanics fixes);
  on 2026-09-20 remedy A1 (`LONG_RUN_SHARE_MARGIN.beginner` 1.2) removed the 320 beginner
  three-day 5K plans and remedy B1 (`GOLDEN_FIVE_K_MAX_WEEKLY_KM = 50`) the 28 golden-path plans.
  The exact-membership mask is all-clear (`BASE_HIGH_BASELINE_OFFENDER_COUNT = 0`,
  `REMAINING_OFFENDER_FAMILIES = []`), so **any** base-high offender now fails by name; disclosed
  build spikes 32 → 4, pinned as a ceiling.
- 🟡 **150 paid plans have a one-week "peak" phase that is a cadence rest week — issue #103
  follow-up, named 2026-09-20, awaiting the captain.** 10- and 14-week 5Ks on every level, 8- and
  10-week competitive halves: `allocatePhaseCounts` gives a single peak week and the deload
  cadence lands on it, so there is no loading peak (outside both base-high metrics, which need
  one). On the paid engine the phase label chooses sessions, so shifting the boundary a week
  earlier — the fix the Free library's ruling implies — moves coaching content; pinned as a
  ceiling (`PEAK_ONLY_REST_CEILING = 150`, shapes named in `planTemplates.progression.test.ts`)
  so the class cannot grow unnoticed. See "Blocked".
- 🟡 **The client's and the Worker's `better-auth` versions must match, and only the lockfile
  holds them together (2026-09-05).** They are two separate npm projects sharing one wire format
  (cookie envelope, `/sign-in/social` state, session payload). During the
  SDK 54 → 57 upgrade the app's lockfile regen floated to 1.7.2 while `workers/` stayed at 1.6.25 —
  a skew nothing in that run exercised, since no real sign-in was performed. Resolved by pinning
  the app to exact `1.6.25` on both packages (no caret — the caret is what let it drift, and a
  from-scratch install re-floats to 1.7.2 with it in place) plus
  `"overrides": {"@better-auth/core": "1.6.25"}`, which is needed because `@better-auth/expo`
  declares core as a peer at `^1.6.25` and npm otherwise hoists the newest match. Residual risk:
  `workers/` still declares its own `^1.6.25`, so the server side can still float independently,
  and no test asserts the two agree.
  Moving the server forward is a separate change with its own review chain, and should be paired
  with an end-to-end sign-in check.
- 🟡 **The SDK 54 → 57 upgrade launches and renders in real Expo Go 57; the sign-in
  tap-through is the part still unproven (2026-09-05).** That upgrade carried
  `react-native-reanimated`/`react-native-worklets` across three SDK majors (4.1→4.5 / 0.5→0.10).
  `expo-doctor`, typecheck, lint, and all 545 Jest tests are clean, but this repo's own testing
  notes already record that Reanimated animations don't advance under Jest, so the suite proves
  nothing about motion. That gap was closed by hand: Expo Go **57.0.9** was installed fresh on an
  iOS Simulator (via Expo's versions API plus the matching GitHub release asset) and Metro run
  against the upgrade worktree. Screenshot-confirmed — Expo Go self-reports "SDK version: 57.0.0",
  the app reaches the genuine signed-out landing screen ("Your training plan, built around you."),
  and the pulse-trace hero (`PulseTraceHero.tsx`) renders correctly, across multiple bundle/reload
  cycles with zero errors in the Metro log. A true cold start first required
  `xcrun simctl keychain reset` — a real signed-in session from unrelated prior testing was still
  in the simulator's Keychain, and `expo-secure-store` is Keychain-backed, so it survives an app
  uninstall/reinstall. **What remains unverified is narrower than "nobody has launched it", and
  should not be overstated in either direction: the sign-in submission tap-through was never
  performed.** Neither blocker is about the SDK — no touch-input automation (`idb` or equivalent)
  is installed here to tap through the native Expo Go dev-menu overlay sitting over the CTA, and
  `wrangler dev` wasn't running, so a real sign-in would have failed on network grounds regardless.
  Full account: `docs/change_log.md`, 2026-09-05.
- 🟡 **`EXPO_PUBLIC_API_BASE_URL` has drifted to a dead loopback address twice on record** (2026-08-07,
  and again by 2026-09-03) despite the earlier fix, because that fix corrected a developer's
  local, gitignored `.env` but not the committed `.env.example` template fresh `.env`s are copied
  from — the template itself defaulted to a loopback address / said "not deployed yet" long after
  the Worker was live. Fixed 2026-09-03: `.env.example` now defaults to the deployed Worker's
  `https://` URL. Residual risk: nothing enforces this stays correct if the Worker's URL ever
  changes (a new deploy target, a custom domain) — there is no test asserting `.env.example`'s
  value resolves to a live origin.
- 🟡 **Occasional `expo start --tunnel` churn on Expo's shared ngrok backend is an unquantified
  residual risk.** Seen once (commit `77cd1c0`'s diagnosis session: drop + reconnect mid-run), not
  reproduced across this session's longer runs. Outside this repo's control; if it recurs, the
  fallback is `EXPO_PACKAGER_PROXY_URL` pointed at a self-run `ngrok` v3 tunnel.
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
- 🟢 **Resolved: the Cloudflare account resources exist.** `wrangler login`, `wrangler d1 create`
  (the real `database_id` is committed), `wrangler deploy --env production`, and the
  `BETTER_AUTH_SECRET` / Google OAuth `wrangler secret put`s have all run, so a phone can now reach
  `https://pace-blueprint-production.i78979848.workers.dev`. The only captain-only command never
  run is `wrangler secret put ANTHROPIC_API_KEY` (the 🔴 item above); one *re*-deploy is still
  outstanding for the 2026-08-10 `INVALID_ORIGIN` fix — see "Blocked" above.
  Local work never depended on any of it — `wrangler dev` and the test suite need no account. Full
  row-by-row status in "Blocked" above.
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
- 🟠 **The password-reset and verify-email deep links have never been opened in a built app
  (issue #94, 2026-09-20).** Same class as the row above, now with two more landing routes:
  `paceblueprint://reset-password?token=…` and `paceblueprint://verify-email` are pinned as the
  Worker's `302` targets in `workers/test/auth-email.test.ts`, and Expo Router maps them to
  `src/app/reset-password.tsx` / `verify-email.tsx` (outside the session guard) — but no mail
  client has ever handed one to a device, and no real mail has been sent at all (the provider is
  captain-only, "Blocked"). Expo Go and web use `exp://` / `http://localhost:8081` callbacks
  instead (`docs/email-setup.md` → "The deep links"); the first proof needs the Android dev-client
  build, a configured provider, and a human tapping the link.
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
- 🟡 **EAS: Android done, iOS blocked.** The EAS project exists (`ianbeatingpros/pace-blueprint`,
  `eas init` run 2026-09-19) and the first Android dev-client .apk is built — `docs/build.md`. No
  TestFlight pipeline exists and cannot until the captain buys the Apple Developer Program
  (`docs/apple-dev-blocked.md`). Google sign-in on the Android build needs no Android OAuth client
  or keystore SHA-1 — it is the Worker's web-client OAuth proxy plus the `paceblueprint://` deep
  link — only a check that the Worker redirect / trusted-origin config covers the dev build's
  return path (`docs/build.md`, `docs/google-oauth-runbook.md`).
- 🟡 **App art is still stock Expo — unblocked by the name decision, not yet done.** The icon,
  wordmark, splash artwork, and store listing copy are all still placeholders; needed at M6, not
  before. The stock Expo *colours* around that art are gone as of 2026-09-16 (issues #20/#49):
  `app.json`'s splash `backgroundColor` (both variants) and the Android
  `adaptiveIcon.backgroundColor` are the Blueprint field `#0B0E12` — the latter effective only
  because the template-blue `adaptiveIcon.backgroundImage` was dropped (prebuild prefers the image
  over the colour) — and `src/constants/__tests__/app-config-colors.test.ts` pins each field to
  `Colors.dark.surface.base`, so a future palette change fails the suite rather than silently
  missing the one file the theme cannot reach. The foreground/monochrome icon layers, iOS icon
  and splash artwork remain stock until M6.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
- 🟠 **Google OAuth client secret should be rotated before shipping (found 2026-08-05).** The
  captain pasted the real `GOOGLE_CLIENT_SECRET` in plaintext into a chat pane twice while
  provisioning it — it is now in `workers/.dev.vars` (gitignored, never committed or logged), but
  the plaintext exposure itself means it should be treated as compromised. Recommend rotating it
  in Google Cloud Console once the credentials are confirmed stable; that rotation is the
  captain's call, not done as part of this change.
