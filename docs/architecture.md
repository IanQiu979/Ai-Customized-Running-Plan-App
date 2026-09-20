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
    _layout.tsx          # root layout — loads the three font families (a failed load boots on
                          #                system fonts, issue #21); ThemeProvider is fed
                          #                constants/navigation-theme.ts's tokened Theme, and
                          #                gates the whole Stack behind Stack.Protected on
                          #                authClient.useSession() (no anonymous browsing) —
                          #                except reset-password and verify-email, registered
                          #                outside both guards (issue #94, see below)
    (auth)/
      _layout.tsx          # stack layout for the signed-out route group
      index.tsx             # redirect anchor -> onboarding (2026-08-08; was sign-up). Note this is
                            #   the anchor for EVERY signed-out session, not just first install
      onboarding.tsx        # 2026-08-08 — the signed-out landing screen. Rebuilt 2026-09-14 on the
                            #   approved V22-01/V22-02 pages: a full-viewport build hero
                            #   (components/build/OnboardingHero — "the plan builds itself"), then a
                            #   scroll-down read of three numbered steps, each with a ≤1.5 s piece
                            #   (components/build/steps) that plays once when it scrolls into view,
                            #   then the primary action drawing itself in (RevealPrimaryAction; the
                            #   stick-runner figure above it was deleted 2026-09-20). No form; the
                            #   CTA is disabled until the hero settles, bounded by a 4s ceiling so a
                            #   clock that never completes cannot strand the only forward action.
                            #   2026-09-20: the very first time the screen ever renders on a device
                            #   (lib/onboardingVisit.ts + hooks/use-first-onboarding-visit.ts,
                            #   AsyncStorage), the ScrollView is disabled while the section in view
                            #   is still animating and re-enabled once that section's build clock
                            #   settles — one animation at a time. On that first launch the scroll
                            #   also snaps section to section (snapToOffsets at every section top +
                            #   disableIntervalMomentum), so a fling lands on exactly one section,
                            #   and the lock settles the scroll onto the section it engages on. A
                            #   section is "seen" only once its CONTENT (piece + copy, centred in
                            #   the full-viewport section) is fully on screen — the geometry is
                            #   lib/onboardingReveal.ts. Every later visit, and any first visit
                            #   under reduced motion, scrolls freely with no snapping, as before.
                            #   The hero's cue is no longer a tap target; it now reads "Scroll down"
      sign-in.tsx            # email/password sign-in + a "Continue with Google" button; Google
                              #   provider live in production since 2026-08-09. Minimal since
                              #   2026-09-14 (spec §V22-06: the auth pages carry nothing) — wordmark,
                              #   heading, fields, and a "Back to the start" link to onboarding.
                              #   Since 2026-09-20 (issue #94): a "Forgot your password?" link, and
                              #   on EMAIL_NOT_VERIFIED an explicit "Resend the link" (through
                              #   apiClient's resendVerificationEmail — never a callbackURL on
                              #   sign-in itself, see workers/src/auth.ts's sendOnSignIn note)
      sign-up.tsx            # email/password sign-up + the same Google button, same treatment and
                              #   the same link back. Passes callbackURL: createVerifyEmailURL();
                              #   when the Worker withholds the session (token: null — verification
                              #   required) it shows "Check your inbox" instead of navigating
      forgot-password.tsx    # issue #94 (2026-09-20) — reads GET /api/email-status on mount and,
                              #   when the Worker cannot send mail, says so in place of the form;
                              #   otherwise requestPasswordReset with the app's /reset-password
                              #   callback, then a generic "if an account exists" confirmation
                            #   all auth screens scroll (KeyboardAvoidingView + ScrollView) as of
                            #   2026-08-08 — centred content used to be unreachable under a keyboard
    (tabs)/
      _layout.tsx          # icon-only tab bar — Home, Glossary, My Plans, Settings. Every icon
                            #  keeps an explicit screen-reader label; the active state is an ink
                            #  tick, never the accent. Home's glyph is the week strip (2026-09-14)
      index.tsx             # Home — asks nothing and generates nothing (captain's 2026-09-20
                             #  rulings). On focus it reads GET /api/intake and pushes a runner
                             #  with no intake on file to /intake (never on a failed fetch). Then,
                             #  in order: the header (tier · quota eyebrow, "Today"),
                             #  VerifyEmailBanner, the subscription box FIRST (the header mark —
                             #  V22-04, components/build/HeaderMark, a 7-slot strip filling to the
                             #  current week's elapsed days via src/lib/planProgress.ts, re-run
                             #  only when that count changes — beside tier + plans used and
                             #  "See plans →" to /paywall), a CURRENT PLAN summary row for the
                             #  newest plan by createdAt (title, "N WEEKS · WEEK k", opens
                             #  /plan/[id]) when one exists, the one CTA "Create a new plan"
                             #  (always opens the intake, blank), and the My Plans row. No
                             #  target card, plan-length field, Notes, locked panel or teaser
      settings.tsx           # Settings tab (new 2026-08-05) — tier + quota (GET
                              #  /api/quota-status, src/lib/quotaDisplay.ts), sign-out (moved off
                              #  Home), a Free-tier "Upgrade" entry point to /paywall, a Legal ->
                              #  Privacy policy row (issue #89; opens through
                              #  src/lib/openPrivacyPolicy.ts, with a visible accessible error
                              #  if opening fails), and Delete Account — since 2026-09-20 a
                              #  credential account re-enters its password in
                              #  <DeleteAccountDialog>, a Google-only one keeps
                              #  confirmDestructive() (the OS alert on native, the browser's
                              #  own confirm on web, 2026-09-16 / issue #96); either path ->
                              #  deleteAccount() -> authClient.signOut(). Contract: the
                              #  POST /api/delete-account row below. Quota refreshes
                              #  cache-first on every focus.
      glossary.tsx           # compact accessible disclosure rows, collapsed by default; terms and
                              #  expanded definitions are sourced from notation.ts, nothing hardcoded
      my-plans.tsx           # My Plans — the permanent Example Plan is always present; generated
                              #  plans come from GET /api/plans and refetch on every tab focus, with
                              #  the last-known list visible during the background request. There is
                              #  no empty state; the most-recent stat links to max(createdAt)
      __tests__/             # state render tests for Home's first-entry gate and control set, My
                              #  Plans' permanent example/latest link, and the Glossary's
                              #  independent disclosures
    intake.tsx               # the questionnaire AND the only place a plan is created (captain's
                              # 2026-09-20 rulings; the only place a target race is asked for since
                              # 2026-08-15). Starts blank every time — GET /api/intake is read once
                              # for a boolean (intake on file → 'repeat', else 'first'), never to
                              # prefill. First entry: the survey intro (V22-03,
                              # components/build/SurveyIntro) holds until PRESS TO CONTINUE, then
                              # the questions; no Cancel, swipe-back off, beforeRemove refused
                              # until the plan exists. Re-entry (Home's "Create a new plan"):
                              # straight to the questions, with a Cancel back to Home in the
                              # ScreenHeader's action slot (native header hidden). Blueprint
                              # sections on hairlines: YOU, TRAINING, TARGET (target race required;
                              # race date and goal time optional; PLAN LENGTH (WEEKS) only while
                              # the date is blank — needsPlanLength, live), RECENT RESULT, HEALTH.
                              # Numeric answers use src/components/inputs/ (segmented YYYY-MM-DD
                              # and H:MM:SS boxes, digit-filtered). An age of 13–17 reveals a
                              # required guardian-consent checkbox (issue #89, 2026-09-19) whose
                              # policy link goes through lib/openPrivacyPolicy.ts; the server
                              # refuses without guardianConsent: true. The one bottom "Create
                              # plan" runs PUT /api/intake then POST /api/generate-plan (notes
                              # empty; over_quota → /paywall with the quota; a terminal
                              # invalid_request re-mints the idempotency key) and replaces itself
                              # with /plan/[id], so the plan's back arrow lands on Home
    plan/[id]/               # plan detail (V22-06, rebuilt 2026-09-14 as three read-only pushes;
                              #  the accordion/ribbon view and its contour route line are gone)
      index.tsx               #  A · overview — one row per week: W#, a 120×22 miniature strip,
                              #   RECOVERY/TAPER/RACE WEEK tag, total, chevron; the current week
                              #   (planProgress off the list's createdAt param) is highlighted and
                              #   the others' bars dimmed. `[id]` selects a real generated plan via
                              #   GET /api/plans/:id (hooks/use-plan.ts) or the permanent golden
                              #   fixture; GoalRealismNotice and FallbackNotice as before
      week/[week].tsx         #  B · week — the static 7-slot strip (StaticWeekStrip) with the
                              #   current day's numeral in ink, then the seven days as hairline rows
      week/[week]/day/[day].tsx # C/D · session or rest day — eyebrow with a session-tone dot, the
                              #   headline, stats (km / HR zone or RPE / pace when present), then
                              #   STRUCTURE, EFFORT and WHY as they exist on the Workout
    paywall.tsx              # dummy paywall (new 2026-08-05) — a Stack route, reached from
                              #  Settings, Home's subscription box, or the intake's Create-plan
                              #  402 over_quota catch (Home's until 2026-09-20);
                              #  calls POST /api/purchase-tier, honest "test upgrade" copy
    reset-password.tsx       # issue #94 (2026-09-20) — where the mailed reset link lands, at the
                              #  ROOT and outside both Stack.Protected groups (a deep link opens in
                              #  either session state). ?token= → new password + confirm →
                              #  resetPassword → "Password updated"; ?error= or nothing → "Link
                              #  expired". The token is read from the URL, posted once, never logged
    verify-email.tsx         # issue #94 — where the mailed verification link lands, same placement
                              #  and reason. Bare arrival = "Email verified" (refetches the session);
                              #  ?error= = "Link expired" with a resend when signed in
  components/
    auth/                   # AuthField — the labelled text input every auth screen uses;
                             #  VerifyEmailBanner (issue #94) — Home's "verify your email" card,
                             #  self-contained: reads the session and GET /api/email-status and
                             #  renders only for an unverified account on a mail-capable Worker
    build/                  # the build animations (new 2026-09-14) — "the plan builds itself".
                             # WeekStrip (the animated strip every build is made of), CountUp (the
                             # ticking Number), FadeIn, DesignCanvas (the 393×852 page canvas,
                             # scaled down never up), useBuildClock (one master clock `T` in
                             # seconds per composition; reduced motion = end frame), then the
                             # compositions: OnboardingHero (V22-01), steps (V22-02: StepIntake /
                             # StepEngine / StepMiniPlan), SurveyIntro (V22-03), HeaderMark
                             # (V22-04), PlanHero (V22-05), and the two static strips
                             # StaticWeekStrip / MiniWeekStrip (V22-06 and the list rows).
                             # RunnerFigure (the stick runner above Get started) was deleted
                             # 2026-09-20 — captain's ruling, stale asset. Timings and cue tables
                             # live in lib/buildMotion.ts, never here
    intake/                 # IntakeExitAction — the questionnaire's "Cancel", rendered on a
                             #  re-entry only (a first entry has no exit, 2026-09-20)
    layout/                 # ScreenHeader (eyebrow / title / supporting, plus an optional
                             #  `action` slot on the eyebrow row — the intake's Cancel is its one
                             #  caller), GroupedRows (Group / Row / ActionRow)
    nav/                    # TabBarIcon — the four tab glyphs, drawn not shipped as assets
    plan/                   # PlanTopBar (back arrow + mono eyebrow), PlanListRow (a My Plans
                             # row: miniature strip, title, meta), planScreen.ts (the three detail
                             # screens' shared derivations: current week/day, week tag, day label),
                             # PlanPlaceholder (a detail screen's loading / nothing-to-show state,
                             # with its own PlanTopBar so the runner always has a way back),
                             # EffortChip, ReadoutBracket, DisclaimerFooter, FallbackNotice,
                             # GoalRealismNotice, format.ts. WeekAccordion / WorkoutRow /
                             # PlanNameplate were deleted 2026-09-14 with the ribbon view
    ui/                     # ActionButton (new 2026-09-03) — PrimaryAction / RevealPrimaryAction
                             # (the same slab drawing itself in on a build clock, V22-02 "Get
                             # started") / SecondaryAction / ActionDivider / LinkAction.
                             # PrimaryAction IS the accent, so "one accent per screen" is a
                             # question about imports, not about review
    __tests__/              # render smoke tests: render, and build (the build components render
                             # at their end frame under reduced motion)
    inputs/                 # NumberField, SegmentedField, DateField, ClockField (new 2026-08-15) —
                             # every numeric/structured answer in the app. Keystrokes are filtered
                             # through src/lib/fieldInput.ts; dates and times are segmented boxes
                             # with the `-`/`:` printed, never typed. No screen uses a raw
                             # <TextInput keyboardType="..."> for a number
  constants/
    legal.ts                # issue #89 — the one public privacy-policy URL used by Settings;
                             #  points at the GitHub Pages path rendered from docs/privacy-policy.md
    theme.ts                # "Blueprint" token system (2026-09-14, the captain's V22 theme sheet)
                             #  — current, see below
    navigation-theme.ts      # bridges theme.ts's tokens into expo-router's re-exported `Theme`
                             #  shape, so ThemeProvider never leaks the library's own stock
                             #  DefaultTheme/DarkTheme colors (fixes issue #27)
    __tests__/                # legal (issue #89), navigation-theme, theme.contrast (new 2026-09-03), and
                             #  app-config-colors (2026-09-16) — the middle one recomputes every
                             #  ratio in the design doc's tables from theme.ts's own hexes, so the
                             #  contrast rule is enforced rather than documented; the last pins
                             #  app.json's splash/adaptive-icon hexes to Colors.dark.surface.base
  hooks/                    # use-theme (resolves to the dark scheme only, see below),
                             #  use-color-scheme, use-plan (one plan by id: real via
                             #  GET /api/plans/:id or the golden fixture), use-first-onboarding-visit
                             #  (2026-09-20 — wraps lib/onboardingVisit.ts's AsyncStorage flag for
                             #  onboarding's first-launch scroll lock)
  lib/
    supabase.ts             # LEGACY, unused — see below
    apiClient.ts             # the one module that talks to `workers/`: better-auth's Expo client
                              #  (`authClient` — sign-up/sign-in/sign-out/useSession, session
                              #  persisted via expo-secure-store) plus typed fetch wrappers for
                              #  every other `/api/*` route; re-exports apiErrors.ts's error
                              #  vocabulary so screens keep one import site. Since 2026-09-20:
                              #  getEmailStatus(), resendVerificationEmail(email) (the one caller
                              #  of send-verification-email) and useSessionUser(), the typed door
                              #  onto user.email / user.emailVerified — the expoClient cast types
                              #  useSession().data as `never`
    authEmail.ts             # pure (new 2026-09-20, issue #94) — the client half of password
                              #  recovery and email verification: the two callback URLs via
                              #  expo-linking, each landing screen's entry state from its
                              #  ?token= / ?error= params, the password-match check, the
                              #  banner/pending-sign-up predicates, and the flow's shared copy
                              #  constants. 28 unit tests
    apiErrors.ts              # pure error vocabulary for every `/api/*` call: `ApiError` (server
                               #  answered and refused) vs `NetworkError` (nothing answered),
                               #  `describeError()` for the user-facing message. Split out so it
                               #  has no React/expo-secure-store/@better-auth dependency and can be
                               #  unit-tested directly (2026-08-07, `Network request failed` fix)
    postSignupRedirect.ts    # one-shot module-level flag so a fresh signup lands on Intake — see
                              #  "Sign-up → Intake redirect" below
    confirmDestructive.ts    # one confirmation step for a destructive action on every platform
                              #  (new 2026-09-16, issue #96): the OS Alert.alert on native, the
                              #  browser's window.confirm on web — react-native-web's Alert.alert
                              #  is an empty method. Only an explicit confirm calls onConfirm; a
                              #  web runtime with no confirm throws. Platform/Alert/confirm are
                              #  read through an injectable runtime so both branches are tested
    openPrivacyPolicy.ts     # the one way the app opens PRIVACY_POLICY_URL (issue #89): web
                              #  navigates the current tab, native tries the in-app browser then
                              #  the OS handler; every failure resolves to a message the screen
                              #  shows instead of throwing. Shared by Settings' Legal row and the
                              #  intake consent row; same injectable-runtime seam as confirmDestructive
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
    planRequest.ts           # pure (new 2026-08-15) — intake owns the runner's target and, since
                              #  2026-09-20, plan creation; Home never asks. Also the
                              #  stale-race-date guard. See the src/lib/ notes below
    fieldInput.ts            # pure (new 2026-08-15) — the digit/decimal filters and clock/date part
                              #  parsers behind src/components/inputs/
    buildMotion.ts           # pure (new 2026-09-14) — the build animations' vocabulary: the
                              #  easings, the enter/draw/move/snap primitives (snap = 350 ms rise
                              #  to 1.03, one settle), and each approved page's cue table
                              #  (HERO_TIMELINE, STEP_TIMELINE, SURVEY_TIMELINE, MARK_TIMELINE,
                              #  PLAN_HERO_TIMELINE). Worklets; every function is also plain JS
    weekStrip.ts             # pure (new 2026-09-14) — the strip's data shape (StripWeek: seven
                              #  slots, null = rest) and `stripFromWeek` (a real Week normalised so
                              #  its longest session fills 90% of the track), plus the pages' own
                              #  fixed weeks (HERO_WEEK, SURVEY_WEEKS, ENGINE_CANDIDATES)
    planProgress.ts          # pure (new 2026-09-14) — where a runner is in a plan, read off the
                              #  calendar: `planProgress(createdAt, weeks, today)` → week index,
                              #  elapsed days of that week, finished. The app logs nothing, so
                              #  "completed days" means elapsed days — the only honest reading
    goalRealismDisclosure.ts # pure, app-only copy helper (new 2026-08-15) — the ONE place that
                              #  decides whether a realism notice shows and what it says
                              #  ('plan' vs 'preview' tense); classification and cap arithmetic
                              #  stay in paceDerivation.ts
    quotaDisplay.ts          # pure, app-only display helper (new 2026-08-05) — `formatQuotaLine()`
                              #  phrases a `QuotaStatus` for Settings/Home/the paywall; the numbers
                              #  themselves stay server-computed, this only formats them
    fixtures/examplePlan.ts  # hand-built 5K screen fixture; `plan/[id]/` still renders it
    __tests__/               # supabase, loadRules, notation, examplePlan.fixture, tierLimits,
                              # quotaPeriod, planTemplates (golden + general + noRace),
                              # planLibrary/ (registry, engine — 65 tests, new 2026-09-09),
                              # paceDerivation, quotaDisplay (6 tests, new 2026-08-05),
                              # goalRealismDisclosure, planRequest, fieldInput (new 2026-08-15),
                              # buildMotion, weekStrip, planProgress (new 2026-09-14),
                              # confirmDestructive (11 tests, new 2026-09-16),
                              # openPrivacyPolicy (issue #89, 2026-09-19),
                              # authEmail (28 tests) and apiClient.emailStatus (issue #94, 2026-09-20)
                              # — the two engine contracts included
