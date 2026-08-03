# Change Log

Running history of behavior-changing work, newest first. Each entry is a dated `## YYYY-MM-DD`
heading followed by a bulleted list of what changed (and why, where it's not obvious). When you
make a behavior-changing commit, add a bullet under today's date — create a new heading at the
**top** of the file if there isn't one yet for today. Don't rewrite or delete past entries.

## 2026-08-03 — long-run share cap enforced on the golden 5K path (plan-accuracy s1, bug 2)

From the plan-accuracy scout's Bug 2: `clampLongRun()` had no production caller — the golden
12-week/5K/4-day path (`buildCanonicalFiveKWeek`) set long runs straight from the canonical curve,
breaching the intermediate 32% weekly-share cap on 6 of 9 loading weeks at a 27 km/week baseline
(up to 47.8% share at 20 km/week). Only the 35 km golden-fixture baseline was clean, which is the
only one the existing suites exercised.

- **Golden-path long runs now run through `clampLongRun()`** before they reach the plan. The
  weekly-share ceiling is measured against the week's *assembled* volume (which can run below the
  target — an easy run may not exceed 80% of the long run), so the clamp iterates to the fixed
  point rather than trusting a one-pass clamp against the target volume. All four ceilings (share,
  spike, absolute, time) now bind, with the R1c deload denominator and the runner's experience
  level wired through. The spike cap needs `previousLongestKm`, which `buildTemplatePlan` now
  tracks across weeks.
- **Golden-path quality-session distances are now volume-scaled.** Tempo/interval distances are
  scaled by the runner's declared `weeklyKm` via the same `scaleQualityDistanceKm()` the generic
  path uses — scaled by the plan-wide factor rather than the per-week volume, so the
  captain-validated 35 km fixture stays byte-identical (35/35 = 1) while sub-35 baselines shrink
  the tempo/interval floor that was forcing the long run above its curve value.
- Sweep of the fixed engine at 20/27/35/50 km/week: no loading week exceeds its level's share cap
  at any baseline (previously 6-9 of 9 breached everywhere except 35 km). Deload weeks stay
  compliant via R1c's last-loading-week denominator.
- The taper shape and `FIVE_K_WEEKLY_LOAD` (ruling R2) are untouched. Known tension — the fix
  shortens long runs on low-volume plans below the source library's 75-110 min intermediate
  guidance — is logged separately for the captain as
  `workout-v22-plan-accuracy-s1-decision-long-run-duration-vs-share-cap` and is not resolved here.

## 2026-08-03 — plan-generation engine lands (issue #3, with issues #22/#23)

- Added pure `src/lib/paceDerivation.ts`: Riegel equivalency, recent-performance-derived
  easy/tempo/interval bands, exact 10%/15% goal-realism boundaries, and the strictly-above-15%
  race-pace cap. Training paces remain independent of the declared goal.
- Added pure `src/lib/planTemplates.ts`: deterministic template/fallback generation, including the
  Ian-approved 12-week 5K golden plan (phase split, deloads, volume/long-run schedules, strides,
  quality-session caps, rep notation, paces, HR zones, and exact race-day structure). The engine
  also scales phase allocation, run-day count, and starting volume for non-golden inputs without
  adding a backend or dependency.
- Fixed issue #22 by changing `clampWeeklyVolume()` to take a named `lastLoadingWeekKm` input, so a
  deload week cannot accidentally become the growth reference. Added regression coverage for the
  golden post-deload weeks 5 and 9.
- Resolved issue #23 in generated output: week 8 is the approved 30 km and every week's
  `volumeKm` remains the exact sum of its sessions.
- Removed the Jest, TypeScript, and ESLint quarantine exclusions. The two red-first suites now run
  in the normal build; all 213 tests across 10 suites pass alongside typecheck and lint.
