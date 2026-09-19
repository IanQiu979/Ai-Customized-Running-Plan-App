# Change Log

Running history of behavior-changing work, newest first. Each entry is a dated `## YYYY-MM-DD`
heading followed by a bulleted list of what changed (and why, where it's not obvious). When you
make a behavior-changing commit, add a bullet under today's date — create a new heading at the
**top** of the file if there isn't one yet for today. Don't rewrite or delete past entries.

## 2026-09-19 — Three plan-engine rulings: dateless distance plans, the #103 peak invariant, the 35–45% source annotations

Captain's rulings of 2026-09-19 (firstmate task `v22-plan-engine-captain-calls-r1`), GitHub
issues #76, #103 and #101. All three were re-verified against `main` before anything changed.

- **#76 — a paid plan with a race distance but no race date keeps `raceDistance`, titled as a
  Base Plan.** `buildTemplatePlan` (`src/lib/planTemplates.ts`) used to write `raceDistance`
  onto the returned `Plan` only when `isRacePlan` was true, so a runner who named a half but
  booked no race got `"N-Week Running Plan"` with the distance gone — invisible and unrecoverable,
  even though `generalPhaseWeights` had shaped the block to it. It now mirrors the Free library's
  `buildLibraryPlan`: three titles keyed on what the runner said — `"N-Week 10K Plan"` (race with
  a date), `"N-Week 10K Base Plan"` (distance, no date), `"N-Week Running Plan"` (no distance) —
  and `raceDistance` is set whenever it is known. **`raceDate` is the only field that means a race
  is booked.** Reader audit: the plan view already keyed its race line on `plan.raceDate`; the
  race-only engine outputs (`readinessPath`, `goalRealism`, taper phase, race week, the RP
  session) stay gated on the race goal type, which the Worker's `validateRequest` only accepts
  with a `raceDate`; the one reader that presented the distance as a race — the Pro/Elite
  personalization prompt's context line — now says `Target distance:` plus either `Race date:` or
  an explicit "no race is booked — an open-ended base block" line, so the model cannot write a
  base block up as a race build. Pinned in `planTemplates.noRace.test.ts`,
  `planTemplates.general.test.ts`, `workers/test/planEngine.test.ts` and
  `workers/test/planPersonalizationPrompt.test.ts`.
- **#103 — the product invariant is "the peak phase's highest loading week is never below the
  base phase's highest loading week"; a peak under a mid-build loading spike is tolerated if
  disclosed.** Two engine defects put peak weeks under the base high, and both are mechanics,
  not coaching numbers:
  1. *Taper alignment* (`sampleCurve`). The phase allocator sets a plan's taper-week count from the
     distance's phase weights, while each curve carries its taper as a fixed number of trailing
     entries; interpolating the whole curve across the whole plan let the two disagree whenever
     the plan's length differed from the curve's — every 14-week half plan gave the allocator one
     taper week but the 16-entry curve's two-entry taper 1.75 of them, so the last *peak* week was
     sampled 85% of the way down the taper slope and rendered 1 km under the base high (108 of the
     sweep's offenders). The loading block of the curve is now interpolated across the plan's
     non-taper weeks and the taper entries across its taper weeks; no curve value changes.
  2. *Held long-run curves* (`holdRecoveryDips`). The four `*_LONG_RUNS` arrays keep their
     authored recovery dips at every fourth entry, but since 2026-09-12 a rest week takes its long
     run from `deloadLongRun`, so a dip only ever landed on a *loading* week — where it pulled
     the long run down and, because no easy run may outgrow the long run, the whole week with it,
     and through the growth base every week after. That is the same throttling the weekly-load
     curves were already cured of (`FIVE_K_WEEKLY_LOAD_GENERIC` and the three dip-free distance
     curves). The generic path now reads each long-run curve with its loading block held at the
     running maximum (the curve architecture's HOLD week — every value still the coach's own, the
     taper tail byte-identical). `FIVE_K_LONG_RUNS` itself and the golden 12-week/4-day path are
     untouched and still byte-pinned.
  Measured on the standing 22,000-plan sweep, before → after: **peak-below-base 458 → 348, the
  old peak-below-any-pre-peak-loading-week metric 758 → 352**, no plan entering either set,
  2,692 plans with a higher peak and 364 with a lower one (1 km re-sampling shifts), 4,548 with
  more total volume and 2,552 with less. `planTemplates.progression.test.ts` now encodes the
  base-high invariant as its exact-membership mask (348), asserts that every remaining offender
  belongs to one of two named families (below), and asserts the tolerance half of the ruling: every
  plan whose peak sits below a build-phase loading spike carries the new one-sentence flag
  (`buildSpikeDisclosure`: "Your highest-distance week is week N, in the build phase; the peak
  weeks carry a little less distance and more race-specific intensity."), nothing else does, and
  there are 48 such plans, pinned as a ceiling. Two witness pins moved with the re-sampling and are
  annotated in place (20-week 3-day 5K: 21/21 → 24/24 with a 19 km base high; the advanced 60 km
  12-week generic 5K: 69 km/23 km → 82 km/26 km, the curve's own 137%). **Not zero — the 348 that
  remain are two families whose only remedies change a coaching or safety number, so they go back
  to the captain (`docs/mvp-progress.md` → Blocked):** (a) beginner three-day 5K plans, 320 —
  with one 8 km-nominal tempo (≈23% of the week) the beginner three-run share ceiling (1.1/3) and
  the easy-run-≤-long-run rule cap the week at ~86% of target, so the growth base decays to the
  tempo's 3 km floor and the peak renders ~11 km against a week-1 base high; (b) the golden
  12-week/4-day 5K path at 50–110 km/week, 28 — scaled past ~50 km its two-easy-run base/build
  weeks and one-easy-run peak weeks pin to the same flat share cap at different totals. Also
  surfaced, not fixed: 150 sweep plans whose peak *phase* is a single week that is also a rest
  week (first-timer weighting at 10 weeks, for instance), so they have no loading peak at all.
- **#101 — the three coaching source ports now carry a one-line supersession note under each
  35–45% ruling annotation** (`docs/reference/coaching/source/load_rules.md` × 2,
  `training_zones.md`, `workout_library.md`): superseded 2026-09-06, down weeks are 15–25%, see
  `load-rules.md` § Deload trigger, `DELOAD_REDUCTION_MIN`/`_MAX` (0.15/0.25) in
  `src/lib/loadRules.ts` are authoritative, annotation kept as history. The wording is the
  captain's to approve in the PR. `ECHO_Training_Plans_McMillan.md` line ~1305 still says
  "reduce volume 35-45%" inside a plan example and was not in the issue's scope — flagged, not
  edited.

## 2026-09-19 — A declared injury cuts a Free plan once, not every week (issue #106)

Reported by the captain on 2026-09-13 while sweeping rest weeks on `fm/v22-deload-rest-week-bug`,
confirmed still real on current `main` today. In `src/lib/planLibrary/engine.ts`'s
`buildLibraryPlan` week loop, the § 17 module reduction (`injuryEffect.volumeReductionPct`, −15%
knee/shin, −20% ankle/hip/back/plantar) was multiplied into *every* week's target, while
`LOAD-2` / `LOAD-3` / `HOLD` / `RECOVERY` targets are computed from `lastLoadingKm`, which already
carried the previous week's cut. So a knee's 15% became 0.85 × 0.85 × …, and on a rest week it
stacked on `deloadVolume`'s 20% (0.85 × 0.8 = 68%, below the band). The issue's own intake —
`regular`, 3 days, 35 km, `['knee']`, 14-week 10K — ran 24.1, 26.4, 24.2, 16.4*, 26.6, 24.3, 22.3,
15.2*, 20.5, 18.8, 15.7, 10.6*, 16.9, 15.2 km against a healthy 31.6 … 36.9* … 20.8: week 12 at
29% of its healthy twin.

- **The module cut now lands on the first loading week only, together with § 16's own 90%.**
  Both factors are gated on one flag — the first week whose state is not `RECOVERY`.
  `plan-blueprint-examples.md` § 17: "Percentage reductions apply to the validated baseline once;
  they never stack", and every module's `H1` row reads "First loading week −X%" — the same reading
  `planTemplates.ts`'s `applyInjuryVolumeAdjustment` has always applied on the paid skeleton. Later
  weeks ramp off that week's reduced volume through the § 5 state machine and `clampWeeklyVolume`'s
  +10% growth cap. "First loading week" is deliberately not `index === 0`: `adaptCalendar`'s
  "Longer race date" prefix is drawn from the end of canonical weeks 1–4, so a `canonical + 1`
  duration (13-week 5K, 15-week 10K, 17-week half, 25-week marathon) opens on a prepended rest
  week — a week-1 gate (the first cut of this fix, caught in review) spent the cut on that rest
  week and left every loading week at healthy volume. The rest week is now untouched and the cut
  lands on week 2; the pre-existing re-anchor to the full baseline at the next `ENTRY` week on
  longer-than-canonical plans is left as-is (a coaching-shape question for the captain). The
  issue's intake (14 weeks, opens on `ENTRY`) is unaffected by the gate and now runs 24.1,
  26.4, 28.5, 22.9*, 31.3, 33.8, 36.6, 29.3*, 39.6, 42.8, 41.7, 33.3*, 32.0, 19.8 km: week 1 is
  unchanged (both week-1 cuts still apply there), rest weeks are 80% of the preceding loading
  week, and week 12 is 90% of healthy. No coaching number was added or changed; the week-1
  composition (§ 16's 90% × the module's −X%) is untouched and was not the issue.
- **Regression harness.** New `src/lib/planLibrary/__tests__/engine.injury.test.ts` pins the
  issue's intake by name and sweeps every § 17 module across the 40-plan register (5 tracks × 5
  layouts × 5 volumes × 4 durations (`canonical − 4 / canonical / canonical + 1 / canonical + 4`)
  × 2 goal types × 4 distances × 7 flags of injured weeks against their healthy twins): every
  week of an injured plan must hold at least the once-applied share of its healthy twin, less one
  bounded growth-cap step (`0.9 × B → B` for the healthy plan against `× 1.10` for the injured
  one — derived from `WEEKLY_INCREASE_RECALC_AT` and `VOLUME_STATE_TARGETS.ENTRY`, not a magic
  number) and a linear per-run rounding allowance that cannot be confused with the geometric bug.
  Two named `canonical + 1` cases (15-week 10K and 17-week half, knee) pin the prepended-rest-week
  shape from both sides: week 1 equals its healthy twin, week 2 is the once-applied share of its.
  `engine.recovery.test.ts`'s 15–25% rest-week property now sweeps `H0` plus all seven `H1`
  modules instead of `H0` only — the harness the captain's issue asked for. Both suites fail on
  the unfixed line (mutation-checked) and pass on the fix.
- **Not changed: the paid skeleton and the sweep baseline.** `buildTemplatePlan` was never
  affected; the 22,000-plan progression mask passes untouched (758), and no golden fixture pins a
  library plan with an injury, so no fixture changed. Worker suite (144) also green.
- **Found, not fixed — issue #119.** Extending the rest-week sweep to `H1` exposed a second,
  pre-existing defect on `lower_back` (INJ-6) only: "keep Day 7 at `LR-low`" is applied on rest
  weeks too, so Day 7 never shortens there and the easy runs carry the whole cut (total still in
  band; shape wrong — 2.7/2.7/4.5L after 3.9/3.9Q/4.5L). Whether the pin is a *cap* or a *value*
  is a coaching reading, so it is the captain's; until ruled, the recovery suite sweeps
  `lower_back` for the total band only (`TOTAL_BAND_ONLY`), and the other six modules pass all
  three invariants.

## 2026-09-16 — The golden 5K path serves only the cadence it was authored for (audit §1.3, `golden-cadence3-route`)

Core-purpose audit §1.3, found 2026-09-06 and deliberately left open by the §1.2/§1.4 task: on
the golden 12-week / 4-day / 5K path (`buildCanonicalFiveKWeek` in `src/lib/planTemplates.ts`),
an under-50 advanced (`competitive`) runner's weeks flagged `isDeload` were not reductions.
`isDeload` came from the runner's recovery cadence — every 3 weeks for advanced under 50, per
Ian's 2026-08-03 "pro runners = 3 weeks" ruling, so weeks 3/6/9 — while the week's volume was read
from the coach-authored `FIVE_K_WEEKLY_LOAD` curve by array position, whose authored dips sit only
at weeks 4 and 8. Weeks 3/6/9 were therefore flagged rest weeks carrying loading volume (quality
stripped, the easy runs absorbing it), and the real dips at 4/8 were unflagged loading weeks that
then became the growth base. For a 30-year-old competitive runner at 60 km/week on the paid-tier
skeleton (`density: 'paid'`) the weeks ran 54, 56, 64*, 39, 62, 74*, 72, 51, 77*, 55, 65, 41 km
(* = flagged deload): the three "rest" weeks were **up** 14%, 19% and 51% on the loading week
before. The captain's 15–25% band (2026-09-06) could not have caught it — the band was not what
was broken. The other golden profiles the audit had listed (experienced/27 km weeks 4+8, some/30 km
week 12) were already correct on current `main`; the 50+ runner's week 12 is race week, ruled on
below.

- **Captain's ruling, `golden-cadence3-route` (2026-09-16, option A of three): the coach-authored
  golden plan admits only a runner whose recovery cadence lands on its authored dips.**
  `FIVE_K_WEEKLY_LOAD`, `FIVE_K_LONG_RUNS` and the tempo/interval tables are one artefact written
  for a runner who recovers on weeks 4 and 8, so `buildTemplatePlan` routes a 12-week / 4-day / 5K
  race intake to `buildCanonicalFiveKWeek` only on the 4-week cadence or the 50+ ruling's explicit
  4/8/12 (2026-08-06, `fifty-plus-golden-deload-weeks`, unchanged): a new
  `FIVE_K_AUTHORED_DIP_CADENCE = 4` and one extra clause on `useGoldenFiveKShape`,
  `(params.intake.age >= 50 || deloadCadence === FIVE_K_AUTHORED_DIP_CADENCE)`. The under-50
  advanced runner is served by `buildGenericWeek` like every other intake off the golden path,
  with the 3-week pro cadence intact. Rejected: authoring a week-3/6/9 recovery for the curve
  (option C — it needed tempo/interval doses the coach never wrote) and reversing the 2026-08-03
  pro cadence (option B). No coaching content was added.
- **Sub-ruling, same key: the 50+ runner's race week 12 stays flagged `isDeload`** per the
  2026-08-06 ruling. Its volume includes the 10 km race day, so it cannot satisfy a reduction
  band; it is excluded from the band property rather than un-flagged, and the UI keeps calling it
  a recovery week.
- **Who receives a different plan: only a `competitive` runner under 50 asking for a 12-week,
  4-day 5K race plan on the paid-tier skeleton.** Free is served by the plan library and is
  untouched; the byte-pinned example-plan fixture (25-year-old `regular`) is untouched; the other
  seven golden-shape profiles are byte-identical before and after. The 30-year-old competitive
  60 km/week runner now gets 58, 60, 48*, 52, 57, 46*, 63, 61, 49*, 67, 69, 41 km — rest weeks
  are cuts of 20%, 19% and 20%, inside the band; deloads still 3/6/9; peak loading week 72 → 69 km;
  peak long run 24 → 23 km; long runs by week 17, 19, 12, 14, 19, 12, 21, 17, 11, 23, 21.
- **New `src/lib/__tests__/planTemplates.goldenDeload.test.ts`** sweeps all eight golden-shape
  profiles (every level, both age bands, 12–80 km/week) and asserts every flagged non-race week
  has a preceding loading week, is a real reduction, sits inside 15–25% (authored-dip weeks 4/8:
  between the band floor and the authored ~39.5% depth, the 2026-09-08 exception), and never
  grows the long run. Verified to fail against `main`'s engine (competitive/60: weeks 3/6/9 up
  14%/19%/51%) and pass after. `planTemplates.longRunCap.test.ts`'s golden sweep gained a
  `servedBy: 'golden' | 'generic'` field, judges the rerouted profile by the generic path's
  whole-km spike ceiling, and re-pins its progression 72/24 → 69/23.
  `planTemplates.golden.test.ts`'s "under-50 competitive deloads 3/6/9" case is kept and
  re-described: it now proves the reroute did not lose the cadence.
- **The 22,000-plan progression mask was re-encoded exactly once, on the captain's authority,
  770 → 758.** Routing moved all 22 competitive / 4-day / 12-week / 5K matrix intakes
  (10–110 km, both recent-time variants) onto the generic curve, removing 14 offenders
  (50–110 km) and adding two, named in a new `POST_BASELINE_NAMED_OFFENDERS` constant and
  asserted by name: `5k / competitive / 4 days / 40 km/week / 12 weeks / no recent time` and
  `… / recent 10K` — the generic path's #103-class shape (week 8 long run 17 → 11 km, peak 47 km
  under a 49 km week 7), pre-existing and captain-scoped out under issue #103. Any other addition
  is still a regression. `AGENTS.md`'s mask guardrail records the re-encode, and a new guardrail
  there states the admission rule.
- Full root gate green: `npm run typecheck && npm run lint && npm test` — 53 suites, 931 tests. The new band suite was also run against `main`'s engine and fails there with exactly the three breaches above. `workers/` untouched.

## 2026-09-16 — Settings' "Delete account" now confirms and deletes on web (issue #96)

Issue #96. `src/app/(tabs)/settings.tsx` routed its confirmation through `Alert.alert`, which
react-native-web implements as literally an empty method (`class Alert { static alert() {} }`).
On web the row therefore produced no dialog, no deletion and no error — the tap was swallowed.
Verified real before fixing: the screen had no `Platform.OS === 'web'` branch at all. Native was
never affected.

- **New `src/lib/confirmDestructive.ts`, one confirmation step on every platform.** Native keeps
  the OS `Alert.alert` exactly as before — same title, same message, a `cancel` button and a
  `destructive` "Delete" button. Web asks the browser's own modal (`window.confirm`) with the
  title, the message and "Press OK to delete, or Cancel to keep everything as it is." — the
  browser cannot relabel OK, so the text says what OK will do. On either platform only an explicit
  confirm calls `onConfirm`; dismissing sends nothing. If a web runtime has no `confirm` function
  the lib **throws** rather than silently doing nothing — fail closed, loudly, the opposite of the
  bug it replaces — and Settings catches that throw into its `deleteError` line, since React does
  not catch handler throws and a console-only error would be #96's silent tap again. `Platform.OS`, `Alert.alert` and `globalThis.confirm` are read through an
  injectable `runtime` parameter (`defaultConfirmRuntime()`) so both branches are unit-tested
  under the one jest-expo preset; screens never pass it. Settings' `confirmDeleteAccount` is now
  a call to it; the rest of the delete flow (`deleteAccount()` → `authClient.signOut()` → the
  `Stack.Protected` bounce to `(auth)`) is unchanged.
- **Pinned by `src/lib/__tests__/confirmDestructive.test.ts`, 11 cases.** On ios/android: the
  alert is presented with the two buttons, cancel never reaches `onConfirm`, only the destructive
  button does, and the browser dialog is never touched. On web: the browser confirm is asked with
  the title, message and what OK does, cancel never reaches `onConfirm`, confirm reaches it
  exactly once, and a missing `confirm` throws. `defaultConfirmRuntime` reads the real
  `Platform`/`Alert` and binds the global `confirm` (bound, not passed bare — browsers throw
  "Illegal invocation" on an unbound `confirm`).
- **Verified end to end on Expo web** (headless Chrome, `npm run web` on 8081 against a local
  `wrangler dev` on 8787 with a throwaway `.dev.vars`): dismissing the dialog sent no request and
  the D1 user row stayed; accepting sent `POST /api/delete-account` (200), then `sign-out`, the app
  bounced to onboarding, and the user table was empty.
- **Observation, pre-existing and not changed here: a cross-origin web page does not keep the
  better-auth session cookie.** The local Worker was needed because `localhost:8081` → the deployed
  `workers.dev` origin does not retain the session cookie in the browser — `workers/src/auth.ts`
  deliberately sets no cross-domain cookie attributes (`SameSite` defaults to Lax), and
  `apiClient.ts` on web relies on the browser cookie rather than the bearer token. Same-site
  `localhost:8081` → `localhost:8787` works. Recorded under "Known debt" in `mvp-progress.md`.
- **Deliberately not built: a custom in-app confirmation sheet.** The browser modal is the
  platform-idiomatic equivalent of the OS alert; a designed sheet is separate design work.
- Root gate clean: 52 suites, 899 tests (after rebasing onto #116). `workers/` untouched, so its gate does not apply.

## 2026-09-16 — Issue #25 (Home placeholder copy) was already fixed; the regression is now pinned

Issue #25, from the 2026-07-11 frontend audit, reported Home saying "Intake, generation, and plan
view land in later build phases" directly above a working "View the sample 5K plan (demo)" link.
Both the sentence and that link left `src/app/(tabs)/index.tsx` in `86d2d66` (#62) when Home was
wired to the real backend; the sample plan is now My Plans' pinned `PlanListRow`, which already
announces as a link (`my-plans.test.tsx`'s `rowsContaining` only matches `role === 'link'`). No
screen change — a second edit to a sentence that no longer exists would have been invented work.

- **`src/app/(tabs)/__tests__/home.test.tsx` gains three cases** under "Home copy matches what
  the app does": neither the pre-intake nor the intake-plus-plan branch renders placeholder
  capability claims ("later build phase", "(demo)", "not yet available"), and every `Pressable`
  Home renders carries a `button`/`link` `accessibilityRole` — the issue's second ask, generalised
  from one control to all of them. Both guards were run red against a mutated screen first.

## 2026-09-16 — A font-load failure boots the app instead of stranding it on the splash screen

Issue #21, from the 2026-07-11 codebase audit. `src/app/_layout.tsx` read only the first element
of `useFonts`'s `[loaded, error]` pair. `expo-font`'s hook never resolves `loaded` after
`loadAsync` rejects — it sets `error` and stops — so any one of the eleven Google-font assets
failing (an interrupted first-launch download, a corrupt cache, a failed web fetch) left `ready`
false forever: the layout returned `null`, `SplashScreen.hideAsync()` never ran, and a first-time
user — i.e. a tester — saw the splash screen indefinitely with no error and no retry.

- **The gate now settles on either outcome.** `fontsSettled = fontsLoaded || fontError !== null`
  feeds `ready` in place of `fontsLoaded`; the session half of the gate (`sessionGate.ts`) is
  untouched. On failure the app renders on the system faces — each `fontFamily` the theme names
  falls back at the renderer, wrong-looking but legible — and the splash is hidden exactly as on
  success. **Deliberately no user-visible signal**: there is nothing a runner could do with an
  error dialog, and a working app in the wrong typeface beats a stranded one. A `__DEV__`-only
  `console.warn` carries the error for the developer.
- **Pinned by `src/app/__tests__/root-layout-font-gate.test.tsx`**, the fifth rendered-screen
  suite (`CLAUDE.md` → Testing, same grounds as the other four: the behaviour is the layout's own
  render branch). Three cases — fonts loaded, fonts still loading (gate holds, splash stays), and
  fonts failed. The failure case was run red against the pre-fix layout before the change landed.

## 2026-09-16 — Native splash and adaptive-icon chrome painted with the Blueprint field (issues #20, #49)

`app.json` still carried the create-expo-app template colours — `#208AEF` on the
`expo-splash-screen` background and `#E6F4FE` on `android.adaptiveIcon.backgroundColor` — through
every rebrand since Instrument. Because `src/app/_layout.tsx` holds the splash
(`preventAutoHideAsync`) until three font families load, that blue was the app's single longest
first impression on every cold start, followed by a hard cut to the near-black field.

- **Both values are now `#0B0E12`, the Blueprint field (`Colors.dark.surface.base`).** On Android
  the colour only takes effect because `adaptiveIcon.backgroundImage` was dropped too: Expo's
  prebuild ignores `backgroundColor` whenever a background image is set, and the template's
  `android-icon-background.png` was a flat fill of the same `#E6F4FE`, so the PNG is deleted and
  the tokened field now paints the icon background. The splash gets an explicit
  `dark.backgroundColor` too, pinned to the *same* token rather than the light
  palette: `use-theme.ts` renders the dark scheme only, so a light-keyed splash on a light device
  would flash white and then drop to near-black — the more jarring of the two problems. If the
  light scheme is ever re-enabled, the base variant is the line to revisit.
- **`app.json` cannot reference the tokens** — it is strict JSON, and `theme.ts` imports
  `react-native`, so an `app.config.ts` could not import it at config-evaluation time either. So
  the literals are pinned by a test instead of a comment:
  `src/constants/__tests__/app-config-colors.test.ts` parses `app.json` and asserts each colour
  field equals the token. Verified to fail against the old file.
- Colours only. The adaptive icon's foreground and monochrome layers, the iOS icon and the splash
  artwork are the M6 release issue and remain stock.
- Root gate clean: 51 suites, 885 tests (on the rebased head, which includes PR #114's suite). `workers/` untouched.

## 2026-09-16 — Issue #24 closed: the Elite per-workout "why" is rendered and now proven

GitHub issue #24 (2026-07-11 frontend audit: "`WorkoutRow` never renders `Workout.why`, so Elite's
per-workout coaching vanishes") was diagnosed today and is stale as filed. No source file changed;
the fix is the missing test.

- **Where the why renders now.** `WorkoutRow` and `WeekAccordion` were deleted by PR #111
  (2026-09-14, V22-06); `composeWorkoutLabel` survives in `src/components/plan/format.ts` with its
  unit test but no screen calls it. Their replacement, the plan detail's day screen
  (`src/app/plan/[id]/week/[week]/day/[day].tsx`), already renders `Workout.why` as its WHY
  section — `{day.why ? <Section label="WHY" body={day.why} /> : null}` — so the Elite per-workout
  why does reach the runner. The week screen's `SessionRow` accessibility label omits it on
  purpose: the row does not show it visually either; it is a link to the day screen, where the why
  is plain `Text` and VoiceOver reads it as part of the page.
- **What was genuinely missing was coverage — the root cause the issue named.** No fixture
  anywhere populated `Workout.why` (the permanent example plan is Pro and correctly carries no
  per-workout why; only Elite gets one), so the render branch could never fail a test.
- **New `src/app/plan/__tests__/day-why.test.tsx`** — the fourth deliberate rendered-screen
  exception on `CLAUDE.md`'s stated grounds (one conditional render branch, no logic layer beneath
  it). It derives an Elite Week 1 from `examplePlan` by giving each of its four run days its own
  `why`, mocks `expo-router` and `@/hooks/use-plan`, and pins five things: an Elite workout's why
  renders under WHY; every run day's why renders on its own screen; a workout without a why (the
  Pro example) renders no WHY section at all; a rest day gets `REST_WHY` and never the week's why;
  a workout screen never shows the week's why. Removing the branch from the screen fails the first
  two tests.
- The example plan stays Pro and carries no per-workout why; that is deliberate, not a gap.
- Root gate clean: 49 suites, 879 tests. `workers/` untouched, so its gate does not apply.

## 2026-09-16 — Expo SDK 57 packages brought to their expected patch versions

`npx expo-doctor` reported 14 Expo packages behind their expected SDK 57 patch on 2026-09-12
(`expo`, `expo-router`, `expo-linking`, `expo-secure-store`, `expo-splash-screen`, `expo-symbols`,
`expo-system-ui`, `expo-web-browser`, `expo-network`, `expo-constants`, `expo-device`, `expo-font`,
`expo-image`, `@expo/ui`). `npx expo install --fix` was run twice — bumping `expo` itself raises the
expected range for the rest — until `expo-doctor` is 21/21 clean. `expo` now carries a tilde range
(`~57.0.23`) rather than the caret it had since the 2026-09-05 upgrade; `package.json` is the
source of truth for every current version. `jest-expo` was already at its latest SDK 57 patch.
Every bumped package's SDK 57 changelog was checked: additive-only, nothing this app uses.

- **`app.json`: `expo-image` re-registered in `plugins`, by the tool.** `expo install --fix`
  auto-registers the config plugin of any package that ships one; not a hand edit.
- `workers/` untouched, so its gate does not apply. Root gate clean: 48 suites, 874 tests.
- Resumed from an earlier interrupted session whose WIP commit was based on a stale `main`; that
  commit was reset and the fix re-run cleanly on top of current `main` rather than hand-resolving
  the rebase conflict.

## 2026-09-14 — "The plan builds itself": the V22 build animations, the Blueprint theme, and the heartbeat/graph motif retired

Implements the six captain-approved Claude Design pages (`V22-01` … `V22-06`, approved
2026-09-13, design handoff of the same date) natively in `react-native-reanimated`, with the
handoff's `V22 theme.md` as the colour/type authority. Where a page and the 2026-09-12 animation
spec disagreed, the page won. Nothing is dropped in as web/HTML.

- **One shared vocabulary, ported verbatim from the pages' runtime.** `src/lib/buildMotion.ts`
  holds the easings, the `enter` / `draw` / `move` / `snap` primitives (snap = 350 ms rise to 1.03
  with one settle, never a second bounce) and each page's cue table resolved to seconds;
  `src/lib/weekStrip.ts` holds the strip's data shape and `stripFromWeek`, which normalises a real
  week so its longest session fills 90% of the track. Every build derives everything from one
  master clock `T` (`components/build/useBuildClock`) on the UI thread, exactly as the pages derive
  theirs from the page timeline, so the choreography is one number rather than chained timers.
  Under reduced motion the clock starts at its end and the end frame is shown directly. Each
  composition plays once and holds; only the header mark may re-run, and only when its data changes.
- **V22-01 · onboarding hero** (`OnboardingHero`): the wordmark; a 96pt Number that counts the
  week's kilometres; a 7-slot strip whose baseline draws left to right and whose blocks snap in one
  every 220 ms (Easy 8 · Rest · Rest · Tempo 7 · Rest · Long 10 · Rest, the page's week), the total
  ticking 8 → 15 → 25 with each landing; three faint copies (0.28 / 0.18 / 0.10) slide down beneath
  it; legend; then "Continue" 0.8 s into the hold. 3.0 s of build, 2.2 s hold. Laid out in the
  page's own 393×852 coordinates on a `DesignCanvas` that scales down (never up) and centres.
- **V22-02 · step pieces** (`components/build/steps`, `RevealPrimaryAction`): 01 Intake — three
  input rows arrive, a segmented control is pressed 3 → 4 → 5, a field counts to 10 km, another to
  51 min; 02 Engine — three candidate tiles arrive and the middle one grows into a full session
  card ("EASY RUN · DAY 03 · 8 KM · 5:40 /KM" — `DAY 03`, not the page's `WED`: days are unnamed
  here) while the other two fade; 03 Plan — the plan-detail week in miniature builds in 1.0 s;
  Get started — the primary action's outline draws itself over 0.6 s, the ink fill sweeps in from
  0.65 s, the label fades up from 0.85 s. Each plays once when its step scrolls into view. The
  stick-runner figure above the button is the page's own SVG. The old pricing beat is gone; the
  page has exactly three steps.
- **V22-03 · survey intro** (`SurveyIntro`, mounted by `intake.tsx` for a runner with no saved
  intake): heading, then week 1 builds (1.4 s) and weeks 2–6 stack beneath it fading toward the
  bottom, W1 … W6 labels 4pt under each baseline; PRESS TO CONTINUE fades in 0.8 s into the hold
  and a tap reveals the questions, which never animate. A runner editing an existing intake goes
  straight to the form.
- **V22-04 · home header mark** (`HeaderMark`, in Home's tier row): seven 6×10pt slots at 4pt gap,
  drawn at 1.4×; the current week's completed days fill bottom-up in ink, 300 ms each at a 70 ms
  stagger, on screen open, and re-run only when the count changes. "Completed" means *elapsed*:
  the app logs nothing, so `src/lib/planProgress.ts` reads Day 1 of Week 1 as the day the plan was
  generated and fills one slot per calendar day since — the only honest derivation without a log,
  and the one place it lives.
- **V22-05 · My Plans hero** (`PlanHero`): the runner's real most-recent plan — eyebrow, title, a
  64pt Number counting to the real first week's total, the real week's bars snapping in 180 ms
  apart with their real distances and codes, one faint copy beneath — then "Open plan" and the list
  fade in on the hold. With no generated plan it plays the permanent example; there is no empty
  state. List rows (`PlanListRow`) carry a 60×28 miniature of the plan's first week.
- **V22-06 · plan detail, static, three read-only pushes** (`plan/[id]/index`, `week/[week]`,
  `week/[week]/day/[day]`): A — the whole plan, one row per week with a 120×22 miniature strip,
  RECOVERY / TAPER / RACE WEEK tag and total, the current week highlighted and the others' bars
  dimmed to 55%; B — the week's static strip with the current day's numeral in ink, then the seven
  days as hairline rows; C/D — a session (eyebrow with a session-tone dot, headline, km / zone or
  RPE / pace, STRUCTURE, EFFORT, WHY as they exist on the `Workout`) or a rest day (No run today,
  WHY). Rows keep the spec's 44pt hit-target floor over the page's 41pt. The page's "OPTIONAL …
  walk or mobility" block on a rest day is deliberately not built — plans are running only. The
  accordion/ribbon plan view (`WeekAccordion`, `WorkoutRow`, `PlanNameplate`) is deleted.
- **The heartbeat/graph motif is gone from the whole app, not only the six screens** (spec
  §V22-06's inventory, confirmed by sweep): `PulseTraceHero`, `PulseTraceSlot`, `RouteLine`,
  `routeProfile.ts`, `pulseTrace.ts` (lib and constants), the `/dev/pulse-trace` route and
  `docs/design/pulse-trace.md` are deleted; `ScreenHeader` lost its `routeLine` prop and every
  screen's header is the same hairline; the Paywall's rule is a hairline; the Home tab's glyph is
  the week strip; sign-in and sign-up carry nothing (the page inventory: "→ nothing, the pages are
  minimal"). The week strip is the app's one drawing.
- **The theme is now "Blueprint" — the captain's V22 sheet.** `theme.ts`: background `#0B0E12`,
  raised `#141920`, hairline 10% white, empty slot 14% white, ink `#EEF1F4`, dim `#8B9299`, and
  exactly two session colours — easy `#4DB58C`, hard `#E0864E` — applied to bars and tiles, never
  to text or chrome (`sessionToneFor` collapses the five-level effort scale onto them; steady is
  hard). **The accent is ink**: the primary action is a near-white slab with the page colour as its
  label, and the icy cyan went with the pulse trace — there is no second highlight anywhere. Fonts
  are Barlow Condensed (display, every numeral), IBM Plex Mono (tracked labels, units, day
  numerals) and IBM Plex Sans (body), replacing Big Shoulders / Public Sans / Space Mono; bars have a
  5pt top radius, buttons are 12pt / 52pt tall. **The app renders the dark scheme only**
  (`use-theme.ts`): the sheet defines one field and every page is composed on it; the light palette
  is kept and still contrast-tested so re-enabling it is one line. The contrast suite was rewritten
  for the new tokens and still enforces every floor from the hexes.
- **Visual-match pass (the spec's acceptance step) done before the captain sees it.** Every screen
  was rendered on Expo web at 393×852 and compared pixel-over-pixel against the approved pages —
  end frames via the pages' own seek event, motion via in-page sampling (hero bars 220 ms apart
  with the 1.03 overshoot, total ticking on each landing; button outline 0–0.6 s, fill from 0.65 s,
  label from 0.85 s; mark filling at a 70 ms stagger). One divergence found and fixed: the survey
  intro's W1 label sat 15pt low because it was anchored to a box that also held the numerals row;
  it is now anchored to the baseline like W2–W6. Remaining differences are deliberate and listed
  above (`DAY 03`, 44pt rows, no mobility block, the app's own screen header on My Plans, the
  fallback notice on a template plan).
- Verification: root `typecheck && lint && test` green (48 suites / 870 tests); `workers/` untouched.

## 2026-09-12 — Home and navigation layout audit batch

Captain-audit scope only: Home, the tab bar, My Plans and the Glossary. No new design assets, and
no heartbeat/graph animation, onboarding or auth-screen work.

- **Create plan now leads Home.** The primary action previously followed the target, plan-length,
  Notes/subscription panels and library link in source order, leaving it at the bottom of the
  screen. It now sits immediately below the header, before the target and optional fields, and the
  action is consistently named "Create plan". Generation failures stay next to that action and are
  exposed as an assertive accessibility alert.
- **The Home header now carries live account status.** The static "Pace Blueprint" eyebrow is
  replaced by `getQuotaStatus()`'s tier and `formatQuotaLine()`'s server-backed used/limit reading.
  The duplicate tier/quota stat plate lower down is gone; "Today" remains the screen title.
- **Notes and subscription disclosures are a post-first-plan stage.** The old gate was only
  `quota !== null`, so those panels appeared as soon as tier data loaded even when the runner had
  never generated anything. Home now checks persisted state through `GET /api/plans` on every
  focus and reveals the panels only when that list contains a plan. Paid runners then get editable
  Notes; Free runners get the locked Notes and paid-content teaser. A transient plan-list failure
  does not erase a previously confirmed `true` state.
- **My Plans no longer contradicts its own permanent example.** "Nothing here yet" was keyed only
  to an empty generated-plan response even though the Example Plan rendered unconditionally above
  it. That unreachable product state is removed: the example is always the library's baseline,
  followed by any fetched plans. The MOST RECENT reading now links to the actual newest generated
  plan, selected with `max(createdAt)` rather than assuming the response is ordered.
- **The four tabs are icon-only without becoming nameless to assistive technology.** Visible text
  labels are disabled; Home, Glossary, My Plans and Settings each keep an explicit tab-bar
  accessibility label. The active ink tick remains, and the decorative icon/tick subtree is hidden
  from screen readers so it does not duplicate the tab name.
- **Glossary rows are compact disclosures.** Run-type, unabbreviated-term and structure-shorthand
  rows show only their abbreviation/term line initially. Each row's drawn arrow expands its full,
  unchanged `notation.ts` definition inline and toggles independently. The toggle is exposed as a
  button with `accessibilityState.expanded` and an expand/collapse hint; section titles are exposed
  as headings.
- **State-dependent tests exercise absence before presence.**
  `src/app/(tabs)/__tests__/home.test.tsx` proves the plan basics remain while both paid and Free
  disclosures are absent with no persisted plan, then proves a refocus revealing the first saved
  plan changes that state. `my-plans.test.tsx` proves an empty API list still has the Example Plan
  and no contradictory empty copy, and that an unsorted response links MOST RECENT to the newest
  id. `glossary.test.tsx` proves definitions are absent initially and appear only for the row that
  is expanded, covering abbreviated, unabbreviated and structure rows.

## 2026-09-12 — first-run copy reduced after the captain's audit

- **Cause:** the captain's first-time-user audit found that the onboarding journey gave a stranger
  too much information at once. The signed-out route through onboarding and auth into the Intake
  start was inventoried before rewriting it.
- **Onboarding now says only what the runner needs to continue.** The cover and each existing
  01/02/03 beat keep one headline and one supporting sentence; the sign-up hand-off and Intake
  header are shorter too. The plan description still explains weeks, runs and rest days, while the
  tier copy now says accurately that Pro/Elite pace guidance depends on the runner supplying a
  recent time.
- **Copy only.** Instrument fonts, colours and spacing, the existing components and layout, the
  pulse-trace animation behaviour, and the 01/02/03 structure are unchanged.

## 2026-09-12 — rest weeks shorten the long run first, on both engines

Branch `fm/v22-deload-rest-week-bug`. The captain's 2026-09-12 user-audit item: a 10 km plan
averaging ~35 km/week produced a rest week of **14 km long run + 2 km + 3 km** — a ~45% drop whose
distribution was absurd, the long run barely moved while the easy runs collapsed to warm-up length.

- **Diagnosis, with evidence.** The plan came from `src/lib/planTemplates.ts`'s `buildGenericWeek`,
  not the Free library — `buildLibraryPlan` already sizes every recovery week's Day 7 at § 9's
  60–70% of the preceding long run and was correct on every plan in the register. Two defects
  stacked in the skeleton. (1) The *total*: the 45% drop is the pre-2026-09-06 35–45% band. The
  code at `adc3aa0` (2026-09-05, the last commit before the band change) reproduces the exact
  `14 + 2 + 3 = 19 km` rest week in 1,014 parameter combinations at 35 km/week on 10K; `main`
  reproduces it in none, because the band change fixed the total. The last-deployed Worker
  predates that change, which is why the captain saw it live. (2) The *distribution*, still on
  `main`: the file's own comment said "there is no separate deload formula for the long run the
  way `deloadVolume` is one for weekly volume", so a rest week's long run followed the *loading*
  curve — on `main`, across 34,560 generated plans, the long run was cut proportionally less than
  the easy runs in 97% of rest weeks and actually **grew** into the rest week in 12.5% — and the
  easy runs absorbed the entire cut. Neither defect was a rounding floor or a per-run scaler.
- **Fix — `loadRules.ts` owns a long-run deload band, and both engines read it.**
  `DELOAD_LONG_RUN_SHARE_MIN`/`_MAX` (0.6/0.7) and `deloadLongRun(previousLongRunKm)` (midpoint,
  65%) are the long run's counterpart to `DELOAD_REDUCTION_MIN`/`_MAX` and `deloadVolume`. The
  numbers are `plan-blueprint-examples.md` § 9's, already ported in the library as
  `LONG_RUN_RECOVERY_SHARE`, which is now that pair re-exported rather than a second copy — the same
  arrangement `RECOVERY`'s weekly total already had with `deloadVolume`. Nothing new was invented.
- **`buildGenericWeek` on a rest week:** the long run is `deloadLongRun` of the last loading week's
  rendered long run (a new `lastLoadingLongRunKm` tracked beside `lastLoadingWeekKm`), not a point
  on the curve; quality is already removed, so "remove hard volume before removing easy frequency"
  (§ 2 rule 7) is now what the arithmetic does. The easy-run ceiling on a rest week is the last
  loading week's long run — a distance already run inside every ceiling, and the denominator R1c
  measures a genuine deload's share cap against — rather than the deliberately-shortened long run,
  because at three runs a week the 80% total cannot be covered by three runs of 65% of the long run
  and the week would otherwise fall below the band on the low side, taken from exactly the easy
  runs the rule says to keep. Loading weeks keep the ordinary "no easy run outgrows the long run"
  rule unchanged; the golden 12-week/4-day 5K path is untouched and still byte-pinned. The
  captain's case now renders `11 / 10Q / 11L → 10 / 9 / 7L` (26 of 32 km).
- **R1c's wording, noted not changed.** The 2026-07-12 denominator ruling was reasoned from "a
  deload cuts the week's total while largely preserving the long run". The *mechanism* it ruled on
  — measure a genuine deload's share against the last loading week — is untouched and still what
  keeps every rest-week run inside the cap; only the premise is superseded by the captain's
  2026-09-12 finding and § 6/§ 9, which shorten Day 7. Flagged in the PR for the captain.
- **Tests.** `src/lib/__tests__/planTemplates.deload.test.ts` reproduces the captain's case and
  sweeps 4 distances × 5 levels × 4 layouts × 4 volumes × 3 durations × race/duration on the
  skeleton; `src/lib/planLibrary/__tests__/engine.recovery.test.ts` sweeps the whole 40-plan
  register. Both assert the same three invariants on every rest week: total 75–85% of the preceding
  loading week; no easy run below `1 − DELOAD_REDUCTION_MAX` of the loading week's shortest non-long
  run (the band's own deepest permitted cut, applied per run — not a new number); and the long run
  inside 60–70% of, and cut proportionally more than, the easy runs. The skeleton suite fails six of
  seven on the unfixed engine. Four existing suites had literal pins or "easy ≤ this week's long
  run" assertions that encoded the old rest-week shape; each now derives the rest-week value from
  `deloadLongRun` or bounds rest-week easy runs by the last loading week's long run, with the reason
  beside it. The progression suite's 22,000-plan baseline mask was **not** regenerated and passes
  unchanged.
- **Observed, not fixed (out of this item's lane):** the Free library under a declared injury
  (`H1`) applies the injury volume reduction every week on top of a `lastLoadingKm` that already
  carries it, so a 35 km/week runner's plan collapses 24 → 26 → 24 → 16 → … → 10 km across 14 weeks
  and its rest weeks land ~32% down. Filed as GitHub issue #106 for the captain.

## 2026-09-12 — tab returns keep their last-known content while refreshing

- **Cause diagnosed.** Expo Router SDK 57 keeps bottom-tab screens mounted. Home, My Plans, and
  Settings intentionally use `useFocusEffect` to refresh when focused, but their request-in-flight
  flags also controlled the full loading branch, so every return hid data the mounted screen
  still held. Glossary has no fetch and was not part of the failure.
- **Loading is now cache-first.** A full spinner appears only on a tab's first load, before it has
  any successful response. Later returns show the last-known Home intake, My Plans list, or Settings
  quota immediately while the focus refresh runs silently. A successful `null` intake and an empty
  plan list both count as loaded data, and a refresh error leaves the cached UI visible alongside
  the error.
- **Regression proof.** `src/app/(tabs)/__tests__/tab-cache-first.test.tsx` drives two focus cycles
  through one mounted My Plans renderer. While the second request is deliberately unresolved, it
  asserts that the cached plan remains visible and no `ActivityIndicator` renders. The root gate is
  clean: 42 suites, 851 tests.
- **PR/manual observation note (not yet device-tested):** “After a tab’s first load, returning to
  Home, My Plans, or Settings shows the last-known content immediately while it refreshes silently.
  A spinner appears only on the first visit when that tab has no data yet; Glossary is unchanged.”

## 2026-09-10 — the Free library engine's six coaching questions, all answered

Branch `fm/v22-library-free-engine`. `npm run typecheck && npm run lint && npm test` (40 suites,
844 tests) and `npm --prefix workers run typecheck && npm --prefix workers test` (144 tests) both
clean.

Ian answered all six questions yesterday's entry raised. They are recorded as settled rulings in
[`docs/reference/coaching/free-engine-open-questions.md`](reference/coaching/free-engine-open-questions.md),
each still shown beside the question as it was put to him, and each is one constant or function in
`src/lib/planLibrary/openQuestions.ts` keyed by the same number. Five confirmed what shipped; one
changed behaviour.

- **Q1 — Free now requires a target race distance, and refuses without one.** Ian ruled that a
  duration-only Free request naming no distance anywhere is not served by the library engine, and
  must not be defaulted onto the 10K calendar. `workers/src/lib/planEngine.ts` no longer falls
  through to `buildTemplatePlan` for that shape — falling through would have put a Free user back
  on the paid tiers' skeleton and quietly undone the 2026-09-06 tier split. It returns
  `invalid_request` with `NO_RACE_DISTANCE_MESSAGE`, which names the fix rather than only the
  problem, and `generate-plan-flow` releases the quota reservation before returning, so the refusal
  costs nothing. That last part matters: Free's allowance is one plan for life
  (`tierLimits.ts`'s `FREE_IS_LIFETIME`), so a refusal that consumed it would be unrecoverable.
  **This narrows an earlier ruling.** The captain's 2026-08-15 report — "the race stage should be
  optional, it's not a mandatory thing you need to input" — now governs the **paid tiers only**. A
  race *date* remains optional on every tier; it is the distance, not the booking, that Free needs,
  because the library is organised by distance. `workers/test/planEngine.test.ts`'s "no race named
  anywhere" suite now pins both halves: Pro still gets a real plan with no distance and no invented
  5K, Free is refused, and a Free runner who named a distance but no race date is still served.
- **Q2 — "materially stronger" is 5%.** `SPD_MATERIALLY_STRONGER_PCT = 0.05`: a result 5% or more
  faster than its Riegel-predicted equivalent classifies the runner `SPD` under § 7. Banked
  deliberately ahead of the intake work so it is not re-litigated later; nothing consumes it yet,
  because § 7 needs a recent performance at *two* distances and `IntakeResponses` holds one. Every
  runner therefore still takes § 7's own conservative `END` default, and the 20 `SPD` calendars
  stay built, tested and unreachable — expected, not a defect. A test records why.
- **Q3 — `deriveReadinessPath`'s `prepared` verdict stands** as the test for "already demonstrates
  the required base", approved as implemented with no new threshold.
- **Q4 — all three tie-breaks stand:** band midpoints for `HOLD`/`TAPER-1`/`TAPER-2`/`RACE-WEEK`,
  `EXP`/`COMP`-only eligibility for a second hard session, and the five-day clamp for a `REG`
  runner requesting six.
- **Q5 — the H0/H1 default stands, and § 15's six-field injury intake is explicitly not required
  before Free ships.** A separate future task. Any declared injury still maps to `H1`; `H2`–`H4`
  remain implemented and tested but unreachable from live intake. `deriveInjuryState` (renamed from
  `deriveProvisionalInjuryState`, since it is no longer provisional) is the single function the
  real intake replaces.
- **Q6 — the notation mapping is approved as proposed**, all ten codes including `MP` as *steady*
  and `RP10` as *interval*. No new abbreviations were minted; a test asserts no generated plan ever
  emits a label outside `notation.md`'s nine.
- **Naming.** The `PROVISIONAL_*` constants are renamed to what they now are —
  `DEFAULT_RUNNER_PROFILE`, `TWO_QUALITY_TRACKS`, `INJURY_STATE_WITH_DECLARED_INJURY` — and
  `openQuestions.ts` documents rulings rather than provisionals. Both filenames are kept so the
  links already pointing at them from this file and `AGENTS.md` keep working.

## 2026-09-09 (later) — the retained-quality long-run floor lands (Task 2)

Branch `fm/v22-3day-peak-below-base`, on top of Task 1's `f956d11` (the entry below). That entry
recorded the `retainedQuality` floor correction as still pending under **GitHub issue #99**; this
is that correction, and it closes the pending half of the pair.

- **`buildGenericWeek`'s `longRunStartFloor` now derives from `retainedQuality`, not the full
  `quality` array.** At three or four running days only Q1 is retained (source § 6), so the old
  derivation floored the pre-clamp long-run candidate on a Q2 interval session the layout never
  schedules — inflating it for exactly those layouts. The correction was held back out of the
  previous PR because that inflated floor was *masking* the 3-day peak-progression undershoot;
  Task 1's `peakCapacityLongRunKm` now holds the peak floor, so the start floor can safely read the
  week it actually builds.
- **Plan shapes do move, in one direction and by one kilometre.** On the same 22,000-plan sweep
  (5K/10K/half/marathon/no-race × 5 experience levels × 3–7 days × 10–110 km per week ×
  6/8/10/12/14/16/20/24 weeks, with and without a recent 10K time), **348 of 22,000 plans change**:
  long-run distances drop 1 km where an unscheduled Q2 had been setting the floor.
- **Zero new regressions, by membership and not just by count.** Broad "peak below pre-peak
  loading" offenders hold at **770** and literal "peak below base" at **470**, unchanged from
  Task 1's baseline (pre-Task-1: 954 broad, 470 literal), and the committed exact-membership mask
  gate — the "records the exact Task 1 matrix baseline for the Task 2 zero-new-regression
  comparison" test — passes, so no plan enters the offender set that was not already in it.
- **The residual 470 literal / 770 broad offenders are pre-existing and out of scope.** They
  predate both fixes; the captain's 2026-09-09 decision scoped this pair to a zero-new-regression
  gate, not a curve/phase redesign. They stay owned by **GitHub issue #103**.
- **Progression suite.** The 24-week guard is renamed *"holds the 24-week witness across the
  retained-quality floor correction"* — its pinned peak weeks 17–19 at 23/24/24 km with 9/9/9 km
  long runs are **unchanged** by this task, and that stability is the assertion. Two tests added: a
  three-day peak week's long run is floored against the TR session the week actually schedules
  (4 km inside an 11 km week, where the old floor produced 5 km), and that same plan's peak volume
  stays at or above its own base high-water mark.
- Gates clean: root `npm run typecheck && npm run lint && npm test` (39 suites, 785 tests) and
  `npm --prefix workers run typecheck && npm --prefix workers test` (7 files, 141 tests).

## 2026-09-09 — generic peak-week capacity progression (Task 1)

- Generic non-deload peak weeks now derive the minimum long-run capacity candidate needed for the
  existing easy-run ceiling to carry the already-rendered pre-peak high-water mark:
  `Math.ceil((peakTrainingWeekKm - qualityKm) / (easyCount + 1))`. The candidate is folded into
  `longRunFromCurve` before `clampLongRun`; the existing safety ceilings retain final authority.
  Existing rendered state continues into subsequent peak-deload and taper weeks.
- The dedicated progression suite covers the 20-week regular / 5K / 3-day / 20 km/week / no-recent-
  time witness, the 24-week guard (peak weeks 17–19 at 23/24/24 km with 9/9/9 km long runs), and
  an exact 22,000-plan matrix. Task 1 records 770 broad peak-below-pre-peak-loading offenders as
  the accepted baseline for the zero-new-regression gate; the pre-existing absolute baseline is
  tracked separately by GitHub issue #103.
- The `retainedQuality`-based `longRunStartFloor` correction remains pending under issue #99 and
  must land only after this progression stage is verified. It is not part of this change.

## 2026-09-09 — the Free tier's engine is the 40-plan deterministic library

Branch `fm/v22-library-free-engine`. `npm run typecheck && npm run lint && npm test` (40 suites,
832 tests) and `npm --prefix workers run typecheck && npm --prefix workers test` (141 tests) both
clean.

**The plan engine now splits by tier** (captain's ruling, 2026-09-06): **Free users get the 40-plan
deterministic template library as their entire product; paying users get the existing AI curve
generator.** The library is not a fallback for the generator and not a parameter source for it —
the two never meet.

- **New module `src/lib/planLibrary/`**, a port of `planning/research/plan-blueprint-examples.md`'s
  "V1 deterministic template library". No coaching content was invented; every value traces to a
  numbered section of that document:
  - `registry.ts` — the 40 plan IDs (§ 1), the workout vocabulary (§ 3), the experience-dose ladder
    and operating limits (§ 4), the weekly-volume state machine (§ 5), the 3–7-day placement
    layouts (§ 6), the long-run target ladder (§ 9), the canonical durations 12/14/16/24 (§ 8) and
    the recovery-cadence overlay (§ 10).
  - `calendars.ts` — the four canonical week-by-week calendars verbatim (§ 11 5K/12wk, § 12
    10K/14wk, § 13 half/16wk, § 14 marathon/24wk).
  - `injury.ts` — the H0–H4 state machine (§ 16), all seven injury modules (§ 17), and multiple-
    injury composition (§ 18: highest state wins, the single largest reduction is never summed,
    workout removals are a union).
  - `engine.ts` — `buildLibraryPlan`, implementing § 20's resolution order end to end, plus § 22's
    mandatory disclaimers.
  - `openQuestions.ts` — the six coaching decisions the source document does **not** make, isolated
    in one file so nothing else in `planLibrary/` guesses.
  - Tests: `src/lib/planLibrary/__tests__/registry.test.ts` and `engine.test.ts`, 53 tests.
- **Wiring.** `workers/src/lib/planEngine.ts`'s `createTemplateSkeletonBuilder()` routes
  `tier === 'free'` to `buildLibraryPlan`. Paid tiers are untouched — `buildTemplatePlan` remains
  the AI skeleton. The single uncovered request shape, a Free runner naming no race distance at
  all, keeps the generic template engine; that is open question Q1, not a fallback for the library.
- **Captain rulings honoured.** Recovery-week depth is 15–25% (target 20%), matching
  `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`MAX`, which stay authoritative and unchanged — the
  source library's own stale "35–45% / target 40%" lines were corrected in place in
  `plan-blueprint-examples.md` (§ 2 rule 7, § 5's `RECOVERY` row, "Resolved for the V1 library"
  item 4). All seven injury modules ship despite § 21's unticked clinical-review box. A race date
  that cannot be safely prepared for reports limited preparation, never compression.
- **Six coaching questions are open and captain-only**, written up in the new
  [`docs/reference/coaching/free-engine-open-questions.md`](reference/coaching/free-engine-open-questions.md):
  Q1 Free eligibility for intake naming no race distance; Q2 the SPD/END classification thresholds
  (every runner takes § 7's documented conservative END default today, so the 20 SPD plans are
  unreachable from live intake); Q3 the exact shorter/longer/no-date calendar transforms
  (`deriveReadinessPath`'s `prepared` verdict is the provisional "demonstrates the required base"
  test); Q4 numeric range and eligibility tie-breaks (unnamed bands take their midpoint, "eligible"
  = EXP/COMP); Q5 the H0–H4 derivation, since `IntakeResponses` lacks § 15's six required injury
  fields, so any declared injury provisionally maps to H1 and H2–H4 are implemented and tested but
  unreachable from live intake; Q6 the notation/effort mapping for the seven library codes
  `notation.md` has no label for. Each has a provisional answer in `openQuestions.ts` keyed by the
  same number; when one is ruled on, that file and that doc are the only two places that change.

## 2026-09-07 (later) — the no-recent-time marathoner is bounded; the readiness path is surfaced

Branch `fm/v22-distance-specific-plans`, commit `bd2b0b6`, on top of the squashed `6a9f4a7` (the
entry below). `npm run typecheck && npm run lint && npm test` (38 suites, 778 tests) and
`npm --prefix workers run typecheck && npm --prefix workers test` (7 files, 141 tests) both clean.

**The marathon absolute-ceiling bypass now requires the evidence it was justified on.**
`maxSingleRunKm()` returned `Infinity` for every intermediate/advanced marathon race plan on the
premise that "the 180-minute time cap and spike guard govern instead". That premise is false for a
runner who gave no recent race time — they have no pace, so the time cap cannot be measured — and
for every advanced runner, since `deriveTrainingPaces` derives no easy pace for them (easy is by
feel). Concretely, a 110 km/week advanced marathoner with no recent time rendered a **38 km** long
run, above the blueprint's own `COMP` ≤35 km (`plan-blueprint-examples.md` § 4 "Experience-specific
operating limits": NEW/SOME ≤14, REG/EXP ≤25, COMP ≤35 km).

- **`maxSingleRunKm(level, raceDistance, context?)`** takes `{ readiness, easyPaceSecPerKm }` and
  returns `Infinity` **only** for a `prepared` runner whose easy pace makes the time cap
  computable. Every other marathoner — no recent time, advanced, first-timer, or a caller passing
  no context — keeps the flat `MAX_SINGLE_RUN_KM` table. Two consequences worth knowing: an
  advanced marathoner's absolute ceiling is therefore always 35 km (exactly § 4's `COMP` limit),
  and `MAX_WEEKLY_KM.intermediate` is 70 km, so 35% of it is under 25 km at every volume — the
  intermediate bypass can only ever matter through the time cap. The captain's 35% share cap
  (`MARATHON_LONG_RUN_SHARE_CAP`) is unchanged and remains the binding ceiling for the ship-gate
  profile. **Where the two entries below say the absolute ceiling "remains non-binding
  (`Infinity`)" for intermediate/advanced marathon race plans, they describe the code before this
  commit.** The separate marathon absolute calibration itself is still captain-pending — this
  commit narrows when the bypass applies; it does not settle the number.
- **Readiness carried through.** `ReadinessPath` lives in `src/lib/planTypes.ts` (re-exported from
  `planTemplates.ts`); `deriveReadinessPath`, `READINESS_WEEKLY_KM_THRESHOLD` (5K 15 / 10K 25 /
  half 35 / marathon 45 km/week) and the new `FIRST_TIMER_MIN_WEEKS` (5K 12 / 10K 12 / half 16 /
  marathon 16 — the low end of the research's first-timer duration ranges) are exported.
  `Plan.readinessPath?: ReadinessPath` is set on race plans only. Readiness feeds the long-run
  absolute ceiling above and two new disclaimers on first-timer race plans. Neither is coaching
  content — the numbers are the engine's own thresholds and the runner's intake:
  - a first-timer disclosure naming which capacity check sent them there, in their own numbers:
    "This plan takes the first-timer path — a longer aerobic foundation before race-specific work,
    with long runs held to your level's ceiling — because no recent result at 10K or longer shows
    the long-run base a marathon block assumes." The volume variant reads "…because your current
    30 km/week is below the 45 km/week a prepared Marathon block assumes".
  - when the runway is shorter than `FIRST_TIMER_MIN_WEEKS`, a limited-preparation disclosure per
    § 8 "Shorter race date" rules 3–4: "With 12 weeks to race day, under the 16 weeks a first-timer
    Marathon build normally needs, this is a safe completion plan rather than full preparation. It
    keeps the taper and race week and does not try to compress fitness into the time available."

  Prepared runners get neither line.
- **The ship gate, proven** — new suite `src/lib/__tests__/planTemplates.noRecentTime.test.ts`.
  Profile: advanced (`competitive`), marathon, 60 km/week, 5 days, 16 weeks, no recent performance.
  Every long run is ≤35% of its share denominator; loading weeks sit on `floor(0.35 × volume)`;
  the peak loading week renders a 31 km long run in a 91 km week (cap 31.85 km, 34.1%); with
  `longRunShareCap` mocked to `Infinity` the same plan breaches 35%, which proves the cap is what
  binds, not the curve. At 110 km/week, 6 days the long run is 35 km (38 km before the fix). Also
  pinned: no numeric pace on any workout without a recent time, even with a goal time declared;
  `hrZone` still present on paid; the `maxSingleRunKm` contract table.
- **Rebase.** The branch was rebased onto `origin/main` after PR #88 (`9fb3b33`) landed. #88 is a
  reviewed evolution of this branch's first two commits, so those were dropped and the later work
  squashed into `6a9f4a7`. Merge resolutions kept main's landed shapes (ladder floored at the flat
  cap, whole-kilometre spike ceiling, largest-first `reconcileVolumeToTarget`, easy-run ceiling
  tracking the clamped long run, `placeWorkouts`' `{ padMissing }` option) and the branch's
  additions (35% marathon share cap, `maxSingleRunKmOverride`, `preRaceSchedule`/`preRaceBudgetKm`
  peak-bounded race week with the single-shakeout exception, in-loop rendered-week share
  measurement). The orphaned JSDoc on `clampLongRun`'s args in `loadRules.ts` — the compile break
  the earlier rebase left — is fixed. Test expectations re-pinned as a consequence, each verified
  against a printed plan: profile F (10K, 20 km/wk, 4 days) long runs are now [4, 5, 5, 5, 6, 7, 7]
  on the 10K curve; profiles L and N join the rising-window set, and the anti-freeze stall check
  now distinguishes a cap-bound flat long run (`floor(cap × volume)`) from a freeze; the reconcile
  profile's week 5 is 25 km with an 8 km long run (no longer a curve dip); the four underfunded
  10 km/week half/marathon 6–7-day race weeks get one 2 km shakeout (race day alone exceeds their
  peak week); the 12 km/week, 6-day 5K race week is `ER:3, SR:2` (peak 15 km − 10 km race day =
  5 km budget).
- **Known, unchanged.** The three-day intermediate/advanced marathon plateau survives the merge: a
  50 km/week, 16-week, 3-day intermediate marathon renders 32 km every loading week (26 km on
  deloads) and an 11 km long run throughout. It is disclosed by `THREE_DAY_MARATHON_DISCLAIMER`
  per the earlier ruling and is not changed here; now recorded under "Known debt" in
  `docs/mvp-progress.md`.
- **Found in review, deliberately deferred (2026-09-08): `longRunStartFloor` derives from the full
  `quality` array, not from `retainedQuality`.** At three and four running days Q2 is dropped
  (`retainedQuality = quality.slice(0, 1)`), so a peak week floors its long-run candidate on an
  interval session it does not schedule. Deriving the floor from `retainedQuality` is the correct
  reading, and it was tried here and reverted: a 22,000-plan before/after sweep showed **518 plans
  move, no long run ever moves up, the largest long-run drop is 3 km, 3-day weekly volume falls by
  up to 6 km, and a peak week can render below its own base weeks.** That undershoot is a separate,
  pre-existing 3-day progression defect the lower floor merely unmasks (the single easy run is
  itself capped at the long run), so it is filed for the captain as **GitHub issue #99** and this
  PR ships no plan-shape change. For the record, the profile raised in review — advanced / 5K /
  4 days / 35 km per week / 10 weeks — **does not move**: its peak long run is 15 km in a 47 km
  week both before and after, because the curve target dominated the floor in both derivations.
- **Found in review and fixed (2026-09-08): a no-race 10K block ended its long run on a recovery
  dip.** Dropping the race taper was not enough on its own. `TEN_K_LONG_RUNS`' 4-week dip cadence
  lands on its last pre-taper entry (index 11), where 5K, half and marathon all place their peak,
  so a duration plan built on the 10K curve wound the long run down in its final week while the
  volume curve was still rising — the same "tapering for a start line that does not exist" defect
  `taperAwareCurve` exists to prevent, one week earlier, and the same captain's ruling (2026-08-15)
  that a no-race plan never ends on a deload. The no-race read of that one curve now substitutes
  `TEN_K_LONG_RUNS_NO_RACE` — the same twelve pre-taper entries with the last one, and only the
  last one, replaced by the curve's own peak (12 → 17 km). The engine already forces a no-race
  plan's final week to be a loading week (`endsOnForcedLoadingWeek`), so the peak is the matching
  long run for it, and 17 km is this curve's own approved value, not a new one. Deliberately a
  substitution rather than truncating the tail: `interpolateCanonical` samples by array length, so
  a shorter curve would re-scale every week of the block and slide the recovery dips off the deload
  weeks. Same length, same twelve sample positions, dips still on weeks 4 and 8. The race read of
  `TEN_K_LONG_RUNS` is untouched and still tapers 12 → 11 km, and no other distance is affected.
  Before/after for an intermediate, 5 days, 50 km/week, 12-week 10K duration plan — the final week
  is the only week that moves: long runs `[13, 14, 15, 11, 17, 18, 19, 14, 20, 20, 21, 17]` become
  `[13, 14, 15, 11, 17, 18, 19, 14, 20, 20, 21, 21]`, so the closing 67 km week no longer drops
  below the preceding 66 km week's 21 km. Pinned by `planTemplates.noRace.test.ts`' "ends a no-race
  10K block on its peak long run", which also pins the two deload weeks against a re-scale.

## 2026-09-07 — marathon share cap finalized; race-week placement corrected

The previous round capped the pre-race shakeout floor at the taper ratio, which moved the defect
rather than removing it: for a low-volume runner training often, the floor went inert and the
budget was spread thinner than a real run per day — the exact 1 km filler signature the §1.4
race-week fix exists to prevent. Bounding the budget harder alone was not the answer either; the
two rules (fit inside the peak week, give every pre-race day a real run) genuinely conflict once
race day is most of the runner's biggest week.

**The pre-race budget is now bounded by the peak week's room above race day, and surplus days are
dropped to rest.** `preRaceBudgetKm` returns `min(ratio, peak − raceDay)` with no floor; the new
`preRaceSchedule` converts that into however many days it can fund at 2 km each, and the rest of
the week is genuine rest. `placeWorkouts` grew a `padMissing: false` option because it pads any short
week with 1 km filler runs — race week now opts out, so the dropped slots come out as rest instead
of silently re-adding what was just removed. Surviving pre-race workouts are right-aligned into
the latest available slots, preserving their order so SR remains the final workout before race
day. For the 12 km/week, 6-day example that is **two** 2 km workouts — ER on Thursday and SR on
Saturday — not three 2 km runs or a Monday-first placement.

Concrete, 5K / 10 weeks / 6 days a week (all three are permanent regression profiles now):

| runner | pre-race days, before | after | race week total | peak |
|---|---|---|---:|---:|
| 12 km/week | 2, 1, 1, 1, 1 km (1 rest day) | **2, 2 km (4 rest days)** | 16 → **14** | 14 |
| 9 km/week | 1, 1, 1, 1, 1 km (1 rest day) | **2 km (5 rest days)** | 15 → **12** | 8 |
| 5 km/week | 1, 1, 1, 1, 1 km (1 rest day) | **2 km (5 rest days)** | 15 → **12** | 7 |

For a low-volume runner training 5–6 days a week before a short race, race week therefore contains
**fewer running days than before**, with the removed slots as real rest. That is the intended
coaching change: three token kilometres in the four days before a goal race are not a taper.

**The one place the peak bound yields**, documented on `preRaceSchedule` and pinned by its own
test: where race day alone already meets or exceeds the peak week (the 9 and 5 km/week rows above),
a single 2 km shakeout is scheduled anyway rather than shipping a race week with no running but the
race. The overshoot is exactly one minimum run and cannot grow with day count; above that regime
the bound is absolute.

**Profile-list audit** — the fourth coverage hole on this branch, so the matrix was audited rather
than just patched. Added permanently to `planTemplates.genericLongRun.test.ts`'s `PROFILES`:

- **L** (5K, 12 km/wk, 6 days) and **M** (5K, 9 km/wk, 6 days) — the low-volume/high-frequency
  corner. The `>= 2 km` pre-race assertion had existed since the §1.4 fix but no profile could
  reach the regime where the budget and the day count conflict, so it could not fail.
- **N** (beginner marathon, 30 km/wk, 20 weeks) — keeps the beginner-only combination of the
  run-count-scaled share ladder and 14 km absolute ceiling under test. B/G/I/K now exercise the
  captain's final 35% marathon share cap; only their separate absolute-kilometre assertion remains
  intentionally non-binding (`Infinity`).

Remaining invariants were each checked for a profile capable of violating them: the `clampLongRun`
replay (C, the audit's own breach), the spike guard (B/I, where it is the only live ceiling), the
taper-down rule (A/J/L/M), the race-week-vs-peak and headroom bounds (weeklyKm 9/12/20 × 3–6 days),
and the curve-dip monotonicity checks (5K no-race, advanced marathon). No invariant is left without
one.

**Marathon long-run share is now final at 35% for intermediate/advanced race plans.** The
distance-aware `MARATHON_LONG_RUN_SHARE_CAP` is `0.35`, measured against the rendered loading week
or the last loading week for a valid deload. The separate `maxSingleRunKm()` calibration remains
non-binding (`Infinity`) for those runners and is still captain-pending; the unchanged 180-minute
duration cap and 1.10× spike guard remain active. Beginner behavior is unchanged.

Generated survey — 50 km/week, 16 weeks, intermediate, recent half-marathon performance:

| Days/week | Old level/run-count cap | Temporary `Infinity` stage | Final 35% share cap |
|---|---:|---:|---:|
| 3 | 25 km | 28 km | **11 km** |
| 4 | 19 km | 28 km | **24 km** |
| 5 | 16 km | 28 km | **24 km** |
| 6 | 8 km | 28 km | **24 km** |

The four-day plan is the headline genuine marathon progression: 24 km versus the old
stretched-5K 19 km (and the audit's approximately 21 km observation). Three days is constrained
by the sourced E + Q1 + LR layout and fixed Q1 dose; the generated plan now discloses that its
11 km fixed point is limited preparation and recommends a fourth running day. The source-corrected
adaptation keeps Q1 and drops Q2 before easy support at both three and four days; five or more days
may retain Q2.

The cap does not repair the separate structural caveat: fixed long-run-curve dips still do not
realign to `deloadEveryWeeks` on noncanonical durations. It limits magnitude only. Valid deloads
continue to use the last loading week's denominator, so their displayed own-week ratio is not
required to be at or below 35%.

## 2026-09-06 (final) — the 5K/no-race curve loses its dips too, and the pre-race floor is bounded

Two defects the previous round's own fixes left behind, plus a sweep for the error shape that
produced the first one.

- **`FIVE_K_WEEKLY_LOAD_GENERIC`: the de-dipping fix reached only three of the four curves.** The
  previous round removed the fixed-position recovery dips from the 10K, half and marathon curves
  but left `FIVE_K_WEEKLY_LOAD` dipped, on the reasoning that the 5K path "reads its dips directly
  and never calls `deloadVolume`". That is true of `buildCanonicalFiveKWeek` only — which runs at
  exactly one intake (race + 5K + 12 weeks + 4 days). Every other 5K plan, **and every no-race
  duration plan** (`curvesForDistance` hands `undefined` the 5K shape), goes through
  `buildGenericWeek` and hit the identical defect. The generic path now reads a separate,
  de-dipped 12-week array — same 34 km baseline, same 48 km peak, same 40/28 taper tail — selected
  by a new `goldenFiveKShape` flag threaded through `curvesForDistance`/`targetVolumeKm`/
  `targetLongRunKm` and set true only by `buildCanonicalFiveKWeek`, so the byte-pinned fixture and
  `RACE_WEEK_PRE_RACE_SHARE`'s derivation are untouched. `FIVE_K_LONG_RUNS` keeps its dips, as the
  other three long-run curves do.

  Profile E (general fitness, age 55, `regular`, 4 days/week, 30 km/week, 12 weeks, no race —
  deload cadence 3, curve dips at 4 and 8, so the two disagree):

  | | week-by-week volume (D = flagged deload) |
  |---|---|
  | before | 29, 30, **24D**, **27**, **24**, **19D**, 26, 29, 23D, 30, 33, 36 |
  | after | 29, 30, 24D, 32, 33, 26D, 35, 36, 29D, 38, 39, 39 |

  Before, weeks 4 and 5 were suppressed without being flagged as recovery, week 4's 27 km became
  the growth base, and the block never recovered — three consecutive down weeks and a plan that
  ends below where a clean progression starts. After, every loading week climbs and the deloads are
  the only dips. Regression: a no-race profile-E case in `planTemplates.distanceSpecific.test.ts`,
  verified red before the fix.

- **`preRaceBudgetKm`'s shakeout floor is now bounded by the taper ratio.** The floor could
  override both the ratio and the peak-relative bound and *raise* race-week volume: a 12 km/week
  runner racing a 5K got 4/6/8/10 km of pre-race running at 3/4/5/6 days a week — more taper volume
  purely for training more often, past their own peak week. Both terms are now individually capped
  at the ratio, so the result cannot exceed it; that profile now plateaus at 6 km from 4 days
  upward. The floor deliberately still outranks the peak headroom for runners whose race is most of
  their biggest week — bounding it there instead reinstates the §1.4 filler-day bug (verified: it
  breaks the three low-volume race-week profiles in `planTemplates.genericLongRun.test.ts`).

- **The race-week regression test's allowance was circular** — it re-derived the budget function's
  own `MIN_PRE_RACE_RUN_KM` floor, so it could not fail in the region that just regressed. It is
  rebuilt from the plan's own peak training week and race day alone, and asserts the training
  component rather than the total. The floor regression is covered separately by comparing two
  generated plans against each other (pre-race volume must not grow with day count), which needs no
  constant from the function under test.

- **Sweep for over-generalized "the 5K path" claims** (the shape of error behind the first item —
  a statement true only at the pinned fixture, written as if it covered the distance). Checked
  every `golden`/`5K path`/`canonical 5K` reference in `planTemplates.ts` and `loadRules.ts`:
  - `RACE_WEEK_PRE_RACE_SHARE`'s "a 5K race day is small enough that the bug never bites there" —
    **corrected**: true only at the pinned 35 km/4-day intake, and a low-volume 5K on the generic
    path is in fact the ratio's tightest case.
  - `TAPER_ENTRIES`' "every plan's volume curve is interpolated from them" — **corrected**: that
    was true before this branch added three distance curves and, now, the generic 5K array.
  - Quality-distance scaling ("generic scales by the week's own volume, golden by declared
    `weeklyKm`") — checked, both halves accurate, no fix.
  - Long-run ceiling ("the canonical 5K path keeps its own literal `longDistanceKm * 0.8`") —
    checked, both literals are inside `buildCanonicalFiveKWeek`, no fix.
  - 50+ deload weeks 4/8/12 "on this golden path" — checked, inside `buildCanonicalFiveKWeek`,
    which only ever runs at the pinned intake, no fix.
  - `loadRules.ts`'s run-count-scaled share cap and `shareCapOverride` notes — checked, both name
    `buildCanonicalFiveKWeek` explicitly as the exception, no fix.

## 2026-09-06 (latest) — review-round corrections to the distance-specific plan work

Five defects found reviewing the two entries below, each confirmed against generated plan output
before fixing. Regression coverage for all of them lives in
`planTemplates.distanceSpecific.test.ts`'s "distance-aware ceilings and the curves that feed them"
suite; every test in it fails against the pre-fix code.

- **`longRunShareCap()` bypassed the weekly-share ceiling for BEGINNER marathon runners too.** It
  short-circuited on `raceDistance === 'marathon'` before consulting `level`, so a first-time
  marathoner lost their only volume-relative ceiling — contradicting both the ruling below and
  `load-rules.md`, which scope the bypass to `intermediate`/`advanced`. Now gated on
  `level !== 'beginner'`, matching `maxSingleRunKm()`'s existing gate.
- **An easy run could end up longer than the week's own long run.** The per-easy-run ceiling is
  deliberately frozen at the pre-clamp long-run candidate (it keeps a low-volume week able to
  absorb its volume), but `clampLongRun`'s time cap and spike guard bite only on the long run — so
  the kilometres they removed were handed back to the easy days under the stale, larger ceiling. A
  3-day/50 km-week/16-week marathon plan shipped a 31 km "easy run" beside a 28 km long run. The
  convergence loop is unchanged; only the final distribution is now additionally bounded by the
  long run the clamp settled on.
- **Race week's pre-race budget is now bounded by the plan's own peak training week minus race
  day** (`preRaceBudgetKm`). `RACE_WEEK_PRE_RACE_SHARE` is read off the 5K fixture's
  race-*inclusive* total, and race day is then stacked on top of it uncounted — for a marathon the
  47 km race day is larger than the entire scaled race-week entry, so the final week of a plan
  labelled `taper` reported as its biggest week. Race day is a fixed cost, so it is subtracted
  from the peak first and the tapered training component takes what is left. The floor is a 2 km
  shakeout per pre-race day, which keeps the §1.4 fix (no 1 km filler days) intact for a
  low-volume runner whose race alone already outweighs their peak week — there the overshoot is
  the race itself, never budget the engine chose. 5K and 10K race weeks at realistic volumes are
  unaffected (the ratio is already the smaller term), and the byte-pinned golden 12-week/4-day 5K
  path keeps its own literal subtraction. Regression:
  `planTemplates.distanceSpecific.test.ts`'s race-week-versus-peak case, verified red against the
  pre-fix engine.

  An earlier revision of this fix bounded the budget by `lastLoadingWeekKm × 0.6` instead. That
  guard was inert — `lastLoadingWeekKm` at race week is the preceding taper week, always well
  above the threshold at which the term could bind — so it has been removed rather than kept as
  dead code shaped like protection.
- **The three new weekly-load curves no longer encode their own recovery dips.**
  `TEN_K_WEEKLY_LOAD`, `HALF_WEEKLY_LOAD` and `MARATHON_WEEKLY_LOAD` had dips on a fixed 4-week
  cadence, while `buildGenericWeek` derives deload weeks independently from `deloadEveryWeeks` (3
  weeks for advanced and for 50+). Where the two disagreed the curve's dip landed on an unflagged
  week, became `lastLoadingWeekKm`, and throttled every week after it — a 24-week/60 km/5-day
  advanced marathon plan peaked ~10 km/week below an otherwise identical intermediate one. The
  arrays are now smooth ramps with the same canonical durations, baselines, peaks and taper tails;
  recovery is owned solely by `deloadEveryWeeks`/`deloadVolume`. The four LONG_RUN curves keep
  their dips (there is no separate deload formula for the long run) and the byte-pinned
  `FIVE_K_WEEKLY_LOAD` is untouched.
- **The loosened marathon ceilings are now scoped to race plans.** They were computed from
  `raceDistance` alone, so a duration/no-race block that merely named marathon as an aspirational
  distance also got them; now gated on `isRacePlan`, matching how `deriveReadinessPath` already
  scopes itself.
- Doc corrections: `clampLongRun`'s header and `load-rules.md`'s deload-validity predicate both
  still quoted the superseded 35–45% band (now 15–25%), and `load-rules.md` now states that
  beginner is excluded from both marathon bypasses, not just the absolute one.

## 2026-09-06 (later) — marathon ceilings made distance-aware; share later settled at 35%

The task's `needs-decision` (`[key=marathon-longrun-share-cap]`) split one engineering change from
two coaching calibrations. `longRunShareCap()` and `maxSingleRunKm()` (`src/lib/loadRules.ts`) were
made distance-aware without raising the general intermediate/advanced ceilings, which would also
loosen 5K plans. Beginner marathoners retained their run-count-scaled share ladder and 14 km
absolute ceiling throughout.

The temporary plumbing stage set both intermediate/advanced marathon overrides to `Infinity` and
produced a 28 km peak across 3–6 days for the 50 km/week, 16-week survey. Ian subsequently settled
the weekly-share half at **35%**; `MARATHON_LONG_RUN_SHARE_CAP` is now `0.35`. The separate absolute
kilometre ceiling remains `Infinity` pending calibration. The unchanged 180-minute duration cap
and 1.10× recent-longest-run spike guard remain active alongside the share cap.

The final survey is 11/24/24/24 km at 3/4/5/6 days. The three-day fixed point follows the sourced
E + Q1 + LR layout and fixed Q1 dose; generated plans disclose the limitation and recommend a
fourth running day. The four-day 24 km peak is the headline comparison against the old stretched-
5K 19 km result. Full final policy and denominator behavior:
`docs/reference/coaching/load-rules.md` § "Long-run cap, by level".

## 2026-09-06 — distance-specific plans, deload ruling reversed to 15-25%

Closes the core-purpose audit's headline finding: every distance except the byte-pinned golden
5K fixture read `FIVE_K_WEEKLY_LOAD`/`FIVE_K_LONG_RUNS`, scaled by the runner's own weekly km — so
a marathon, half, or 10K plan was a 5K plan's curve wearing that distance's phase weights. Rebased
onto, and builds on top of, the 2026-09-05 (later) long-run-cap/race-week fixes below.
`npm run typecheck && npm run lint && npm test` (37 suites, 617 tests) and
`npm --prefix workers run typecheck && npm --prefix workers test` (7 suites, 141 tests) both clean.

- **Distance-specific weekly-volume and long-run curves.** New `TEN_K_WEEKLY_LOAD`/
  `TEN_K_LONG_RUNS`, `HALF_WEEKLY_LOAD`/`HALF_LONG_RUNS`, `MARATHON_WEEKLY_LOAD`/
  `MARATHON_LONG_RUNS` in `planTemplates.ts`, selected by `curvesForDistance()` and normalized to
  the same 35 km/week reference runner as the existing 5K arrays. Raw target shapes follow the research's
  already-resolved architecture (`plan-blueprint-examples.md` §§ 5, 11–14: canonical durations
  12/14/16/24, recovery-week positions) with pre-safety-clamp peak long-run shares climbing from ~31% (5K) to ~33%
  (10K), ~40% (half), ~50%+ (marathon) — Examples B/C/D and the long-run ladder (§ 9). Exact
  per-week workout content from that same document (§§ 11–14's dose tables) is deliberately NOT
  implemented — that document's own status is "coach-review source... not yet application
  behavior," Ian's review still unchecked. The shared phase-based tempo/interval primitives remain,
  with the source's schedule adaptation corrected so 3–4-day plans retain Q1 only and drop Q2
  before easy support; 5+ days may retain Q2.
  - Final headline case: a 50 km/week, 16-week intermediate marathon plan at 4 days/week peaks at
    24 km, up from the old stretched-5K result of 19 km and past the audit's cited ~21 km ceiling.
    The 3-day E + Q1 + LR plan is mathematically constrained to 11 km by the final 35% cap and
    fixed Q1 dose, so it carries a visible limited-preparation disclosure and recommends a fourth
    running day. New
    regression suite `planTemplates.distanceSpecific.test.ts` compares distances directly against
    each other and against a literal reconstruction of the old output — the
    already-existing `clampLongRun`-replay style oracle (`genericLongRun.test.ts`) cannot catch
    this class of bug, since it passes equally on a genuine target and a stretched one.
  - **Remaining calibration, not silently reconciled:** the marathon weekly-share override is now
    final at 35%, but `maxSingleRunKm()` remains non-binding for intermediate/advanced marathon
    race plans pending a separate absolute-kilometre ruling. The existing 180-minute duration cap
    remains active. Fixed-position long-run-curve dips also remain structurally misaligned with
    `deloadEveryWeeks` on noncanonical durations; the 35% cap limits magnitude but does not realign
    the curve.
- **Readiness path (first-timer vs prepared runner entering a race-specific block).** New
  `deriveReadinessPath()`: a first-timer (weekly km below this file's own reasonable read of
  Examples A-D's illustrative intake ranges, or — for marathon specifically — no recent
  performance at 10K or longer as a proxy for "longest run in the last 30 days," since intake has
  no dedicated longest-run field) gets a phase-weight shift from `peak` into `base` — more
  aerobic foundation, less race-specific work, for the same plan length. Driven only by
  `weeklyKm`/`recentPerformance`, never `goalTimeSec` (task's explicit requirement, mirroring how
  `deriveTrainingPaces` already reads capacity, not ambition). Applies only to an actual race
  entry (`isRacePlan === true`) — a no-race/duration block has no "entering a race-specific block"
  decision to make.
- **Deload reduction band reversed to 15-25% (Ian's ruling, 2026-09-06), superseding 35-45%.**
  The research (`report-source.md`) found McMillan's own public marathon guide uses 15-25% down
  weeks, conflicting with V2.2's imported-examples-derived 35-45% figure. Asked to choose rather
  than have it resolved silently, Ian chose the published figure — recovery weeks are shallower
  across every generated plan now, not just marathon ones. Full history:
  `docs/reference/coaching/load-rules.md` § Deload trigger.
  - **Confirmed interaction with the 2026-09-05 long-run-cap work, and a deliberate exception
    rather than an open divergence (Ian's ruling, 2026-09-08,
    `[key=golden-deloads-outside-new-band]`):** the byte-pinned golden 12-week/4-day 5K fixture's
    own weeks 4/8 dips (~39.5%/~37.5%, from `example-plan-5k-pro.md`) fall outside the tighter
    band, so they no longer count as "a genuine deload", which flips `clampLongRun`'s weekly-share
    denominator from the prior loading week to the deload week's own (smaller) volume for those
    two weeks — tightening their long runs from 8/10 km to 7/9 km. Asked whether to reshape those
    dips into the band, Ian ruled they stay exactly as authored: the 15-25% band is authoritative
    for every generic-path deload, and the golden plan's weeks 4 and 8 are the one ruled exception
    to it. Both the generated golden fixture's tests and the hand-built
    `src/lib/fixtures/examplePlan.ts` screen fixture were updated to the new, correctly-computed
    numbers; neither curve's own authored weekly-volume values changed.

## 2026-09-06 — long-run cap and race-week fixes, core-purpose audit §1.2/§1.4

Closes the audit's two pure rule-enforcement findings
(`/Users/Guestyyyyyyyy/firstmate/data/v22-core-purpose-audit-r1/report.md`). Its other findings —
per-distance training content, deload session shape (§1.1, §1.3, §1.5–§1.9) — are unrelated and
untouched; they stay open, captain-content-blocked.

**Verification, as measured — the "36 suites, 610 tests clean" line this entry originally carried
was written before the review rounds below and was not true while they were in flight.** The final
focused pass is green at 3 suites / 177 tests, including generated marathon and half-marathon
plans, underfunded 6/7-day race weeks, and a pace-known marathon that exercises the
three-hour ceiling. ESLint is clean on the two changed source files and `git diff --check` passes;
the repository-wide gate belongs to the delivery pipeline.

- **§1.2 — `buildGenericWeek` never called `clampLongRun()`.** Every 10K, half, marathon and
  general-fitness plan (everything off the golden 12-week/4-day 5K path) computed its long run
  from the curve and volume budget with none of the documented share/spike/absolute/time caps
  enforced — the audit reproduced a 34 km long run in a 64 km week (53% against a 35% cap) and
  deload-week breaches up to 86%. Both paths now call `clampLongRun()`: the generic path supplies
  its run-count-scaled share cap and whole-kilometre rounded-up spike ceiling, while the
  coach-authored golden path deliberately keeps the flat share table and raw fractional spike
  ceiling. On the generic path, `longRunStartFloor` is only the pre-clamp starting candidate and
  `easyRunCapKm` follows the final clamped long run, so an easy run cannot outgrow the LR that
  actually ships. Quality sessions are not bounded by LR; Ian explicitly accepted that a safety
  cap can put LR below a tempo/interval session rather than silently changing its stimulus.
- **Long-run share cap now scales with weekly run count — captain's ruling on issue
  `longrun-share-cap-floor`.** Fixing the wiring bug surfaced a deeper one: a flat per-level cap
  is arithmetically impossible below a run-count-dependent threshold (an n-run week's largest
  entry is never under `1/n` — 33% at 3 runs/week, already over every level's flat cap), which is
  why the audit's beginner and 3-day profiles breached the cap on *every* loading week regardless
  of the wiring fix. Ian's ruling: the cap always wins, even where that puts the long run below a
  quality session that week, and it must scale by run count rather than stay flat — "a 3-day week
  legitimately carries a larger share than a 6-day week; that is normal training, not a breach."
  New: `loadRules.ts`'s `longRunShareCap(level, runCount)`. The flat `LONG_RUN_SHARE_CAP` table is
  untouched and still governs the byte-pinned golden 5K fixture. Consequence, also per the ruling:
  the long run is no longer guaranteed to be "the week's longest run" — `notation.ts`'s LR entry
  and `planTemplates.ts`'s `LONG_DESCRIPTION` no longer claim it (docs mirrored in
  `docs/reference/coaching/notation.md`). Full ruling, formula, and before/after numbers for the
  audit's own cited breaches: `docs/reference/coaching/load-rules.md`'s 2026-09-05 entry.
- **§1.4 — race week was assembled from the race-day budget.** `raceDayWorkout`'s distance (race +
  5 km warm-up/cool-down — 47 km for a marathon) was charged against the race week's own volume
  budget; once the race alone exhausted it, every day before the race fell to
  `distributeDistance`'s 1 km floor (a marathon race week of three 1 km runs plus the 47 km "race
  day"). Pre-race days are now sized from `RACE_WEEK_PRE_RACE_SHARE`, a share of the taper-curve
  target read straight off the approved 12-week 5K fixture's own race week (18 of its 28 km is
  pre-race running) — no new coaching content, the race day sits on top instead of competing with
  it for budget. **Both paths use it.** The golden 5K path was first left on the literal
  subtraction, on the reasoning that a 5K race day is too small for the bug to bite there — which
  was false away from the fixture's own 35 km baseline (a 12 km/wk beginner's golden race week
  rendered `1 km | 1 km | 1 km | Race Day 10 km`). At 35 km the share and the subtraction agree
  exactly, so the pinned fixture is unchanged; across 480 golden intakes the eleven training weeks
  are numerically and structurally identical to `adc3aa0`; `effortDescription` intentionally
  differs because LR copy no longer promises it is the week's longest run. The 90 golden intakes
  that rendered a 1 km filler race week now render none. On the generic path, a race-week budget
  too small to fund every requested pre-race slot at the existing 2 km non-filler threshold now
  schedules fewer pre-race runs and leaves the unused slots as rest. It keeps the original layout:
  Race Day is Day 7 and SR is the final run before it. Normally funded audit profiles B/C and the
  golden fixture retain their existing run counts and numeric distances.
- **Review follow-up (same day): the ladder is floored at the flat table.** The first revision of
  `longRunShareCap` was a bare `margin / runCount`, which raised the cap at low run counts as the
  ruling required but also *lowered* it at high run counts — advanced 35% → 23.3% at six runs a
  week and 20.0% at seven, halving the long runs on the marathon and half plans the flat table was
  signed off for (an 80 km/wk half runner peaked at a 16 km long run). Nobody ruled on that.
  `longRunShareCap` is now `max(flat cap, margin / runCount)`: 4–7-run weeks are byte-identical to
  the flat table again, and only the 3-run weeks that motivated the ruling move. The half runner
  above now peaks at 27 km, the 50 km/wk marathon at 18 km.
- **Review follow-up: `src/lib/fixtures/examplePlan.ts` no longer claims "the week's longest
  run" either.** The permanent example plan every signed-in user can open still carried the retired
  wording next to the glossary entry that had already dropped it. Same copy as the engine now.
- **Review follow-up: the golden 5K path calls the clamp and is verified against the caps, not
  silently exempt.**
  `planTemplates.longRunCap.test.ts` gains a sweep of that coach-authored path across every level,
  age band and declared volume it is reachable with. It calls `clampLongRun()` with the flat share
  table and raw spike ceiling; its authored numbers already fit, so the clamp returns them
  unchanged. The share, spike and absolute ceilings are also asserted over its output. The
  share is measured with `clampLongRun`'s own denominator — the last loading week when the week is a
  genuine deload against it (`isValidDeload`), otherwise the week's own volume. An earlier revision
  of this entry claimed that denominator had been *tightened* to `max(own, last loading)`; that
  claim is withdrawn as false. Taking the larger of the two can only shrink the measured share, so
  it was strictly weaker, and it has been reverted. **No ratio-based share check can catch a week
  where the long run and the week's total collapse together** — the golden 12 km/wk beginner's
  week-4 "deload" is a 4 km total of four 1 km runs, and 1/4 = 25.0% sits exactly on the beginner
  cap whichever denominator is used. That needs an assertion about absolute degeneracy, which this
  suite does not have.
  **Still open, and Ian's to rule on:** that path never grows the long run for three beginner
  intakes, whose biggest week also stays under the volume the runner declared (12 km/wk → 2 km long
  run in a 10 km week; 20 km/wk → 3 km / 17 km; 30 km/wk → 5 km / 27 km). Those figures are pinned
  by test so the gap is visible and any drift fails, rather than silently fixed by reshaping a plan
  that is the captain's own coaching.
- **Review follow-up: the clamp is closed against the volume the week actually renders.** The
  convergence loop measured the long run's share against the *assembled* sum of its sessions, which
  `distributeDistance`'s 1 km-per-session floor can push above the week's target;
  `reconcileVolumeToTarget` then trimmed the week back to the target and the rendered share climbed
  back over the ceiling the loop had just satisfied. A 5-day advanced 20 km/wk runner's week 5
  settled a 7 km long run against an assembled 20 km and rendered `ER 1 | TR 4 | ER 1 | INT 5 |
  LR 6` — 6 km of a 17 km week, 35.3% against a 35.0% cap. The loop now measures against
  `min(assembled, target)`, and `reconcileVolumeToTarget` removes the overshoot one whole kilometre
  at a time from the largest non-long-run session, only reaching the long run once everything else
  is at its 1 km floor — so an ordinarily funded week lands on target rather than undershooting it.
  When the target is smaller than the number of scheduled sessions, the 1 km/session floor makes
  some overshoot unavoidable; the established tiny-deload behavior is intentionally unchanged.
  That week now reads `ER 1 | TR 5 | ER 1 | INT 6 | LR 6`, 19 km, 31.6%. Share-cap breaches
  across the 5,625-intake sweep: 47,183 on `adc3aa0` → 0.
- **Review follow-up: easy runs follow the final clamped LR, not a pre-clamp candidate.**
  Wiring the clamp in first shipped with the easy-day ceiling frozen at the *pre*-clamp long-run
  candidate and reduced by a kilometre. That cured the volume spiral but left the easy days bounded
  by a long run that never shipped, so they could come out longer than the one that did — a 3-day
  beginner at 15 km/wk drew `ER 5 | TR 3 | LR 4`, a 5 km easy day at 41.7% of a 12 km week against
  a 36.7% cap. A 5,625-intake sweep found 1,648 such plan-weeks on the branch and none on the
  pre-branch engine. Every easy run in a generic week is now bounded by that week's actual
  post-clamp long run — no subtracted kilometre, ties allowed — and the sweep now reports zero.
  Quality/tempo sessions are deliberately outside that ceiling and may be longer than LR. The
  ladder's reachability property (`cap × runCount > 1`) is what keeps the week fillable at that
  shared ceiling, so the spiral does not return. Weeks previously over-filled by an oversized easy
  day do lose volume (mean 3.9 km over the 1,648 affected weeks), and on heavily-clamped weeks
  several runs now legitimately read the same distance.
- **Review follow-up: the spike ceiling was forbidding growth instead of limiting its rate.**
  `clampLongRun`'s spike ceiling was the raw `previousLongestKm × 1.10` while the engine renders
  whole kilometres, so below 10 km the floored ceiling equalled the previous longest (5 km → a
  5.5 km ceiling → back to 5 km) and the long run could never move again for the rest of the plan —
  reaching every beginner plan and every low-volume intermediate one. Now
  `Math.ceil(previousLongestKm × LONG_RUN_SPIKE_MULTIPLE)`; the rendered distance is still floored,
  and the share, absolute and time ceilings still apply as a minimum alongside it, so nothing can
  grow past a ceiling that another rule already imposes. **Scoped to the generic path** via
  `clampLongRun`'s `roundSpikeCeilingUp` argument — the coach-authored golden path omits it and
  keeps its original raw ceiling, verified numerically and structurally identical to `adc3aa0`
  across 480 intakes (5 experience levels × 6 ages × 16 declared volumes): every distance, zone,
  RPE, structure, duration, phase, deload flag and weekly volume matches; `effortDescription`
  intentionally differs because the LR definition changed. Covered by unit tests on
  `clampLongRun` (including two that pin the share and absolute ceilings still binding over the
  loosened spike ceiling) and by a plan-level test on profile E, which used to finish on the same
  9 km long run it started with. See `docs/reference/coaching/load-rules.md`.
- Expanded regression suite: `src/lib/__tests__/planTemplates.genericLongRun.test.ts` —
  every audit runner profile, replayed through `clampLongRun` and checked against the scaled share
  cap, the spike cap, the absolute cap, and the race-week reconstruction, plus two tests pinned to
  the captain's ruling that fail without it (a 3-day beginner week, and a 4-day week where a large
  tempo session used to force the floor over the cap), plus a volume-preservation pair for
  profile F that fails if easy runs stop tracking the final clamped LR. It also generates a
  pace-known, high-volume marathon and proves the rendered long run stays within the three-hour
  ceiling, rather than testing that limit only at the arithmetic-helper level.

## 2026-09-05 — Expo SDK 54 → 57 upgrade

Client-only, one major version at a time (54→55→56→57) per this repo's upgrade etiquette
(`AGENTS.md`'s SDK-bump chain). `workers/` (the Cloudflare backend) was out of scope and untouched.
Current versions per `package.json`: `expo ^57.0.20`, `react-native 0.86.3`, `react 19.2.3`,
`expo-router ~57.0.19`, `react-native-reanimated 4.5.1`/`react-native-worklets 0.10.1`. Commits, in
order: `92b7d85` (54→55), `22b943b` (55→56), `7fea751` (SDK 56 fallout unrelated to
react-navigation), `ad49f61` (the react-navigation fork migration), `d1c2a27` (56→57). `expo-doctor`
21/21, and `npm run typecheck && npm run lint && npm test` clean (34 suites, 545 tests) after every
step.

- **The one structural break, handled by Expo's own codemod.** SDK 56's expo-router forks away from
  `@react-navigation/*` ("most code imported directly from `@react-navigation/*` packages will no
  longer work out of the box alongside expo-router" — Expo's SDK 56 changelog).
  `npx expo-codemod sdk-56-expo-router-react-navigation-replace .` rewrote the two call sites
  (`src/app/_layout.tsx`'s `ThemeProvider`, `src/constants/navigation-theme.ts`'s
  `DarkTheme`/`DefaultTheme`/`Theme`) to import from `expo-router/react-navigation` instead;
  those imports were then moved to the `expo-router` package root, which re-exports the identical
  bindings and is the path SDK 57 documents (the subpath marks all three deprecated) —
  verified as an identical re-export of expo-router's own fork. This also retires the
  V2.2-specific landmine that `@react-navigation/native` was never a declared dependency here, only
  resolved transitively through expo-router under SDK 54/55; nothing in `src/` imports
  `@react-navigation/*` directly anymore.
- **Non-obvious fixes the scout report (`v22-v23-sdk57-upgrade-scout`) didn't and couldn't flag**,
  since it never ran an install:
  - `scripts/generate-router-types.js` called expo-router's private `regenerateDeclarations`
    export, removed outright in SDK 55 with no replacement. Swapped for Expo's documented,
    CI-safe `expo customize tsconfig.json` (stdin closed to skip the interactive overwrite prompt).
  - RN 0.85 removed `StyleSheet.absoluteFillObject`; `absoluteFill` is the same frozen style object
    under its new name. Updated `PulseTraceHero.tsx`'s one use.
  - `eslint-config-expo`'s SDK 56 bump ships `eslint-plugin-react-hooks` 7's new React
    Compiler-readiness rules, which false-positive on Reanimated's documented shared-value `.value`
    mutation and on this app's two deliberate "synchronize not derive" setState-in-effect latches
    (`_layout.tsx`'s session-settled latch, `plan/[id].tsx`'s id-driven sync). Fixed with scoped,
    documented `eslint-disable` comments on each site, not a blanket rule change — this app has
    `reactCompiler: true` in `app.json`, so these rules still matter elsewhere.
  - `@better-auth/expo`'s `^1.6.25` range picked up `1.7.2` mid-upgrade; its `getCookie()` now calls
    `getItemAsync`/`setItemAsync` unconditionally, including on web. The web storage stub only had
    the sync pair, which would have thrown at runtime on web, not just failed typecheck. Added the
    async no-ops.
  - This project's deliberate `typescript ~5.9.2` pin (documented in `src/lib/apiClient.ts`'s
    header — bumping breaks `expo/tsconfig.base`'s ambient `@types/jest` resolution project-wide)
    had `expo install --fix` re-flag it wanting `~6.0.3` at two separate steps. Added
    `"expo": {"install": {"exclude": ["typescript"]}}` to `package.json` so this stops recurring
    every future SDK bump.
- **The client's better-auth is held at the version the deployed Worker runs.** Regenerating the
  lockfile let the app's `^1.6.25` range float to `better-auth`/`@better-auth/expo` **1.7.2** while
  `workers/` (out of scope, untouched) stays on 1.6.25 — a client/server skew across the whole auth
  wire format (cookie envelope, `/sign-in/social` state, session payload), and 1.7.2's `getCookie()`
  change is in exactly that area. Nothing in this upgrade exercised a real sign-in, so the skew was
  never tested. Both are now pinned **exactly** — `"better-auth": "1.6.25"`,
  `"@better-auth/expo": "1.6.25"`, no caret. The caret is what let it drift, and a from-scratch
  `npm install` re-floats to 1.7.2 with it in place, so dropping it is the fix rather than a style
  choice. One more pin is needed on top: `@better-auth/expo` declares `@better-auth/core` as a
  **peer** at `^1.6.25`, so npm satisfies it with the newest match (1.7.2) and hoists that, while
  `better-auth`'s exact `1.6.25` core dependency nests underneath — a split that survives any clean
  reinstall. `"overrides": {"@better-auth/core": "1.6.25"}` collapses it to one hoisted copy.
  `workers/` was not touched; bumping the server is a separate change with its own review chain. `src/lib/apiClient.ts`'s web storage stub keeps all four
  methods — the async pair is unused under 1.6.25 but is what 1.7.2 needs on web, so it stays
  correct whichever side of the range wins next; the reasoning is written down there.

- **What a clean suite does NOT prove, and what an actual launch since did.** This repo's own
  testing notes already record that Reanimated animations don't advance under Jest, so the green
  suite says nothing about whether the onboarding pulse trace (`PulseTraceHero.tsx`) or any other
  Reanimated-driven motion still looks right after the reanimated 4.1→4.5 / worklets 0.5→0.10 jump
  across three SDK majors. So the app was launched for real, after the headless work finished:
  Expo Go **57.0.9** installed fresh on an iOS Simulator (downloaded via Expo's versions API plus
  the matching GitHub release asset — `expo start --ios`'s interactive version-upgrade prompt
  can't be driven non-interactively), Metro run against this worktree. Screenshot-confirmed: Expo
  Go self-reports "SDK version: 57.0.0", the app reaches the genuine signed-out landing screen
  ("Your training plan, built around you."), and the pulse-trace hero renders correctly — across
  multiple bundle/reload cycles with zero errors in the Metro log. Reaching a true cold-start
  signed-out state first needed `xcrun simctl keychain reset`: a real signed-in session from
  unrelated prior testing was still in the simulator's Keychain, and `expo-secure-store` is
  Keychain-backed, so it survives an app uninstall/reinstall. **Still not exercised: the sign-in
  submission tap-through.** Two reasons, neither about the SDK bump — no touch-input automation
  (`idb` or equivalent) is installed here to tap through the native Expo Go dev-menu overlay
  covering the CTA, and `wrangler dev` wasn't running, so a real sign-in would have failed on
  network grounds anyway. Tracked as the narrowed gap in `docs/mvp-progress.md`'s "Known debt."
- **`app.json`: three plugin registrations across the range, nothing hand-written.** The final
  56→57 step needed zero `app.json` changes, and no step needed a `newArchEnabled` edit — this app
  never set that key, so SDK 55's schema removal of it had nothing to remove. What did change is
  the `plugins` array: routine `expo install --fix` config-plugin registration added `expo-image`
  and `expo-secure-store` at the 54→55 step and `expo-status-bar` at 55→56. All three packages
  ship real config plugins; only `expo-image`'s writes anything (a Podfile property). `workers/` is
  untouched.

## 2026-09-04 — the pulse trace: the next redesign's signature animation, built ahead of the screen that carries it

On branch `fm/v22-redesign-animation-r2`. The captain approved a new
house style on 2026-09-03, shared with sibling app V2.3: near-monochrome "cool scientific", a
two-tier accent where charcoal carries everything and ONE icy-cyan highlight is reserved for the
primary CTA and a single signature animation. This entry is that animation and only that — the
onboarding screen is untouched, `theme.ts` is untouched, and nothing mounts the component yet. It
was built to drop into whatever the rebuilt onboarding becomes (`v22-redesign-theme-onboarding`, a
parallel task that also replaces the token system). Integration guide, written for that worker:
[`docs/design/pulse-trace.md`](design/pulse-trace.md).

- **`src/components/brand/PulseTraceHero.tsx`.** A thin icy-cyan ECG-style trace draws itself
  across a near-black field: a beat of flat baseline, then the head crosses at constant paper
  speed, snapping through four spikes that build and quicken before the last one eases off, then a
  soft light sweeps the finished line on a slow loop. Two ways to drive it, one number underneath.
  Omit `progress` and it draws itself on mount; `onSettled` fires when the draw completes, behind a
  fallback ceiling of `lead + draw + settleSlack` so a CTA gated on it can never hang. Drive it from
  a scrolling screen with `usePulseTraceScroll` — the required integration point, since it seeds
  `progress` from layout and content size as well as from the scroll handler, and a page shorter
  than its viewport emits no scroll event at all — with `beatsAtMarks` placing a spike at each
  section boundary so crossing into a section fires a beat. Recipe:
  [`docs/design/pulse-trace.md`](design/pulse-trace.md). Two sizes: `cover`
  (256pt hero with a copy slot) and `band` (128pt header strip). It paints its own dark field in
  both colour schemes. Under reduced motion there is no self-draw and no sweep, `onSettled` fires
  at once, and a scroll-driven trace still follows the scroll. The trace band is announced as one labelled `image`; the copy above it is traversed like any other text.
- **The geometry is pure and tested** (`src/lib/pulseTrace.ts`, 23 tests). Beats → strictly
  x-monotonic polyline → SVG path plus the lookup tables the UI thread interpolates over, so every
  frame is a table lookup off the head's x-position and the "rhythm" — idle along the flat, snap
  through the spike — comes from arc length, not from a bespoke easing per spike. `normalizeBeats`
  sanitises any caller's list (clamp, sort, drop overlaps), so a bad `beats` prop cannot produce a
  broken trace; `scrollProgress` is a worklet so the preview and the real onboarding derive the
  scroll fraction the same way. The default rhythm is a fixed constant — the same trace on every
  launch.
- **Its palette is deliberately NOT in `theme.ts`.** `src/constants/pulseTrace.ts` holds the
  field (`#0A0E13`), the trace (`#A8F0FF`), glow, head, grid, baseline and on-field copy colours,
  the timings, and the two field heights. `theme.ts` still holds the outgoing Trailhead system,
  which the parallel task is replacing wholesale — building against tokens about to be deleted
  would couple the animation to the wrong system, and editing `theme.ts` from this branch would
  collide with that rewrite mid-flight. The intended end state is that `PulseTracePalette.trace`
  becomes the new system's single bright highlight, shared with the true primary CTA and nothing
  else, folded into or re-exported from the new tokens once they land. Only the
  scheme-independent `Spacing` and `Stroke` are read from `theme.ts`.
- **A dev-only preview**, `src/app/dev/pulse-trace.tsx`: `/dev/pulse-trace` in a dev build, a
  redirect home in release, linked from nowhere. A Self-draw tab (cover and band, with Replay) and
  a Scroll tab that is a working copy of the onboarding recipe — a sticky `band` header over four
  sections, spikes at the section marks. Temporary: the onboarding rebuild worker may delete it or
  keep it as the start of a component gallery.
- **Verification.** Both modes seen rendered on web (Expo web in Chrome). Root gate clean:
  typecheck, lint, 545 tests across 34 suites — 34 new, the geometry suite plus
  `src/components/__tests__/pulseTraceHero.test.tsx`'s 11 render smoke tests. Not verified on a
  device. No `workers/` change.

## 2026-09-03 (later) — "Instrument": the visual system replaced again, onboarding and the auth screens rebuilt

On branch `fm/v22-redesign-theme-onboarding`, **not merged to `main`** — nothing below is
released. Trailhead *is* on `main` (PR #82, plus the fidelity follow-up #83), and this replaces it
after two days: the captain approved **Instrument**, a near-monochrome, cool-scientific system
adopted as a house style shared with the sibling app V2.3 ("Pace AnalysisAI"), and grilled its
structure in detail before the work started. It is recorded in the new
[`docs/design/instrument-visual-system.md`](design/instrument-visual-system.md), which supersedes
`frontend-design-brief.md` Parts 2 (tokens) and 3 (the ribbon/wave motif) as the source of truth
for colour, type, and ornament — the rest of that brief still governs — and which replaces
`trailhead-visual-system.md`, deleted in the same pass.

- **The palette is new, not re-tuned** (`src/constants/theme.ts`). Light mode is paper white
  `#FFFFFF` over graphite; dark mode is a deep cool charcoal `#0E1317`. Every token's contrast
  ratio was recomputed against **both** `surface.base` and `surface.raised` — the full tables live
  in the design doc and are not duplicated anywhere else.
- **The accent is two-tier and theme-invariant**, where Trailhead's ember was scheme-keyed.
  `Accent.field` (`#0A0E13`) is a near-black slab; `Accent.signal` (`#A8F0FF`) is the ONE bright
  highlight — icy cyan, locked, because it is the colour the onboarding pulse trace is drawn in —
  spent on exactly one call to action per screen and on that trace, nowhere else. **The cyan is
  never a fill**, and that is measurement rather than taste: it is **1.27:1** against a white page,
  so a cyan button would have no visible boundary at all. The primary action is therefore a
  near-black slab with a 1.5pt cyan edge and a cyan label, identical in both schemes, whose
  boundary is carried by a different channel in each — **19.35:1** in light (the slab against the
  page) and **14.74:1** in dark (the cyan edge, since the slab itself is only **1.04:1** there, on
  purpose). Every one of those relationships is asserted in the contrast test, the two deliberately
  sub-floor ones included.
- **`Accent.field` is also `Colors.light.surface.inverse`**, and the same near-black as the pulse
  trace's own field. Every dark plane in the app is one plane, so a primary action on the Paywall's
  pricing slab reads as an inset in it rather than as a second, slightly different black.
- **The effort ramp was re-tuned into a cooler key** (captain's explicit call — left warm, it would
  read as a leftover from Trailhead): steel blue / sea green / brass / rust / raspberry. Each hue
  keeps its identity and its place in the ordering; only hue-angle and lightness moved. Two
  constraints bound the values. **Headroom:** Trailhead's light ramp sat at 4.02–4.50:1 against
  `base` with nothing checked against `raised` at all, which is what **issue #70** reported; the
  tightest value now is **4.92:1**, against both surfaces. **No collision with the signal:**
  measured as CIE76 ΔE in Lab rather than as a contrast ratio, because a ratio is blind to hue and
  would happily pass an icy-cyan `recovery`. Floor 25, tightest 28.3 (dark `recovery`) — the same
  order as the ramp's own tightest adjacent pair. Issue #70 is *not* claimed closed here; it has
  not been verified closed on GitHub.
- **Contrast is now enforced, not documented.** New `src/constants/__tests__/theme.contrast.test.ts`
  recomputes every ratio from the hexes in `theme.ts` and asserts it against the floor that token
  is held to — including the three deliberately *below* the floor (`progress.disabled`, the signal
  on a light page, the field on a dark one), which are asserted as upper bounds so a later edit
  cannot "fix" them without seeing what they were for. A final guard counts the opaque tokens in
  `Colors`, so a new hex added without a floor fails the suite rather than quietly escaping the
  table. This is the enforcement issue #70 was missing: the "never change a hex without re-checking
  contrast" rule was already written down under Trailhead, and drifted anyway.
- **Retired:** `DuskGradient`, `src/components/brand/DuskHero.tsx`, `src/components/brand/DuskSpark.tsx`,
  `Motion.duration.reveal`, `Motion.duration.ambient`, `RouteLine`'s `hero` variant and its `color`
  override (both existed only for the dusk field — the signed-out screens now carry the pulse
  trace, which draws its own geometry), and the scheme-keyed `Accent`
  (`useTheme()` now returns it unresolved). `accent.ember`/`accent.onEmber` are renamed
  `accent.field`/`accent.signal` — the old names were appearance-named and described a warm orange
  the system no longer contains, the same mistake `hivis` made before them. Radii tightened again:
  control 10 → 8, card 16 → 14.
- **Two new components carry rules that used to be carried by review.**
  `src/components/ui/ActionButton.tsx` (`PrimaryAction`, `SecondaryAction`, `ActionDivider`,
  `LinkAction`) collapses eight hand-rolled button stylesheets across Home, intake, the Paywall and
  the three auth screens into one module — `PrimaryAction` *is* the signal, so "one accent per
  screen" reduces to a question about imports. `src/components/onboarding/PulseTraceSlot.tsx` is a
  clearly marked **INTEGRATION POINT**: it renders the *static end state* of `<PulseTraceHero>`,
  the signature animation being built in parallel on branch `fm/v22-redesign-animation`, with a
  prop subset matching it exactly so the swap is one import line in `(auth)/onboarding.tsx`. **That
  animation is not on this branch**, so nothing in the app moves yet.
- **Onboarding is rebuilt as a scroll-down flow** — not swipeable cards, not a static screen: the
  pulse-trace cover, a "SCROLL" cue, three numbered hairline-separated beats (the intake / the plan
  / the price), then the single CTA with the sign-in skip as its peer. **The sections deliberately
  do not fade or rise on scroll.** A second motion moment competes with the signature one, and the
  scroll itself is already the mechanic. The field carries only the mono wordmark and the headline
  sits on the page below it: `<PulseTraceHero>` is fixed-height, so a 44pt condensed headline inside
  it would have clipped rather than pushed the moment the placeholder was swapped out.
- **Sign-in and sign-up take the same treatment at the short `band` height**, and both gained a
  "Back to the start" link to `(auth)/onboarding`. There was previously no way back to the only
  pre-auth screen except the OS back gesture.
- **The Paywall's RECOMMENDED badge went monochrome**, so the recommended tier's button stays the
  screen's one signal.
- **Verification, honestly.** `typecheck && lint && test` clean at **511 root tests across 32
  suites** (re-run 2026-09-04, after the fix round below); no `workers/` change. **The three
  signed-out screens have been seen rendered** — onboarding, sign-in and sign-up, screenshotted in
  both schemes on Expo **web** at 430x932, which is what caught the stretched waveform and the
  over-loud back link fixed the same day. No screen has been run on a real iOS or Android device or
  simulator, and the signed-in screens (Home, My Plans, Plan view, Settings, Glossary, Paywall) have
  still never been seen rendered at all.

### 2026-09-04 — addendum: review fix round

Two behavior changes, both from the branch's first review pass.

- **Onboarding's CTA gate is now bounded.** "Get started" was gated purely on `onSettled` from
  `<PulseTraceHero>`, a component that lives on another branch — so a callback that never arrived
  (an interrupted draw, an unmount mid-draw, a reduced-motion branch that misses) left the ONLY
  forward action out of the signed-out landing screen permanently disabled, with no timeout behind
  it. The screen now owns a 4s ceiling of its own and releases the CTA if the hero has not settled
  by then. The captain's standing constraint is unchanged — the hero still settles before the CTA
  is interactive; the ceiling only stops that wait hanging forever. `<PulseTraceHero>` settles at
  roughly lead 400ms + draw 2200ms + slack 400ms = 3000ms, so 4s only ever fires when something is
  actually wrong. Covered by `src/app/(auth)/__tests__/onboarding.test.tsx`, which fails if either
  the gate or the ceiling is removed.
- **The four pre-auth links use `router.navigate`, not `router.push`.** Both "Back to the start"
  links and both sign-in ↔ sign-up swap links. `push` grew the stack by an entry every time, so a
  round trip walked the OS back gesture through a chain of duplicate, scroll-reset landing screens;
  `navigate` pops to the existing route instead. Covered by
  `src/app/(auth)/__tests__/auth-back-link.test.tsx`, which asserts the action each of the four
  links dispatches — the second deliberate exception to "screens are not unit-tested".
- **A doc overclaim, corrected as the author's own.** Four places (the contrast test, `theme.ts`,
  `AGENTS.md`, `docs/design/instrument-visual-system.md`) claimed the contrast test pinned
  `constants/pulseTrace.ts`'s duplicated hexes so the two files could not drift. It does not: that
  file is not on this branch and cannot be imported, so the pin is one-sided today. All four now
  say so, and `PulseTraceSlot.tsx`'s swap checklist carries the step that makes it two-sided when
  `fm/v22-redesign-animation` lands.

## 2026-09-03 — fix dead `EXPO_PUBLIC_API_BASE_URL` blocking all sign-in/sign-up; confirm the tunnel works

The captain reported sign-in and sign-up "not working at all," and `expo start --tunnel` broken,
blocking him from testing the app at all.

- **Root cause: `.env.example` still defaulted to a loopback address and claimed the Worker was
  "not deployed yet"**, which has been false since 2026-08-09. A fresh `.env` copied from the
  template (or a stale one left over from before deploy) pointed `EXPO_PUBLIC_API_BASE_URL` at
  `http://localhost:8787`, and nothing was listening there — `wrangler dev` was not running, and
  even if it had been, a loopback address is unreachable from a physical device regardless of
  `--tunnel` (`--tunnel` forwards Metro, never the Worker). This is the second recorded hit of this
  exact class of bug (see the 2026-08-07 entry) — that fix corrected a developer's local `.env`
  and documented the trap, but never changed the committed template it was copied from.
- **Fix: `.env.example` now defaults to the deployed Worker's URL**
  (`https://pace-blueprint-production.i78979848.workers.dev`) for every device type, matching the
  captain's 2026-08-07 ruling to deploy rather than use a LAN address against `wrangler dev`. No
  application code changed — `src/lib/apiClient.ts`'s error handling and the auth screens were
  already correct from the 2026-08-07 fix; the defect was purely in the committed config template.
- **Verified live, through the real client, not a bypass.** Ran `expo start --web` against the
  corrected `.env`, loaded the build in a real browser (Safari), and drove the actual sign-up form
  through its real React state to create a new account, then signed in with the same credentials —
  both against the live deployed Worker. Both succeeded (`200`, real session token, real user row).
  Confirmed separately by inspecting the compiled bundle that `EXPO_PUBLIC_API_BASE_URL` now bakes
  in as the deployed Worker's URL rather than the old loopback value. A true device/simulator run
  via Expo Go was attempted but blocked by an unrelated environment issue on this machine (its
  installed Expo Go build is for SDK 57; this project is SDK 54) — not a defect in this fix.
- **The tunnel itself was not found broken.** `expo start --tunnel` was run and monitored for
  several minutes at a time across multiple sessions: it connected immediately and stayed
  connected with no observed disconnect/reconnect churn, and a real device flow (iOS Simulator +
  Expo Go) fetched the Metro manifest through the live tunnel URL successfully. One earlier
  observation contradicts this and is kept on the record: the diagnosis-only session on this
  branch (commit `77cd1c0`, its since-deleted `docs/wip-auth-tunnel-diagnosis.md`) saw the tunnel
  drop and reconnect during one run (`Tunnel connection has been closed…` then `Tunnel connected.`
  again). This session's re-testing did not reproduce it, and no repo change separates the two
  runs, so it reads as occasional flakiness on Expo's shared tunnel backend, not a defect here —
  logged as a residual risk in `docs/mvp-progress.md`. The most likely explanation for the
  original report is the same root cause as above, indistinguishable from "the
  tunnel doesn't work" from the captain's seat: a working tunnel still can't let a phone sign in
  while the API base URL points at a dead loopback address. For the record: the tunnel runs on
  `@expo/ngrok`'s bundled legacy `ngrok-bin@2.3.42` against Expo's own shared `exp.direct` backend
  (a fixed authtoken baked into `@expo/cli`, not the captain's personal ngrok account) — external
  to this repo. If it becomes flaky in practice, `EXPO_PACKAGER_PROXY_URL` pointed at a
  self-run tunnel is the supported escape hatch (the captain already has an authenticated `ngrok`
  v3 install ready); not implemented since the shared tunnel tested stable.
- 469 root tests pass, typecheck and lint clean. No `workers/` change.

## 2026-09-01 — "Trailhead": the visual system replaced, every screen rebuilt

On branch `redesign/trailhead-2026-09-01`, **not merged to `main`** — nothing below is released.
The captain's audit pass over the shipped app returned one complaint, twice: it looked cluttered,
and no screen said what it was for. The response was not a tidy-up. The whole visual system was
replaced with **Trailhead** (approved 2026-09-01 from a Claude Design mockup), recorded in the new
`docs/design/trailhead-visual-system.md` (deleted 2026-09-03, superseded by
[`instrument-visual-system.md`](design/instrument-visual-system.md)), which supersedes
`frontend-design-brief.md` Parts 2 (tokens) and 3 (the ribbon/wave motif) as the source of truth
for colour, type, and ornament. The rest of that brief — Part 0's law, the tier table, the screen
inventory, the accessibility floors, the copy rulings — is untouched and still governs.

*(Correction, 2026-09-03: it merged to `main` the same day it was written, as PR #82 with the
fidelity follow-up #83. Later docs kept repeating "not merged to `main`" long after it was — fixed
in `mvp-progress.md` and `architecture.md` on 2026-09-03.)*

- **The token system is new, not re-tuned** (`src/constants/theme.ts`). Warm chalk paper and
  espresso ink, hairline rules instead of boxes. `Accent.hivis` (`#D8F14A`) is gone in favour of a
  **scheme-aware** `Accent[scheme].ember` — two changes at once: the old name described a
  yellow-green the system no longer contains, and no single ember clears AA on both chalk and
  espresso, so a theme-invariant accent was no longer possible. `useTheme()` resolves it, so call
  sites still read `theme.accent.*`. New tokens: `surface.inverse` + `text.onInverse*`,
  `grid.routeLine`, `grid.inverseHairline`, `DuskGradient`, `FontSize.hero` (44), `Tracking`,
  `Stroke`, `Radius.pill`, `LockedOpacity`. Every hex is contrast-verified in the design doc's
  tables; radii tightened (control 12→10, card 20→16) because paper and ink is a squarer language.
- **The effort ramp was re-picked for headroom.** The old light ramp sat at 3.00–3.06:1 — four of
  five efforts barely above the 3:1 floor at *full opacity*, which is the only reason
  `AmbientPulseFloor` ever existed. Every new value clears 4:1, so the floor token is deleted along
  with its single consumer. `tempo` is a deliberately browner orange than ember so a plan's week
  ribbon can never read as a screen full of accents. The colour-is-never-the-only-signal rule and
  the monotonic bar-height ramp are unchanged.
- **One ornament, and one exception.** The ribbon/wave signature is retired: `HeroRibbon` put a
  copy of the plan view's own data viz on the landing screen. The signature is now the **route
  line**, a thin contour stroke (`src/components/brand/RouteLine.tsx`) generated from a fixed
  seeded profile (`src/lib/routeProfile.ts`, pure and tested) so a screen draws the same ridge on
  every launch. The signed-out screens are the one deliberate exception — a plum→ember→amber dusk
  gradient with an animated route line (`components/brand/DuskHero.tsx`). Everything past the
  session gate is paper and ink. The per-week effort ribbon inside a plan stays; it encodes data,
  it is not ornament.
- **Ember is barred from navigation and spent once per screen.** The tab bar gained four
  thin-stroke line icons where every tab previously rendered `tabBarIcon: () => null`; the active
  state is an ink tick, not an accent. On Home the single ember is "Generate plan", so the push to
  My Plans is a plain row rather than a second button. My Plans, Plan view, Glossary and Settings
  spend **no** accent at all — a destination is not a call to action, and Settings' "Upgrade" is a
  row with a chevron because the offer lives on the Paywall.
- **Type is new.** Big Shoulders Display / Public Sans / Space Mono replace Barlow Condensed /
  Inter / IBM Plex Mono (old packages uninstalled in the same commit). `mono.medium` and
  `mono.semiBold` collapse onto `regular` / `bold` across all 13 call sites — Google publishes no
  Medium or SemiBold for Space Mono, and an alias resolving to the same file is a token that lies.
  `FontSize.hero` exists because Big Shoulders is optically much smaller than the Barlow it
  replaced, so a 32pt title no longer carries a screen.
- **Every screen was rebuilt to its register.** Home ships all three states (empty / populated /
  Free) plus the two the network forces; sign-in and sign-up moved onto the dusk exception with a
  shared `components/auth/AuthField.tsx`; My Plans and Plan view took the formal register with
  hairline stat rows; the Paywall took dark pricing slabs on `surface.inverse` (dark in *both*
  schemes — the inversion is the gesture) with the one ember on Elite; Settings and Glossary went
  flat grouped rows via the new `components/layout/GroupedRows.tsx`. Two anti-drift details:
  every plan count on the Paywall reads `TIER_PLAN_LIMITS` (the constant `workers/` also imports),
  and My Plans' most-recent date is computed from `max(createdAt)` rather than read off `plans[0]`,
  since `GET /api/plans`' ordering is the server's business.
- **Free-tier Notes are now locked in the UI — a correction, not new enforcement.** Free tier is
  template-only and never reaches the model, so notes a Free runner typed were already discarded
  server-side; showing the field open was the bug. Home renders it inside a dashed `LockedPanel`
  with an "Upgrade to unlock" affordance, plus a second panel teasing what Pro and Elite add. No
  Worker change was needed and none was made. The lock is a **display** of
  `getQuotaStatus().tier`, never a decision made in the client (`AGENTS.md`): `quota === null`
  means "the server has not answered yet" and is deliberately **not** treated as free, or a paying
  runner would see a paywall flash for the length of the request. The teaser is a fixed
  illustration, not the runner's own intake run through a plan engine — deriving a pace
  client-side would be both inventing coaching content and plan generation in the client.
- **Verification, honestly.** `typecheck && lint && test` clean at 469 tests across 29 suites,
  including a new `src/components/__tests__/render.test.tsx` (16 tests) — `tsc` proves the new
  components type-check and proves nothing about whether they render, and an undefined `d` on a
  `Path` is a clean typecheck and a blank screen. Deliberately not snapshots: pinning an ornament's
  tree makes every visual tweak a test edit. **No screen has been seen rendered**, in a browser or
  on a device. `npx expo export --platform web` builds the whole route tree and the DOM confirms
  all nine font faces bundle and preload, but the export does not inline the root `.env`, so the
  bundle throws `Missing EXPO_PUBLIC_API_BASE_URL` and never hydrates.

## 2026-08-16 — review fixes on the intake-once branch

Five findings from the review of the branch below, all fixed forward.

- **Documentation-only: the drift audit's status corrections landed** (findings D3, D9, D10, C1,
  C2). `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/mvp-progress.md`, and
  `workers/README.md` had all still described the Pro/Elite personalizer as unbuilt (it was bound
  2026-08-10) and Google OAuth as unprovisioned in production (both secrets were set 2026-08-09,
  with the token exchange and consent-screen publishing status still unproven). Hard-coded
  `workers/` test counts were removed rather than re-pinned to a new number — they rot on every
  test added; the file trees now point at `npm --prefix workers test`. `AGENTS.md`'s Expo pin and
  `CLAUDE.md`'s `typecheck` row were realigned with `package.json` (`~54.0.36`,
  `npm run routes:generate && tsc --noEmit`). No application code, config, secret, or coaching rule
  changed.

- **A one-week no-race plan no longer opens above the runner's own volume.** Dropping the taper
  tail moved the canonical curve's last entry from the taper's 28 km to the block's 48 km peak, and
  `interpolateCanonical` collapses to that last entry when a plan is one week long — so a runner
  asking for a single week off a 35 km baseline got 48 km, 137% of it, with no ramp. Week 1 has no
  prior loading week, so the growth rule could not fire and only the level's absolute ceiling
  applied. `clampWeeklyVolume` (`src/lib/loadRules.ts`) now takes `baselineWeeklyKm` and holds a
  first week at the runner's declared volume. Arithmetic clamping in typed code, per CLAUDE.md;
  race plans keep the taper-inclusive curve and are unchanged.
- **A past race date is refused by the server, not only the client.** `validateRequest`
  (`workers/src/lib/generate-plan-flow.ts`) now checks `raceDate` recency before `store.reserve`, so
  a stale date can no longer reach `weeksUntilRace`'s one-week floor and charge a quota slot for a
  degenerate plan. It reuses `RACE_DATE_PASSED_MESSAGE` so both routes say the same thing. Race day
  itself still generates, and the server-side week floor is untouched.
- **A failed intake fetch no longer says "you haven't done intake yet."** Home keeps the last known
  intake across a transient `getIntake()` failure; a genuine "no intake" answer from the server
  still renders the empty state. The error banner sits above both branches, so a runner looking at
  a retained target is told the refresh failed rather than shown a possibly stale target in
  silence — keeping the intake without surfacing the error would trade one wrong message for none
  at all.
- **The canonical taper boundary is derived per curve**, not from one shared `10`: the two canonical
  arrays are different lengths with different taper tails (2 entries and 1), so editing either can
  no longer silently mis-cut the slice.
- **`MAX_PLAN_WEEKS` has one home.** `workers/src/lib/planEngine.ts` imports it from
  `src/lib/planRequest.ts` as `MAX_PLAN_DURATION_WEEKS` instead of re-declaring 104.
- **The spec no longer describes a second survey.** On the captain's ruling, two lines in
  `planning/` that still had the target race re-chosen per generation were corrected to match
  shipped behavior: `02-product-requirements.md`'s user flow (Home reads the target back from
  intake and asks only for a plan length when there is no race date) and
  `03-engineering-requirements.md`'s goal-realism advisory (intake review is the only goal-entry
  point). Recording a decision already made, not a spec change — leaving them stale invited a
  future session to faithfully rebuild the duplicate survey. `src/lib/planRequest.ts` is the code
  that enforces it.

## 2026-08-15 (later) — intake asked once, race target optional, structured numeric inputs

Captain's phone test: "the homepage is very very confusing… after you've done [the intake] once,
you have to do it once more… the race stage should be optional… the keyboard is missing the colons,
the dashes." All three reproduced on an iOS 26.5 simulator before anything was changed.

- **Intake is asked exactly once.** There is one intake *screen* but there were two intake
  *surfaces*: `/intake`, which asks for a target race and race date, and Home's generate panel,
  which asked for a goal type, a race distance and a race date all over again — and, unlike intake,
  refused to proceed without them. Home no longer asks any question intake has answered. It reads
  the target back from the saved intake ("YOUR TARGET — Half Marathon on 2026-09-26 / General
  fitness — no target race") with a **Change** link to `/intake`, and asks only for a plan length,
  and only when there is no race date to derive one from. New pure module `src/lib/planRequest.ts`
  holds that decision so it is unit-testable. A return visit generates another plan with no
  re-answering at all.
- **A race target is optional end to end.** Home's "Select a race distance." wall is gone; a runner
  with no race gets a general-fitness plan. Two engine defects behind that were fixed in
  `src/lib/planTemplates.ts`:
  1. `buildTemplatePlan` ended with `params.raceDistance ?? params.intake.raceDistance ?? '5k'`, so
     a runner who named no race silently got 5K periodization. The `?? '5k'` is gone; `raceDistance`
     stays `undefined` and every race-specific branch is gated on a new `isRacePlan`. This is the
     same rule PR #75 established for a *stated* goal, applied to one deliberately left blank.
  2. A no-race plan still ran out through a `taper` — a wind-down into a race day that did not
     exist, and (because every quality branch is gated on base/build/peak or on a race goal type) a
     final stretch with no quality work at all. No-race plans now allocate base/build/peak only. The
     volume curve had the same problem independently: `FIVE_K_WEEKLY_LOAD`'s last two entries *are*
     the 5K taper, so a 12-week general plan finished at 24 km off a 35 km baseline, below where it
     started. A no-race plan now interpolates the loading block of the same approved curve.
     **No number was invented** — see `generalPhaseWeights` and `taperAwareCurve` for the
     derivation from `plan-structure.md`. Race plans are byte-identical to before, golden 5K fixture
     included.
- **Numeric fields are structured, not masked free text.** The captain's "missing the colons, the
  dashes" was accurate twice over. (a) `number-pad` genuinely has no `:` or `-`; the old screens hid
  that behind an as-you-type mask, so the field's own label demanded punctuation the keyboard could
  not produce and the digits regrouped under the thumb while typing (`1` → `14` → `1:45`). (b)
  `keyboardType` restricts nothing — a hardware keyboard, paste, dictation or autofill puts letters
  straight into a "number" field; verified on the simulator, where the letter `v` landed in the
  intake AGE field and produced "Age must be a whole number between 13 and 100." New
  `src/components/inputs/` — `NumberField`, `SegmentedField`, `DateField`, `ClockField` — split
  dates into `YYYY - MM - DD` and times into `H : MM : SS` with the separators **printed, never
  typed**, filter every keystroke through `src/lib/fieldInput.ts`, and auto-advance between boxes.
  Verified on device: age → `number-pad`, weekly distance → `decimal-pad`, race date and both time
  fields → digit boxes with a `number-pad`.
- **A stale race date is refused on both screens, and charges nothing.** Home shows the target
  read-only now, so a runner returning after their race would have had that date sent verbatim:
  `weeksUntilRace` floors at one week and the quota slot is reserved before the skeleton is built,
  so the request would have charged a generation for a degenerate one-week plan. Home refuses
  before sending, and intake refuses to save a past date, each saying so and naming the control
  that fixes it (`RACE_DATE_PASSED_MESSAGE` / `INTAKE_RACE_DATE_PASSED_MESSAGE` in
  `src/lib/planRequest.ts`). Race day itself still generates and still saves; a blank date is still
  valid, because the race is optional. The server-side floor is deliberate behaviour for other
  callers and was not changed.
- **A no-race plan never ends on a deload.** Captain's ruling as a McMillan-certified coach: the
  last week of a plan is the last week the runner sees, and finishing on a recovery week leaves
  them at or below where they started — the visible symptom behind the original report. The final
  week of a plan with `isRacePlan === false` is forced to be a loading week, deliberately bending
  the every-N-weeks deload cadence for that week alone. The cadence, `deloadVolume`, and race plans
  (whose final week is race week or taper) are untouched. Known limitation, pinned by its own
  documenting test: a **4-week** no-race plan still finishes below its opening volume — at that
  length the canonical curve's own dip lands on week 2, and `clampWeeklyVolume`'s week-on-week
  growth ceiling cannot recover it in the two weeks left. That ceiling is a safety rule and was
  deliberately not bent.
- **`raceDistance` is validated on any goal type.** The client now deliberately sends it alongside
  `goalType: 'duration'` for a target-distance-with-no-date runner, so the value check in
  `workers/src/lib/generate-plan-flow.ts` was hoisted out of the `race` branch and runs whenever the
  field is present. `racePhaseWeights` is now an exhaustive `switch` rather than a chained ternary
  that silently handed an unrecognised value the marathon weights.
- 392 root tests (was 332) and 133 `workers/` tests (was 130) pass; typecheck and lint clean on both
  sides. Not verified: Android — no Android SDK on this machine. Billing, tiers, entitlement, auth
  and the paywall were not touched.

## 2026-08-15 — Google sign-up end-to-end audit and observable native return

- Audited the live chain rather than inferring from local tests: D1 began empty; the production
  Worker lists `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`; its generated
  URL uses the exact deployed HTTPS callback and Google serves the real account sign-in page. Secret
  values cannot be read back, so a rotated secret still requires one interactive exchange (or
  captain re-set) to prove. Consent publishing/test-user status remains a Google Console check.
- Replaced the auth screens' fire-and-forget Google call with an explicit native flow that opens the
  Expo authorization proxy, observes every browser result, reads callback errors, persists the
  returned better-auth cookie, verifies `getSession`, and notifies the reactive session atom. A
  successful Google sign-up now marks the same one-shot Intake redirect as email sign-up; failures
  no longer leave a dead button or a valid session sitting on the form.
- Added callback error copy for cancellation, consent denial, expired/missing state, invalid code
  (including stale-secret guidance), missing callback cookies, and post-return session failure.
  Both Google buttons disable while auth is in flight.
- Added secret-free better-auth callback logging in the Worker, plus regression tests for log
  redaction and mobile error mapping. Worker tests now pin fake Google bindings in committed config,
  closing the exact `.dev.vars`/production drift trap where CI can pass against configuration no
  deployed environment has.
- Re-proved email/password against production: a diagnostic account created a `credential` account
  row and session, then `/api/delete-account` removed it; Google remains pending the captain's
  interactive consent, and no Google persistence claim is made. Exact Google Cloud settings,
  secret rotation commands, mobile steps, and before/after D1 queries are in
  [`google-oauth-runbook.md`](google-oauth-runbook.md).

## 2026-08-15 — complete goal-realism disclosure and correct ambitious-goal copy

- The immutable plan screen now renders `GoalRealismNotice` for both warned outcomes, not only
  `implausible`. An `ambitious` plan explains that the goal was flagged as a stretch but its entered
  pace was kept and not capped; the existing `implausible` title and body remain unchanged; a
  `realistic` plan remains silent.
- Intake no longer tells ambitious runners that their plan will target a more sustainable pace.
  Its advisory now says the entered goal pace will be kept but will be a stretch, while the
  implausible-goal message keeps the existing sustainable-pace explanation.
- New pure disclosure helpers centralize the plan/intake visibility and copy, with regression tests
  covering realistic, ambitious, implausible, and absent assessments. Goal-realism classification,
  thresholds, and cap arithmetic were not changed.

## 2026-08-10 (later) — email sign-up and Google sign-in fixed against the deployed Worker

Captain's report: email sign-up fails `"Invalid origin"`, Google sign-in fails `"Invalid callback
URL"`. Both diagnosed against the **live deployed Worker**
(`https://pace-blueprint-production.i78979848.workers.dev`) via `curl`, then root-caused by reading
`better-auth`'s and `@better-auth/expo`'s installed source directly rather than guessing.

- **Bug 1 — `INVALID_ORIGIN` on `sign-up/email`.** Reproduced: `curl -X POST .../sign-up/email -H
  'Origin: http://localhost:8081'` returns `{"code":"INVALID_ORIGIN"}` against production; without
  that header it succeeds. Two compounding defects, both fixed:
  1. `workers/src/auth.ts`'s `trustedOrigins` never read `CORS_ALLOWED_ORIGINS` — a browser origin
     could clear `cors.ts`'s CORS allowlist and still be rejected by better-auth's own, separately
     maintained origin/CSRF check. Fixed by folding `CORS_ALLOWED_ORIGINS` into `trustedOrigins`.
  2. That fold, checked in isolation, does not fix the reported failure: `index.ts`'s
     `normalizeAllowedBrowserOrigin()` (`cors.ts`) already rewrites any origin *already present in*
     `CORS_ALLOWED_ORIGINS` to `BETTER_AUTH_URL` before better-auth ever sees it, so for a request
     through the normal Worker entry point the fold only matters for an origin CORS never allowed to
     begin with. `[env.production.vars] CORS_ALLOWED_ORIGINS` in `wrangler.toml` listed only the
     deployed origin itself — `http://localhost:8081`/`19006` (what `npm run web` actually sends,
     since `.env`'s `EXPO_PUBLIC_API_BASE_URL` points straight at the deployed Worker; no separate
     production web build is hosted anywhere) were dropped from the production list in the
     2026-08-09 Google-sign-in fix (`git show 685b67b -- workers/wrangler.toml`) and never restored.
     Added back, with a comment recording why trusting them in production is an acceptable
     trade-off: auth here is Bearer-token-only, not cookie-session-based (`auth.ts`'s `advanced`
     block), so this isn't a session-hijack surface.
- **Bug 2 — `INVALID_CALLBACK_URL` on Google sign-in.** Could not reproduce via `curl` (both a
  relative `callbackURL: '/'` and a deep-link `callbackURL: 'paceblueprint:///'` returned a valid
  Google authorization URL). Root cause found by reading `node_modules/@better-auth/expo/dist/
  client.js` and `node_modules/expo-linking/build/{createURL,Schemes}.js`: **Expo Go is the only way
  to run this app on a device today** (`docs/mvp-progress.md`: no EAS dev client exists), and inside
  Expo Go, `expo-linking`'s `resolveScheme()` ignores the `scheme: 'paceblueprint'` option passed to
  `expoClient()` entirely and always falls back to the fixed `'exp'` scheme — so the OAuth
  `callbackURL` `@better-auth/expo/client` builds via `Linking.createURL('/')` is an
  `exp://<lan-ip>:<port>/--/` URL, never `paceblueprint://...`. `@better-auth/expo`'s own server
  plugin (`node_modules/@better-auth/expo/dist/index.js`) already auto-adds `'exp://'` to
  `trustedOrigins` — but only `if (process.env.NODE_ENV === 'development')`, and Wrangler's esbuild
  bundling replaces that literal with `'production'` for `wrangler deploy` (`'development'` only for
  `wrangler dev`, confirmed by reading `wrangler`'s own bundler source), so the plugin's own fallback
  is silently absent from every deployed Worker. Fixed by adding `'exp://'` to `auth.ts`'s
  `trustedOrigins` unconditionally, independent of `NODE_ENV`.
- **The test harness had a real blind spot, now closed.** `workers/test/worker.test.ts`'s
  pre-existing "allows an auth POST from an allowlisted Expo web origin" test could not have caught
  either regression: `vitest.config.ts` pins `env.CORS_ALLOWED_ORIGINS` to already contain the one
  origin that test uses, so `normalizeAllowedBrowserOrigin()` always neutralizes it before
  better-auth is reached — the test passed identically with or without the `trustedOrigins` fold,
  and never exercised production-shaped config. Its comment now says so explicitly, pointing at the
  tests that do. New coverage: a `describe('the 2026-08-10 production INVALID_ORIGIN bug')` block in
  `worker.test.ts` (4 cases) drives `createAuth()` and `normalizeAllowedBrowserOrigin()` directly
  against production-shaped env vars — one pins the pre-fix production repro (fails `INVALID_ORIGIN`
  with the old `wrangler.toml` value), one pins the post-fix success, one isolates the `auth.ts`
  fold from CORS normalization entirely, and one proves the fix did not over-broaden trust to an
  origin CORS never allowed. One new case in `social-auth.test.ts` does the same for the `exp://`
  callback fix. All five verified to fail against the pre-fix code (`git stash` the two source files,
  re-run, confirmed both new proof tests fail with the exact production error codes; `git stash pop`
  to restore). 130 `workers/` tests pass (125 existing + 5 new); 326 root tests pass; typecheck and
  lint clean on both sides.
- **Not fixed here, not fixable here:** the fix is merged but not live — `wrangler deploy --env
  production` still needs the captain's own Cloudflare login. Separately, two things about Google
  sign-in specifically remain unproven and are not ruled out by this pass: the OAuth consent
  screen's publishing status (Testing vs. production — only listed test users could complete sign-in
  if it's still in Testing) and the client secret itself (only exercised at the token exchange, needs
  one real device sign-in). See `docs/mvp-progress.md`'s "Blocked / awaiting a decision".

## 2026-08-10 — the Pro/Elite personalization prompt lands (`deps.ts`'s second swap)

`workers/src/deps.ts` had two documented swaps to make the AI path real: the skeleton builder
(bound 2026-08-04) and the Pro/Elite prompt (still `null` until today). This lands the second one.

- **New `workers/src/lib/planPersonalizationPrompt.ts`.** The `PromptBuilder` `createPlanPersonalizer`
  was already built to accept (`planEngine.ts`, tested since before this prompt existed). Deliberately
  narrower than `docs/reference/plan-generation.md`'s original "one representative week per phase +
  deterministic expander" design: the template skeleton (`createTemplateSkeletonBuilder()`) already
  computes every week's structure and, at `density: 'paid'` (both Pro and Elite), every workout's
  pace and HR zone/RPE — safety-clamped by `loadRules.ts`/`paceDerivation.ts` — before this file is
  reached. The only thing Pro/Elite still lacked was the coach's-reasoning prose
  (`Plan.coachIntro`, `Week.why`, and — Elite only — `Workout.why`), so that prose is the *only*
  thing the prompt asks the model for.
- **The output contract has no numeric field.** A forced tool call (`submit_plan_personalization`)
  whose schema is `{ coachIntro: string, weeks: [{weekNumber, why}], workouts?: [{weekNumber,
  dayIndex, why}] }` (Elite only). `weekNumber`/`dayIndex` exist only to locate the matching
  skeleton slot; nothing in the schema can carry a distance, a pace, an HR zone, an RPE, a phase, or
  a deload flag. `mergePersonalization()` reads exactly those two integers plus one string per entry
  and copies everything else from the skeleton, byte-for-byte — the enforcement is structural, not
  just a prompt instruction, matching `CLAUDE.md`'s "a model must not be able to prescribe an unsafe
  week."
- **Model, request shape:** `claude-sonnet-5`, no `temperature`/`top_p`/`top_k` (this model 400s on
  any non-default value of them, per the sibling repo's `analyze-form-prompt.ts` finding), explicit
  `thinking: {type: 'adaptive'}`, `max_tokens` scaled by plan length and tier
  (`computeMaxTokens()`). Both `why` and `coachIntro` are length-truncated on the way in
  (`MAX_WHY_LENGTH`/`MAX_COACH_INTRO_LENGTH`) — an arithmetic bound, same category as
  `MAX_PLAN_DURATION_WEEKS`, not content validation.
- **Wired in `deps.ts`:** `createPlanPersonalizer(modelCaller, planPersonalizationPromptBuilder)`
  replaces `createPlanPersonalizer(modelCaller, null)`. No other file changed — `generate-plan-flow.ts`
  already had the validate → retry-once → fall-back-to-template control flow built and tested.
- **Still blocked on `ANTHROPIC_API_KEY`.** No key exists anywhere (local `.dev.vars` or production
  `wrangler secret put`), so `resolveModelCaller` still binds `createUnconfiguredModelCaller` and
  every Pro/Elite generation still serves the template plan, marked `isFallback: true`
  (quota-exempt) — exactly the designed degradation for "the backend not being finished." The
  remaining gap to real personalized plans is now purely the missing secret, which needs the
  captain's own Anthropic account and `wrangler login`.
- **`GeneratePlanRequest`'s missing `goalTimeSec` field (`docs/mvp-progress.md`'s 🟠 item) does not
  block this feature and was deliberately left alone.** The personalizer reads `intake.goalTimeSec`
  — already stored at intake time and already what `buildTemplatePlan()` uses to build the skeleton
  this prompt personalizes — so every plan this prompt sees already carries a correct goal time.
  The flagged gap is about a *per-generation* override of that stored default, a separate and
  narrower fix.
- **Tests:** new `workers/test/planPersonalizationPrompt.test.ts` (19 cases) — request shape (forced
  tool call, no numeric field sent to the model, no rejected sampling params), structural
  extraction, and `mergePersonalization` proven never to touch a structural field, never to mutate
  its input, and to truncate an oversized response. 125 `workers/` tests pass (106 existing + 19
  new); 326 root tests pass; typecheck and lint clean on both sides.

## 2026-08-09 — Google sign-in is broken in production; root cause is a missing secret, not code

Captain's report: cannot log in with Google at all. Diagnosed against the live deployed Worker
rather than by reading code, because three of the candidate causes (revoked secret, redirect URI
mismatch, wrong client id for the build) are indistinguishable from the source.

- **Root cause — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are not set on the deployed Worker.**
  `POST /api/auth/sign-in/social {"provider":"google"}` against
  `https://pace-blueprint-production.i78979848.workers.dev` returns
  `{"message":"Provider not found","code":"PROVIDER_NOT_FOUND"}` (HTTP 404). `buildSocialProviders()`
  in `workers/src/auth.ts` returns `{}` when either credential is missing, so better-auth never
  registers Google, and `src/app/(auth)/sign-in.tsx` renders that as "Google sign-in isn't available
  yet." The message is honest but reads exactly like a bug, which is why the state went unnoticed.
- **What it is *not*, each ruled out by evidence, not by reasoning.** Not a code regression and not
  a broken auth stack: on the same origin, email/password returns `401 INVALID_EMAIL_OR_PASSWORD`
  for bogus credentials (so D1 and `BETTER_AUTH_SECRET` are both live) and `/api/quota-status`
  returns `403 unauthenticated` (so the route table and session gate are live). Not a
  `redirect_uri_mismatch` and not a revoked/flagged credential: the request never reaches Google,
  because no credential is deployed to send. The leaked-secret backlog item
  (`v22-launch-audit-r1-decision-google-secret-rotation`) is therefore **not** the cause — but it
  was still open, and rotating was free precisely because nothing was deployed with it. The captain
  did rotate before deploying (see the resolution below), so the exposed value was never live.
- **Not fixable here, and deliberately not worked around.** `wrangler secret put` needs the
  captain's own Cloudflare login, which `AGENTS.md` forbids agents from running. Escalated with the
  exact commands; see `docs/mvp-progress.md`'s "Blocked / awaiting a decision".

Three real defects *were* found and fixed, each of which would have broken Google sign-in again
immediately after the secrets landed:

- **`workers/wrangler.toml`'s production config was wrong in two ways.**
  `[env.production.vars] BETTER_AUTH_URL` read `https://pace-blueprint.workers.dev`, which is not
  the deployed origin (`[env.production]` appends `-production` to the top-level `name`, and the
  account subdomain was missing entirely). better-auth derives the OAuth `redirect_uri` it hands
  Google from that var, so a redeploy from a clean clone would have failed `redirect_uri_mismatch`
  — the exact "confusing state mismatch, not a clear error" the file's own comment warns about.
  Separately, `[env.production]` declared no D1 binding: **a named wrangler environment does not
  inherit top-level bindings**, so that deploy would have had no `env.DB` and 500'd on every
  authenticated route. Both fixed, along with the now-real `database_id` (an identifier, not a
  credential). The live deploy only works today because the captain has these values as an
  uncommitted local edit; committing them is what stops the next clean clone from regressing.
- **The test suite was reading OAuth config from an untracked file.** Wrangler layers `.dev.vars`
  over `wrangler.toml [vars]`, and `.dev.vars` is gitignored — so `env.BETTER_AUTH_URL` and
  `env.APP_SCHEME` inside `vitest` were whatever each developer happened to have locally. Caught
  because a worktree carrying stale values (`APP_SCHEME=http://localhost:8090`) failed the new
  deep-link test against a config no committed file describes; the same hole would have let a
  genuinely broken `trustedOrigins` pass elsewhere. Both are now pinned in `vitest.config.ts`.
- **Credentials are trimmed, and blank counts as absent.** `wrangler secret put` reads stdin, so a
  pasted value routinely carries a trailing newline. Untrimmed, `"<id>\n"` is truthy: the provider
  registers and then fails at the token exchange with `invalid_client`, which reads like a revoked
  credential rather than a stray byte. Trimming collapses that into the one diagnosis the code
  already reports clearly.

Coverage: new `workers/test/social-auth.test.ts`, 7 cases — provider absent → `PROVIDER_NOT_FOUND`;
provider registered → a real `accounts.google.com` authorization URL, asserting the exact
`client_id` and the `redirect_uri` derived from `BETTER_AUTH_URL`; one-of-two credentials;
blank and whitespace-only; whitespace stripped; and both directions of the `trustedOrigins` check
(`paceblueprint:///` accepted, `https://evil.example/steal` rejected with 403). Verified to fail
against the pre-fix code, not just to pass against the new. `workers/README.md` and
`.dev.vars.example` now document both required redirect URIs, the mandatory `--env production` flag
(a `put` without it succeeds while writing to a Worker nothing talks to), and the one-line `curl`
that distinguishes "secrets missing" from every other OAuth failure. 324 root tests and 93
`workers/` tests pass; typecheck and lint clean on both projects.

**RESOLVED the same day.** The captain rotated the client secret in Google Cloud Console (closing
`v22-launch-audit-r1-decision-google-secret-rotation` — the leaked value was never deployed), added
the production redirect URI, and set both secrets with `wrangler secret put --env production` — the first attempt failed with
`Required Worker name missing` / `no environment named "production"`, which is what wrangler prints
when it finds **no config file at all**: it was run from the repo root rather than `workers/`, where
`wrangler.toml` lives. Both misleading errors come from an empty config, not a malformed one.

Verified live, in two stages rather than by trusting the first green:
`POST /api/auth/sign-in/social` now returns HTTP 200 with a real `accounts.google.com`
authorization URL carrying the right `client_id` and a `redirect_uri` of
`https://pace-blueprint-production.i78979848.workers.dev/api/auth/callback/google`; following that
URL, Google itself serves `<title>Sign in - Google Accounts</title>` with no `invalid_client`, no
`redirect_uri_mismatch` and no "Access blocked", which proves Google recognises the client id *and*
has the redirect URI registered against it.

**Two things remain unproven by that check, by construction.** (1) The client *secret* is only ever
exercised at the token exchange, which needs a real human login — a wrong secret would surface as
`invalid_client` at the very end of the round trip, not here. That risk is slightly raised by the
rotation, not lowered: the value in production is a freshly minted secret that has never completed
a single exchange. (2) If the OAuth consent screen is in
**Testing** publishing status, only listed test users can complete sign-in; everyone else gets
`access_denied` after entering their password. Both are settled by one real sign-in from the app.

## 2026-08-09 — comprehensive frontend/backend audit and temporary unlimited access

- Audited every reachable app screen and every Worker route/D1 statement. Fixed web CORS and web
  session-storage failures, stale typed routes, malformed date/time/intake acceptance, terminal
  idempotency retries, fallback quota-copy accuracy, missing dynamic plan IDs, and the stale D1
  age floor. Full concrete receipt: [`audit-2026-08-09.md`](audit-2026-08-09.md).
- Added the reversible `ALL_USERS_UNLIMITED_ACCESS` Worker override (`workers/src/access.ts`): while
  true, every authenticated account is Elite with no quota limit. The underlying subscriptions,
  purchase route, quota ledger, and normal limits are preserved for a one-variable rollback.
- Updated Expo within SDK 54 to 54.0.36, made typecheck regenerate Expo Router declarations, and
  applied non-breaking dependency audit fixes. Expo Doctor is clean; Worker production audit is
  clean. Remaining root advisories require a breaking Expo 57 upgrade and are documented in the
  audit receipt rather than force-applied.

## 2026-08-08 — the sign-up form went blank while being filled in; onboarding screen added ahead of it

Captain's report, verbatim: *"very difficult to sign in, if u input everything it will just
disappear."* Reproduced live in a browser against local `wrangler dev` before anything was changed.
Two independent defects on the same screens, plus a new screen in front of them.

- **Defect 1 — the whole app unmounted on every background session refetch, wiping the form.**
  `src/app/_layout.tsx` computed `ready = fontsLoaded && !sessionPending` and returned `null` when
  it was false. That `return null` unmounts `<Stack>`, the `(auth)` group, and the sign-up screen's
  `useState` with it. The trap is that better-auth's `isPending` is **not** a one-shot "first load
  in flight" flag: `node_modules/better-auth/dist/client/session-atom.mjs`, inside `fetchSession`,
  sets `isPending: current.data === null`, so it is re-raised on *every* refetch — but only while
  signed out, which is exactly the state a runner filling in the form is in. Refetches are frequent
  and invisible (`refetchOnWindowFocus` defaults to true, plus online / broadcast / signal events);
  on web the trigger is `visibilitychange`, on native it is AppState. Real-world repro: switch to a
  password manager, come back, everything you typed is gone. A 5-second rate limit on the focus
  path is the only reason it read as intermittent rather than constant.
  **Fix:** new pure module `src/lib/sessionGate.ts` (`hasSessionSettled`) latches readiness so it
  can only go false→true once; `_layout.tsx` holds that in state. The first-load gate — and its
  original anti-flash reasoning — is preserved; only the *re*-closing is removed. Regression test
  `src/lib/__tests__/sessionGate.test.ts` (6 cases), confirmed to fail against the old logic.
  `security-auditor` traced the change and found no widened authorization window: because
  `isPending === true` implies `data === null`, the old gate could never have fired for a signed-in
  user, so the behavioural delta is confined to signed-out users, who now correctly see the `(auth)`
  group instead of a blank frame. `sessionGate.ts` is splash-screen sequencing, **not** an
  authorization signal, and its header now says so.

- **Defect 2 — auth content could be pushed off the top of the screen with no way to scroll.**
  `sign-up.tsx` / `sign-in.tsx` centred their content in a `flex: 1` container with no scroll view.
  Measured at 390pt wide: at a 380pt viewport the "Create account" title sat at top −49 (clipped);
  at 300pt the Name input was at −19. Content centred in a container shorter than itself overflows
  off **both** edges, and with nothing scrollable it is unreachable. A keyboard produces exactly
  this — Android resizes the window (`softwareKeyboardLayoutMode` defaults to `"resize"`, verified
  against the pinned Expo SDK 54 docs), iOS instead covers the Sign up button — and an error
  message makes it worse by growing the content.
  **Fix:** both screens wrapped in `KeyboardAvoidingView` + `ScrollView` with
  `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}` and
  `keyboardShouldPersistTaps="handled"`. Identical look on a tall screen; scrollable when it does
  not fit. No token or visual change. Verified at a 280pt viewport: scrolling to the top reaches
  the title, scrolling to the end puts the Sign up button fully in view.

- **New — an onboarding screen ahead of the create-account form.** `src/app/(auth)/onboarding.tsx`;
  `(auth)/index.tsx`'s `Redirect` moved from `/(auth)/sign-up` to `/(auth)/onboarding`. The hero
  (`src/components/onboarding/HeroRibbon.tsx`) animates the app's **own** week-ribbon motif — the
  same instrument as `WeekAccordion`, at 2× geometry with the week-number gutter dropped so no text
  glyph ever sits near an effort-coloured bar. Seven cells build left to right on a
  `Motion.duration.instant` stagger, each a bottom-anchored `scaleY` spring (`Motion.spring.snappy`)
  that hard-swaps from `progress.disabled` to its effort colour at the frame it locks in, with a
  per-cell pop/glow fading over `Motion.duration.quick`; then the ribbon settles into a slow ambient
  opacity pulse. The seven days are a real microcycle, not a sorted colour ramp: the two hard days
  sit three days apart with a recovery day and the rest day between them, and the week closes on the
  long run. The CTA is genuinely disabled until the build completes, with a token-derived timeout
  ceiling so it can never strand the user; the sign-in link is deliberately never gated.
  Reduced motion is respected (`useReducedMotion()`): no stagger, no spring, no glow, no ambient
  loop — one simultaneous 250ms crossfade to the finished week, then static.
  Built entirely from existing `theme.ts` tokens, from a `ui-designer` pass over
  `frontend-design-brief.md` / `mvp-blueprint.md`.

- **Two new tokens in `theme.ts`.** `Motion.duration.ambient` (2800) — the pulse's one-way period,
  RESERVED to this one use exactly as `reveal` is, and the single sanctioned exception to
  `mvp-blueprint.md` Part 1's ban on "idle floating / ambient looping / breathing gradients"
  (scoped: opacity only, all bars in phase, amplitude capped). And `AmbientPulseFloor`
  (`{ light: 0.999, dark: 0.7 }`) — see below.

- **Copy decision, RULED.** A proposed onboarding supporting line read *"A McMillan-certified coach
  designed the training. No monthly coaching fees, no bloated app — just your plan, week by week."*
  The second sentence is near-verbatim from `planning/02-product-requirements.md`. The first was
  **not** — no user-facing copy anywhere in the product had previously made a certification claim.
  It was grounded in `CLAUDE.md`'s "Coaching domain" section (the owner is a McMillan-certified
  coach; the coaching content is a port of his own library) and worded to attribute the credential
  to the coach who authored the content, not to imply endorsement, partnership, or accreditation by
  McMillan Running as a company. Both `ui-designer` and `ux-copywriter` flagged it for explicit
  sign-off. **The captain ruled against the claim on 2026-08-08**; the fallback shipped instead —
  the supporting line is now just the PRD-grounded second sentence, with no certification claim.

- **Ambient shimmer is dark-mode-only. RULED 2026-08-08 — final, not a pending limitation.**
  `AmbientPulseFloor` is `0.999` in light mode, which makes the shimmer effectively invisible there;
  dark mode pulses normally at 0.7. This was never a tuning choice — four of the five light-mode
  effort hexes already sit barely above the brief's 3:1 floor at full opacity (`easy` is 3.0045:1),
  so there is no headroom for a shared opacity dip, and 0.999 is the largest amplitude that keeps
  all five compliant. The alternatives were to weaken the contrast rule or to re-pick the light
  effort hexes; **the captain ruled to do neither here** — dark-mode-only shimmer is the final
  behaviour for this screen and the contrast floor stays untouched.
  The palette question is tracked separately as **issue #70**, which also carries a second finding
  from the same measurement pass: **dark** `interval` (#C6402F on #14171C) is 3.57:1 at full opacity
  and **2.32:1 at the 0.7 dark floor**, so the dark floor is not actually justified by the numbers
  either. Both are pre-existing properties of the hexes — neither was introduced or worsened by this
  change — and both belong to that issue, not to this one.

## 2026-08-07 — `TypeError: Network request failed` on a phone: the transport failure is now a first-class error, not an unhandled rejection

Phone testing over `expo start --tunnel` produced `Uncaught (in promise, id: 1) TypeError: Network
request failed` from inside `whatwg-fetch`, with no way to get past sign-in. Two separate defects,
one environmental cause.

- **Cause (environment, not code):** `EXPO_PUBLIC_API_BASE_URL` was `http://localhost:8788`. A
  loopback address means *the device running the app*, so it reaches the developer's computer only
  on web or a simulator; on a phone it is the phone, where no Worker is listening. Tunnel mode does
  not change this — `--tunnel` forwards the Metro bundler, never the Worker. The port was also
  drifted (`8788` vs `wrangler dev`'s `8787`, the value in `.env.example`, `workers/README.md`, and
  `wrangler.toml`'s `BETTER_AUTH_URL`), which fails identically. `.env` is gitignored, so the fix
  there is the captain's; `.env.example` now documents the trap and the per-device-type correct
  value, including `wrangler dev -- --ip 0.0.0.0` for LAN testing.
- **Defect 1 — the crash. Auth handlers had no `try`/`catch`.** `sign-in.tsx`/`sign-up.tsx` only
  checked better-auth's `{ error }` return, which covers responses that *arrived*.
  `@better-fetch/fetch` awaits `fetch` outside its own try/catch (`dist/index.js`), so a transport
  failure escapes the `{ data, error }` contract as a raw rejection. In a `Pressable` handler
  nobody awaits, that is an unhandled promise rejection **and** a `submitting` flag that never
  clears — the button spins forever and sign-in becomes unreachable, which is why this blocked
  testing entirely rather than merely showing a bad message. Both screens' four handlers now
  `try`/`catch`/`finally`. `settings.tsx`'s `onPress={() => authClient.signOut()}` had the same
  fire-and-forget shape and is now `handleSignOut`, which catches deliberately: the Expo plugin
  clears the stored cookie and nulls `session.data` in its `onRequest` hook, *before* the request
  goes out, so sign-out succeeds locally even offline and the screen is already unmounted.
- **Defect 2 — the misdirection.** `apiFetch` let `fetch`'s `TypeError` through unwrapped, so it
  failed every `instanceof ApiError` check and surfaced as the per-feature fallback — an
  unreachable backend read as "Could not load your plans." New pure `src/lib/apiErrors.ts` holds
  the error vocabulary (`ApiError` moved there unchanged, new `NetworkError`, `isNetworkFailure`,
  `isLoopbackUrl`, `networkErrorMessage`, `describeError`); `apiFetch` converts transport failures
  to `NetworkError`, and all nine screen `catch` sites now funnel through `describeError`. When the
  base URL is loopback the message names that specifically, because the URL is the diagnosis.
  `isNetworkFailure` matches the known per-engine messages rather than every `TypeError`, so a
  genuine bug in our own code is not reported as an outage. 24 new tests; 318 pass overall.
- **Resolved the same day — deploy the Worker.** Which reachable backend a phone should point at
  was the one thing no code change could settle. The captain ruled for `wrangler deploy` over a LAN
  address against `wrangler dev`, so on-device testing waits on the existing deploy gate rather
  than a same-Wi-Fi workaround, and `EXPO_PUBLIC_API_BASE_URL` becomes the deployed `https://` URL
  once it lands. The deploy chain itself is captain-only and tracked in `docs/mvp-progress.md`'s
  "Blocked / awaiting a decision"; this commit is only the error reporting that made the failure
  legible in the first place.

## 2026-08-06 — Plan-accuracy fix batch: red-flag throughout-plan reduction, 50+ golden deload weeks, age-floor unification

Closes four captain-decided items from `workout-v22-plan-accuracy-s1`'s report and
`v22-apple-kids-guidelines-research-s1`'s report. Full decision rationale:
`docs/mvp-progress.md`'s "Decided (2026-08-06) — plan-accuracy fix batch" section.

- **Red-flag injury volume reduction now applies throughout the plan, not just week 1.**
  Supersedes the 2026-08-03 ruling that gave a red-flag declaration the same week-1-only,
  per-flag-percentage mechanism as any other closed-set flag. `src/lib/loadRules.ts` adds
  `RED_FLAG_VOLUME_REDUCTION_PCT` (15%) and `redFlagVolumeReductionPct()`;
  `applyInjuryVolumeAdjustment()` in `planTemplates.ts` applies it to every week when a red-flag
  injury (today, `ankle_achilles`) is declared, taking over from the ordinary per-flag mechanism
  entirely rather than stacking with it. Still a normal plan shape — no return-to-running
  protocol, no distinct `extras` section — only the reduction's magnitude and duration changed.
- **50+ runners on the golden 12-week 5K path now deload at weeks 4, 8, and 12** — not the
  generic every-3-weeks modulo the 2026-08-03 fix (`ae70d4a`) introduced, which lands on 3/6/9 and
  drops off the plan by week 9. `buildCanonicalFiveKWeek()` in `planTemplates.ts` special-cases
  `intake.age >= 50` to the explicit `[4, 8, 12]` set, which lines up with the natural volume dips
  `FIVE_K_WEEKLY_LOAD` already carries at weeks 4 and 8. Week 12 — the race week — is now flagged
  `isDeload: true` for 50+ runners in addition to its existing race-day structure. The generic
  (non-golden) path's every-3-weeks-for-50+ cadence is unaffected.
- **Confirmed `plantar_arch` is fully wired** (added in the 2026-08-03 batch): `InjuryFlag`,
  `workers/src/routes.ts` intake validation, `src/app/intake.tsx`'s picker, and
  `loadRules.ts`'s reduction table all already include it. No code change needed for this item.
- **App Store declared age-rating floor unified with the backend intake validator at 13.** The
  backend validator (`workers/src/routes.ts:210`) was already raised to `age < 13` by an earlier,
  separate commit (`8acc27c`, 2026-08-03). This task's brief initially described that as a
  declined decision the backend should not follow — the captain resolved that tension mid-task:
  both the backend floor and the App Store Connect age-rating questionnaire answer are 13,
  consistently. There is no in-repo App Store Connect config to point at — `eas init` has never
  been run (`docs/apple-dev-blocked.md`) — so this is recorded here as the value for that
  questionnaire once submission is set up; answering it is still a captain's-account action at
  submission time, not something this repo can encode today.

## 2026-08-06 — Under-18 plans substitute RPE for HR zones, plus a youth disclaimer (captain-approved, §6-A/E)

Client-only, `src/lib/` + rendering only, nothing in `workers/`. Implements the one item the
captain approved from `v22-youth-policy-research-s1`'s report (§6-A) — items B–D (rest-day floor,
volume ceilings, race-distance gate) were explicitly declined and are **not** implemented here.

- **`Workout.hrZone` is now adults-only (age ≥ 18).** `src/lib/loadRules.ts` adds `isUnder18(age)`
  and `rpeForZone(zone)` — the latter a direct lookup into `training-zones.md`'s already-ported
  RPE scale (zone 1 → RPE 3, zone 3 → RPE 7, zone 4 → RPE 8), so no new coaching content was
  invented. `planTemplates.ts`'s `paidFields` picks `hrZone` or the new `Workout.rpe?: RpeValue`
  field based on age, never both; `age` is now threaded through `easyRun`/`longRun`/`tempoRun`/
  `intervalRun`/`shakeoutRun` alongside the existing `density` parameter. Rendering: `RPE N`
  replaces `Zone N` in `WorkoutRow.tsx`'s bracket and "perceived effort N out of 10" replaces
  "heart rate zone N" in `format.ts`'s spoken label, for under-18 plans only — adult plans are
  provably unaffected (regression-tested).
- **New disclaimer, captain's exact sign-off text, appended whenever `intake.age < 18`** — covers
  pre-participation evaluation, growth-plate/bone-health awareness, and a parent/guardian's
  awareness and right to stop the plan. Renders wherever `Plan.disclaimers` already renders
  (`DisclaimerFooter.tsx`) — no separate PDF export exists in this repo to also update.
- **Alternatives considered and rejected:** talk-test (would require inventing coaching content
  the ported library doesn't have) and a "better" age formula like 208 − 0.7×age (the report
  itself rejects this — still implies a precision the evidence doesn't support). Full reasoning:
  `docs/superpowers/specs/2026-08-06-youth-hr-zone-replacement-design.md`.
- New tests: `src/lib/__tests__/planTemplates.youth.test.ts`, plus additions to
  `loadRules.test.ts` and `format.test.ts`. `planTemplates.injuries.test.ts`'s fixture (age 16,
  pre-existing, unrelated to this change) now correctly picks up the new disclaimer — its
  disclaimer-count assertions were updated, not its behavior.

## 2026-08-05 — Settings tab, dummy paywall, and goal-realism UI land; Intake's dead-end save fixed (closes issues #12, #15)

Client-only batch, no `workers/` changes, nothing deployed. Closes GitHub issues #12 and #15,
`docs/mvp-progress.md`'s "Next" step 9 (quota UI + dummy paywall), and the "goal-realism UI half
not built" doc-vs-code drift item from a recent launch-readiness audit (external to this repo).

- **New Settings tab, `src/app/(tabs)/settings.tsx` — the fourth tab alongside Home / Glossary /
  My Plans.** On focus, fetches `GET /api/quota-status` and renders the tier plus a quota line via
  a new pure helper, `src/lib/quotaDisplay.ts`'s `formatQuotaLine()` ("N of M plans used" for
  Free's lifetime allowance, "N of M plans used this period" for Pro/Elite) — mirroring
  `tierLimits.ts`'s existing "display helper only, server enforces the number" convention. Free
  tier also gets an "Upgrade" button to `/paywall`. **Sign-out moved here from Home** (Home's
  temporary button, in place since the 2026-08-03 auth commit for lack of anywhere else to put it,
  is removed). **New Delete Account flow**: a native `Alert.alert` confirm, then `deleteAccount()`,
  then an explicit `authClient.signOut()` — the server-side session row is gone after the delete
  call, but better-auth's Expo client only refetches on an explicit sign-in/out call, not on a
  plain `apiFetch`, so `signOut()` is needed to invalidate the local session store and let
  `src/app/_layout.tsx`'s `Stack.Protected` guard react.
- **New dummy paywall screen, `src/app/paywall.tsx`** — a `Stack.Screen` route (registered in
  `src/app/_layout.tsx` alongside `(tabs)`/`plan/[id]`/`intake`), reached two ways: reactively, from
  Home's generate-plan action catching a `402 over_quota` response and pushing to `/paywall` with
  the server's `quota` object JSON-stringified as a route param (parsed defensively — a missing or
  malformed param degrades to generic copy rather than throwing); or proactively, from Settings'
  "Upgrade" row for a Free-tier runner (no `quota` param). Calls `purchaseTier('pro' | 'elite')`
  (the existing dummy purchase route) and says so honestly: "This is a test upgrade — no payment
  required."
- **Intake's dead-end save is fixed.** `src/app/intake.tsx` previously saved and left the runner on
  the same screen with only a transient "Saved." text; it now calls `router.replace('/(tabs)')`
  after a successful `putIntake()`, landing the runner on Home. The header's exit action
  (`src/components/intake/IntakeExitAction.tsx`, now taking an explicit `label` prop instead of a
  hardcoded "Skip for now") reads "Done" once intake already existed on load or was just saved this
  session, and "Skip for now" otherwise — so a runner revisiting a completed intake, or one who just
  saved, no longer sees a label that implies they're abandoning something incomplete.
- **Home (`src/app/(tabs)/index.tsx`) now prefills `raceDistance`/`raceDate` from the runner's saved
  intake**, once per mount (a `useRef` flag, not on every refocus) so it doesn't clobber an
  in-progress edit when the runner tabs away and back. Home also now fetches and displays
  `GET /api/quota-status` inline (`formatQuotaLine`), and its `generate-plan` catch branch routes a
  `402 over_quota` response straight to `/paywall` instead of just surfacing the raw error text.
- **`Plan.goalRealism` is now surfaced in the UI, not just computed server-side.** New
  `src/components/plan/GoalRealismNotice.tsx` — a calm, neutral raised-surface card (same treatment
  as `FallbackNotice`, never `status.error`: this is a coaching judgment call, not a failure) — is
  rendered in three places: `src/app/plan/[id].tsx` shows it whenever the generated plan's
  `goalRealism.realism === 'implausible'` ("Your goal pace was adjusted."); and a live, read-only
  preview of the same `assessGoalRealism()` call runs client-side at both goal-entry points ahead of
  generation — Intake's goal-time field (once both a complete goal time and a complete recent
  performance are entered) and Home's goal-entry panel. Home's preview only renders when the
  panel's currently-selected race distance matches the distance the saved `goalTimeSec` was recorded
  against — the saved goal time was entered against `intake.raceDistance` specifically, and the
  panel's own race-distance chip is independently editable, so judging a stored goal time against a
  distance it was never set for would be a silently wrong preview, not a stale-but-honest one.
  `'ambitious'` gets a softer heads-up copy than `'implausible'`'s "was adjusted" copy, since an
  ambitious goal still anchors race-pace reps at the runner's actual declared goal — the notice must
  not claim an adjustment that didn't happen.
- 278 tests pass (272 pre-existing + 6 new for `quotaDisplay.ts`), `npm run typecheck` and
  `npm run lint` both clean. No `workers/` change, so the Workers gate wasn't re-run.
- **Not touched by this batch, deliberately:** the backend deploy (still captain-only, see
  "Blocked" in `docs/mvp-progress.md`) and the Pro/Elite AI-generation prompt (still the one unbound
  seam in `workers/src/deps.ts`) — only the free-tier template engine plus this client polish
  landed.

## 2026-08-05 — Google OAuth credentials provisioned and verified in local dev

The captain provided real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` values, closing the blocker
`workers/src/auth.ts`'s TODO above `buildSocialProviders` had tracked since 2026-08-03.

- Credentials were written to `workers/.dev.vars` (gitignored, local-only — never committed, never
  logged in any tracked file).
- Verified with `wrangler dev` running locally: `POST /api/auth/sign-in/social` with provider
  `google` now returns a real `accounts.google.com/o/oauth2/v2/auth` authorization URL, with the
  correct `client_id` and `redirect_uri` (`http://localhost:8787/api/auth/callback/google`,
  matching `workers/wrangler.toml`'s local `BETTER_AUTH_URL`).
- Fetched that generated URL directly and confirmed Google's own server serves a real sign-in
  page — not `invalid_client` or `redirect_uri_mismatch` — proving the credentials are valid and
  correctly registered.
- Confirmed `APP_SCHEME` (`paceblueprint://` in `workers/wrangler.toml`) matches `app.json`'s
  `expo.scheme`, so the deep-link return into the app is also correctly configured.
- **Not done, deliberately:** a full interactive human login. There's no test Google account
  available, and logging into a real one isn't something to automate — verification stops at
  "Google accepts these credentials and serves the real consent flow," the strongest check
  possible without a human clicking through Google's UI.
- **Production is not done.** `wrangler secret put GOOGLE_CLIENT_ID` and
  `wrangler secret put GOOGLE_CLIENT_SECRET` still need to run, and only the captain can run them
  (needs their own Cloudflare login) — not run as part of this change. See `docs/mvp-progress.md`'s
  "Blocked" table.
- **Flagged: the client secret was pasted in plaintext into a chat pane twice this session**
  before landing in `workers/.dev.vars`. It should be treated as exposed and rotated in Google
  Cloud Console once the credentials are confirmed stable — that rotation is the captain's call,
  not done here.

## 2026-08-05 — UX audit fix batch: tab bar icon, Google error copy, plan legend, plan status label, date/time masking (`1c1e174`)

Findings 1-5 of a 7-finding UX audit report (`v22-ux-audit-r1`, external to this repo). Findings 6
and 7 are explicitly out of scope for this batch and untouched.

- **Finding 1 — tab bar no longer shows React Navigation's dev-only `MissingIcon` placeholder.**
  `src/app/(tabs)/_layout.tsx` never supplied a `tabBarIcon`, so React Navigation's fallback was
  rendering and clipping the tab labels — a dev affordance shipping to real users. All three
  `Tabs.Screen` entries now set `tabBarIcon: () => null`; no icon set is being added (that remains
  a deliberate label + caliper-tick design, `mvp-blueprint.md` Part 8, and a HIGH-tier new
  dependency per `AGENTS.md`).
- **Finding 2 — Google sign-in shows a human message instead of the raw backend error string.**
  `src/app/(auth)/sign-in.tsx` and `sign-up.tsx` both caught `socialError` and rendered
  `socialError.message` verbatim, which for better-auth's `PROVIDER_NOT_FOUND` code is the literal
  string "Provider not found." Both screens now special-case that code and show "Google sign-in
  isn't available yet." instead; the button itself stays visible either way. This is copy only —
  Google OAuth credentials are still not configured (tracked separately, `v22-google-oauth-creds`
  in "Blocked" in `mvp-progress.md`); no code path changed.
- **Finding 3 — plan view gained a one-line effort-color legend.** `src/app/plan/[id].tsx`'s week
  ribbon (`WeekAccordion`) colors each day by effort with no key of its own; a screen-reader user
  already got the effort word per day via `describeDays()`, but a sighted user had no way to decode
  the colors. One legend under the plan title, sourced from the same `EffortOrder`/`theme.effort`
  tokens the ribbon uses, not repeated per week (plan-level information, not per-week).
- **Finding 4 — My Plans drops the internal "TEMPLATE" engine label from user-facing copy.**
  `src/app/(tabs)/my-plans.tsx`'s `PlanRow` metadata line was printing `plan.engine.toUpperCase()`
  next to `TIER: FREE` — an internal implementation detail (which generation engine produced the
  plan), redundant with the tier the runner already sees. Removed from the visible line; nothing
  else about `PlanSummary` changed.
- **Finding 5 — Intake and Home's date/time fields gained as-you-type masking and inline
  validation.** `raceDate` (Intake, Home), `goalTime`, and `recentTime` (Intake) were raw free-text
  inputs accepting any keystroke. Both screens now mask input live (`formatDateInput`/
  `formatTimeInput`, digits-only, auto-inserted separators) and show an inline error once a field
  is digit-complete but invalid (`dateFieldError`/`timeFieldError`) — the error message doesn't
  flash mid-keystroke. A native date/time picker was deliberately not added: it would be a new
  dependency (HIGH tier, `AGENTS.md`), out of scope for this batch, and is logged as a possible
  follow-up. A code-review pass over this fix caught a related gap and closed it in the same
  commit: an incomplete race date (e.g. `"2026-09"`) previously passed submit-time validation
  silently on both screens; submit now also checks digit-completeness, not just calendar validity.

Verified: `npm run typecheck && npm run lint && npm test` — 272/272 passing. Reviewed by
`code-reviewer` (one finding, the incomplete-date gap above, fixed in the same commit) and
`security-auditor` (the Google error-handling change; no issues) against the combined diff.

## 2026-08-05 — phone-test UX fixes for auth landing and Intake

- Signed-out launches now default to `/(auth)/sign-up`; the existing "Already have an account? Sign in" action remains on the sign-up screen for returning runners.
- Intake now has an always-visible, accessible header action labeled "Skip for now". It replaces to `/(tabs)`, where Home already supports a missing intake by showing its "Complete your intake" prompt, so the deliberate post-signup `router.replace('/intake')` remains intact and does not recreate the sign-up redirect race.
- The conditional race-date label now says `Race date (optional, YYYY-MM-DD)`, matching its existing optional payload and validation behavior.
- Added focused regression tests for the auth anchor's sign-up default and the explicit Intake exit action.

## 2026-08-04 — four bugs fixed in the E2E verification pass over the intake/generate-plan/My Plans frontend loop

This branch wired up the app's first end-to-end user loop: the intake screen against `GET`/`PUT
/api/intake`, the generate-plan action against `POST /api/generate-plan`, the plan view rendering
real generated plans via `GET /api/plans/:id` (alongside the permanent static golden fixture), and
a My Plans list off `GET /api/plans`. An E2E pass over that loop found and this pass fixed four
bugs, all verified (unit-tested and/or re-verified live against `wrangler dev`):

- **Sign-up → Intake auto-redirect race.** `src/app/(auth)/sign-up.tsx`'s own `useEffect` watching
  `session` could lose a React unmount race against `src/app/_layout.tsx`'s `Stack.Protected`
  unmounting the `(auth)` group in the same commit — an unlucky ordering could leave a freshly
  signed-up user on no screen at all. Fixed with a new one-shot module-level flag,
  `src/lib/postSignupRedirect.ts` (`markPostSignupRedirect()` / `consumePostSignupRedirect()`):
  `sign-up.tsx` marks it on a successful signup, and `_layout.tsx` — which never unmounts —
  consumes it in a `useEffect` watching `session`, then calls `router.replace('/intake')`. New test:
  `src/lib/__tests__/postSignupRedirect.test.ts`. E2E-verified: two independent fresh signups both
  landed on Intake.
- **Long-run distance floating-point display bug.** `src/lib/planTemplates.ts`'s long-run
  convergence loop assigned `clampLongRun()`'s raw fractional km straight into the rendered plan
  (e.g. `"5.666666666666667 km"`). Fixed by flooring (`Math.floor`, never rounding up — rounding up
  could re-breach a safety-cap ceiling) each iteration before comparing or assigning. Verified
  against the existing exact-equality/byte-identical assertions in
  `src/lib/__tests__/planTemplates.longRunCap.test.ts` (unchanged, still green) and E2E-verified
  across a real 10-week 5K and a real 32-week Marathon plan generated through the actual endpoint.
- **My Plans list went stale after navigating away and back.** `src/app/(tabs)/my-plans.tsx`
  fetched via a mount-only `useEffect`, but Expo Router tab screens stay mounted across
  navigation — the same staleness class as an earlier Home-screen fix on this branch. Fixed by
  switching to `useFocusEffect(useCallback(...))`. E2E-verified: a newly generated plan appeared on
  tab revisit with no manual reload.
- **Race Day distance unrounded for Half/Marathon.** Found by the E2E re-verification pass itself,
  not part of the original three. `raceDayWorkout()` in `src/lib/planTemplates.ts` computed
  `distanceKm: raceKm + 5` with no rounding — harmless for 5K/10K's whole-number race distances, but
  Half Marathon (21.1 km) and Marathon (42.195 km) rendered a literal `"47.195 km"` in `WorkoutRow`,
  since `WorkoutRow.tsx` applies no formatting of its own. Fixed by wrapping the sum in
  `Math.round()` — the exact race distance is still spelled out in the workout's `structure`
  string, so nothing is lost; only the summary number changes. New coverage in the existing
  parametric suite, `src/lib/__tests__/planTemplates.general.test.ts`'s `describe('buildTemplatePlan
  — parametric inputs')`, asserting the race-day `distanceKm` is a whole number across all four
  supported race distances.

All 270 root tests + 86 `workers/` tests pass clean: `npm run typecheck && npm run lint && npm test`
plus `npm --prefix workers run typecheck && npm --prefix workers test`.

## 2026-08-03 — intake age floor raised from 10 to 13 (captain's ruling)

Ian ruled V2.2's minimum accepted intake age is 13 — the number that simultaneously clears
Apple's App Store 9+ rating floor for exercise-recommendation apps, COPPA's under-13
verifiable-parental-consent line, and Texas SB2420's lowest legally-defined age band (scout report
`v22-apple-kids-guidelines-research-s1` §6.4/§6.5).

- `workers/src/routes.ts`'s `validateIntake` now rejects `age < 13` (was `< 10`).
- New migration `workers/migrations/0003_raise_intake_age_floor.sql` rebuilds `intake_responses`
  with `CHECK (age >= 13 AND age <= 100)`, the real backstop behind the validator, dropping any
  pre-existing rows with `age < 13` rather than grandfathering them.
- New test: age 12 rejected (`400`), age 13 accepted (`200`).

## 2026-08-03 — deload cadence is driven by experience level (Ian's ruling: "pro runners = 3 weeks, beginners = 4")

Ian ruled that the deload cadence should be driven by experience level — "pro runners = 3 weeks,
beginners = 4" — composing with, not replacing, the already-merged 50+ mandatory 3-week rule.

- **The engine already keyed cadence to experience, and this ruling ratifies it.** Since the plan
  engine landed, `deloadEveryWeeks()` (`src/lib/loadRules.ts`) resolved the source's per-level
  "Deload trigger" table (`load-rules.md`: Beginner every 4, Intermediate every 3–4, Advanced every
  3, 50+ every 3 mandatory) to one number per level. `advanced` deloads every 3 weeks; `beginner`
  every 4. `intermediate` stays at 4 — the source's "every 3–4 weeks" range, and the ruling only
  addresses the two extremes. This also resolves the source's open beginner-cadence gap
  (`workout_library.md` § Deload Frequency by Runner Type, which had flagged 4 vs 4–5 weeks): the
  ruling settles beginner at 4.
- **Composition with the 50+ rule, made structurally explicit.** `planTemplates.ts` previously
  inlined the same `age >= 50 || level === 'advanced' ? 3 : 4` expression; it now calls through the
  single shared `deloadEveryWeeks(level, age)`, so the "50+ forces 3 regardless of experience,
  otherwise experience decides" composition lives in exactly one place and can't drift.
  Verified semantics: a 50+ runner of *any* experience level still gets the mandatory 3-week
  cadence; an under-50 `advanced`/competitive runner now also gets 3 weeks; an under-50
  `beginner` runner gets 4 weeks; `intermediate` is unchanged.
- **Regression tests** on both the canonical golden 12-week/5K/4-day path and the generic path, plus
  the `deloadEveryWeeks` unit suite: under-50 advanced → deloads `[3, 6, 9]`; under-50 beginner →
  `[4, 8]`; 50+ of any level → `[3, 6, 9]`; intermediate unchanged.

## 2026-08-03 — `intake.injuries` now drives plan generation (plan-accuracy s1, bug 1 + mandated finding B)

From the plan-accuracy scout's Bug 1: `intake.injuries` was read nowhere in `planTemplates.ts` —
every injury combination, including all six original flags plus red-flag free text, produced a
byte-identical plan to `['none']`. Two captain rulings closed the open design questions this
depended on (full text: `docs/reference/coaching/plan-structure.md`'s "Design rule" section,
`load-rules.md`'s "Per-flag volume reduction" section):

- **Ruling 1 — red-flag injury plan shape.** "Whichever uses the least amount of tokens but still
  maintain professionalism": a red-flag declaration produces a normal, volume-adjusted plan — the
  same mechanism as any other closed-set flag — **not** the return-to-running protocol generator
  `plan-structure.md` previously described as the intended design. That section is updated in
  this pass to record the supersession, dated and cited, per this project's convention for
  ruling changes; the original text is kept below the note, not deleted. "Still maintain
  professionalism" is met by a strengthened professional-evaluation disclaimer, adapted from the
  source's own language rather than invented, layered on top of the standard Rule 10 injury
  disclaimer for a red-flag declaration.
- **Ruling 2 — add `plantar_arch` to the closed `InjuryFlag` set,** resolving mandated finding B's
  coverage gap. Wired at its library-prescribed 20% reduction (`injury_flags.md:69`).

Implementation:

- `src/lib/planTypes.ts`: `InjuryFlag` gains `'plantar_arch'`.
- `src/lib/loadRules.ts`: new `INJURY_VOLUME_REDUCTION_PCT` (per-flag "this week" volume cut —
  knee/shin splints 15% from their own body-specific source figures, plantar_arch 20%; the four
  flags without a body-specific figure — `ankle_achilles`, `it_band`, `hip_glute`, `lower_back` —
  fall back to Rule 5's generic 20% Reduce Volume tier, not an invented number), `RED_FLAG_INJURIES`
  (today, `ankle_achilles` only — an interpretive call, flagged for captain review, since the
  source never literally labels a body-location pattern "RED FLAG"), and the
  `injuryVolumeReductionPct()` / `hasDeclaredInjury()` / `hasRedFlagInjury()` helpers. Multiple
  declared flags combine at the largest reduction, not additively — an engine-combination choice,
  not a sourced number.
- `src/lib/planTemplates.ts`: both `buildCanonicalFiveKWeek` and `buildGenericWeek` now apply the
  declared reduction to the plan's first generated week only ("this week" in every source
  coaching response); later weeks ramp off week 1's actual reduced volume through the existing
  `lastLoadingWeekKm` mechanism, unchanged. `Plan.disclaimers` now attaches the Rule 10 injury
  disclaimer (exact string, `load-rules.md:265-267` — previously nowhere in the codebase despite
  a declared knee injury) whenever `injuries` isn't `['none']`, plus the new strengthened
  disclaimer for a red-flag declaration. `injuryNotes` continues to never gate arithmetic
  (`planTypes.ts`'s existing documented contract, unchanged).
- New `src/lib/__tests__/planTemplates.injuries.test.ts` (12 tests): inverts the scout's
  all-identical A/B, checks the per-flag reduction percentages (golden and generic engine paths),
  the disclaimer's presence/absence, and that a red-flag plan is structurally identical to an
  ordinary injury plan at the same reduction tier — same phases, same deload cadence, no `extras`,
  differing only in disclaimers. Extended `loadRules.test.ts` with direct coverage of the new
  helpers. **256 passing tests across 14 suites**, `typecheck`, `lint`, and `test` all clean.
- Docs updated in the same pass: `plan-structure.md`, `injury-rules.md` (notes the
  return-to-running protocol is documented, unused source content — not deleted, same status as
  Rule 5's "Monitoring" tier), `load-rules.md` (new per-flag table), `00-README.md` (clarifies
  that Rule 6/`injury_flags.md` Part 1's per-pattern *magnitudes* are reused for the closed-set
  flag's at-intake cut even though the log-detection *mechanism* stays out of scope, plus two new
  decision entries), `mvp-progress.md`, `architecture.md`.

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

## 2026-08-03 — client-side auth lands: sign-in/sign-up, an API client, and a session gate (`06b1f89`)

The app's first module that actually talks to `workers/`. No new backend routes — this wires the
client onto the account routes that landed 2026-08-02.

- **New `src/lib/apiClient.ts`.** Wraps better-auth's Expo client (`@better-auth/expo/client`,
  session persisted via `expo-secure-store`) as `authClient`, re-exporting `signIn`, `signUp`,
  `signOut`, and `useSession` for screens to call directly. Adds a small typed `apiFetch<T>()` and
  one function per non-auth `/api/*` route: `getQuotaStatus`, `purchaseTier`, `deleteAccount`,
  `getIntake`/`putIntake`, `listPlans`/`getPlan`, `generatePlan`. Those custom routes attach the
  session by reading `authClient.getCookie()` onto the request's `cookie` header — better-auth's
  Expo plugin only replays the stored session automatically for calls made through `authClient`
  itself, not for a plain `fetch`.
- **New `src/app/(auth)/`**: `sign-in.tsx` and `sign-up.tsx` (email/password, plus a "Continue with
  Google" button that is wired end to end but inert until the captain provisions Google OAuth
  credentials), `_layout.tsx`, and `index.tsx` (a redirect anchor).
- **`src/app/_layout.tsx` now gates the whole app behind a session.** Reads
  `authClient.useSession()` and uses Expo Router's `Stack.Protected` to route a signed-in user into
  `(tabs)`/`plan/[id]` and everyone else into `(auth)` — including mid-session sign-out. This is the
  captain's explicit "no anonymous browsing" decision, and it matches reality: every `/api/*` route
  already 403s anonymously, so there was nothing an anonymous user could do past sign-in anyway.
- **`workers/src/auth.ts` gains the `expo()` server plugin from `@better-auth/expo`**, paired with
  the existing `bearer()` plugin — needed for OAuth deep-link redirects and origin trust; a no-op
  for the email/password path already in use.
- **New dependencies:** `better-auth`, `@better-auth/expo`, `expo-secure-store`, `expo-network`
  (root); `@better-auth/expo` (`workers/`).
- **`.env.example` gains `EXPO_PUBLIC_API_BASE_URL`** — the Worker's origin
  (`http://localhost:8787` for local dev), not a secret.
- **A known type friction, documented in place rather than worked around silently:**
  `@better-auth/expo`'s `package.json` declares a `typescript: ^6.0.3` peer; this project is pinned
  to `~5.9.2` (bumping to TS 6 broke `expo/tsconfig.base`'s ambient type resolution project-wide —
  tried, reverted). `apiClient.ts` carries a narrow `as unknown as BetterAuthClientPlugin` cast plus
  a small interface merge to restore `getCookie()`'s type, with a comment explaining why.
- **Unrelated pre-existing bug fixed in the same commit, needed to run the app at all for manual
  verification:** `metro.config.js` was importing `metro-config/src/defaults/exclusionList`, a
  subpath the installed `metro-config`'s `exports` map no longer allows; fixed to
  `metro-config/private/defaults/exclusionList`.
- **Verified:** `npm run typecheck && npm run lint && npm test` clean at root;
  `npm --prefix workers run typecheck && npm --prefix workers test` clean. Curl-level, against
  `wrangler dev`: sign-up, sign-in, anonymous 403, wrong-password 401 all behave exactly as
  `workers/src/index.ts`'s route table documents. Drove the running app (Expo Go/iOS Simulator,
  briefly web): unauthenticated launch redirects to `/sign-in`; a successful email/password sign-in
  navigates into the protected `(tabs)` group; a temporary "Sign out" button added to Home for this
  purpose (there's no Settings-lite screen yet) redirects back to `/sign-in`. The sign-up screen was
  verified only via the same backend curl test, not tap-tested live in the running app (an Expo Go
  dev-menu tooltip blocked further UI automation) — it shares the sign-in screen's code path and
  structure.
- **Not built in this pass, deliberately:** intake screen, plan generation UI, My Plans list,
  quota/tier display UI, visual design polish (function over form, captain's explicit call).
- **Still outstanding:** Google OAuth client id/secret — the captain provides them through a
  separate channel; once they land in `workers/.dev.vars` (local) and `wrangler secret put`
  (production), no code changes are needed.

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