```

Expo Router SDK 57 retains these tab screens when focus moves between them; the tab navigator does
not unmount and remount each screen on every switch. Home, My Plans, and Settings therefore use
`useFocusEffect` to refresh on return while preserving their last successful result. Their full
loading indicator is a first-load state only: once a response succeeds, cached `null` intake and a
cached empty plan list are data too. Later refreshes are silent, and a refresh error does not erase
the last-known UI. Glossary performs no data fetch. The rendered My Plans regression test drives two
focus cycles on one mounted renderer and asserts that an unresolved second refresh shows the cached
plan without an `ActivityIndicator`.

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

## Current — privacy policy and publication

[`docs/privacy-policy.md`](privacy-policy.md) is the sole policy source. It identifies Ian Qiu, a
sole trader based in Thailand, as data controller and documents the current observable contract,
including the account-deletion control already shipped through PR #117. It states that users must
be at least 13 and that ages 13–17 require a parent or guardian's consent. As of 2026-09-19 that
consent is also recorded, not just stated: `PUT /api/intake` requires an explicit
`guardianConsent: true` for a 13–17 runner and writes a `guardian_consent` event (timestamp +
policy version) atomically with the intake row — see the schema and API table above. It treats
account-linked intake answers and plans conservatively as health/fitness data
without claiming that the injury picker records a GDPR Article 9 consent event; saving Intake
overwrites the one stored response but does not rewrite existing plans. Its provider disclosures
cover GitHub Pages request metadata, Cloudflare Worker logs (up to seven days), and Anthropic's
ordinary and flagged-request retention, including trust-and-safety scores.

Publication is intentionally isolated from the app and the internal documentation tree:
`.github/workflows/publish-legal-pages.yml` runs after a qualifying push to `main` (or manual
dispatch), stages the policy as `privacy-policy/index.md` with Jekyll front matter plus one root
redirect, and uses GitHub's official Pages Jekyll build action to produce an otherwise-empty Pages
artifact. It targets
`https://ianqiu979.github.io/Ai-Customized-Running-Plan-App/privacy-policy/`. The URL is a configured
target, **not a proven live endpoint until a qualifying Pages workflow succeeds**.
`src/constants/legal.ts` holds the same URL for Settings → Legal → Privacy policy;
`src/constants/__tests__/legal.test.ts` pins the controller identity and age posture and checks that
the workflow's Markdown input/output path still agrees with the app constant.