- Review fix: `buildGenericWeek()` now reconciles assembled workouts down to the clamped
  `targetKm` via `reconcileVolumeToTarget()`, since independently-floored pieces (a quality
  session's minimum, the long run's floor, `distributeDistance`'s 1 km/session floor) could each
  be individually reasonable yet stack past the clamp.
- Fixed a bug where the golden 12-week/5K/4-day path silently bypassed the mandatory 50+ 3-week
  deload cadence (`load-rules.md` Rule 1): `buildCanonicalFiveKWeek()` hardcoded deload weeks
  `4 || 8` and never received `deloadCadence`, so a 50+ runner on that exact path deloaded like a
  30-year-old while the generic path correctly produced `[3, 6, 9]` for the same input.
  `deloadCadence` now threads into `buildCanonicalFiveKWeek()` the same way it already reaches
  `buildGenericWeek()`, and deload weeks are computed as `weekNumber % deloadCadence === 0` (with
  the same `phase !== 'taper'` guard), mirroring the generic path exactly. Sub-50 cadence (weeks
  4, 8) is unchanged. Regression coverage in `planTemplates.golden.test.ts`.

## 2026-08-02 — the backend is Cloudflare, not Supabase; the spine is built and running locally

**Captain's decision: the backend moves to Cloudflare (D1 + Workers + better-auth).** Two reasons,
neither of them a technical verdict on Supabase — a Supabase project-slot constraint, and a
preference for a stack that stays genuinely free at this stage. Cloudflare also clears the bar that
ruled Firebase's free tier out: Workers can make outbound `fetch` calls, which `generate-plan` needs
to reach Anthropic.

**The relational design was not re-decided.** Same tables, same quota rules, same API shape as the
draft `docs/architecture.md` and `planning/03-engineering-requirements.md` already carried — ported
to SQLite, not reopened.

New: `workers/`, a separate npm project (so `wrangler`/`better-auth` never enter the Expo bundle;
`metro.config.js` was added to keep Metro out of its dependency tree, and the root
`tsconfig`/`eslint`/`jest` configs each exclude it).

- **Auth** — better-auth on D1, email/password, sessions via `Authorization: Bearer` (its
  `bearer()` plugin is mandatory, not polish: a React Native client has no browser cookie jar, and
  without it every route 403s a user who just signed in — caught by an end-to-end test, not by
  reasoning). Google OAuth is coded and gated behind credentials only the captain can create.
- **Schema** — `workers/migrations/`, applied locally. `0001` is better-auth's four tables,
  verified against its own schema builder; `0002` is `profiles`, `intake_responses`,
  `subscriptions`, `plans`.
- **Routes** — `generate-plan`, `quota-status`, `purchase-tier`, `delete-account`, plus
  `GET/PUT /api/intake` and `GET /api/plans[/:id]`. Those last three are new *routes* only because
  they were direct RLS-guarded client reads under Supabase and D1 has no client-facing API.
- **Shared logic** — `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts` are new, pure, and
  imported by both the app and the Worker, as `planning/03-engineering-requirements.md` demanded by
  name. 18 new jest tests; 75 vitest tests in `workers/`, run inside real `workerd` against real
  D1.

Behavioral consequences worth knowing:

- **No RLS.** SQLite has no policy system, so the Postgres design's last line of defence is gone.
  Authorization is enforced in `workers/src/lib/store.ts` — every statement binds a `userId` from
  the verified session — and by authenticating once ahead of dispatch. Tests pin both ends. The
  full list of Postgres constructs with no SQLite equivalent is in `docs/architecture.md` and at the
  top of `workers/migrations/0002_app_schema.sql`.
- **The atomic quota gate got simpler, legitimately.** Postgres needed a `SECURITY DEFINER` RPC
  holding `pg_advisory_xact_lock`; SQLite serializes writes and D1 funnels a database through one
  Durable Object, so one conditional `INSERT ... SELECT ... WHERE count < limit` is genuinely
  atomic. Eight concurrent reservations against a three-slot limit yield exactly three, asserted.
- **`subscriptions` stores `purchased_at`, not `period_start`/`period_end`.** Storing boundaries
  needs something to roll them over, contradicting the "computed at read time, no cron" rule stated
  next to them in the draft. The client contract is unchanged: `purchase-tier` still returns both,
  computed.
- **`generate-plan` returns `503 engine_unavailable` and consumes no quota.** All eleven pipeline
  steps are implemented and tested; two of them have no implementation to call yet — the
  deterministic skeleton (`src/lib/planTemplates.ts`, being built in parallel) and the Pro/Elite
  prompt. Both are bound to typed *unavailable* implementations rather than mocks, on purpose: the
  sibling repo `running-form-v2.3` shipped a mock as its production client (its issue #128) and
  served dead ends for weeks. Each is one binding in `workers/src/deps.ts`, which names them.
- **Nothing is deployed and no key is set.** `wrangler.toml`'s `database_id` is an obviously fake
  placeholder. `wrangler login`, `wrangler d1 create`, `wrangler secret put`, and `wrangler deploy`
  are the captain's to run — the exact analogue of `supabase login` / `supabase secrets set`.
  Everything above was verified against `wrangler dev`'s local emulation, offline, with no account.

`supabase/` and `src/lib/supabase.ts` are left in place, untouched and unused, and marked legacy in
the docs. Deleting them is a separate decision.

## 2026-07-12 — the last stale doc reference from issue #37, actually fixed this time

Found while cleaning up branches after the four-PR merge pass. **Issue #37's sweep was recorded as
complete, and one of its corrections had never landed.**

This file's own 2026-07-12 issue #37 entry claims *"Part 9's prerequisite table and checklist
updated: the three Google Fonts packages marked installed, `expo-font`'s stale 'zero font files
bundled' note corrected."* That correction was applied to **Part 9** — but the prerequisite table
and the "Already present" line actually live in **Part 11** of
`docs/design/mvp-blueprint.md`, and Part 11 was never touched. So the change log asserted a fix
that the document did not contain, which is the worst kind of doc rot: it defends itself against
being found.

Verified against reality (`package.json`), not against the claim:

- **`@expo-google-fonts/barlow-condensed`, `inter`, and `ibm-plex-mono` are installed** — three
  packages, present. Part 11's table still listed all three as things to install, marked `v1?
  **Yes**`. Removed from the table; a line now records that they landed in `145d7e0`.
- **`expo-font ~14.0.12` (**zero font files bundled**)** — false since `145d7e0`. The "Already
  present" line now names the three font packages, and says out loud what it used to claim, so the
  next person greping for the old string finds the correction rather than the error.

Re-checked and found genuinely **already correct**, so left alone: `expo-glass-effect` (absent from
`package.json`, and every doc reference already reads "removed"/"Done — `145d7e0`"), `expo-blur`
(never installed), and every `explore.tsx` reference (all past-tense records of its deletion —
`src/app/(tabs)/` holds only `_layout.tsx`, `glossary.tsx`, `index.tsx`).

The stale `worktree-issue37` branch that carried this fix on a pre-PR-#1 base was deleted rather
than merged: its base was old enough that merging it would have regressed newer doc content. The
one correction it still had that `main` lacked is the one applied above.

## 2026-07-12 — issue #32 polish batch: nine of eleven LOW findings fixed, two dispositioned not fixed (closes #32)

Frontend/code polish batch from the 2026-07-11 audits, triaged and closed in one pass. No coaching
rule touched. Applied to `src/components/plan/{WeekAccordion,PlanNameplate}.tsx`,
`src/constants/theme.ts`, `src/hooks/use-theme.ts`, `src/app/(tabs)/index.tsx`, `src/lib/notation.ts`,
`src/lib/fixtures/examplePlan.ts`, and `src/lib/__tests__/{examplePlan.fixture,theme.effort}.test.ts`
(the second is new). `docs/design/mvp-blueprint.md` Part 7 also corrected — see below.

- **Ribbon bars round top-only.** `WeekAccordion.tsx`'s `bar` style used a full `borderRadius`,
  making each bar look like it floats above the week's baseline rule instead of rising from it.
  Now `borderTopLeftRadius`/`borderTopRightRadius` only.
- **The ▴/▾ chevron is drawn, not typeset.** The Unicode triangle's weight rode on the body font's
  Android fallback, so it could render heavier or lighter than the rest of the UI depending on
  device. Replaced with a small bordered `View` rotated onto a point (fixed 1.5 stroke, not
  `hairlineWidth` — a glyph should carry the same weight on every device, unlike a hairline rule).
  The finding said to wait for "the tab icon set"; there is no icon set and none is planned — the
  tab bar is deliberately label + caliper tick (`mvp-blueprint.md` Part 8) — and adding an icon
  library would be a HIGH-tier dependency addition (`AGENTS.md`) for a cosmetic fix, so it was
  drawn instead.
- **`PlanNameplate.tsx`'s metadata line: one glyph, one job.** `·` was doing double duty as both
  the key→value binder (`TIER · PRO`) and the field separator, distinguishable only by how much
  whitespace surrounded it. Now a colon binds key to value and `·` (with its existing wide gutters)
  separates fields only. `·` keeps the separator role, not the binder role, because that's the
  sense the app already teaches the runner — `notation.ts` glosses `·` as the structure-string
  segment separator, and the Glossary tab prints that definition. The line now renders
  `TIER: PRO   ·   12 WEEKS TO RACE DAY: OCT 4, 2026` (or `TIER: FREE   ·   12-WEEK PLAN` for a
  duration goal). **`docs/design/mvp-blueprint.md` Part 7 corrected in the same pass — it was the
  origin of the ambiguity**: its own worked example, `TIER · PRO   GENERATED · 07.10.26`, used `·`
  for both jobs too. Rewritten to the shipped colon/middot split; the surrounding prose ("uppercase
  tokens separated by middots") fixed to name both roles explicitly.
- **`PressedOpacity` token added to `theme.ts`.** `index.tsx` and `WeekAccordion.tsx` each
  hardcoded the same `0.7` press-dim value independently; both now reference one token.
- **The effort scale is no longer duplicated between `theme.ts` and `planTypes.ts`.** `EffortLevel`,
  its render order (`EffortOrder`), and its intensity ordinal were each declared separately in both
  files — three places a reorder could silently desync. `theme.ts` now imports `EFFORT_LEVELS` and
  `EFFORT_ORDINAL` from `planTypes.ts` (the module the app and the future `generate-plan` edge
  function share) and derives `Effort[level].barHeight` as `0.4 + 0.15 × EFFORT_ORDINAL[level]` —
  reproducing `frontend-design-brief.md` Part 2's documented ramp (0.4 / 0.55 / 0.7 / 0.85 / 1)
  exactly, but as arithmetic instead of five hand-written numbers. `planTypes.ts` itself was **not**
  edited — it was already the source of truth, and stays it. New test file
  `src/lib/__tests__/theme.effort.test.ts` (3 tests) guards the derivation: the exact ramp, that the
  ordinals it assumes are dense `0…4`, and that `EffortOrder` is `EFFORT_LEVELS` by referential
  identity, not a re-typed copy.
- **Home's `SafeAreaView` no longer reserves the bottom edge.** `index.tsx` now passes
  `edges={['top', 'left', 'right']}`, matching `glossary.tsx` — the tab bar already owns that inset.
- **A false provenance comment in `notation.ts` corrected — no user-visible copy changed.** The
  comment claimed the Rest glossary entry's description was reused verbatim from `WorkoutRow.tsx`;
  it isn't verbatim, it elaborates that row's copy for a glossary context. Comment only.
- **`examplePlan.ts`'s `easyRun()` no longer infers its "+ Strides" label from the mere presence of
  a structure string.** Strides is now an explicit third parameter (`hasStrides`), so a structure
  string and its label can't silently disagree the way an inferred label could. Every call site
  updated; the fixture's emitted data is byte-identical. New regression test in
  `examplePlan.fixture.test.ts` asserts the converse of the existing "+ Strides implies a strides
  structure" test — that an `ER`-labelled day never carries an unlabelled strides structure —
  scoped to the `ER` family on purpose (`shakeoutRun`'s week-12 `SR + Strides` day is intentional,
  not a desync).
- **`BottomTabInset` documented as deliberately parked, not given a manufactured call site.** The
  finding was "zero call sites — use it or justify it"; the honest answer is the constant models a
  tab bar that *floats over* content, and no such tab bar exists. `src/app/(tabs)/_layout.tsx` sets
  no `position: 'absolute'` on `tabBarStyle`, so React Navigation lays the bar out in normal flow as
  a sibling below the screen container and applies the bottom safe-area inset itself — a tab
  screen's viewport already ends where the tab bar begins. Padding by `BottomTabInset` today would
  add trailing void, not clearance: exactly the "floating dead gap" `frontend-design-brief.md` Part
  8 warns against. **It becomes correct — and should be applied to every scrolling tab screen at
  once — only if `tabBarStyle` ever goes `position: 'absolute'`.** Caught in review: the first cut
  of this batch wired it into the Glossary's scroll padding, which silently grew Android's bottom
  gap from 48pt to 80pt for no benefit; that wiring was reverted before landing. `theme.ts`'s
  docblock now carries this full reasoning at the constant's definition.
- **Two findings dispositioned, not fixed — deliberately, not silently dropped:**
  - **The disclaimer finding is rejected.** It claimed `examplePlan.ts`'s Rule 10 disclaimer
    "hardcodes PACE as the app name" and should be templated. Ian already ruled the opposite on
    2026-07-12, in the same pass that named the app (PR #40, recorded above and in
    `mvp-progress.md`'s "Decided" table): the disclaimer keeps "PACE" because the family brand, not
    the individual app surface, is the entity providing coaching guidance. Not re-litigated here.
  - **The "Home title is a de-facto app name" finding was already stale by the time this pass
    opened it** — Home has read "Pace Blueprint" since PR #40, well before this batch started.
- **Test suite: 86 passed / 0 failed, up from 82** (`theme.effort.test.ts` new, 3 tests;
  `examplePlan.fixture.test.ts` +1). `typecheck` and `lint` both clean. No source file outside the
  list above was touched, and no coaching-reference file under `docs/reference/coaching/` changed.
## 2026-07-12 — navigation chrome now uses design tokens, not React Navigation's stock palette (closes #27)

Frontend-audit finding from 2026-07-11. `src/app/_layout.tsx` handed React Navigation's stock
`DefaultTheme`/`DarkTheme` straight to `ThemeProvider`. Those ship colors nobody in this codebase
chose (`rgb(242, 242, 242)` light background, `rgb(1, 1, 1)` dark, plus stock `card`/`text`/
`border`/`primary`) that the library uses to paint chrome the app never styles directly —
transition underlays, header defaults, and the reveal behind an in-progress back-swipe. Against
the chalk `#F7F7F4` canvas, a light-mode push could flash a visibly wrong gray: an untokened seam
in an otherwise token-only system.

- **New `src/constants/navigation-theme.ts`** — exports `NavigationLightTheme`,
  `NavigationDarkTheme`, and a `NavigationThemes: Record<ColorScheme, Theme>` lookup. Each spreads
  the stock theme (preserving React Navigation v7's `dark` flag and `fonts`) and overrides only
  `colors`, with every slot derived from `Colors` in `theme.ts` — never a re-typed hex: `background`
  → `surface.base`, `card` → `surface.raised`, `text` → `text.primary`, `border` → `hairline`,
  `primary` → `text.primary`, `notification` → `status.error`. `primary` is deliberately
  `text.primary`, **not** `Accent.hivis` — the design brief reserves hivis for the single
  forward-action per screen and explicitly bars it from nav/tab active states.
- **`src/app/_layout.tsx`** now feeds `NavigationThemes[theme.scheme]` to `ThemeProvider`, replacing
  the old branch between the stock `DarkTheme`/`DefaultTheme`.
- **`src/app/plan/[id].tsx`** drops the now-redundant `headerTintColor` (the nav theme's `text` slot
  already supplies it) and keeps its `headerStyle: { backgroundColor: theme.surface.base }`
  override — a deliberate seamless-header deviation from the nav theme's `card`
  (`surface.raised`), now with a comment explaining why so it doesn't get "cleaned up" as a
  leftover.
- **New test suite, `src/constants/__tests__/navigation-theme.test.ts`** (10 tests) — the first
  suite under `src/constants/`. Asserts every overridden slot derives from its `Colors` token, and
  separately, that the stock React Navigation literals (`rgb(242, 242, 242)`, `rgb(1, 1, 1)`) are
  absent — a regression guard against the module ever being "simplified" back to
  `export const NavigationLightTheme = DefaultTheme`.
- **Verified:** `npm run typecheck && npm run lint && npm test` all clean — 5 suites, 92 tests (up
  from 4 suites / 82 tests). The two quarantined plan-engine TDD suites
  (`planTemplates.golden.test.ts`, `paceDerivation.test.ts`) remain excluded per `jest.config.js` /
  issue #41 — unrelated to this change.
- Closes GitHub issue #27.
## 2026-07-12 — `FallbackNotice`'s quota-copy variant made explicit, not hardcoded (closes issue #30)

Bug fix, plus a same-session engineering ruling from Ian on how to close it. Frontend audit
finding: `FallbackNotice` always rendered the quota-exempt copy ("This attempt didn't use one of
your plans"), which is true only for the first 3 fallbacks in a period (R-B addendum,
`docs/reference/plan-generation.md:112-118`) — a 4th+ fallback keeps its already-reserved quota
slot and counts like any other plan, and the old copy would tell that user something false.

- **`src/components/plan/FallbackNotice.tsx` gains a required prop, `variant: 'exempt' |
  'counted'` (exported type `FallbackVariant`).** Both copy strings now live in the component,
  taken verbatim from the already-ruled copy block in `docs/design/frontend-design-brief.md`
  (lines 684-689) rather than newly written: `exempt` → "This attempt didn't use one of your
  plans."; `counted` → "This attempt used one of your plans, the same as any other." The shared
  lead sentence ("We tried twice to build your personalized plan…") and the card's visual
  treatment (raised surface, hairline border, never `status.error`/hivis, no CTA —
  `frontend-design-brief.md`'s "The `isFallback` treatment") are unchanged.
- **The prop is required, with no default — Ian's ruling, overriding the issue's own suggested
  fix.** The issue text proposed defaulting to `exempt`; Ian rejected that: a default is exactly
  what would let a bare `<FallbackNotice />` keep compiling while still making a false quota claim
  to a runner past the cap. Required means the Phase 4 integrator physically cannot wire the
  screen up without choosing which claim is true.
- **`src/app/plan/[id].tsx`, the one existing caller, now passes `variant="exempt"` explicitly**,
  with an inline comment explaining why it's hardcoded (see the next bullet).
- **Known limitation, filed as its own issue rather than half-fixed here: GitHub issue #45.** The
  client cannot currently derive the correct variant — `Plan.isFallback`
  (`src/lib/planTypes.ts:218`) is a bare boolean, and only the server knows which side of the
  3-per-period cap a given fallback landed on. `exempt` is correct for the Phase 1 fixture and the
  common case, wrong for anyone past the cap. Issue #45 asks `generate-plan` to return whether the
  fallback consumed quota (e.g. `quotaConsumed: boolean` alongside `isFallback`) so the plan
  screen can derive `variant` from it, rather than the client guessing. Deliberately not built now
  — it's an API/edge-function contract change (HIGH tier per `AGENTS.md`), and `generate-plan`
  itself doesn't exist yet (Phase 4).
## 2026-07-12 — Screen-reader gaps fixed: pace bands spoken as words, race day announced (closes #31)

Bug-fix pass closing GitHub issue #31 ("Screen-reader gaps"), the three findings from the
2026-07-11 accessibility audits, plus three further defects a code review caught while fixing
them. Code only — no coaching rule touched.

- **Finding 1 — pace bands now reach VoiceOver as words.** New `speakPace()` in
  `src/lib/notation.ts` renders a `Workout.pace` band as "4:41 to 4:54 per kilometer" instead of
  the visible "4:41–4:54/km", whose en dash and "/km" read unreliably through VoiceOver. Used only
  in the accessibility label (`composeWorkoutLabel`, see below); the visible readout still uses
  `formatPace` and is unchanged.
- **Finding 2 — race day is no longer announced as a generic interval.** `describeDays` in
  `src/components/plan/format.ts` now special-cases the canonical race-day label, so a collapsed
  week 12 announces "Day 7 race day" instead of "Day 7 interval" — previously a screen-reader user
  never heard that the week contained the race at all. (Race day is an ordinary `Workout` whose
  `effort` happens to be `'interval'`, the closest intensity bucket; only `label` distinguishes it.)
- **Finding 3 — `accessibilityRole="link"` added to Home's demo link, but this turned out to be
  redundant, not a fix — recorded honestly.** `src/app/(tabs)/index.tsx`'s demo `Pressable` sits
  inside `Link asChild`; expo-router's `useLinkToPathProps` already passes `role: 'link'` through,
  so the link already announced correctly and the audit's finding 3 was mistaken. The attribute
  was kept as an explicit, belt-and-braces annotation, not because it fixed a defect.
- **Code review then caught that finding 1's fix was only half applied.** `speakStructure` was
  leaving pace bands *embedded in the structure string itself* raw (e.g. `"WU 2 km · 8 × 600 m @
  4:22–4:30/km w/ 300 m jog"`), so a single flattened VoiceOver label spoke the same band correctly
  once (from `day.pace`) and as broken notation once (from `day.structure`) — every interval and
  race-pace session in the plan carries such a band. `expandStructureTokens` now applies the same
  en-dash/slash → "to"/"per kilometer" transform. Two existing tests in `notation.test.ts` that
  were pinning the broken output are corrected.
- **Issue #28 / PR #46 fixed a latent `:60` rollover bug in the m:ss formatter first, independently
  of this issue** — pre-existing in `formatPace` (`src/components/plan/format.ts`): it floored the
  minutes but independently rounded the seconds, so a non-integer pace could render a nonexistent
  `":60"` — e.g. 299.63 sec/km (a 3:30:43 marathon goal) produced `"4:60/km"` instead of
  `"5:00/km"`. Not reachable from today's integer-only fixture, but it would land live the day the
  pace-derivation engine (issue #3) starts producing non-integer paces. **This issue's contribution
  is de-duplication, not the fix itself.** Finding 1's new `speakPace` needed the same m:ss
  arithmetic, and giving it its own copy would have re-created a second, independently-drifting
  version of the bug #46 already fixed. Instead, the m:ss logic was collapsed into one shared
  `formatSecPerKm()` in `src/lib/notation.ts`, consumed by both `formatPace` (visible) and
  `speakPace` (spoken), so the two formatters cannot drift apart again.
- **`composeWorkoutLabel` moved from `WorkoutRow.tsx` into the React-free
  `src/components/plan/format.ts`** so the composed accessibility label is unit-testable without a
  renderer — the regression is now pinned at its real call site
  (`src/components/plan/__tests__/format.test.ts`, added by #46 and extended here with these
  cases), which it previously wasn't: swapping `speakPace`/`speakStructure`'s pace expansion back
  out would have left every existing test green.
- **Two small hardening changes alongside the above.** `RACE_DAY_LABEL` is now an exported constant
  in `src/lib/notation.ts` — an inlined `'Race Day'` literal would not fail to compile on a rename,
  it would just silently stop matching and re-hide the race. `notation.ts` now imports `planTypes`
  with a relative path, matching `loadRules.ts`'s existing convention and staying resolvable under
  Deno for the future edge function.
- **Test suite: 107 passed / 0 failed, up from 93** (still 5 suites — `format.test.ts` is now the
  union of both PRs' cases: #46's `formatPace` carry-boundary and `formatPlanDate` regressions,
  plus this issue's race-day `describeDays` and `composeWorkoutLabel` cases; `notation.test.ts`
  also extended). The two TDD suites for the still-unbuilt `planTemplates.ts`/`paceDerivation.ts`
  stay quarantined, unaffected. `typecheck`, `lint`, and `test` all clean.
- **Found while tracing the Link, not fixed here — filed as its own issue.** expo-router's `Link
  asChild` uses a Radix Slot whose `mergeProps` spreads `style` as an *object*, but Home's
  demo-link `Pressable` passes `style` as a *function* (`({ pressed }) => [...]`); spreading a
  function yields `{}`, so the demo link may be rendering with no border, no 48pt minimum tap
  target, and no pressed state. Derived from reading the source, not device-verified.

## 2026-07-12 — `formatSecPerKm` carry-boundary fix, first test suite under `src/components/` (closes #28)

Bug fix from the 2026-07-11 codebase audit's bug list.

- **The bug.** `src/components/plan/format.ts`'s `formatSecPerKm()` computed minutes and seconds
  independently — `Math.floor(totalSec / 60)` for minutes, `Math.round(totalSec % 60)` for
  seconds — so a fractional pace could round seconds up to 60 without carrying into the next
  minute: 359.6 s/km rendered as `"5:60/km"` instead of `"6:00/km"`.
- **The fix.** Round the total seconds once, then derive minutes and seconds from that
  already-rounded value, so the carry is structural rather than two independent roundings that
  can disagree.
- **Latent today, not yet triggered.** Every pace in the current fixture (`examplePlan.ts`) is an
  integer, so the bug never fired in a rendered plan. It was armed to fire the moment
  `paceDerivation.ts` or the AI generation path emits an unrounded pace band — i.e. it would have
  surfaced the instant the plan engine (step 3, `mvp-progress.md`) landed.
- **New `src/components/plan/__tests__/format.test.ts` (11 tests)** — the first test suite under
  `src/components/`. Covers `formatPace`, including both carry-boundary regression cases (359.4
  s/km → `"5:59/km"`, 359.6 s/km → `"6:00/km"`, and a range that crosses the boundary on only one
  end), plus `formatPlanDate` and `describeDays`.
- Verified clean: `typecheck`, `lint`, and **93 tests passing across 5 suites** (up from 82 across
  4).
- Closes GitHub issue #28.

## 2026-07-12 — integration pass: five PRs merged to `main`, `main` returned to green

Repo-state change, not a coaching or product decision. Merged every open PR into `main` in one
pass, resolving the conflicts between them (all five had added a `2026-07-12` entry to this file;
several also touched `docs/mvp-progress.md` and `example-plan-5k-pro.md`).

- **Merged, in order:** PR #42 (doc stale-reference sweep, closes #37), PR #38 (units ruled
  km-only, closes #36), PR #40 (app named Pace Blueprint, closes #35), PR #43 (Ian's issue #34
  coaching rulings, closes #34, #19, #29), PR #44 (goal-realism ruling, closes #33). Conflict
  resolution was a union in every case — no ruling was dropped. `example-plan-5k-pro.md`'s open-items
  list 4–7 is the clearest example: #43 resolved items 4, 6 and 7, #44 resolved item 5, and the
  merged file shows all four RESOLVED.
- **`main` is green again — the two orphaned TDD suites are QUARANTINED (issue #41).**
  `planTemplates.golden.test.ts` and `paceDerivation.test.ts` import `planTemplates.ts` /
  `paceDerivation.ts`, which don't exist; PR #2 merged the tests without their modules, leaving
  `main` failing `typecheck` (3 × TS2307), `lint` (2 × `import/no-unresolved`) and 2 of 6 test
  suites — so every branch cut from `main` inherited a red build and nobody could satisfy
  `CLAUDE.md`'s "clean typecheck && lint && test before every commit" gate. Both files are now
  excluded from `jest.config.js`, `tsconfig.json` and `eslint.config.js`, and carry a banner
  explaining why. **This is the alternative issue #41's own text offered** ("revert/quarantine the
  two orphaned test files so `main` is green again in the meantime") — chosen over building the
  engine, which is coaching work (issue #3) and must not be auto-generated. Un-quarantining them is
  now part of issue #3's done-when. Verified after the merge: `typecheck` clean, `lint` clean,
  **82/82 tests passing across 4 suites**.
- **Also fixed: `jest` and `eslint` were scanning `.claude/worktrees/`** — the local agent worktrees
  are full copies of the repo, so every suite was running once per worktree (32 suites, not 4).
  Both now ignore that path, and `.gitignore` excludes it so the gitlinks can't be committed.
- **Apple Developer Program work parked.** Ian doesn't hold the membership yet. GitHub issue #18
  (M6 release — `eas init`, TestFlight, store listing) was **permanently deleted** at his request
  and preserved verbatim in the new [`docs/apple-dev-blocked.md`](apple-dev-blocked.md); the Apple
  Sign-In bullet was carved out of issue #7, which stays open and workable (email/password, Google
  OAuth, session routing need nothing from Apple). That file also records what only *looks*
  Apple-gated (#20, #17, #15 — none of it is) and the leftovers from work that was attempted but
  not finished (#3, #22, #20, #41).

## 2026-07-12 — Goal-realism ruling: warn at 10%, cap at 15%

Coaching decision by Ian. Closes Open item 5 (`example-plan-5k-pro.md`) and GitHub issue #33, which
blocked `deriveRacePaceTarget()`. Full reasoning, worked cases, and the type contract:
`docs/superpowers/specs/2026-07-12-goal-realism-design.md`.

- **The question.** When a declared goal is implausibly faster than the runner's Riegel
  recent-equivalent time — the canonical case being a 25-minute 5K runner asking for a sub-3
  marathon — should the app warn, cap, or trust the goal? This was genuinely open, not merely
  undocumented: `COMPLETENESS.md` lists "goal unrealistic for current fitness" under **what the
  coaching library is missing**. There was no threshold anywhere in the source to port. **Both
  numbers below are Ian's own, and nothing but his ruling may change them.**
- **Why ruling 3 didn't already answer it.** Ruling 3 (2026-07-11) anchors race-pace (`RP`) sessions
  in the race-specific phase directly at goal pace, and was decided on the fixture runner, whose
  goal implies an 11.1% improvement — ambitious but real. It settles *when* a session converges to
  goal pace; it says nothing about a goal that is a fantasy. Meanwhile the 2026-07-10 R-A addendum's
  10% pace gate — the only thing that would have caught one — had been retired as stale. So **"trust
  the goal outright" was the de facto behavior**, leaving open exactly the failure mode
  `planning/03-engineering-requirements.md` names: an algorithm that takes the runner at their word
  and prescribes reps at a pace they cannot hold.
- **Ruled: two bands, warn then cap.** Riegel-equivalent the recent performance to the goal
  distance, then measure `impliedImprovementPct = (equivalentSec − goalTimeSec) / equivalentSec ×
  100`. **≤10% → `realistic`:** silent, `RP` anchors at the raw goal pace. **10–15% → `ambitious`:**
  warn, but `RP` *still* anchors at the raw goal pace — **ruling 3 holds even under a warning**.
  **>15% → `implausible`:** warn **and cap** the `RP` anchor at the recent-equivalent improved by
  exactly 15%. Boundaries are inclusive at the top of each band (10.0% is `realistic`, 15.0% is
  `ambitious`); the cap engages only strictly above 15%. **Thresholds are flat** — no scaling by
  age, experience, or plan length, because the source offers no per-week or per-age rate to port and
  inventing one is precisely what this project forbids.
- **Worked, both ways.** The fixture runner (22:30 5K recent → 20:00 goal, 11.1%) is `ambitious`,
  warned, **not capped** — `RP` still 4:00/km, i.e. ruling 3's week-11 prescription is untouched,
  which is the point. The canonical fantasy (25:00 5K → sub-3 marathon, 24.93%) is `implausible` and
  caps to a 3:23:49 anchor (4:50/km) instead of the 4:16/km the goal implies.
- **The 10% is a *different* 10% from R-A's.** R-A's 10% was a **pace gate** (which pace anchors the
  session). Ruling 3 killed that. This 10% is a **warning line** (whether we say anything). Same
  number, different job — do not read the R-A row in `mvp-progress.md`'s 2026-07-10 "Decided" table
  as live behavior; it is now marked superseded.
- **Blast radius is one number.** Training paces (easy/tempo/interval) remain **unconditionally**
  recent-derived at any goal size. A fantasy goal cannot corrupt everyday paces, which is why
  capping the `RP` anchor alone is a sufficient fix.
- **One function, two callers, so warning and cap cannot disagree.** A pure `assessGoalRealism()`
  is called by the client at **both** goal-entry points — the intake review screen *and* the
  configure modal, since goal time travels per-generation — so the runner is warned **before**
  burning a generation (on Free, 1 of 3). The engine calls the same function to cap the anchor and
  stamps the verdict onto the immutable plan (`Plan.goalRealism`), so the plan explains its own
  numbers. Advisory and non-blocking; it never gates the Generate button. This does not breach "no
  business rules in the client" — the client renders a pure computation and is never the authority,
  the same posture already taken with tier state.
- **Code landed:** `src/lib/planTypes.ts` gains `GoalRealism`, `GoalRealismAssessment`, and the
  additive optional `Plan.goalRealism`. `src/lib/__tests__/paceDerivation.test.ts` gains the ruling
  as real tests — the `it.todo` that stood in for this question is gone, the two existing
  `deriveRacePaceTarget()` tests are widened for the new return shape (`source` widens to
  `'goal' | 'capped'`), and the ruling-3 assertion (fixture runner anchors at 240 s/km from
  `source: 'goal'`) is deliberately preserved intact as a regression guard.
- **Not built yet: `src/lib/paceDerivation.ts` itself** (issue #3). This entry is the *contract*,
  not the engine. The test suite therefore stays red exactly as it already was — `typecheck`,
  `lint`, and `test` each fail only on `Cannot find module '../paceDerivation'` / `'../planTemplates'`,
  with 64 tests still passing. Unchanged before and after.
- **Two doc tensions found and recorded as known debt, deliberately not fixed here.** (1)
  `GeneratePlanRequest` has **no `goalTimeSec` field**, so the per-generation goal that
  `mvp-build-prompt.md:332` promises cannot reach the engine at all — the realism check depends on
  it; belongs to issue #9's `generate-plan` contract. (2) The configure-modal spec
  (`frontend-design-brief.md:564`) never mentions goal time, contradicting the same line and leaving
  the warning's second home unspecified; belongs to issue #13.

## 2026-07-12 — Ian's round-2 sign-off: the coaching queue for GitHub issue #34 is closed

Ian ruled on all eight items batched into issue #34 ("Decision (Ian): coaching sign-off queue for
rendered-plan review round 2") — every remaining open question from the 2026-07-11 review-and-refine
cycles, plus the two standalone bugs (#19, #29) filed against the same rendered plan. **Closes
issues #19, #29, and #34.** Applied to `src/lib/loadRules.ts`, `src/lib/fixtures/examplePlan.ts`,
`src/lib/__tests__/{loadRules,examplePlan.fixture,notation,planTemplates.golden}.test.ts`, and
`docs/reference/coaching/{load-rules,notation,workout-library,example-plan-5k-pro,00-README}.md`.

- **R1 — long-run share cap ladder raised and made monotonic. Closes issue #19. Corrected the same
  day by follow-up ruling R1c after a HIGH-severity code-review finding.** Per-level cap: beginner
  25% (unchanged), intermediate 32% (was 30%), advanced 35% (was 30%) — raised deliberately so
  intermediate's new 32% could never exceed advanced's. **This is an Ian-authorised override of
  the source library's 20–25% / 25–30% / 30% figures, not a port; do not "correct" it back toward
  the source.** Ian's initial wording for the deload side of this ruling said "deload weeks are
  exempt" from the cap. **A code review of this same change flagged that as a HIGH-severity hole:
  exempting the week removes the ceiling outright, and `Week.isDeload` is a field the AI model
  itself emits on paid tiers, so an exemption keyed to it would hand the model a switch that turns
  off its own safety cap — exactly what `CLAUDE.md` forbids ("a model must not be able to
  prescribe an unsafe week").** Ian issued a same-day follow-up ruling, R1c: **the cap is never
  removed for a deload week. It is measured against the last *loading* week's volume instead of
  the deload week's own (reduced) total** — a deload cuts the week's total while largely
  preserving the long run, so measuring the long run's share against that shrunken total measures
  the wrong thing; measure it against the right thing, not against nothing. A deload long run
  stays bound by every other ceiling exactly as before (spike cap, absolute single-run cap,
  3-hour time cap). **A week that claims to be a deload but is not actually 35–45% down off the
  last loading week is not treated as one — it's capped as an ordinary loading week**, which makes
  an unsubstantiated deload claim worthless to a model. `LONG_RUN_SHARE_CAP` and `clampLongRun()`
  in `src/lib/loadRules.ts` are updated so a deload week's long run is measured against the last
  loading week's volume rather than skipped outright, with tests covering that measurement and
  the still-enforced spike/absolute/time ceilings on deload weeks. With the new ladder and R1c's
  corrected measurement, the golden 5K plan now passes comfortably — issue #19's finding (9 of 11
  long runs over the old 30% cap) no longer applies: loading weeks top out at 31.7% (week 5,
  13/41 km); week 4's 8 km deload long run is 21.1% of week 3's 38 km (the last loading week), and
  week 8's 10 km deload long run is 20.8% of week 7's 48 km — both far under 32%. `load-rules.md`
  § "Long-run cap, by level" and `example-plan-5k-pro.md`'s "Three things to flag for Ian" item 2
  (the whole-kilometre rounding overage against the old cap) both rewritten accordingly — that
  overage no longer exists against the new 32% ceiling. **Cross-reference: R1c is conceptually the
  same correction as open issue #22** (`clampWeeklyVolume()` should compare a proposed week's
  total against the last loading week, not literally the previous week) — the two rules now agree
  "the last loading week" is the correct reference point across a deload boundary. Issue #22
  governs a different function (the weekly-volume increase cap) and remains open; it is not
  resolved by this ruling.
- **R2 — peak weekly volume 48 km APPROVED on its own merits, no longer awaiting Ian's eyes.**
  `weeklyLoad` stays `[34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28]` — no code or fixture change,
  just the doc's flagged-item status moving to resolved (`example-plan-5k-pro.md`).
- **R3 — Daniels' 10%-of-weekly-volume brake is PERMANENTLY advisory: never enforced, and never
  overrides the 5K quality-volume band's floor, not even for a low-volume runner. Resolves Open
  item 6.** Ian's reasoning: the physiological demand of a 5K doesn't shrink because the runner
  trains less. `workout-library.md` § "Session sizing by race distance" re-worded from "the
  original wording here was wrong, still an open question" to "settled, permanently advisory."
- **R4 — Rule 5's "Monitoring" tier is DROPPED from intake.** Only Immediate Stop and Reduce
  Volume are surfaced or actioned; Monitoring's triggers describe something noticed during or
  after a run, and V2.2 never observes a run, so a flag it can never monitor does nothing. The
  triggers stay in `injury-rules.md`/`load-rules.md` as documented source content, explicitly
  marked not-used-by-V2.2 — not deleted. **Closes the last row of `mvp-progress.md`'s "Blocked /
  awaiting a decision" table**, removed below.
- **R5 — the run-type abbreviation set is SIGNED OFF exactly as written.** `ER`, `RR`, `TR`, `INT`,
  `RP`, `LR`, `SR`, Strides always spelled out, Race Day never abbreviated — no longer "proposed."
  Ian was shown the `RP`-vs-`GP` layering wrinkle (a run-type label and a structure-string symbol
  for closely related ideas, e.g. week 11's `RP · 3 × 1600 m @ GP`) and approved the set anyway; it
  is not to be re-litigated. `notation.md` updated. Resolves Open item 4.
- **R6 — race-day structure string is now `WU 3 km · 5 km race · CD 2 km`. Closes issue #29.**
  Replaces `5 km warm-up/cool-down + 5 km race`, which broke the notation grammar (a spelled-out
  "warm-up/cool-down" and a `+` the glossary can't explain) and introduces no new
  `STRUCTURE_SHORTHAND` token — `WU`/`CD`/`·` already cover it. Same 10 km headline total.
  `raceDayWorkout()` in `src/lib/fixtures/examplePlan.ts` updated; new tests in
  `examplePlan.fixture.test.ts`, `notation.test.ts` (`speakStructure` screen-reader text), and
  `planTemplates.golden.test.ts` assert the exact string and the unchanged 10 km sum.
- **R7 — strides now fall on BOTH easy days of loading weeks 1, 2, 3, 5, 6, 7 (up from one day),
  moving further toward `workout-library.md`'s own 2–3×/week guidance. Resolves Open item 7.**
  Weeks 9 and 10 (one easy day each) keep their single strides day; week 11's taper is deliberately
  left alone (Day 1 stays strides-free, only Day 5 keeps its goal-pace strides); deloads 4 and 8
  stay strides-free. Volume-neutral — strides add no headline distance. `easyRun()` calls for Day 1
  of weeks 1, 2, 3, 5, 6, 7 in `src/lib/fixtures/examplePlan.ts` now also carry
  `'4 × 30 s Strides'`; `examplePlan.fixture.test.ts` and `planTemplates.golden.test.ts` rewritten
  from "every loading week gets exactly one stride day" to "weeks with two easy days get two,
  weeks with one easy day keep one." `workout-library.md` and `example-plan-5k-pro.md` updated.
- **R8 — week 9's 300 m recovery jog CONFIRMED**, not merely corrected. The library's 300–400 m
  menu for 600 m reps stands as written; the version of the plan Ian first scored used a 200 m jog,
  outside the menu, and the cycle-2 fix to 300 m was correct. Week 9 stays 45 km. No code or
  fixture change — the doc's "flagged, needs Ian" framing in `example-plan-5k-pro.md` moves to
  "confirmed."
- **Test suite: 82 passed / 0 failed, up from 64 at baseline** (`loadRules.test.ts` extended for
  R1c's last-loading-week deload measurement; `examplePlan.fixture.test.ts`, `notation.test.ts`,
  and `planTemplates.golden.test.ts` extended/rewritten for R6 and R7). **`npm run typecheck` and
  `npm run lint` still report errors, and two suites (`planTemplates.golden.test.ts`,
  `paceDerivation.test.ts`) still fail to *compile*** — both entirely because
  `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts` don't exist yet. These are red-by-design
  TDD suites; they failed identically on clean `origin/main` before this change, and this change
  introduces no new failure. The repo cannot currently satisfy `CLAUDE.md`'s own "clean typecheck
  && lint && test before every commit" rule — tracked honestly as debt in `mvp-progress.md`, not
  hidden.
- **What this unblocks, not just what it closes:** `src/lib/planTemplates.ts` is still unbuilt and
  still the critical path (step 3 in `mvp-progress.md`'s "Next" list). Issue #19's cap conflict was
  the HIGH-severity blocker in its way — the engine could not have reproduced the golden fixture's
  own long-run numbers under the old 30% cap. Every coaching question the engine needed answered
  before it could be built for real is now answered. **Issues #22** (`clampWeeklyVolume` comparing
  against the literal previous week instead of the last loading week) **and #33** (goal-realism
  handling — Open item 5) **remain open** — neither was part of issue #34's queue and neither is
  touched by this pass.
- Constraints respected: HR-zone tables, the Day 1…Day 7 model, and running-only scope are all
  untouched. Only the eight items above changed.

## 2026-07-12 — Units ruling: km, permanently (closes issue #36)

- **Ian ruled: V2.2 speaks kilometres, everywhere, permanently. No unit toggle; units are never
  user-selectable.** Intake asks weekly volume in km; plans render distances in km and paces in
  sec/km. Imperial is **out of scope**, not deferred. Recorded as a standing product rule in
  `planning/02-product-requirements.md`, next to the intake-fields section.
- **Why:** the coaching source of truth (`docs/reference/coaching/source/`) is 100% km — 314 km
  mentions, zero miles. The shipped code was already km-canonical (`Pace`'s
  `{lowSecPerKm, highSecPerKm}`, plus `volumeKm`, `distanceKm`, `MAX_WEEKLY_KM`,
  `MAX_SINGLE_RUN_KM`, `RACE_DISTANCE_KM` in `src/lib/planTypes.ts` / `src/lib/loadRules.ts`).
  A unit toggle could never be display-only: `Workout.structure` and `Workout.effortDescription`
  are free prose with the unit baked into the string, and plans are immutable once generated, so
  switching units would require choosing before generation and regenerating on a change of mind —
  burning quota for a display preference. That cost is what makes km-only correct rather than a
  deferred nice-to-have.
- **This corrected the design brief, not the code.** `docs/design/frontend-design-brief.md` had
  drifted to a stale `/mi` pace format and "weekly mileage" phrasing in three places (the paid pace
  readout copy, the intake Q4 copy, and the large-text workout-row example); all three now read
  `/km` and "weekly volume." The code needed no change — it was already correct.

## 2026-07-12 — docs stale-reference sweep (closes #37)

Doc-only pass reconciling files that still described the Phase 1 plan-engine work and the
`145d7e0` theme rewrite as pending, even though both had landed. `docs/architecture.md`,
`docs/mvp-progress.md`, and `docs/design/mvp-blueprint.md` were already reconciled by an earlier
pass (commit `75b8aba`) and were left untouched.

- **`README.md`** — "What exists today" code block rewritten to the real `src/` tree: real plan UI
  under `src/app/(tabs)/` and `src/app/plan/[id].tsx`, `src/components/plan/`, and `src/lib/`
  (`loadRules.ts`, `notation.ts`, `planTypes.ts`, `supabase.ts`, `fixtures/examplePlan.ts` —
  deliberately *not* listing `planTemplates.ts` or `paceDerivation.ts`, which don't exist yet even
  though their tests do). The "Planned layout" block no longer lists `(tabs)/index`, `plan/[id]`,
  `planTypes.ts`, or `supabase.ts` as unbuilt; auth, intake, paywall, settings, `(tabs)/plans`,
  `planTemplates.ts`, `subscription.ts`, and `generate-plan` stay listed as planned.
- **`docs/mvp-build-prompt.md`** — Ruling 18 (`expo-glass-effect` removal) and the Phase 1
  `design-system` task bullet (theme rewrite, font bundling, glass-effect removal, stock-template
  deletion) both annotated as landed in `145d7e0`, without deleting the historical instruction
  text or renumbering the ruling list.
- **`docs/design/frontend-design-brief.md`** — open-question item 5 (`expo-glass-effect`) marked
  RESOLVED 2026-07-10 (Ruling 18, `145d7e0`), matching item 6's existing RESOLVED convention. The
  now-moot `Spacing.six`-migration blockquote removed (its two call sites lived in `explore.tsx`
  and died with it), keeping the design rationale for the 48 spacing step directly above it. Part
  9's prerequisite table and checklist updated: the three Google Fonts packages marked installed,
  `expo-font`'s stale "zero font files bundled" note corrected, `expo-glass-effect` marked removed
  rather than "consider removing," and the "required before build" checklist rewritten past tense
  as done (`145d7e0`).
- **`docs/reference/coaching/example-plan-5k-pro.md`** — the "Cycle-2 note" on
  `paceDerivation.test.ts` rewritten in past tense: the resync to ruling 3's goal-pace convergence
  landed (verified against the live test file — `deriveRacePaceTarget` now asserts
  `{ pace: { lowSecPerKm: 240, highSecPerKm: 240 }, source: 'goal' }` for the fixture runner, and
  the old >10%-goal-improvement gate is gone). Open item 5's stale "still applies it" / "being
  resynced this cycle" clauses fixed to past tense; the actual open question — whether to warn,
  cap, or trust an implausibly fast declared goal — is untouched and still needs Ian's ruling.
- Closes GitHub issue #37.

## 2026-07-12 — app name decided: Pace Blueprint (closes GitHub issue 35)

- **Ian closed the last open naming decision.** The app is named **Pace Blueprint** — a
  PACE-family sibling to V2.3 "Pace AnalysisAI" (`com.ian.paceanalysisai`). Chosen over "Pace
  Blocks," "Pace Plans," and "Pace Builder." Rationale: a blueprint is a precise document you
  build from and don't edit, matching this app's immutable plans (2026-07-10 decision); the name
  carries no AI hype, matching the "Instrument & Matter" aesthetic ruling (data is the decoration,
  glow is banned).
- **Identifiers renamed in the same pass, not deferred to M6.** `app.json` `expo.name` →
  `Pace Blueprint`, `expo.slug` → `pace-blueprint`, `expo.scheme` → `paceblueprint`,
  `expo.ios.bundleIdentifier` → `com.ian.paceblueprint`, `expo.android.package` →
  `com.ian.paceblueprint` (newly added); `package.json` name → `pace-blueprint`; Home title in
  `src/app/(tabs)/index.tsx` → "Pace Blueprint." `package-lock.json` regenerated to match.
  `typecheck && lint && test` all pass (22 tests).
- **Why the identifiers landed now, not at M6 — revises the issue's own premise.** The issue said
  the name was "needed by M6, not before." True of the *art* (icon, wordmark, splash, store
  listing), not of the *identifiers*. `scheme` and the bundle ID are load-bearing for Supabase
  OAuth redirects and Apple/Google sign-in callbacks. Auth doesn't exist yet, EAS isn't linked (no
  `eas.json`, no `projectId`), and the scheme had zero references anywhere in code — so the rename
  cost one edit today, versus reconfiguring the Supabase redirect allowlist and the Google/Apple
  OAuth consoles if done after auth ships.
- **Rule 10 disclaimer wording stays exactly as written.** Ian ruled the legally-required
  disclaimer keeps the word "PACE" — the family brand is the entity providing coaching guidance,
  and Pace Blueprint is one surface of it. `docs/reference/coaching/**` was **not** touched. The
  issue's claim that the fixture disclaimer was "fossilizing a placeholder" was mistaken.
- **Docs synced**: `docs/mvp-progress.md` (App name moved out of "Blocked" into a new
  "Decided (2026-07-12)" section; a new 🟡 debt item records that the app art and `app.json`'s
  stock Expo colors — `#208AEF` splash background, `#E6F4FE` Android adaptive-icon background —
  are now unblocked but still stock, and clash with the Instrument & Matter tokens from commit
  `145d7e0`), `CLAUDE.md` ("What this is" now names the app), `planning/02-product-requirements.md`
  (status line no longer says "Working name TBD"), and `planning/README.md` ("Pick the app name"
  removed from "Still open before coding").

## 2026-07-11 (cycle 3) — AGENTS.md rewritten as a 3-tier Subagent Usage Policy

Process/tooling decision, not a coaching or code change — logged because it changes how every
future session routes work in this repo.

- **`AGENTS.md`'s old size-based "Routing rules" (small/big) replaced with Ian's 3-tier severity
  policy**: LOW (single file, no schema/API change, easily reversible — proceed directly or with
  at most one subagent), MEDIUM (multi-file, new features, refactors touching shared code —
  minimum planning → implementation → testing → `doc-writer` if user-facing), HIGH/CRITICAL
  (schema/migrations, auth/security, production config, cross-service, or anything the user flags
  risky — full chain ending in branch + PR via `github-ops`, never a direct commit). The old
  "always big" list (auth, RLS, schema, payments, secrets/env, edge functions, plan generation,
  adding a dependency) folds into the HIGH tier definition unchanged. Skipping a required step for
  a tier is disallowed unless the user overrides it in the same message; the old "unsure → treat
  as big" rule becomes "unsure → default to the higher tier," with `task-router` kept as an
  optional escalation path.
- **New § "Subagent selection — category lookup" table** maps severity → category (planning,
  implementation by domain, testing, review/security, docs, QA/verification) → specific subagent,
  so routing is a lookup rather than a guess. Grounded directly against the 70 real subagent
  definitions at `~/.claude/agents/*.md` (name + description read for every file first) — no
  subagent name in the new policy is invented; the pre-existing "Full roster (70)" section
  cross-checks cleanly against it.
- **"Task → chain" table kept, given a `Tier` column**, and every row's chain brought in line with
  its tier's minimum requirements (e.g. the DB-schema, auth, edge-function, `generate-plan`,
  env/secrets, Expo-SDK-bump, and TestFlight-ship rows all gained the `doc-writer` → `github-ops`
  (branch + PR) tail HIGH now requires; a new "Add any new npm dependency" row was added since the
  old table never gave dependency additions their own line despite always being in the "always
  big" list).
- **Carried forward unchanged, under a new § "Standing rules"**: parallel dispatch only when tasks
  share no files; read-only agents report/never fix (with all seven existing pairings); all
  git/GitHub actions via `github-ops`; `verifier` = `npm run typecheck && npm run lint && npm
  test`, required before every commit at every tier.
- **`CLAUDE.md` checked, left untouched.** Its Git etiquette section ("branch when a change is
  multi-file, touches auth/payments/RLS/edge functions, or is worth a review pass") is coarser than
  the new HIGH tier but not contradicted by it — HIGH is a subset of that existing rule, and this
  predates the rewrite rather than being introduced by it. Flagged, not fixed, since fixing it
  wasn't this pass's scope: CLAUDE.md's "multi-file" branching trigger and the new policy's
  MEDIUM tier (which doesn't itself mandate branch + PR) can disagree on an ordinary multi-file
  feature — worth Ian's eye in a future pass.
- **`Full roster (70)`, `V2.2 guardrails agents must respect`, and the file's intro/`Expo HAS
  CHANGED` sections are untouched** — none referenced the old small/big language.

## 2026-07-11 (cycle 2) — review-and-refine: doc-side corrections to the 3/10-review rebuild

A code-review pass over cycle 1's rebuild (same day, entry below) found five internal
contradictions in the doc set plus one coverage gap worth closing while everything was already
open. This entry is the doc-side fix; code/tests are a separate, parallel pass this same cycle
(`src/lib/notation.ts`'s `STRUCTURE_SHORTHAND` gaining `·`, an accessibility fix to the structure
readout, and the `paceDerivation.test.ts` resync noted below).

- **Recovery-menu alignment: week 9's interval jog was outside `workout-library.md`'s own
  recovery menu.** The menu prescribes a 300–400 m jog after 600 m reps (40–67% of rep distance);
  week 9's `8 × 600 m` session used a 200 m jog (33%), contradicting it. Fixed to `w/ 300 m jog`.
  Ripple, all re-verified: week 9's headline INT distance 10 → **11 km** (WU 2 + 4.8 quality +
  2.1 jog + CD 2 = 10.9, rounded); week 9 total **44 → 45 km** (11 ER + 9 TR + 11 INT + 14 LR);
  volume-table note −8.3% → **−6.3%** vs week 7; week 10's note +9.1% → **+6.7%** (48 off 45);
  long-run share 14/45 = 31.1%, still inside the documented under-1-km-over-30% tolerance; the
  easy-run ≤ 80%-of-long-run check (11 ≤ 11.2) still holds. Marked in `example-plan-5k-pro.md` as
  a cycle-2 correction, with the alternative (widening the menu to ~33–67% instead) noted for Ian
  if he prefers the original 200 m jog.
- **Daniels 10%-of-weekly-volume brake was mis-scoped as an enforced rule.**
  `workout-library.md` had listed it as "used by this app" with "the smaller number wins" — but
  the app's own golden plan violates it in every quality week (10% of this plan's 34–48 km weeks
  is 3.4–4.8 km, under the 4.0–5.0 km band this app enforces). Re-scoped to advisory context from
  a different methodology, not an enforced constraint; the false "smaller number wins" line is
  removed. Whether it should ever override the band's floor for a genuinely low-volume runner is
  now an explicit open question (`example-plan-5k-pro.md` Open item 6), not a resolved rule.
- **"Reps are prescribed as distance × count" was backwards everywhere it appeared** — the
  grammar table and every emitted string are `count × distance` (`"8 × 600 m"`, count first).
  Fixed in `notation.md`, `example-plan-5k-pro.md` (the header bullet and § Session sizing), and
  this file's own cycle-1 entry below (ruling-2 bullet).
- **`notation.md`'s canonical structure-string example anchored an `INT` session `@ GP`**,
  contradicting ruling 3 (only race-specific-phase `RP` sessions anchor to goal pace; `INT`
  anchors to current fitness). Replaced with two worked examples — an `INT` session at a literal
  current-fitness pace band, and a separate `RP` session `@ GP` — so the doc no longer implies
  goal-pace anchoring for ordinary intervals. The `INT` example's recovery jog was also updated
  200 m → 300 m for the same reason as the week-9 fix above.
- **Tempo-band phrasing drifted between docs.** `example-plan-5k-pro.md` § Session sizing said
  "20–30 minutes" where `workout-library.md`'s own rule is 15–30; harmonized — the band is
  15–30 minutes, this plan's sessions sit in the 20–30 minute upper region, now stated that way in
  both places. Also reworded `workout-library.md`'s "bounded well under 10 km" to **"≤ 10 km"**,
  since week 10's tempo session is exactly 10 km — "well under" was false on the doc's own numbers.
- **Strides extended to one easy day per loading week** (weeks 1, 2, 3, 5, 6, 7, 9, 10, 11 — up
  from weeks 1–2 and 12 only), sourced from the 2026-07-11 market-research report's finding that
  strides are standard weekly maintenance in the McMillan/Runna/RunnersConnect convention and the
  ported library's own "optional 4–6 × 20 sec strides at the end" clause (`workout-library.md` §
  Session 1). Deload weeks 4 and 8 stay strides-free by choice, not rule — the library permits
  deload strides for "speedster" types; the alternative is noted, not adopted. No headline-distance
  arithmetic changes anywhere; flagged for Ian's sign-off (`example-plan-5k-pro.md` Open item 7),
  same status as the still-pending abbreviation-set sign-off (Open item 4).
- **`paceDerivation.test.ts` resync flagged, not yet landed.** That test's `deriveRacePaceTarget`
  section still encodes the 2026-07-10 R-A addendum's >10%-goal-improvement gate, which for this
  runner (11.1% implied improvement) pins the race-pace target flat at 270 s/km — contradicting
  ruling 3's week-11 goal-pace prescription (240 s/km / 4:00/km) in the golden plan. A test agent
  is resyncing that test to ruling 3 this same cycle; documented in `example-plan-5k-pro.md`'s
  "Pace bands" section as a cycle-2 note so the golden plan isn't read as contradicting a test that
  hasn't caught up yet. The gate also surfaced a genuinely open question ruling 3 doesn't answer —
  new Open item 5, "goal-realism handling": when a declared goal is implausibly faster than the
  runner's recent-equivalent performance, should the app warn, cap, or trust the goal? Not decided
  here.
- **Tracker sync.** `docs/mvp-progress.md` corrected: the fixture rebuild, `notation.ts`, the
  glossary tab, and the passing test suite are moved from "not done" to done (they already existed
  in the working tree, just weren't reflected); the stale "Aanya's baby" / `src/app/index.tsx:38`
  debt entry is removed (`src/app/index.tsx` was renamed to `src/app/(tabs)/index.tsx` and
  rewritten in the theme commit; `explore.tsx` no longer exists).
- **Correction, doc-audit pass, same day: the "paceDerivation.test.ts resync flagged, not yet
  landed" bullet above was wrong by the time this pass checked the actual files.**
  `src/lib/__tests__/paceDerivation.test.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`,
  and `src/lib/fixtures/examplePlan.ts` all already assert cycle-2's numbers: week 9 at 45 km with
  a 300 m interval jog, and `paceDerivation.test.ts`'s `deriveRacePaceTarget` section already
  replaces the stale >10%-goal-improvement gate with a test asserting ruling 3's goal-pace
  convergence (240 s/km), plus an `it.todo` naming the still-open goal-realism question (Open item
  5) rather than inventing an answer to it. None of the three files needed further resyncing.
  `docs/mvp-progress.md`'s "In flight," "Next" step 3, and "Known debt" sections repeated this same
  now-corrected claim and are fixed in this pass too. `planTemplates.ts` and `paceDerivation.ts`
  themselves genuinely don't exist yet — that part of the original claim stands.
- Constraints respected: HR-zone tables, `load-rules.md` and `injury-rules.md`'s numeric rules,
  the Day 1…Day 7 model, and running-only scope are all untouched. `training-zones.md`,
  `load-rules.md`, `injury-rules.md`, and `planning/` were not opened for this pass.

## 2026-07-11 — Ian's 3/10 review: session-sizing correction, notation system, pace-anchor supersession

Ian reviewed the rendered 5K plan and scored it **3/10**, naming one concrete defect: the tempo
session grew 9 → 10 → 11 → 12 → 12 → 14 km across the plan to absorb rising weekly volume,
producing a 14 km tempo run at 4:30 pace inside a 5K plan — *"makes no sense."* Five rulings
followed. A market-research pass on published 5K plans (Higdon, McMillan, Daniels, Pfitzinger,
RunnersConnect, Runna, Nike Run Club) was run first to check the fix against real coaching
practice rather than inventing one; findings are cited inline in the docs below (report:
[`docs/reference/market-research-5k-plans.md`](reference/market-research-5k-plans.md), preserved
into the repo at the end of the session since the coaching docs cite it as a source).

- **Ruling 1 — quality-session sizing is keyed to race distance, never scaled with weekly
  volume.** Tempo and interval session size is now a fixed physiological band (5K: tempo 15–30 min
  sustained; interval quality volume 4.0–5.0 km off the McMillan rep menu), independent of the
  week's total volume — matches every source in the research pass, none of which scale a 5K
  session by weekly-mileage tier. Surplus volume goes to easy runs and the long run instead, inside
  the existing long-run share cap. New section: `docs/reference/coaching/workout-library.md` §
  "Session sizing by race distance," clearly marked as Ian's ruling + research-sourced, not a port.
- **Ruling 2 — reps are prescribed as count × distance**, never a bare distance or bare time
  (`"4 × 600 m"` style), with recovery and target pace stated. The source library only has
  time-based structures (`6 × 3 min`); the distance-rep menu (400/600/800/1000 m, McMillan's own
  four interchangeable designs) is adopted from the research pass under this ruling, added to
  `workout-library.md` § VO2 Max Intervals.
- **Ruling 3 — race-pace-rep anchoring converges from current fitness to goal pace, superseding
  part of the 2026-07-10 correction.** Ian: *"your goal is to run at your goal pace, might be
  slower in the beginning."* Early-plan interval sessions run at current-fitness interval pace;
  race-specific-phase race-pace-rep sessions run at goal pace directly. This is the McMillan
  position (Higdon and Runna also anchor to goal pace); Daniels forbids goal-pace anchoring
  outright and anchors to current fitness only — Ian is McMillan-certified and ruled for McMillan,
  with the early-plan moderation answering Daniels' overtraining concern. **This supersedes, not
  deletes, the 2026-07-10 correction that pinned week-11 race-pace reps flat at this runner's
  current pace (270 s/km) throughout** — recorded with the supersession explicit in
  `example-plan-5k-pro.md`'s "Open" section, not silently overwritten.
- **Ruling 4 — run-type labels are abbreviated, never spelled out, except Strides.** Ian's
  examples: `ER` (easy run), `TR` (tempo run). New canonical set, **marked "proposed... pending
  Ian's sign-off"**: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, composite `ER + Strides`,
  unabbreviated `Race Day`; in-structure shorthand `WU`/`CD`/`GP`/`w/`/`@`. New file:
  `docs/reference/coaching/notation.md` — the abbreviation table (written full-name-first, one
  line each, so it drops into the planned in-app abbreviations glossary tab unchanged), the
  structure-string grammar with worked examples, and the strides rule.
- **Ruling 5 — praised, unchanged.** The plan staying within the runner's weekly volume capability,
  and the HR zones. Neither `training-zones.md` nor `load-rules.md`'s numeric rules were touched.
- **Headline-number convention decided and documented (a deliberate divergence, flagged for Ian):**
  published plans headline quality *work only* and itemize warm-up/cool-down separately (research
  §5); this app's `Workout.distanceKm` is instead the **total** kilometres run that day (WU + work
  + CD + recovery jog), so each day sums cleanly into the week's volume the wave chart renders —
  the thing ruling 5 praised. The `structure` string still itemizes WU/work/CD so the true
  quality-work size is never hidden. Documented in `notation.md`.
- **`docs/reference/coaching/example-plan-5k-pro.md` rebuilt** under all five rulings: same runner,
  HR zones, phase names, deload architecture (weeks 4/8, ~40% off the last loading week), and 4-day
  Day 1/3/5/6 pattern; every tempo/interval/race-pace session resized to the fixed band above, with
  the arithmetic shown (sustained minutes × ~4:45–4:50/km, inside the derived 281–294 s/km tempo
  band); every day label abbreviated per `notation.md`.
  **Volume-table consequence, stated as a rule, not an accident: weekly volume is now the *sum* of
  correctly-sized sessions, not a target the sessions are stretched to fill.** The old 52–54 km
  peak weeks only existed because the tempo/interval sessions were inflated past their sizing band
  — the exact defect ruling 1 removes. With sessions right-sized, this runner's 4-day week cannot
  fill 52–54 km without breaking the long-run cap, so the new peak lands at **48 km** (weeks 7 and
  10, tied) instead. New volume table, week → km: 1→34, 2→35, 3→38, 4→23 (deload), 5→41, 6→45,
  7→48, 8→30 (deload), 9→44, 10→48, 11→40, 12→28. Two small consequences flagged for Ian in the doc
  itself: week 1 lands 1 km under the runner's declared 35 km/week baseline (the 80%-of-long-run
  cap on easy runs is the binding constraint), and every loading week's long run rounds 0.5–0.8 km
  over a strict 30%-of-volume reading once each day is a whole kilometre (mechanical rounding, not
  the cap being ignored — both inside the ±1 km tolerance this revision uses when the caps
  interact). The "Bug found while building this" `clampWeeklyVolume()` note stays, still unfixed in
  code (`planTemplates.ts` doesn't exist yet).
- **Pace bands section rewritten to reflect it's largely resolved, not open.** The doc's original
  "pace gap" (no tempo/easy pace formula anywhere in the source) was already closed by the
  2026-07-10 decision-13 Riegel-based method and is now implemented in the in-flight
  `paceDerivation.ts` module — the doc was still describing it as open. Updated to show this
  runner's actual derived bands (tempo 281–294 s/km, interval 262–270 s/km, easy 326–354 s/km) and
  to note the one genuinely still-open piece: no relative rule exists for steady/Zone 2 pace.
- **Cross-references added**, nothing else changed: `plan-structure.md` and `00-README.md` now
  point to `notation.md`. Swept `docs/` and `planning/` for the old inflated numbers and labels
  ("Tempo 14," "54 km," full-name day labels) — found none outside `example-plan-5k-pro.md` itself
  and the quotes of Ian's words added above; `docs/mvp-build-prompt.md`,
  `planning/02-product-requirements.md`, and `docs/reference/plan-generation.md` never restated
  specific session sizes, so nothing there needed a fix.
- Constraints respected: HR-zone tables, deload rules/cadence, `load-rules.md`'s numeric rules,
  injury rules, the Day 1…Day 7 model, and running-only scope are all untouched.
- **Correction, same day: this entry originally claimed "no code file was edited" — that was
  wrong even at the time of writing.** Cycle 1 also shipped `src/lib/notation.ts` (the
  `RUN_TYPE_ABBREVIATIONS` / `STRUCTURE_SHORTHAND` code counterpart of `notation.md`, with
  `expandLabel()` for screen-reader text), the abbreviations glossary tab
  (`src/app/(tabs)/glossary.tsx`), the rebuilt golden fixture (`src/lib/fixtures/examplePlan.ts`),
  and three test files (`notation.test.ts`, `examplePlan.fixture.test.ts`, plus the still-failing
  TDD suites `planTemplates.golden.test.ts` and `paceDerivation.test.ts`, which intentionally fail
  on missing modules — `planTemplates.ts` and `paceDerivation.ts` don't exist yet). 52 tests pass.
  `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts` themselves are still the next
  session's work, as the superseded sentence correctly said.
- **Second correction, doc-audit pass, same day: "52 tests pass" above was also wrong, even at the
  time of writing.** Summing the four passing suites' actual test counts (`supabase.test.ts` 3,
  `loadRules.test.ts` 19, `notation.test.ts` 13, `examplePlan.fixture.test.ts` 29) gives **64**,
  matching `npm test`'s live output (`Tests: 64 passed, 64 total`, `Test Suites: 2 failed, 4
  passed, 6 total`). `docs/mvp-progress.md`'s occurrences of the same figure are corrected to 64
  in this pass.

## 2026-07-10 (evening) — theme rewrite: "Instrument & Matter" tokens land in code

**Missing from this log until now — added in this doc-audit pass.** Commit `145d7e0` shipped
between Phase 0's decision gate (below) and Ian's 3/10 review above (the review's rendered plan
and the golden fixture's components already consume these tokens), but was never given its own
entry.

- **`src/constants/theme.ts` and `src/hooks/use-theme.ts` rewritten** from the stock Expo template
  palette to the full "Instrument & Matter" token system specified in
  `docs/design/frontend-design-brief.md` Part 2: `Colors` (light/dark bases, effort scale,
  `grid.*`), `Accent`, `FontFamily`/`FontSize`, `Spacing`, `Radius`, and `Motion`. Two contrast
  values the brief left unresolved were computed to the documented 4.5:1 floor rather than
  guessed: `text.secondary` dark `#7E8590` (4.83:1 on `#14171C`) and `progress.informative` light
  `#676D7B` (4.83:1 on `#F7F7F4`) / dark `#788696` (4.83:1 on `#14171C`).
- **Spacing ramp gains a step.** `48` inserted between the old `five` (32) and `six` (64); the old
  `six` is renamed `seven`. The only two call sites using the old name were in the now-deleted
  `explore.tsx`.
- **Bundled the three font families** (`@expo-google-fonts/barlow-condensed`, `-inter`,
  `-ibm-plex-mono`) via `npx expo install`; `src/app/_layout.tsx` now loads them with `useFonts`
  and keeps the native splash screen up until they resolve.
- **Removed `expo-glass-effect`** — banned by the no-blur depth rule (Phase 0 Ruling 18); this
  system has no sanctioned blur use. Resolves the corresponding 🟠 risk in
  `docs/mvp-progress.md`'s "Known debt," removed in this pass.
- **Deleted the stock Expo template surface**: `src/app/explore.tsx`, `animated-icon*`,
  `hint-row.tsx`, `web-badge.tsx`, `app-tabs*`, `themed-text.tsx`, `themed-view.tsx`,
  `external-link.tsx`, `ui/collapsible.tsx`, and `src/global.css`.
- **`src/app/index.tsx` → `src/app/(tabs)/index.tsx`, rewritten** as a token-only placeholder Home
  screen proving the font/token pipeline boots. The stock template's placeholder title `"Aanya's
  baby"` is gone.
- Verification before commit: `typecheck`, `lint`, 22/22 tests, and `npx expo export --platform
  web` all ran clean.

## 2026-07-10 (Phase 0) — audit rulings applied, decision gate closed

Doc-sync pass following `docs/mvp-build-prompt.md`'s Phase 0 (§0-B rulings, §0-C decision gate).
Full detail for each item lives in the file it changed; this entry is the index.

- **All 20 audit rulings in `docs/mvp-build-prompt.md` §0-B applied** across `CLAUDE.md`,
  `docs/architecture.md`, `docs/reference/plan-generation.md`, `docs/reference/coaching/`,
  `planning/02-` and `03-*.md`, `docs/design/frontend-design-brief.md`,
  `docs/design/mvp-blueprint.md`, `docs/mvp-progress.md`, and `src/lib/planTypes.ts` (comment
  only). See that file rather than restating all 20 here — nothing was re-litigated or softened.
- **Decision gate — 13 rulings, Ian, 2026-07-10:**
  1. **Paywall + Settings restored to MVP.** Minimal dummy paywall (M4 needs it — without it
     nobody reaches Pro/Elite) + settings-lite (sign out, tier display, restore), in the
     blueprint's reserved third tab slot.
  2. **Fallback plans do not burn quota.** `is_fallback` filter in both `generate-plan` and
     `quota-status`, capped at 3 quota-exempt fallbacks/period so free-text `notes` can't farm
     unlimited template plans; `notes` is length-limited and sanitized.
  3. **Goal-vs-recent pace threshold = 10%, gating race-pace session targets only (refined by
     addendum R-A below).** Training paces are **unconditionally** derived from the recent time —
     the goal never drives everyday paces, at any improvement size. The threshold decides only
     which pace the goal-pace *session itself* is prescribed at.
  4. **Free configure gating.** Free sees every option; out-of-tier selections render locked and
     route to the paywall on tap — never a dead disabled button.
  5. **"Next workout" card dropped** (Ian's override of the recommended current-week
     arithmetic). Home shows the plan link + quota state only; no current-week concept exists.
  6. **Red-flag injury protocol** renders as a conservative fixed-length plan whose weeks carry
     the protocol's phases, plus a pain-gated-progression `extras` section, plus Rule 10
     disclaimers — and does not consume quota.
  7. **Elite extras cut for MVP.** Elite = richest personalization prompt + per-workout "why"
     only; `Plan.extras` can carry confirmed extras later without a schema change.
  8. **"Experienced" keeps mapping to intermediate** — the safer, tighter-caps reading.
  9. **Intermediate deload cadence stays 4 weeks** (50+ still always forces 3).
  10. **Injuries intake field: closed-set `InjuryFlag` flags + optional free-text notes**
      (length-limited/sanitized); flags alone drive safety triage, notes inform paid prompts only.
  11. **Rule 10 disclaimers**: a static footer section on every plan view + one line in the
      generating modal's fine print.
  12. **Phone-only v1; iPad and desktop/computer support move to v2** (Ian: "phone only for
      phase 1, then ipad and computer in phase two"). App name stays open until M6; password
      minimum to be verified against the live Supabase project in Phase 2.
  13. **Pace-derivation method** (closes Ruling 2's re-check gap): cross-distance equivalency via
      the published Riegel formula (`T2 = T1 × (D2/D1)^1.06`); training paces anchored to the
      source's own relative rules (e.g. Zone 2 ≈ marathon pace to slightly faster; tempo = 30–60
      s/km faster than easy pace by level). Any remaining numeric gap goes back to Ian as a
      specific question — nothing invented.
- **Addenda, same day (Ian's follow-up rulings, sharpening decisions 3 and 2 above):**
  - **R-A — the 10% threshold gates race-pace session targets only.** If the goal implies ≤10%
    improvement over the recent-time equivalent (Riegel), goal-pace sessions use the raw goal
    pace; beyond 10%, goal-pace sessions are prescribed at the recent-time-equivalent pace
    instead. **Training paces are unconditionally recent-time-derived** — the `planTypes.ts`
    contract (`recentPerformance` drives every pace; `goalTimeSec` drives race-pace sessions
    only) stands exactly as coded; the goal never drives everyday paces, regardless of the
    threshold. This corrects decision 3's original wording, which read as if training paces
    themselves became goal-derived under the threshold.
  - **R-B — a 4th+ quota-exempt fallback in a period burns quota.** Decision 2's 3-per-period
    fallback exemption is a cap, not an unlimited allowance: once a user has 3 quota-exempt
    fallbacks in a period, the already-reserved slot for a 4th+ fallback is **kept, not
    released** — nobody is refused a plan, but that attempt counts against quota. The
    fallback-card copy must say so honestly when it applies (see
    `docs/design/frontend-design-brief.md`).
- **Ruling 19 done: `claude-sonnet-5` verified live** against the Anthropic Models API with the
  project's server-side key today — a real model ("Claude Sonnet 5," 1M input tokens, 128K max
  output). V1 runs `claude-sonnet-4-6`; this confirms the new string actually exists.
- **Ruling 2 re-check done: no source coaching rule was wrongly filtered out by the 8→10-field
  intake change.** Every rule marked NOT-ported in `docs/reference/coaching/00-README.md` needs
  logging, wearable, or sex data that the two new time fields don't supply. The one real gap the
  re-check found — no numeric race-time → training-pace method anywhere in the source — is closed
  by decision 13 above.

## 2026-07-10 (later still) — plan shape spec + build prompt

- **Plan shape spec added to `planning/02-product-requirements.md`.** "Fixed duration (8 / 12 /
  16 weeks)" is replaced by rules ported from `ECHO_Training_Plans_McMillan.md §
  Customization Guidelines`:
  - **Never refuse.** A race three weeks out gets an honest three-week plan (race-specific work,
    final week a taper) instead of being turned away.
  - **Plan length is keyed to race distance, not experience**: 5K 12–14 weeks, 10K 14–16, half
    16–20, marathon 24–30. Ultra is deferred to v2 — no source content exists for it.
  - **Maximum plan length is a tier feature**: Free 12 weeks, Pro 24, Elite 30+. Consequence
    stated plainly: Free can only reach a 5K plan; a 10K needs 14 weeks minimum.
  - **Days available shape the week** (`§ Weekly Availability`): under 3 days → a 3-run week
    (easy, tempo, long); 3–4 days → add steady/interval; 5–6 days → the full program.
  - **v2 section explains the ultra deferral**, naming both blockers: no source content exists
    (5K/10K/half/marathon only in the library — not ours to invent per `CLAUDE.md`'s coaching
    domain rule), and `load-rules.md` Rule 4's ceilings (110 km/week, 35 km longest run) cannot
    express an ultra distance even if content existed.
- Added `docs/reference/coaching/example-plan-5k-pro.md` — a hand-derived, fully worked 12-week
  5K Pro-tier plan tracing every number to a source rule or intake arithmetic; it doubles as the
  golden fixture `src/lib/planTemplates.ts` must reproduce.
- Added `docs/mvp-build-prompt.md` — the audited, multi-session build prompt (three-lens audit:
  spec consistency, design blueprint, live DB state) the MVP build will follow phase by phase.

## 2026-07-10 — Coaching domain decisions

- **Intake grows to 8 fields**: `age` added. Not cosmetic — max HR is estimated `220 − age`, so no
  HR zone is computable without it, and the load rules make a 3-week deload mandatory for 50+.
  Updated `planning/02`, `planning/03`, `docs/architecture.md`, and both design docs (intake is now
  8 questions + review; the a11y progressbar name is "Question 3 of 8").
- **Plans are running-only.** Prehab strength, cross-training, and mobility sessions are dropped
  from Echo's McMillan plans. Consequence recorded: the engine's only levers against a declared
  injury are volume and intensity.
- **Days are unnamed** (Day 1 … Day 7, rest days as real slots). Confirms the length-7 `Week.days`
  array and leaves the seven-cell week ribbon unchanged.
- **Deload weeks reduce volume 20–30%.** Fixes an inconsistency where the 5K example plan labelled
  Week 4 a deload while its volume rose (~17–19 km → ~18–19 km). `load_rules.md` is authoritative.
- **Safety logic belongs in typed code, not prompts** — added to `CLAUDE.md`. The template engine and
  the AI-output clamp share one deterministic implementation of the load and injury rules.
- **Ported the coaching library** into `docs/reference/coaching/` (`00-README.md`, `load-rules.md`,
  `training-zones.md`, `workout-library.md`, `injury-rules.md`, `plan-structure.md`), rebranded
  ECHO → PACE, filtered to what a one-time intake (no logging, no wearables) can actually drive.
  Six evidence-driven corrections applied while porting: the 10–15% weekly cap is now labeled
  "coaching convention" not "verified" (a); a new long-run spike cap (b) and long-run time cap (c)
  were added, since V2.2 generates every week and can enforce both deterministically; cadence is
  now a qualitative cue only, no absolute SPM targets (d); the "polarized" intensity label is
  corrected to "pyramidal" (e); stress-fracture return timelines are de-keyed from
  experience/age and made symptom-gated instead (f). Full reasoning and citations in
  `docs/reference/coaching/00-README.md`.
- Updated `docs/reference/plan-generation.md` to point at the new coaching library and note that
  all three tiers share the same deterministic load/injury rules — Elite clamps Claude's output
  against them post-generation since it has no template skeleton.
  **⚠️ Superseded later the same day — see "Elite is not unconstrained" below: Elite does use the
  template skeleton, it just customizes it far more heavily.**
- Added the long-run spike cap to the `generate-plan` edge function's responsibilities in
  `planning/03-engineering-requirements.md`.
- **Elite is not unconstrained — corrects the entry above.** All three tiers build on the same
  coach-authored template skeleton; it is never removed. Free selects + lightly parametrizes it (no
  AI call, effort descriptions only). Pro's Claude personalizes workouts, paces, HR zones, and a
  weekly "why" within it. Elite's Claude customizes the same skeleton far more heavily (richest
  prompt: injury history, periodization nuance, race context; a per-workout "why"; any confirmed
  extras) — still inside the skeleton. The deterministic load-rule clamp applies **identically to
  all three tiers**, not just Elite. Rationale: Runna's publicly reported injury cases trace to an
  algorithm that "takes the runner at their word," and Düking et al. 2024 found LLM-generated plans
  were not rated optimal by coaching experts without oversight — selling the top tier as the one
  with the guardrail removed would be backwards. Canonical wording lives in
  `planning/03-engineering-requirements.md`'s `generate-plan` section; propagated to
  `docs/architecture.md`, `docs/reference/plan-generation.md`, `docs/design/frontend-design-brief.md`,
  `docs/design/mvp-blueprint.md`, `planning/02-product-requirements.md`, and `README.md`.
- **HR zones belong to Pro *and* Elite, not Elite-only.** `planning/02-product-requirements.md` was
  always right (Pro gets HR zones); `docs/design/frontend-design-brief.md` and
  `docs/design/mvp-blueprint.md` had drifted and showed the HR zone as an Elite-only addition over
  Pro's pace-only row. Fixed the row anatomy in both design docs: Free shows a qualitative effort
  description with no readout bracket; Pro and Elite both show a bracketed mono pace range + HR
  zone; Elite's row is taller only because its "why" is longer and per-workout, not because it
  measures more.
- **Merged `docs/status.md` into `docs/mvp-progress.md`** (the living tracker), then deleted
  `docs/status.md`. All eleven open items moved into `mvp-progress.md`'s "Blocked / awaiting a
  decision" or "Known debt and risks" sections — nothing dropped. Fixed the resulting dangling
  `docs/status.md` links in `docs/architecture.md` and `docs/reference/plan-generation.md`.
  (`AGENTS.md` still references `docs/status.md` once — left untouched, since editing `AGENTS.md`
  was explicitly out of scope for this pass; needs a follow-up.)
- Marked the coaching-library port **done** in `mvp-progress.md` (moved from "In flight" to "Done"
  — six files under `docs/reference/coaching/`).
- Added the three open coaching-port gaps to `mvp-progress.md`'s "Blocked / awaiting a decision":
  the shape of the intake `injuries` field (free text vs. structured picker), whether Rule 5's
  "Monitoring" tier applies to a one-time pre-run intake at all, and where the mandatory
  disclaimers render in the UI.
- Flagged a new risk in `mvp-progress.md`: Ian's own `workout_library.md` worked deload examples
  reduce volume ~35–45% (three independent examples), exceeding the 20–30% band he made
  authoritative. Unresolved — the port currently enforces 20–30% regardless.

## 2026-07-10 (later) — first product code, and two decisions superseded

- **`src/lib/planTypes.ts`** — the shared plan vocabulary. Pure TypeScript, no runtime deps, imported
  by both the Expo app and the Deno edge functions. `Day = RestDay | Workout` (plans are running-only);
  `Week.days` is a length-7 tuple of unnamed days; rest is deliberately **not** an `EffortLevel`, which
  is what lets the ribbon render it as a gap.
- **`src/lib/loadRules.ts`** — the deterministic safety arithmetic, ported from
  `docs/reference/coaching/`. 19 unit tests. `clampLongRun()` applies four ceilings (weekly share,
  absolute single-run, spike, time) and reports which one bound. The time cap silently does not apply
  when no pace is known, rather than pretending to clamp.
- **The type system now enforces the design's honesty rule.** `pace` and `hrZone` are optional on
  `Workout`, so a Free plan — or any plan from a runner who gave no recent time — structurally cannot
  carry a measured numeral. The "readout bracket" can never render a lie.

### Superseded, same day

- **Deload weeks now reduce volume 35–45%, not 20–30%.** Ian's own three worked examples in
  `workout_library.md` (~40% / ~45% / ~35–40%) all sit outside the 20–30% band his Deload Trigger table
  states, and his "Exception — Recovery Weeks" clause already permits deeper cuts. The fact-check found
  no direct RCT evidence for any specific magnitude, so the coach's own practice is the tiebreak.
  Enforced as a band with a floor *and* a ceiling: `isValidDeload()` accepts `[0.35, 0.45]`.
  The earlier bullet in this file recording "20–30%" is **superseded**.
- **Intake grows from 8 fields to 10.** Added `goal_time_sec` (shown only when a target race is chosen)
  and `recent_perf_distance` / `recent_perf_time_sec` (optional). Goal time drives **race-pace sessions
  only**; the recent time drives **every other training pace**. Deriving easy or tempo pace from a goal
  the runner hasn't achieved would prescribe paces they cannot sustain — the exact failure behind
  Runna's reported injuries. Without a recent time, no numeric pace is emitted at any tier.
  The earlier bullet recording "8 questions + review / Question 3 of 8" is **superseded**.

### Housekeeping

- `docs/status.md` merged into `docs/mvp-progress.md` and deleted; all references updated.
- `.claude/HANDOFF.md` deleted — 161 lines of stale notes from an unrelated debugging session,
  asserting this project is on Expo SDK 56. It is pinned to SDK 54.
- `AGENTS.md` gains a rule: no agent changes a coaching rule, formula, or clinical claim without Ian.

## 2026-07-09

- Rewrote `README.md` from the create-expo-app boilerplate into a real project doc (status,
  stack, tiers, environment, structure, roadmap).
- Fixed `.gitignore`, which previously ignored only `.env*.local` and would have committed the
  real `.env`.
- Added `.env.example` and `supabase/functions/.env.example` as committed templates for the
  client and edge-function env files.
- Provisioned the Supabase project `v2.2_plan_generation` (ref `vvvcaulmbwbujeszfvbo`, region
  ap-northeast-1, Free plan) and deleted the empty `DashboardFeature` project to free a
  Free-plan project slot.
- Enabled Google OAuth and email auth on the new Supabase project (`apple` and
  `anonymous_users` remain off).
- Installed `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill`.
- Added `src/lib/supabase.ts`, the shared Supabase client (env-guarded at import, native
  session persistence, AppState-driven auto-refresh).
- Installed `jest-expo` and added `src/lib/__tests__/supabase.test.ts` covering the env
  contract (3 tests, all passing).
- Added `typecheck` and `test` npm scripts.
- Corrected `AGENTS.md`'s Expo docs link from v57 (no such SDK is installed) to v54, matching
  the pinned `expo ~54.0.0`.
- Force-pushed the local history over the remote's stub initial commit on
  `IanQiu979/WorkoutGenerationv2.2`.
- Rewrote `CLAUDE.md` and added `docs/architecture.md`, `docs/change_log.md`, `docs/status.md`,
  and `docs/reference/plan-generation.md` to give future sessions persistent, accurate project
  memory.
