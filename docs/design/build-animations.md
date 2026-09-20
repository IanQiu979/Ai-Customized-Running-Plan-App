# The build animations — "the plan builds itself"

> Implemented 2026-09-14 from the six captain-approved Claude Design pages (`V22-01` … `V22-06`,
> approved 2026-09-13; design handoff of the same date, `V22 Pace Blueprint (Claude Design
> project)/`). Where a page and the 2026-09-12 animation spec (`design-animation-spec-2026-09-12.md`,
> §B) disagree, the page wins; the handoff's `V22 theme.md` is the colour/type authority
> ([`instrument-visual-system.md`](instrument-visual-system.md) §B). This is the guide for anyone
> touching or adding one; the code headers carry the detail.

## The idea

Every animation in V2.2 is the same idea at a different scale: an empty week strip → blocks and
numbers snap into place → a finished plan. The vocabulary (spec §B.0):

- **Slot** — one of seven unnamed day columns on a baseline. Empty = a rest day.
- **Block** — a filled session bar in one of the two session tones, labelled with its distance
  (`8`) and code (`ER`, `TR`, `LR`).
- **Number** — tabular figures that count up as blocks land.
- **Snap** — a block rises from the baseline in 350 ms, overshooting to 1.03 and settling once.
  Never a second bounce.

Days are `01 … 07`, never Mon–Sun (`CLAUDE.md`, coaching domain) — the pages print MON…SUN in two
places and the project rule wins there.

## How it is built

**One clock per composition.** `useBuildClock({ total })` (`src/components/build/useBuildClock.ts`)
owns a Reanimated shared value `T` in **seconds** that runs linearly 0 → `total` once and holds.
Every component derives every opacity, height and translate from `T` on the UI thread — exactly as
the pages derive theirs from the page timeline — so a whole choreography is a table lookup off one
number, not a tree of chained timers. `settled` flips at the end (with a slack ceiling so a lost
callback can never strand a gated control); `play: false` holds a clock at 0 until a step scrolls
into view; `restart()` is the one way to play again.

**Reduced motion = the end frame.** The clock starts *at* `total` and never runs, so every build
shows its poster directly (spec §0: "design the end frame first"). `CountUp` seeds its figure from
the landings so the end frame never flashes a 0.

**The vocabulary is `src/lib/buildMotion.ts`**, a straight port of the pages' runtime
(`animations-v3.jsx`'s `Easing`, each scene's `MOTION`): `enter` (ease-out arrival), `draw`
(linear), `move` (ease-in-out), `snap`, `snapLandsAt`, and each page's cue table resolved to
absolute seconds (`HERO_TIMELINE`, `STEP_TIMELINE`, `SURVEY_TIMELINE`, `MARK_TIMELINE`,
`PLAN_HERO_TIMELINE`). Every function is a worklet *and* plain JS, so the UI thread and the tests
run the same code. The numbers are the pages' numbers — change them here and the build stops
matching what the captain approved.

**The data shape is `src/lib/weekStrip.ts`**: `StripWeek` (seven `StripBlock | null`),
`stripFromWeek` (a real `Week` normalised so its longest session fills 90% of the track — the rule
V22-05 was drawn to), and the pages' own fixed weeks (`HERO_WEEK`, `SURVEY_WEEKS`,
`ENGINE_CANDIDATES`). Every strip in the app, animated or static, renders this one shape.

**Page coordinates.** The two full-screen builds (hero, survey intro) are authored in absolute
points on the pages' 393 × 852 canvas and mounted on `DesignCanvas`, which scales the composition
*down* to fit the viewport and centres it — never up, never stretched (spec §0: an iPad centres the
composition). `DesignWidth` in `theme.ts` is that width.

## The compositions

| Page | Component | Mounted by | Clock | What plays |
|---|---|---|---|---|
| V22-01 Main onboarding animation | `OnboardingHero` | `(auth)/onboarding.tsx` | 3.0 s build + 2.2 s hold; the screen owns it and gates the CTA (and, first launch only, the scroll lock) on `settled` | Baseline draws (0.4 s) → blocks snap in 220 ms apart, the 96pt Number ticks with each landing → three faint weeks slide down (0.28 / 0.18 / 0.10) → legend on hold → "Scroll down" at hold + 0.8 s (a hint, not a tap target since 2026-09-20) |
| V22-02 Step animations | `StepIntake`, `StepEngine`, `StepMiniPlan` (`steps.tsx`), `RevealPrimaryAction` (`ui/ActionButton.tsx`) | `(auth)/onboarding.tsx`, one clock per step, started when the step's content (piece + copy) is fully on screen (`lib/onboardingReveal.ts`) | 2.4 s each, motion ≤ 1.5 s | Rows arrive, a segmented control is pressed 3 → 4 → 5, fields count to 10 km / 51 min · three tiles arrive, the middle one grows into a session card while the others fade · the plan-detail week in miniature builds in 1.0 s · the button's outline draws (0.6 s), the ink fill sweeps in (0.65 s →), the label fades up (0.85 s →) |
| V22-03 Survey intro | `SurveyIntro` | `intake.tsx`, only when `getIntake()` returns nothing | 2.3 s build + 2.2 s hold | Week 1 builds (blocks 200 ms apart), weeks 2–6 stack beneath fading toward the bottom, PRESS TO CONTINUE at hold + 0.8 s; a tap reveals the questions |
| V22-04 Home header mark | `HeaderMark` | `(tabs)/index.tsx`, in the tier row | 0.6 s fill + 2.0 s hold; re-runs only when `completedDays` changes | The current week's elapsed days fill bottom-up in ink, 300 ms each, 70 ms apart |
| V22-05 My Plans hero | `PlanHero` | `(tabs)/my-plans.tsx` | 2.0 s build + 2.0 s hold; the screen fades "Open plan" and the list in on the hold | The runner's real first week — real distances, real codes, the real total — snaps in 180 ms apart; one faint copy beneath; the example plan when no generated plan exists |
| V22-06 Plan detail strip | `StaticWeekStrip`, `MiniWeekStrip` | `plan/[id]/`, `PlanListRow`, Home's no-plan preview | none — static | The end frame only: the overview's 120 × 22 row miniatures, the week screen's full strip, the list rows' 60 × 28 thumbnails |

"Completed days" for the header mark and the overview's current-week highlight is **elapsed**
days — `src/lib/planProgress.ts` reads Day 1 of Week 1 as the day the plan was generated. The app
logs nothing, so that is the only honest derivation until a real day-marking flow exists.

## Adding or changing one

1. Read the approved page, not the spec, for every value; serve the handoff folder over HTTP to
   watch it (`file://` will not load its scripts). The pages' stage answers a
   `data-om-seek-to-time-frame` event (`detail: { time, sync: true }`), which is how the
   2026-09-14 visual-match pass captured reference frames at exact times.
2. Put timings in `buildMotion.ts` as a cue table, never in a component; put data shapes in
   `weekStrip.ts`.
3. Derive from `T` in `useAnimatedStyle` / `useAnimatedProps`; do not chain `withTiming`s.
4. Give it an end frame that stands alone as a still, and let `useBuildClock` handle reduced
   motion — do not branch on it in the component.
5. Play once; hold. No loops on a hero. A micro-animation may re-run only when its data changes.
6. Render it in `src/components/__tests__/build.test.tsx` at its end frame (reduced motion) and
   test the pure parts in `src/lib/__tests__/`.
7. Do the visual-match pass yourself before the captain sees it: a screenshot of the built screen
   beside the page's PNG in `screenshots/`, and the motion sampled against the page's timings.