## Current — the backend, in `workers/`

```
workers/                    # a SEPARATE npm project; Metro is told to skip it (metro.config.js)
  wrangler.toml             # bindings + non-secret vars (committed — nothing secret here)
  migrations/
    0001_better_auth.sql    # user, session, account, verification
    0002_app_schema.sql     # profiles, intake_responses, subscriptions, plans
    0003_intake_age_floor.sql / 0003_raise_intake_age_floor.sql   # the 13+ age floor
    0004_guardian_consent.sql # guardian_consent — one row per 13–17 user, consent event
  src/
    index.ts                # authenticate once, then dispatch — the route table (plus the one
                            # public app route, GET /api/email-status)
    auth.ts                 # better-auth on D1, email/password + Bearer sessions; since 2026-09-20
                            # also password reset + email verification (issue #94) and a
                            # reset-token-redacting error logger
    auth-email.ts           # resolveAuthMailRuntime(env) → { sendMail, mailConfigured,
                            # verificationRequired }, and the two mail templates
    routes.ts               # handlers, each taking an already-verified userId
    deps.ts                 # binds every plan-engine seam and reads ANTHROPIC_API_KEY
    lib/mail.ts             # provider-agnostic sendMail — ResendAdapter (RESEND_API_KEY +
                            # MAIL_FROM) or ConsoleAdapter (logs one redacted line, sends nothing)
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
Bearer sessions, password reset and email verification (below), the quota ledger (reserve →
settle/release, atomic gate, idempotency replay, fallback exemption), `quota-status`,
`purchase-tier`, `delete-account`, intake read/write, and plan reads. **`generate-plan` now returns a real plan**, as of the 2026-08-04 skeleton binding — Free
and, as a template fallback, Pro/Elite. **As of 2026-08-10 the Pro/Elite personalization prompt is
bound too** (`workers/src/lib/planPersonalizationPrompt.ts`) — see "generate-plan" below. The one
remaining gap is `ANTHROPIC_API_KEY`, unset everywhere, so Pro/Elite generation still serves the
template plan as a quota-exempt fallback until the captain provisions it.

**Transactional mail — password reset and email verification (2026-09-20, issue #94).**
`workers/src/lib/mail.ts` is a provider-agnostic `sendMail({ to, subject, text, html })` with two
adapters: `ResendAdapter` (Resend's HTTP API, chosen when `RESEND_API_KEY` **and** `MAIL_FROM` are
both set and non-blank; a failed send throws with the HTTP status only, never a provider body) and
`ConsoleAdapter` (chosen otherwise; logs one `mail_skipped_unconfigured` line with the subject and
nothing else — never the recipient, link or token — and sends nothing).
`workers/src/auth-email.ts`'s `resolveAuthMailRuntime(env)` picks the adapter per request and
returns `{ sendMail, mailConfigured, verificationRequired }`, where
`verificationRequired = mailConfigured && MAIL_VERIFICATION_REQUIRED === 'true'`; the flag is a
committed, non-secret var set to `"false"` in both `[vars]` and `[env.production.vars]`. Both
secrets go through `.dev.vars` / `wrangler secret put … --env production`, never `wrangler.toml`.
`createAuth` wires that runtime into better-auth: `emailAndPassword.sendResetPassword`,
`revokeSessionsOnPasswordReset: true`, `requireEmailVerification: verificationRequired`;
`emailVerification.sendOnSignUp: mailConfigured`, `sendOnSignIn: false` (deliberate — the app
cannot pass `callbackURL` on `sign-in/email` because on web the client's redirect plugin would
navigate to it, so an auto-sent link would carry the default `/` callback, the Worker root; the
sign-in screen resends explicitly instead); `advanced.backgroundTasks` runs the sends through
`ctx.waitUntil`. Every mailed link is the Worker's own URL — it spends the token server-side and
`302`s to the `callbackURL` the app supplied (`?token=` appended for a reset; bare or `?error=` for
a verify). Both the better-auth error logger and `index.ts`'s unhandled-error path redact
`reset-password/<token>` paths, URLs and secret/token/code/state-keyed values. So: with no
provider configured (every deployment today), sign-up still creates a session immediately, no mail
is sent, and the app's forgot-password screen says so — see `GET /api/email-status` in the API
table and the captain's runbook, [`email-setup.md`](email-setup.md). `workers/vitest.config.ts`
blanks both secrets so no test can send mail; `workers/test/auth-email.test.ts` drives both round
trips against real D1.

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
email/password, plus a "Continue with Google" button — joined on 2026-09-20 by
`(auth)/forgot-password.tsx` and the root-level `reset-password.tsx` / `verify-email.tsx`
(issue #94), whose decisions live in the pure `src/lib/authEmail.ts`; `apiClient.ts` gained
`getEmailStatus()`, `resendVerificationEmail()` and `useSessionUser()` for them. Native Google auth is driven by
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
`/api/*` route already 403ing anonymously. The two exceptions, since 2026-09-20, are
`reset-password` and `verify-email`: they are registered outside both `Stack.Protected` groups
because the mailed link that opens them can arrive in either session state, and nothing on them is
session-sensitive — the URL token is the only credential and the Worker is the only thing that can
spend it.

**Sign-up → Intake redirect (2026-08-04).** A fresh signup must land on Intake, not on `(auth)` or
nowhere. `sign-up.tsx` unmounts as soon as `_layout.tsx`'s `Stack.Protected` swaps the signed-in
user into `(tabs)`/`intake`, in the same commit that its session becomes truthy — so a redirect
driven by `sign-up.tsx`'s own `useEffect` can lose that unmount race. The fix is
`src/lib/postSignupRedirect.ts`: a one-shot module-level flag (`markPostSignupRedirect()` /
`consumePostSignupRedirect()`), set by `sign-up.tsx` on a successful signup and consumed by
`_layout.tsx` — which never unmounts — in its own `useEffect` watching `session`, followed by
`router.push('/intake')` (a push, not a replace, since 2026-09-20: the intake ends by replacing
itself with the new plan, whose back arrow must land on Home, so `(tabs)` has to stay
underneath). Any future post-signup routing decision belongs in `_layout.tsx` for the same
reason, not in a screen that's about to unmount. Since 2026-09-20 the redirect is also no longer
the only way in: Home reads `GET /api/intake` on every focus and pushes a runner with no intake on
file to `/intake` itself (skipped if Home has already blurred, so the two paths never stack two
intakes), and the intake has no "Skip for now" — a first entry has no Cancel, swipe-back off, and
`beforeRemove` refused until the plan exists. The 2026-08-05 escape hatch is gone by the captain's
ruling; the intake is mandatory.

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
`src/app/plan/[id]/` and `src/components/plan/` render it end to end on a real screen
(ugly-beyond-tokens caveats aside), and `src/app/(tabs)/glossary.tsx` explains its abbreviations
through collapsed-by-default disclosure rows, reading every definition from `notation.ts`.
**As of 2026-08-04, the pure generator is also wired into the
route**: `src/app/plan/[id]/` renders a real generated plan fetched via `GET /api/plans/:id` for
any real plan id, and falls back to the static fixture only for the example-plan id — the fixture
is the permanent demo/glossary example, not a stand-in for missing wiring.

There is no `subscription.ts` file — that planned module was never needed as its own thing;
`apiClient.ts`'s `getQuotaStatus()`/`purchaseTier()` wrappers cover the same ground, now consumed
by `src/app/(tabs)/settings.tsx` and `src/app/paywall.tsx` (both new 2026-08-05) as well as Home.
Intake now has a screen (`src/app/intake/`, against `GET`/`PUT /api/intake`), and My Plans now has
one too (`src/app/(tabs)/my-plans.tsx`, against `GET /api/plans`) — the latter always includes the
static example, appends generated rows, and links its newest-date stat to the corresponding plan.
Both screens date from 2026-08-04. No
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
                           # session. Sign-in links to forgot-password and offers a verification
                           # resend on EMAIL_NOT_VERIFIED; sign-up shows "Check your inbox" when
                           # the Worker withholds the session (issue #94, 2026-09-20)
  (auth)/forgot-password   # exists today (2026-09-20) — email → requestPasswordReset, or the honest
                           # "can't send email" message when GET /api/email-status says so
  reset-password           # exists today (2026-09-20) — the reset link's landing; ROOT level,
                           # outside both Stack.Protected groups, renders in either session state
  verify-email             # exists today (2026-09-20) — the verification link's landing; same
                           # placement. Both are reached only by deep link (paceblueprint://…,
                           # exp://…/--/…, or the web origin), never by in-app navigation
  (tabs)/index          # Home — gates first entry (no intake on file → push /intake), then the
                         # subscription box, the newest plan's summary row, "Create a new plan"
                         # (opens the intake, blank) and the My Plans row. Asks nothing, generates
                         # nothing (2026-09-20). Carries VerifyEmailBanner under the header (issue
                         # #94), which renders only for an unverified account on a mail-capable
                         # Worker
  (tabs)/glossary       # compact, collapsed-by-default abbreviation disclosures; not in the
                         # original blueprint's tab list; added for Ian's 2026-07-11 notation ruling
  (tabs)/my-plans       # My Plans — permanent Example Plan plus GET /api/plans rows; no empty
                         # state, and MOST RECENT links to the newest generated plan
  (tabs)/settings       # exists today (2026-08-05) — tier + quota display, sign-out, delete
                         # account, an "Upgrade" entry point to /paywall (decision 1, 2026-07-10),
                         # and issue #89's accessible Legal -> Privacy policy link (via
                         # src/lib/openPrivacyPolicy.ts)
  intake                 # the questionnaire and the plan-creation press (stack) — exists today,
                         #  against GET/PUT /api/intake then POST /api/generate-plan; mandatory
                         #  and unskippable on first entry, blank on every entry (2026-09-20)
  plan/[id]              # plan overview (V22-06 A) — exists today; renders a real generated plan
                         #  via GET /api/plans/:id, or the permanent static golden fixture for the
                         #  example-plan id. One row per week, current week highlighted
  plan/[id]/week/[week]  # week (V22-06 B, 2026-09-14) — the static strip and the seven day rows
  plan/[id]/week/[week]/day/[day]  # session or rest day (V22-06 C/D, 2026-09-14)
  paywall                # exists today (2026-08-05) — dummy purchase-tier UI, a Stack route
                         #  reached from Settings, Home's subscription box, or the intake's 402
                         #  over_quota catch
```

**Decision 1 (2026-07-10):** the paywall and a settings-lite screen (sign out, tier display,
restore purchases) are restored to MVP scope, using the blueprint's reserved third tab slot
(`docs/design/mvp-blueprint.md` Part 8) rather than shipping as detached modal-only routes.
**Built 2026-08-05** — see `(tabs)/settings` and `paywall` above; "restore purchases" has no
counterpart yet since v1's in-app purchase flow is dummy-only, with no real store receipt to
restore.

**Decision 5 (2026-07-10), as revised by the captain's 2026-09-20 rulings:** Home leads with
quota state (the tier · quota eyebrow and the subscription box), then the newest plan's summary
row, then "Create a new plan" — which only opens the intake. Home shows no intake target, asks
for no plan length and has no Notes or subscription disclosures; every question and the create
press live on `/intake`. The original decision's "no next workout card" stands in spirit: the
summary row prints `N WEEKS · WEEK k` from `planProgress.ts`'s elapsed-days arithmetic (there
since V22-04's header mark) but names no workout, since days are unnamed and there are no
check-offs, so "next" has no well-defined meaning.

## Current + planned — `src/lib/` layout

```
src/lib/
  supabase.ts            # exists today — LEGACY, unused
  apiClient.ts             # exists today — better-auth's Expo client (`authClient`) plus typed
                            #                fetch wrappers for the app's `/api/*` routes
  apiErrors.ts              # exists today (2026-08-07) — pure `ApiError`/`NetworkError`/
                             #                `describeError()`, re-exported from `apiClient.ts`
  authEmail.ts             # exists today (2026-09-20, issue #94) — the client half of password
                            #          recovery and email verification, pure so every decision is
                            #          tested without a render: `createResetPasswordURL()` /
                            #          `createVerifyEmailURL()` (the app's `callbackURL`s, built
                            #          through `expo-linking` so one code path yields
                            #          `paceblueprint://…` in a built app, `exp://…/--/…` in Expo
                            #          Go and the page origin on web — all in the Worker's
                            #          `trustedOrigins`); `resolveResetPasswordEntry()` (`?token=`
                            #          → form, `?error=` or nothing → invalid) and
                            #          `resolveVerifyEmailEntry()`; `newPasswordProblem()` (match
                            #          only — the 8-character minimum stays server-side);
                            #          `isEmailNotVerifiedError()`, `isVerificationPendingSignUp()`
                            #          (better-auth answers `token: null` when verification is
                            #          required), `shouldShowVerifyEmailBanner()`; and the flow's
                            #          shared copy strings as exported constants (the
                            #          not-configured, invalid-link, mismatch and lifetime
                            #          messages — the screens' own titles and labels stay in their
                            #          JSX; `docs/mvp-progress.md` → Blocked lists them all).
  confirmDestructive.ts    # exists today (2026-09-16, issue #96) — `confirmDestructive(prompt,
                            #          onConfirm)`: the OS `Alert.alert` on native (cancel +
                            #          destructive button), the browser's `window.confirm` on web,
                            #          because react-native-web's `Alert.alert` is an empty method
                            #          and Settings' Delete account did nothing there. Only an
                            #          explicit confirm calls `onConfirm`; no `confirm` on web
                            #          throws. `Platform.OS`/`Alert.alert`/`globalThis.confirm`
                            #          come through an injectable `runtime`
                            #          (`defaultConfirmRuntime()`) so both branches are
                            #          unit-tested; screens never pass it.
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
                            #          authoritative. Since 2026-09-19 (issue #103) the curve's
                            #          loading block is sampled across the plan's non-taper weeks
                            #          and its taper entries across the allocator's taper weeks
                            #          (`sampleCurve`), and the generic path reads each long-run
                            #          curve with its recovery dips held at the running maximum
                            #          (`holdRecoveryDips`) — rest weeks size their own long run.
                            #          A peak that sits below a build-phase loading spike is
                            #          disclosed in one sentence; the 22,000-plan sweep in
                            #          `planTemplates.progression.test.ts` holds the base-high
                            #          invariant at zero offenders since the captain's 2026-09-20
                            #          rulings (beginner share margin 1.2; ≥50 km/week leaves the
                            #          golden path), and pins the 150 plans whose one-week peak
                            #          phase is a cadence rest week as a ceiling awaiting him.
                            #          Race Day's `distanceKm` is the bare race distance (5 / 10 /
                            #          21.1 / 42.2) on both tiers since 2026-09-20 — warm-up and
                            #          cool-down live in the `structure` string only, so a race
                            #          week tapers instead of reading as a second peak. A distance
                            #          named with no race date yields an "N-Week 10K Base Plan"
                            #          that keeps `raceDistance` (issue #76); `raceDate` alone
                            #          means a race. The byte-pinned golden fixture remains its
                            #          own path, admitted only for a 12-week / 4-day / 5K race
                            #          intake under 50 km/week (`GOLDEN_FIVE_K_MAX_WEEKLY_KM`) on
                            #          the 4-week recovery cadence or the 50+ 4/8/12 (2026-09-16,
                            #          2026-09-20); anything else is served generically.
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
                            #          composition; INJ-6's "Day 7 at `LR-low`" is a cap, so a
                            #          rest week still shortens the long run first — #119,
                            #          2026-09-20), `engine.ts` (`buildLibraryPlan` — the source
                            #          document's resolution order plus its mandatory
                            #          disclaimers; every week is reconciled exactly to its
                            #          target, `HOLD` holds at the top of § 5's 95–100% band, and
                            #          `derivePhases` labels base / build / peak / taper from the
                            #          rendered volumes so the peak phase is always the plan's
                            #          highest-volume block — captain's ruling 2026-09-20, swept
                            #          over 17,600 plans by `__tests__/engine.progression.test.ts`;
                            #          a 6- or 8-week completion plan with no loading block after
                            #          its base has no peak), `openQuestions.ts` (the six coaching decisions
                            #          the source does NOT make, all six ruled by Ian 2026-09-10
                            #          and isolated in one file — see
                            #          `docs/reference/coaching/free-engine-open-questions.md`).
                            #          Selection is by register lookup, never by inventing a plan:
                            #          a request the register does not cover is refused, not
                            #          approximated.
  paceDerivation.ts        # exists — Riegel cross-distance equivalency, source-relative training
                            #          bands, and the ruled goal-realism/race-pace cap (decision
                            #          13, 2026-07-10)
  planRequest.ts           # exists (2026-08-15; header rewritten 2026-09-20) — the rule that
                            #          intake owns the runner's target and, since 2026-09-20, plan
                            #          creation; Home never asks and never sends a request:
                            #          `planTargetFromIntake()`, `needsPlanLength()` (plan length
                            #          is asked only when no race date fixes it),
                            #          `buildGeneratePlanRequest()`. Pure, so the "asked exactly
                            #          once" and "no race needed" guarantees are unit-tested without
                            #          rendering a screen (the builder still encodes a `general`
                            #          target — the required distance is the screen's rule). Also
                            #          owns the stale-race-date guard — `isRaceDatePast()` (`now`
                            #          is injected, never read from the clock in here),
                            #          `intakeRaceDateError()` and the one
                            #          `RACE_DATE_PASSED_MESSAGE`. The intake refuses before it
                            #          saves or generates, so no quota slot is charged for the
                            #          one-week plan the server's `weeksUntilRace` floor would
                            #          otherwise produce. `describePlanTarget` and Home's "Tap
                            #          Change" message went with Home's panel.
  fieldInput.ts            # exists (2026-08-15) — digit/decimal filters and the clock/date part
                            #          parsers behind `src/components/inputs/`. Its header records
                            #          why `keyboardType` alone is not enough (it restricts nothing;
                            #          a letter reached a number-pad field on device).
  buildMotion.ts           # exists (2026-09-14) — the build animations' shared vocabulary, a
                            #          straight port of the approved V22 pages' runtime: easings,
                            #          the enter / draw / move / snap primitives, and each page's
                            #          cue table resolved to absolute seconds (`timelineFrom`).
                            #          Every function is a worklet AND plain JS, so the UI thread
                            #          and the tests run the same code. Pure.
  weekStrip.ts             # exists (2026-09-14) — `StripWeek` (seven slots, null = rest) and
                            #          `stripFromWeek()`, which normalises a real `Week` so its
                            #          longest session fills 90% of the track (the rule V22-05 was
                            #          drawn to), plus the pages' own fixed weeks. Pure.
  planProgress.ts          # exists (2026-09-14) — `planProgress(createdAt, weeks, today)`: the
                            #          calendar reading of where a runner is in a plan (Day 1 of
                            #          Week 1 is the day the plan was generated). The app logs
                            #          nothing, so this is what "completed days" can honestly mean
                            #          until a real day-marking flow exists. Pure.
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
   intake screen mounts (Home's, until 2026-09-20), held across retries of the same attempt, and
   re-minted after a success or a terminal `invalid_request`. If `(user_id, idempotency_key)` already has a row in `plans`, return
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
   mandatory disclaimers, labels its phases from the rendered volumes (`derivePhases` — the peak
   phase is always the plan's highest-volume block, captain's ruling 2026-09-20), and that plan is
   the finished product — the pipeline stops at step 6.
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
or four-day week is never floored on the Q2 interval it drops. The generic path also reads
every long-run curve with its authored recovery dips held at the running maximum and keeps the
curve's taper entries on the allocator's taper weeks (2026-09-19, issue #103) — see `sampleCurve`
and `holdRecoveryDips` in `planTemplates.ts`. The coach-authored golden
5K path uses the flat per-level share table, the flat absolute table, the raw fractional spike
ceiling, and the un-held `FIVE_K_LONG_RUNS` with whole-curve interpolation. That path is admitted only for a 12-week / 4-day / 5K race intake whose recovery cadence
lands on the curve's authored dips at weeks 4 and 8 — the 4-week cadence, or the 50+ ruling's
4/8/12 — and whose declared volume is under 50 km/week (`GOLDEN_FIVE_K_MAX_WEEKLY_KM`, captain's
#103 remedy B1, 2026-09-20); every other intake, including the under-50 advanced runner's 3-week
cadence and any ≥50 km/week runner, is built by the generic path (captain's `golden-cadence3-route`
ruling, 2026-09-16, audit §1.3). Generic easy runs are
capped at the final clamped LR distance. Quality/tempo sessions are not: the safety cap may put LR
below one of them rather than rewriting the authored stimulus. `reconcileVolumeToTarget()` trims
whole kilometres without dropping scheduled training runs; an extremely small target can therefore
remain above target when every session has reached its 1 km floor.

Race Day's `distanceKm` is the bare race distance on both engines (captain's ruling, 2026-09-20);
its warm-up and cool-down appear only in the `structure` string, so the golden fixture's race week
sums to 23 km (18 km of pre-race running plus the 5 km race) and a paid race week never reads as a
second peak. Race-day distance is not charged against the pre-race taper budget. Both paths derive
that budget from `RACE_WEEK_PRE_RACE_SHARE` (18/28, still derived from the fixture's authored
28 km race week through `RACE_DAY_PADDING_KM`), and `preRaceBudgetKm`'s peak-relative bound is
measured against the bare race distance; on a generic low-volume/high-frequency plan, the engine schedules
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
| `ANY /api/auth/*` | — | better-auth's own | better-auth's own | Sign-up, sign-in, sign-out, session, OAuth callbacks. Email/password and Google both work in production (Google since 2026-08-09 — see `docs/change_log.md`). Since 2026-09-20 (issue #94) also `request-password-reset`, `reset-password`, `send-verification-email` and the two mailed-link endpoints (`GET reset-password/:token`, `GET verify-email`) that spend the token and `302` to the app's `callbackURL`; a reset revokes every session; an unknown address gets the same `200` as a known one; an untrusted `callbackURL` is `403`. Sign-in answers `EMAIL_NOT_VERIFIED` only when `verificationRequired` is true (below). |
| `GET /health` | none | — | `{ ok: true }` | Liveness. Touches no database. |
| `GET /api/email-status` | none | — | `{ mailConfigured: boolean, verificationRequired: boolean }` | The only unauthenticated app route besides `/health` (issue #94, 2026-09-20). Booleans only — never which provider or credential is set — with `cache-control: no-store`. `mailConfigured` is true when `RESEND_API_KEY` and `MAIL_FROM` are both bound; `verificationRequired` is `mailConfigured && MAIL_VERIFICATION_REQUIRED === "true"`. Read by `(auth)/forgot-password` (form vs. honest "can't send email" message) and Home's `VerifyEmailBanner` (shown only when true and the account is unverified). |
| `POST /api/generate-plan` | session | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes?, idempotencyKey }` | `{ plan, planId, isFallback, quotaConsumed }`, or `402` over-quota / `403` anon / `409` intake-required | Enforces tier + quota server-side, branches by tier, validates, persists. `raceDistance` is validated whenever it is present, on either goal type — a `duration` request legitimately carries one for a runner with a target distance and no date. A duplicate `idempotencyKey` returns the existing plan instead of generating twice. Free gets the template plan (since 2026-08-04). Pro/Elite call the personalization prompt (bound since 2026-08-10) but, with no `ANTHROPIC_API_KEY` configured anywhere yet, still fall back to the same template today (`isFallback: true`, quota-exempt) — see "Current — `generate-plan`" above. `quotaConsumed` tells the client whether this fallback counted against the tier limit, so `FallbackNotice` can pick `counted` vs `exempt`. |
| `GET /api/quota-status` | session | — | `{ tier, used, limit, periodEnd, unlimited, purchasesAvailable }` | Drives Home's and Settings' "N of M plans used" line (`src/lib/quotaDisplay.ts`'s `formatQuotaLine()`, consumed by both since 2026-08-05). `used` counts **non-fallback** plans in the current purchase-anchored period, server-side, never a client counter. `periodEnd` is `null` for Free (lifetime allowance) and also `null` while the temporary `ALL_USERS_UNLIMITED_ACCESS` override is on (see below) — the UI must not render a countdown for either. `purchasesAvailable` (2026-09-20) is whether the v1 dummy purchase is open to *this* account, decided by `workers/src/dummyPurchase.ts` from `DUMMY_PURCHASE_ENABLED` / `DUMMY_PURCHASE_ALLOWLIST`; the paywall renders it (`src/lib/purchaseAvailability.ts`) and never computes it. |
| `POST /api/purchase-tier` | session | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart: string \| null, periodEnd: string \| null }`, or `403 purchases_unavailable` | v1 dummy flow, called from `src/app/paywall.tsx` (new 2026-08-05) with honest "test upgrade, no payment required" copy. Since 2026-09-20 gated server-side to trusted testers: refused `403 purchases_unavailable` unless `DUMMY_PURCHASE_ENABLED === "true"` (local/dev only) or the session's email is on `DUMMY_PURCHASE_ALLOWLIST` (exact, case-insensitive) — `workers/README.md` → "The v1 dummy purchase gate". Production ships with it off and the allowlist empty. v2 swaps `source` to `"revenuecat"` and verifies the receipt — same route, same table write. `source: "revenuecat"` is refused in v1 rather than trusted. |
| `POST /api/delete-account` | session | `{ password?: string }` | `{ deleted: true }`, `401 invalid_password`, or `429 rate_limited` | Really deletes; no soft-delete flag, because the app's own copy promises erasure. The only route that deletes a plan. Since 2026-09-20 (change-list item 10, matching V2.3) it re-checks identity server-side: if the account has a `providerId = 'credential'` row (`store.getCredentialPassword`), `password` is required and must verify against the stored hash (`deps.verifyPassword`, the same function sign-in uses) or the request is `401 invalid_password` and nothing is deleted — five wrong passwords per user or per connecting IP inside 15 minutes make the route answer `429 rate_limited` before it verifies anything (`lib/attemptThrottle.ts`, in-memory, route-scoped), so nothing is deleted while throttled; a Google/OAuth-only account (no credential row) keeps the pre-existing confirm-only behavior, with no `password` needed. Called from Settings' Delete Account flow — `<DeleteAccountDialog>` for a credential account, the existing `confirmDestructive` native alert / web `confirm()` (2026-09-16, issue #96) for an OAuth-only one — followed client-side by `authClient.signOut()` to invalidate the local session store. |
| `GET /api/intake` | session | — | `{ intake }` or `{ intake: null }` | Was a direct client read under Supabase. Since 2026-09-20 it is read for a boolean only: Home's first-entry gate (`null` → push `/intake`; a failed fetch never redirects) and the intake's first/repeat decision. Nothing prefills from it — the stored row is the record of what the last plan was built from. |
| `PUT /api/intake` | session | `IntakeResponses & { guardianConsent?: boolean }` | `{ saved: true }` or `400 invalid_request` | Was a direct client upsert under Supabase. Since 2026-09-20 the intake's one "Create plan" calls it and then `POST /api/generate-plan` in the same press; a refused save never generates. Since 2026-09-19, an `age` of 13–17 requires `guardianConsent: true`; without it the request is refused before anything is persisted. With it, the intake row and a `guardian_consent` event (timestamp + policy version) are written atomically in the same D1 batch (`workers/src/lib/store.ts`'s `upsertIntake`). 18+ requests are unaffected. |
| `GET /api/plans` | session | — | `{ plans: [summary] }` | Drives My Plans and Home's CURRENT PLAN summary row. My Plans keeps the permanent static example outside this response, links its most-recent stat to `max(createdAt)`, and has no empty-library state. Home shows the newest plan by `createdAt` (title, `N WEEKS · WEEK k` once `GET /api/plans/:id` supplies the length) and renders no summary before one exists; a failed refresh keeps the last-known plan. Summaries only — full documents would be megabytes for a heavy user. |
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

-- 0004 — guardian consent for a 13–17 runner
guardian_consent  (user_id -> user.id PK, granted_at, policy_version)
  -- One row per user (INSERT OR REPLACE) — the most recent consent event, not a history.
  -- Written by `upsertIntake` in the same db.batch() as the intake_responses upsert, so an
  -- intake row for a 13–17 user can never exist without a matching consent row. policy_version
  -- is `src/constants/legal.ts`'s PRIVACY_POLICY_VERSION.
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

## Current — visual direction ("Blueprint", `theme.ts`)

> **Source of truth: the captain's V2.2 theme sheet (`V22 theme.md` in the 2026-09-13 design
> handoff, transcribed into [`docs/design/instrument-visual-system.md`](design/instrument-visual-system.md)'s
> opening "Blueprint" section) and `src/constants/theme.ts`'s own header.** Blueprint (2026-09-14)
> supersedes Instrument (2026-09-03) for colour, type and the accent; Instrument's *rules* —
> one accent per screen, tokens only, contrast enforced by test, the effort ramp's non-hue channel
> — carry over unchanged. Where the sheet and any older spec differ, the sheet wins (captain's
> instruction with the handoff). This section is a summary and never the authority.
>
> **Only Expo web has ever rendered it.** Every screen was rendered and compared against the
> approved Claude Design pages on the Expo web dev server at 393×852 on 2026-09-14 (the visual-match
> pass recorded in `change_log.md`); no screen has been run on a real iOS or Android device or
> simulator.

**The app renders one scheme.** The sheet defines a single near-black field and every approved
page is composed on it, so `use-theme.ts` resolves to `dark` regardless of the OS setting. The
`light` palette in `theme.ts` is kept intact and still measured by the contrast suite; re-enabling
it is a one-line change in the hook, not a re-derivation.

**First-run copy is deliberately sparse (captain audit, 2026-09-12).** The onboarding steps and the
auth hand-off keep one headline and one supporting sentence each; that copy contract survived the
2026-09-14 rebuild (step 02's copy is the approved page's).

`src/constants/theme.ts` holds the Blueprint tokens. `Spacing` runs half=2, one=4, two=8, three=16,
four=24, five=32, six=48, seven=64; `MaxContentWidth = 800` and `BottomTabInset` are unchanged (the
latter still has zero call sites — see `docs/mvp-progress.md`'s "Known debt"). `DesignWidth = 393`
is new: the width the V22 pages were composed at, which the build animations lay out against and
scale *down* to fit, never up.

- **Bases**: background `#0B0E12`, raised `#141920` (cards, inputs), hairline
  `rgba(255,255,255,0.10)`, empty slot `rgba(255,255,255,0.14)` (`grid.slot` — a rest day's dash,
  an unfilled cell of the header mark: heavier than a hairline because it stands for something).
  `surface.inverse` (`#05080B`, deeper than base) is still the Paywall's pricing slab.
- **Ink and dim**: `text.primary` `#EEF1F4` for every heading, number and the primary button's
  fill (17.06:1 on base); `text.secondary` `#8B9299` for labels, units and secondary copy (6.14:1).
- **The accent is ink, and there is only one.** `Accent.fill` (`#EEF1F4`) is the primary action's
  fill with `Accent.onFill` (the page colour) as its label, so the one forward action on a screen
  reads as a cut-out of the field. The icy cyan of the retired pulse trace went with the trace;
  there is no second highlight colour anywhere in the system. `PrimaryAction` (and
  `RevealPrimaryAction`, the same slab drawing itself in on a build clock) in
  `src/components/ui/ActionButton.tsx` is the only module allowed to paint it, so "one accent per
  screen" is still a question about imports. Navigation never touches it; a destination is not a
  call to action.
- **Two session colours, and nothing else touches a bar.** `Session.easy` `#4DB58C` (easy,
  recovery, long run) and `Session.hard` `#E0864E` (steady, tempo, intervals) — applied to bars
  and tiles, never to text or chrome; `sessionToneFor(effort)` is the one place the five-level
  effort scale collapses onto them (steady is above easy on `EFFORT_ORDINAL`, so it is hard). Both
  clear 3:1 against base with room (7.65:1 / 7.08:1). The five-hue `Effort` ramp is retained for
  the places that still name all five levels (glossary, the effort chip, the paid-content teaser),
  with its `barHeight` still `0.4 + 0.15 × EFFORT_ORDINAL[level]`.
- **Contrast is enforced, not documented.** `src/constants/__tests__/theme.contrast.test.ts`
  recomputes every ratio from the hexes in `theme.ts` — both schemes, the accent, the session
  tones, the effort ramp — and asserts it against that token's floor (or, for `progress.disabled`,
  its ceiling). A last check counts the opaque tokens, so a new hex cannot be added without being
  given a floor. The one surface the tokens cannot reach — `app.json`'s native chrome (the
  `expo-splash-screen` background, both variants, and the Android `adaptiveIcon.backgroundColor`)
  — is pinned to `Colors.dark.surface.base` the same way by
  `src/constants/__tests__/app-config-colors.test.ts` (2026-09-16, issues #20/#49).
- **Type** — the sheet's three families, loaded in `_layout.tsx` and named in `FontFamily`:
  **Barlow Condensed** 500/600/700/800 for display and every numeral; **IBM Plex Mono** 400/500/700
  for tracked uppercase labels, units and day numerals; **IBM Plex Sans** 400–700 for body. Scale
  `tiny` 10 / `xxs` 11 / 13 / 15 / 17 / 20 / 24 / 32 / 44 / `numeral` 64 / `giant` 96 — the last
  two are the one counting number a hero carries. `Tracking.wide` (2.5) is the sheet's most
  tracked setting (KM / WEEK, PRESS TO CONTINUE).
- **Shape** — `Radius.bar` 5 (a session bar's top corners), `control` 8, `button` 12, `card` 14;
  buttons are 52pt tall (the sheet's 48–52).
- **Motion** — the build animations carry their own timings in `src/lib/buildMotion.ts` (ported
  from the approved pages: snap = 350 ms rise to 1.03 with one settle, ease-out arrivals,
  40–80 ms staggers, play once and hold, cue text only after the hold begins). `Motion.duration.standard`
  (250 ms) is the plan detail's push. Under reduced motion every build shows its end frame directly
  (`useBuildClock` starts the clock at its end).
- **The one drawing is the week strip.** Seven unnamed slots on a baseline, a bar per run in its
  session tone, a dash per rest day, `01 … 07` beneath — animated (`WeekStrip`), static
  (`StaticWeekStrip`), thumbnail (`MiniWeekStrip`), and the tiny header mark (`HeaderMark`) are the
  same drawing at four sizes, all reading `lib/weekStrip.ts`'s `StripWeek`. The heartbeat/pulse
  trace, the contour route line and the accordion's effort ribbon were all retired on 2026-09-14
  (spec §V22-06: "the heartbeat/pulse-trace and the graph are retired everywhere they appear");
  the Home tab's glyph is now the strip.
- **Interaction**: one `PressedOpacity` token (`0.7`) for every `Pressable`'s press-dim; distinct
  from `LockedOpacity` (`0.45`), the *resting* dim of a surface the runner cannot use.
- **React Navigation's own chrome is tokened too.** `src/constants/navigation-theme.ts` bridges the
  same `Colors` tokens into the `Theme` shape `expo-router` re-exports, so `ThemeProvider` never
  falls back to the library's stock palette (issue #27). `primary` maps to `text.primary`, not the
  accent.
- Accessibility rule, non-negotiable: an effort colour is never the only signal — always pair it
  with a text label (a bar carries its number and code; a row carries its name).
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
  **The aesthetic was replaced by Trailhead on 2026-09-01, by Instrument on 2026-09-03, and by
  Blueprint on 2026-09-14** (see "Current — visual direction"). The banned list still governs
  everything past the session gate. The build animations are the sanctioned motion (captain's
  2026-09-12 spec, pages approved 2026-09-13): each plays once, holds its end frame, and never
  loops — only the header mark may re-run, and only when its data changes.
- **Onboarding is a scroll-down read; its copy does not fade or rise on scroll, but each step's
  build piece plays once when the step scrolls into view** (2026-09-03, revised 2026-09-14 per
  spec §V22-02). The scroll is still the mechanic — there is no carousel and no "next" — and it is
  a plain, Reanimated-compatible `ScrollView`, so nothing is precluded later.
