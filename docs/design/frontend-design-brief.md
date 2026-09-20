# V2.2 — Frontend Design Brief

> Plain-English design document. No code. Written for two readers: a **designer** translating this
> into Claude Design, and an **implementer** building it afterwards.
>
> Assembled from eight specialist passes (ground truth, market research, visual design, token
> system, motion, copy, responsive, accessibility). Where those passes disagreed, the conflict is
> resolved here and recorded in Part 10 — nothing was averaged or papered over.
>
> Status: the app is a bare Expo template. Every screen below is built from zero.

---

## Part 0 — The law

These come from `planning/01-brainstorm.md`, `02-product-requirements.md`,
`03-engineering-requirements.md`. They are not design choices and cannot be traded away.

**The product does one thing.** A runner answers an intake questionnaire and gets a week-by-week
training plan. It is **not a training log**. No workout check-offs, no "completed vs. upcoming"
states, no logging affordances, no progress-against-plan tracking. Any design that implies
check-off is out of scope.

**The tiers.**

| Tier | Quota | Engine | What the runner gets |
|---|---|---|---|
| Free | **1 plan total, forever** — not monthly | Template only, no AI call | Structure only. No pace targets, no coach notes |
| Pro | 3 plans **per period**† | Template skeleton + AI personalization | Pace targets, HR zones, warm-ups/drills, a coach's "why" per week |
| Elite | 10 plans **per period**† | Same skeleton, customized far more heavily — richest prompt | Everything in Pro, richer, tuned to injury history |

† A period is purchase-day-anchored (e.g. May 26 → June 26, clamped at month end), not a calendar
month. Copy never says "this month" for any tier.

**Elite is not "the tier with the guardrail removed."** All three tiers build on the same
coach-authored template skeleton, and it is never removed — Elite just customizes it far more
heavily (richest prompt, per-workout "why"). Extras are cut for MVP (decision 7, 2026-07-10).
What scales across tiers is how much of the runner the plan reasons about and how much it
explains, never how much of the coach's judgment is taken away. The deterministic load-rule clamp
applies identically to all three tiers.

Getting *"1 total"* vs *"per month"* wrong is a factual error, not a copy nuance.

**Quota and tier are server-authoritative.** The client displays them and is never the authority.
Home reads a `quota-status` endpoint; it never counts anything itself.

**Intake is ten fields.** Goal, **age**, experience level, days per week, current weekly volume,
target race distance, target race date *(only if a race is chosen)*, **goal time** *(only if a race
is chosen)*, **a recent time at any distance** *(optional)*, injuries/constraints. Do not add an
eleventh.

Eight are always asked. Race date and goal time appear only when the runner picks a target race, so
the flow is **8 questions, or 10 with a race**.

> **Three of these are load-bearing, not demographic.**
>
> **Age** → max HR is estimated `220 − age`, so every heart-rate zone is uncomputable without it,
> and Pro and Elite explicitly sell HR zones. The load rules also make a 3-week deload cadence
> mandatory for runners 50+. Store an integer age, never a date of birth.
>
> **Goal time** → drives **race-pace sessions only**.
>
> **Recent time** → drives **every other training pace**. Deriving easy or tempo pace from a goal
> the runner hasn't achieved prescribes paces they cannot sustain. **Without a recent time, the plan
> emits no numeric paces at any tier** — only effort language.
>
> That last rule is why the **readout bracket** (Part 2) can never render a lie: the bracket flanks
> a measured numeral, and if nothing was measured, no numeral exists to flank. The type system
> enforces it — `pace` and `hrZone` are optional on `Workout`.

**Two different "goal" concepts. Never merge them.** `intake.goal` is a one-time general training
goal captured at onboarding. The request's `goalType` is separate: a target **race** (plan spans
today → race day) or a fixed **duration** (a number of weeks).

> **Superseded, 2026-08-15 — the target race is asked once, at intake.** This brief originally had
> the race distance and race date re-chosen on every generation, with intake's answers as a mere
> default. Shipping that produced the "take the survey twice" bug the captain reported: intake is
> now the only surface that asks for a target race, and no other screen may re-ask it. The target
> is also genuinely optional — nothing may default a race distance. The rule is code, not prose:
> `src/lib/planRequest.ts`, with the guardrail in [`AGENTS.md`](../../AGENTS.md). Everything below
> that shows a distance chip row or a date control outside intake is superseded by it.

> **Superseded further, 2026-09-20 — the intake creates the plan, and Home asks nothing.** The
> captain's phone-test rulings moved the last of the per-plan questions into the intake: it asks
> the plan length itself (only while the race date is blank), requires a target race distance
> (the date and goal time stay optional), starts blank on every entry, cannot be skipped on a
> first entry, and ends in one **"Create plan"** that saves and generates in the same press. Home
> has no target card, no plan-length field, no Notes and no teasers; its one CTA, **"Create a new
> plan"**, opens the intake. The per-plan Notes field was dropped, not moved. Every "configure"
> or "generate" surface described below is superseded by it — `docs/change_log.md`, 2026-09-20.

**Sign-up is required.** Google, Apple, email/password. No guest mode in v1 — never write "continue
as guest" or "skip for now" on auth. Apple Sign-In must appear in the design even though it is not
yet configured server-side (App Store rules require it once Google is offered).

**`isFallback`.** When AI output fails structural validation twice, the system serves a template
plan and flags the row. The backend contract is settled; **the UI treatment was specified nowhere**
and is invented in this document (Part 5).

**Errors.** `402` = over quota → route to paywall. `403` = anonymous → defensive only.

**The app has no name.** Do not design a wordmark, a logo lockup, or name-dependent app-icon
typography. Identity comes from palette, type, and motif alone. Copy uses `{AppName}`.

**Elite's extras are cut for MVP (decision 7, 2026-07-10 — was "proposed, confirm").** Mid-plan
adjustment, race-day strategy, and deeper periodization do not ship in v1; Elite's differentiation
is the richest personalization prompt plus a per-workout "why," nothing more. Do not build
dedicated screens or flows for them, and do not promise them in paywall copy. The Elite plan view
is still designed to *absorb* one or two extra sections later without a redesign — `Plan.extras`
exists for exactly this — but nothing populates it in v1.

### Explicitly forbidden, despite being good ideas

Market research surfaced these from best-in-class apps. The spec forbids them. Borrow the visual
language; do not borrow the feature.

1. **No drag-to-reschedule / mid-plan editing** (Runna). That's an unconfirmed Elite extra.
2. **No completed/upcoming states or check-offs** (every fitness app). This is not a log.
3. **No projected race-time reveal** ("without us 1:59, with us 1:51" — Runna). The spec grants no
   such feature and the app cannot honestly compute it.
4. **No "notify me when done"** (Lensa). No background-generation affordance exists.

---

## Part 1 — Open decisions that block a clean build

These surfaced during design. Each needs a human answer. Four of them change code, not just pixels.

1. **Does a fallback plan consume the user's quota? RESOLVED 2026-07-10 (decision 2): no.**
   `is_fallback = false` is the count filter in both `generate-plan` and `quota-status`, capped at
   3 quota-exempt fallbacks per period so the free-text `notes` field can't farm unlimited
   template plans. The isFallback copy in Part 5 now ships as written. Left here for history: the
   original recommendation was "no," reasoning that charging quota for the personalized product a
   user didn't receive is the fastest way to destroy trust in an app whose entire value is
   personalization.

2. **Is iPad / Android tablet a v1 target? RESOLVED 2026-07-10 (decision 12): no — phone-only v1.**
   iPad and desktop/computer support move to v2 (Ian: "phone only for phase 1, then ipad and
   computer in phase two"). The orientation and wave-scaling work in Part 8 that depended on this
   answer does not matter for v1; `MaxContentWidth = 800` remains harmless dead weight on phones
   until v2 picks this back up.

3. **Does the configure-plan notes field appear for Free users?** Their plans are templates and the
   notes are never read by an AI. Recommendation: hide it, or show it disabled with an honest line,
   rather than silently collecting text that goes nowhere.

4. **Password minimum length — RESOLVED 2026-08-02.** Copy's 8-character assumption is confirmed:
   better-auth is configured with `minPasswordLength: 8` (`workers/src/auth.ts`).

5. **`expo-glass-effect` — RESOLVED 2026-07-10 (Ruling 18, `145d7e0`): removed.** It directly
   contradicted this design's "no blur, no glass — depth comes from surfaces and hairlines" rule
   and is no longer in `package.json`; see `docs/change_log.md`'s "theme rewrite" entry.

6. **Elite extras — RESOLVED 2026-07-10 (decision 7): cut.** They appear in no copy and no screen
   in v1; see Part 0.

---

## Part 2 — The global system

> **Superseded, 2026-09-03 — see
> [`instrument-visual-system.md`](instrument-visual-system.md).** The colour, type, shape and
> ornament values below describe the long-retired "Instrument & Matter" system; they were first
> superseded by "Trailhead" on 2026-09-01 and Trailhead has itself now been replaced. **Instrument
> is the source of truth for every value in this Part and in Part 3.** Kept for the reasoning,
> which is still worth reading; do not implement a hex from here. Everything outside Parts 2 and 3
> — Part 0's law, the tier table, the screen inventory, the accessibility floors, the copy rulings
> — is unchanged and still governs.

### Bases and text

Deliberately not pure black and white.

| Token | Light | Dark | Rule |
|---|---|---|---|
| `surface.base` | `#F7F7F4` chalk | `#14171C` asphalt | The page canvas |
| `surface.raised` | `#EDEDE8` | `#1D2128` | Cards, rows, inputs, chips, sheets. In light mode it is *darker* than base (no shadow is separating it); in dark mode *lighter* |
| `surface.overlay` | asphalt @ 55% | asphalt @ 80% | Solid modal scrim. **Never a blur** |
| `hairline` | asphalt @ 10% | chalk @ 12% | The only separator in the app, outside the two shadow users |
| `text.primary` | asphalt | chalk | 16.74:1 both ways |
| `text.secondary` | `#5A6069` graphite | **needs a lifted value** | See the defect below |

> **Verified defect.** `graphite #5A6069` on chalk measures **5.91:1** (passes AA). On asphalt it
> measures **2.83:1 — fails AA.** The recorded palette calls graphite "secondary text" without
> qualifying the mode. Dark mode needs its own lifted secondary-text value, verified at ≥4.5:1
> against asphalt. **This is mandatory**, not optional, because four screens are pinned dark and a
> user cannot escape it by switching themes.

### The effort scale — the palette *is* the information

A color always means an intensity. It never decorates.

| Effort | Dark-mode fill | Light-mode fill | Bar height |
|---|---|---|---|
| recovery | `#6FA8C9` | `#5196BE` | 40% |
| easy | `#4FA97E` | `#4A9F76` | 55% |
| steady | `#C9A227` | `#AB8A21` | 70% |
| tempo | `#D9772B` | `#D87427` | 85% |
| interval | `#C6402F` | `#C6402F` | 100% |

> **Verified defect and its real fix.** As flat swatches against chalk, four of five hues fail the
> 3:1 non-text bar: recovery 2.41:1, easy 2.68:1, steady 2.25:1, tempo 2.95:1. Only interval (4.69:1)
> passes. **Dark mode is fine** — all five land between 3.57:1 and 7.43:1.
>
> A proposed fix — give every swatch a 1px ink stroke — was **rejected on review as a
> rationalization.** The stroke is identical across all five hues, so it does nothing to make
> `steady` distinguishable from `tempo`, and nothing for the fill's own perceptibility. It fixes a
> boundary-visibility technicality while leaving the actual failure intact.
>
> The real fix has two parts, both mandatory: **(a)** use the darker light-mode fills in the table
> above, each computed to clear 3:1 against chalk; **(b)** add the **bar-height channel** below.

**The height channel is not decoration — it is the accessibility fix.** Under deuteranopia and
protanopia, `easy`(green) / `steady`(gold) / `tempo`(orange) / `interval`(red) collapse toward one
warm smear. That is four of five levels — the entire graduated-intensity read that the barcode
exists to show. Only `recovery` (blue) survives. Encoding intensity **also** as a monotonic bar
height means the ribbon survives colorblindness, grayscale, glare, and a photograph. It adds a
channel rather than removing the motif, and it adds no text.

**Rule, from `architecture.md:144-145`, now actually satisfied:** an effort color is never the only
signal. In the collapsed ribbon the second signal is height. Everywhere else it is an adjacent text
label. An effort hue is **never** a text color and never sits beneath a text glyph.

### The accent

`hivis #D8F14A`. Theme-invariant. It has exactly **one** sanctioned use: **the single primary
forward-action of whatever screen you are on.** *(There is no next-workout card in v1 — decision
5, 2026-07-10 — so this rule no longer has a second, card-specific use to enumerate; it was never
two separate rules, just one rule applied to two objects.)*

It is banned from selection states, focus states, the tab bar's active state, quota pips, links, and
the wave chart. Those use an ink-colored border or capsule instead. One hivis slot per screen — on
Home, that slot belongs to "Create a plan" until a plan exists, at which point it moves to the
plan-link row that replaces it, and "Create a plan" demotes to an outline button.

Because hivis is light, text on it is always `text.onAccent` = asphalt (**14.20:1**, clears AAA).
Chalk on hivis is **1.18:1** and must never occur.

`accent.hivisDeep #BBD911` exists solely as the second stop of the primary CTA's gradient. It is
never used standalone, never for text, never anywhere else — that is what stops it becoming a second
accent by accident.

### Supporting tokens

- `color.progress` is **split into two tokens** (Ruling 13, 2026-07-10). The original single
  value (light `#8D93A0`, dark `#4B5561`) was doing two incompatible jobs — "disabled" and
  "meaningful but quiet" — and fails contrast in the second role: inactive tab-bar labels measure
  **2.13:1 in dark mode**, and the intake progress-hairline fill falls under the 3:1 non-text bar.
  Both are informative, not decorative, so both need to actually read.
  - `color.progressDisabled` — keeps the original value, for genuinely inert states (a disabled
    CTA fill, a spent-quota pip's hollow ring).
  - `color.progressInformative` — a **lifted** value, verified to clear **4.5:1** wherever it
    carries text (inactive tab labels, quota captions) and **3:1** wherever it carries meaningful
    non-text (the intake progress-hairline fill, active quota pips). Exact hex TBD when
    `design-system` implements `theme.ts` — record the contrast targets here, not a guessed value.
  Neither token is hivis, and neither is any effort hue.
- `status.error` — dark `#DE5482` (4.87:1), light `#AB214F` (6.39:1). Hue ~340°, roughly 27° off
  `interval`, with a cooler pink undertone so it never reads as "a shade of interval."
- `status.success` — dark `#37BEB9` (7.89:1), light `#206F6C` (5.51:1). Pushed toward cyan to clear
  `easy`. This is the tighter of the two separations; worth a second look in practice.
- `chart.loadLine` — dark `#BCA98F`, light `#745E3E`. Desaturated bronze.
- `chart.loadFill` — graphite at 12% (light) / 18% (dark).

> Why the chart gets its own hue family: the wave charts training **volume**. The ribbon encodes
> **intensity**. If the wave borrowed the effort palette, a volume chart would be fighting an
> intensity legend on the same screen. Keeping the wave monochrome and the ribbon multi-hue is what
> lets both coexist. This separation is load-bearing.

### Type

Six steps, fixed: **32 / 24 / 20 / 17 / 15 / 13**.

- **Barlow Condensed** (600/700/800) — display text and **every numeral in the app**. Running is
  numbers: pace, distance, splits, week counts, prices, the intake stepper.
- **Inter** (400/500/600/700) — body copy and UI chrome.
- **IBM Plex Mono** (400/500/600) — pace splits, HR zones, unit labels, ribbon week numbers. Being
  genuinely monospace, tabular figures come free from the font; no unreliable `fontVariant` workaround.

> "Condensed for all numerals" means a number appearing inline inside Inter body copy needs its own
> styled wrapper — React Native does not substitute fonts per character range. Every primitive below
> already isolates numerals into their own slot, but it is a trap for future body-copy components.

### Spacing, radii, depth

Existing ramp: `half 2 · one 4 · two 8 · three 16 · four 24 · five 32 · six 64`.

**One step must be added.** The ramp decelerates (16→24 is ×1.5, 24→32 is ×1.33) then jumps ×2 to 64.
There is no "large section gap," which this design needs under the bottom-anchored CTA on tall
devices. Insert **48**. Since names are ordinal, `six` becomes 48 and the old 64 is renamed
`seven`.

`radius.control` = **12** (buttons, chips, inputs, segmented tracks). `radius.card` = **20** (cards,
sheets, modals). An 8px gap between them — deliberately distinct, not the "two values 2px apart" trap.

**There is no usable backdrop blur on Android** — `expo-blur` degrades to a flat overlay. Depth
therefore comes from the surface ladder plus hairlines, never glass. **Exactly one thing in the
entire app gets a real shadow: true modals/sheets.** *(The next-workout hero card was the other
sanctioned user; it's cut for MVP — decision 5, 2026-07-10 — and this budget shrinks to one rather
than being handed to a replacement.)* Everything else — plan cards, workout rows, chips, tier pills
— is flat, separated by hairline only. A second shadow user is a review violation, not a judgment
call.

**Four screens are pinned dark** regardless of OS theme: sign-in, sign-up, generating, paywall.
These are deliberate, attention-holding moments. Everything else follows the system preference,
because both asphalt and chalk are first-class bases, not one a fallback for the other.

### Base components

Every interactive target is **≥44×44** unless noted.

- **Primary CTA** — full-width, bottom-anchored, `radius.control`, hivis→hivisDeep gradient, label in
  asphalt, condensed bold. Height 52–56. Pressed: 8% asphalt wash. Disabled: fill drops to
  `color.progressDisabled` and the gradient is removed entirely, so "disabled" never looks like a
  dimmed version of the one reserved accent.
- **Outline button** — 1.5px ink border, ink label. Never a hivis border.
- **Text link** — no container, ink, underlined. Deliberately given no accent color; that is what
  keeps hivis scarce.
- **Input** — `surface.raised` well, hairline border, `radius.control`. Focused: 2px ink border.
  Error: `status.error` border plus helper text below.
- **Selectable card** — selected is an ink border plus a filled checkmark. Never color-coded.
- **Chip** — two kinds. A neutral utility chip; and an **effort chip**, a pure 8–12px colored swatch
  with its label always rendered *beside* it, never inside.
- **Segmented control** — ink capsule for the active segment, never hivis.
- **Numeral stepper** — large condensed numeral, mono unit label, `−`/`+` at **48×48** (bumped above
  baseline; they take repeated rapid taps).
- **Quota pip row** — filled = available, hollow ring = used. Grouped in fives for Elite's ten.
  Available/remaining pips render in `color.progressInformative` (a meaningful count, not
  decoration); spent pips render in `color.progressDisabled` (inert — that capacity is gone).
  Always paired with a plain-text count. Non-interactive.
- **Workout row** — effort chip + text label + condensed numeral distance + mono pace, with an
  optional dimmer indented "why" line on paid tiers. Flat, hairline-separated, no card shell.
- **Week ribbon row** — mono two-digit week number + seven effort **bars** (height-encoded per the
  table above), rest days as visible **gaps**, not empty cells. The whole row is one tap target.
- **Plan card** — `surface.raised`, `radius.card`, hairline, flat, **no shadow**, carrying the wave
  sparkline and a tier pill.
- **Tier pill** — neutral, never color-coded, identical construction across all three tiers, so it
  can't visually alias with `steady`'s gold or the chart's bronze.
- **Informational card** — used for the `isFallback` notice. Neutral. Explicitly never `status.error`.
- **Modal / sheet** — one of the two shadow recipients, on a solid scrim.

### Token discipline — what stops this rotting

- Hivis has two uses. Selection and tab-bar-active are the two a contributor will reach for out of
  habit; both are handled by ink instead.
- Effort hues never appear outside effort encoding. Not as a chart color, not as a status color, not
  as decoration.
- Status colors never borrow effort hues.
- No token gets a flat hex where ink-at-alpha is more correct (`hairline`, `chart.loadFill`).
- **No single hex clears 4.5:1 against both asphalt and chalk.** Any token proposed as "one value,
  both modes" — other than the three theme-invariant accent tokens — is a latent bug.

---

## Part 3 — The signature motif

> **Superseded, 2026-09-03 — see
> [`instrument-visual-system.md`](instrument-visual-system.md).** The signature is now the
> **onboarding pulse trace**, with the **route line** (a thin contour stroke, kept from Trailhead)
> as the in-app ornament — not the ribbon-and-wave motif below. The **week ribbon (micro)
> survives** — it encodes real data and is still built as described here, though on Instrument's
> cooler re-tuned effort ramp. The **periodization wave (macro) is retired**: a hero-scale week
> ribbon competes with the plan's own data viz. `HeroRibbon` is deleted.

Two scales, deliberately kept on **separate color systems** so they cannot be confused for one another.

### The week ribbon (micro)

Each training week renders as one row: a mono two-digit week number, then seven bars. Bar **color**
is that day's effort. Bar **height** is that day's effort, on the monotonic ramp above. Rest days are
**gaps** — no bar at all, which is what keeps "no stimulus" categorically distinct from any low
intensity, including `recovery`.

A 16-week plan reads as a barcode of periodization: you can see the build, the recovery weeks, and
the taper without reading a single word. The plan view leads with this, not with a list.

Because the height channel carries the same information as the hue channel, the barcode still reads
in grayscale, under glare, and to a colorblind user. That is the point.

The ribbon appears at two scales: every week as an expandable accordion on plan view; and
desaturated to `color.progressDisabled` gray as a **ghost ribbon** on sign-in, sign-up, and empty
states — inert by construction, since it carries no real data yet; the motif teased before it means
anything. *(A third scale — one live week inline on Home — is cut
along with the next-workout card and all current-week arithmetic: decision 5, 2026-07-10. Home's
populated state is a plain plan-link row, not a ribbon fragment — see Part 5.)*

### The periodization wave (macro)

A single smoothed, gradient-filled area chart of weekly training load, building through the plan and
resolving into a taper. Monochrome bronze. It appears **once per plan**, at the top of plan view,
annotated with coarse week markers and a single "taper" label near the closing downslope so the shape
reads to someone who has never seen a training-load chart. On My Plans it recurs as a tiny
unannotated sparkline that serves as each plan's at-a-glance identity.

The wave is **honest**: it charts weekly volume the generator already produces, for every tier
including Free's template. It never implies data the app does not have.

> **A real architectural conflict, resolved.** "One Skia canvas per screen" and "a sparkline on every
> My Plans card" cannot both hold once the list has two rows. **Resolution:** My Plans gets **zero**
> live canvases. Each sparkline is rasterized once to a bitmap (offscreen Skia snapshot at generation
> time, or lazily on first render), cached by plan ID plus a hash of the load array, and rendered as
> a plain image. Plan view holds the app's only live canvas.

### Texture

One low-contrast topographic contour texture at 4–6% opacity — a nod to terrain, not abstract
decoration. It is a **static tiled asset**, never a Skia canvas, so the Skia budget stays with the
wave. It appears in exactly four places: the hero zones of sign-in/sign-up, the generating backdrop,
the empty states, and the paywall hero. It never sits behind dense data — plan view has none.

---

## Part 4 — Motion

Eleven values total (ten until 2026-08-08 — see `ambient` below). If a screen seems to need a
twelfth, it is reaching for the wrong one of these.

**Durations.** `instant` 100ms (press feedback) · `quick` 180ms (state crossfades) · `standard`
250ms (the default; entrances) · `slow` 350ms (full-screen pushes) · `reveal` 650ms (**reserved
exclusively** for the wave's one-time stroke-draw; if it gets reused, the reveal is losing its
specialness) · `ambient` 2800ms (**reserved exclusively** for the onboarding hero ribbon's settled
opacity pulse — added 2026-08-08).

**`ambient` is the one sanctioned exception to the manifesto's ban on "idle floating", "ambient
looping" and "breathing gradients".** It exists because every other duration here is a sub-350ms
response to an event, and a loop period is a different kind of quantity. The exception is scoped so
it cannot spread: opacity only — never hue, position or scale; all cells driven by one shared value
so the pulse is strictly **in phase** (a travelling sweep is loading-skeleton vocabulary); and the
amplitude capped by `AmbientPulseFloor`, never reaching zero. It belongs to the onboarding hero and
nothing else.

**`AmbientPulseFloor` — and an honest contrast limit it exposed.** The pulse's trough is
`{ light: 0.999, dark: 0.7 }`, not one number, because the effort fills have almost no contrast
headroom in light mode. Measured against `surface.base` at full opacity: `easy` 3.0045:1,
`recovery` 3.031:1, `tempo` 3.035:1, `steady` 3.062:1 — four of five are *barely* over the 3:1 floor
with no pulse at all, so `easy` binds the floor at alpha ≥ 0.9988 and the light-mode pulse is
consequently near-imperceptible. Dark mode has more room and pulses normally at 0.7 — **except**
`interval` (#C6402F on #14171C), which is 3.57:1 at full opacity and **2.32:1 at 0.7**. Both are
pre-existing properties of the hexes, not of the animation. A visible light-mode pulse, and a safe
dark floor, both need these effort values revisited for headroom — **tracked as issue #70**, and
scoped there rather than here because any change to the effort scale ripples into plan view, its
primary consumer.

**The onboarding hero's own behaviour is settled, not pending:** the captain ruled on 2026-08-08
that its shimmer is **dark-mode-only and final**, with the contrast floor left untouched. The
alternative — weakening the 3:1 rule so light mode could pulse — was considered and declined. Read
the numbers above as a constraint that has already been ruled on, not an open question about that
screen.

**Curves.** `easeOut` for anything arriving. `easeIn` for anything leaving. `linear` for progress
hairlines and quota fills **only** — a progress bar that eases is lying about pace. `springSnappy`
(damping ~0.6, one crisp overshoot) for direct manipulation and the reveal bounce. `springGentle`
(damping ~0.85) for accordions and sheet arrivals.

The rule: informational content that appears uses a duration + curve. A direct physical response to a
gesture, or a snap into place, uses a spring. Literal proportion uses `linear`, always.

### The centerpiece — "your plan is ready"

This is the moment the paid product is selling. Roughly 1.4–1.6 seconds end to end.

During generation a grid of ribbon-shaped cells sits in `color.progressDisabled` gray — pending, not
yet real data. Beneath it, step lines name the **real** work happening, each crossfading pending → active →
done at `quick`. A light tick haptic fires once per step, on the pending→active flip — it marks "now
doing this," not "just finished," so the rhythm reads as forward progress.

**Free tier's step list is genuinely shorter** (two steps; there is no AI call). Two things stop that
feeling broken: the card is pre-sized to the *longest* possible list across all tiers, so it never
visibly shrinks; and each step holds its active state for a ~400ms floor, so Free's total lands
around 1.2–1.8s rather than a jarring 200ms flash.

On completion: the last step dims, then a deliberate **~100ms breath** so the haptic lands clean.
Then, left to right across the seven cells — rest-day gaps staying gaps — each cell compresses to
0.92, springs past 1.0 to ~1.06, and settles, staggered 45ms apart. The cascade resolves around
t=600ms.

**The color change is a swap, not an interpolation.** Effort colors are discrete semantic categories,
not a gradient; crossfading gray into them would pass through muddy intermediate hues that mean
nothing and look like a rendering bug. Instead the color flips instantly at the compressed bottom of
each cell's bounce, hidden inside the impact. It reads as *revealed through impact*. It is also
cheaper — a conditional swap in a worklet, not a color interpolation across the full range.

**One** success-weight haptic fires, timed to the **first** cell's swap, not the last — so it reads
as the cause of the cascade rather than an afterthought.

**The handoff.** Hold the revealed grid ~200ms. Then do **not** slide the modal down while plan view
slides up — that guarantees a visible seam where the ribbon reflows. Instead freeze the ribbon's
screen position, crossfade the modal's chrome to zero, and settle plan view's header and wave in
around the still-frozen ribbon. That ribbon simply *becomes* the top row of plan view's list. Zero
position jump.

### Elsewhere

- **The wave's stroke-reveal** plays once per plan, ever. Gate it on a **persisted** set of plan IDs
  (AsyncStorage, not session memory — otherwise relaunching the app replays it every time). A freshly
  generated plan has a new ID by definition, so it always reveals the first time and never again.
- **Accordion expand/collapse** is the one sanctioned layout animation: gesture-driven, one row at a
  time, never looping. Measure each week's height once and cache it; drive it from a UI-thread shared
  value, not a state-triggered re-render.
- **Plan view's long ribbon list** uses plain native scroll. No parallax, no shrinking header, no
  scroll-linked worklets — that category looks fine in a simulator and janks on mid-range Android.
- **Skeletons** pulse only while work is genuinely ongoing, and the pulse is killed the instant data
  lands rather than being allowed to finish its cycle.
- **The `isFallback` card** enters as ordinary content, present from the first frame — opacity plus a
  6–8px drift. No haptic, no toast, no attention device. It is durable information, not an event.

### Reduced motion

Not "disable everything." Transforms and staggered travel are removed; opacity, color, and haptics
survive. **The reveal must still be a moment.** So: no stagger, no bounce, no travel — all seven cells
crossfade gray→true-color simultaneously over 250ms, the whole grid ducks once to 0.85 opacity and
back in the same window, and the success haptic still fires. Now the haptic carries more of the
moment, because it isn't sharing attention with choreography.

That grid duck is **single-shot**. A repeating brightness oscillation would reintroduce exactly the
motion the user opted out of, even though it is "just opacity."

Drive this from the OS signal (`isReduceMotionEnabled`), never an in-app toggle the user has to find
twice. Note that iOS handles reduced motion for native stack transitions automatically and Android
does not — check the flag and force a crossfade on both, because consistency matters more here than
platform-idiom purity.

---

## Part 5 — Screen by screen

### Sign-in · *pinned dark*

The top 40% is deliberately empty stage: spotlight gradient, topo texture, and the first brand tease
— a single row of seven ribbon bars rendered large, cropped at the screen edge, desaturated to gray
because no plan exists yet. The barcode is established as a texture before the user has done anything.

Below: a condensed headline at 32, one graphite sub-line at 15. Then Apple, then Google, each rendered
in **their own mandated brand button styles**, not reskinned in app tokens. A plain "or" divider. Two
inputs on raised surfaces. The **only** hivis element on the screen is the "Sign in" button beneath
them. Sign-up is a plain underlined text link — never a second button, because two competing calls to
action is precisely the failure this system exists to prevent.

Field errors render inline beneath the relevant input in `status.error`. Never `interval` red.

> Copy — heading **"Sign in"**, sub **"Pick up where you left off."** Buttons **"Sign in with Apple" /
> "Sign in with Google"**. Link **"Forgot password?"** Switch **"Don't have an account? Create one"**.

### Sign-up · *pinned dark*

A visual twin. Same shell, same hivis rule, ghost ribbon cropped slightly less — a continuity touch,
not a redesign. Confirm-password appears only on the email path. There is no "welcome" screen; it
hands straight off to intake.

> Copy — **"Create your account"**, sub **"Start with a free plan. No credit card required."**
> Password helper **"Use 8 characters or more."** *(Confirmed against better-auth's policy — Part 1.)*

### Intake — 8-10 questions + 1 review · *system theme, motif deliberately absent*

One question per screen. Progress is a thin proportional hairline in `color.progressInformative` at
the top — **no visible numeric counter**. The question sits in the top third at 24, left-aligned. A bottom-anchored
hivis "Continue" dims to ~30% opacity (never recolored) when a required step is unanswered.

Controls, by field: **goal** as large tappable cards · **age** as a condensed-numeral stepper ·
**experience** as a segmented row · **days per week** and **weekly volume** as big condensed-numeral
steppers with a mono unit label (reusing the numeral-forward identity rather than a generic slider) ·
**race distance** as a chip row · **race date** as a native picker · **goal time** and **recent time**
as mono time entries (hh:mm:ss), the recent one paired with its own distance chip row · **injuries** as
multi-select chips with a one-tap "None right now" so nobody has to type, plus a free-text field.

> **Shipped controls differ for every numeric answer (2026-08-15).** `keyboardType` restricts
> nothing — a hardware keyboard, paste, dictation or autofill puts letters into a "number" field —
> and a `number-pad` cannot produce the `-` and `:` the date and time labels ask for. Numbers,
> dates and times therefore go through `src/components/inputs/` (digit-filtered entry; dates and
> times as segmented boxes with the separators printed, never typed), not a native picker or a
> masked mono entry. The design intent above still holds; the mechanism does not.

The optional steps (race date, goal time, recent time, constraints) show a visible plain-text **Skip**.
Required steps — including **age** — show only Back and Continue.

**The last screen is a review, not a question** — every answer as a label/value row, each with an
inline Edit that jumps back to that step. This is the Runna/Noom "recap before the next big moment"
device, earned without inventing an extra field.

> **Accessibility ruling (resolves a designer-vs-copywriter conflict).** The hairline stays the only
> *visible* indicator. But the element carries `accessibilityRole="progressbar"` and its accessible
> name is the copywriter's string, **"Question {n} of {total}"** — where `total` is 8, or 10 when a
> target race was chosen. A bare hairline is not "less precise" to a screen reader — it is *silent*,
> on a flow where not knowing your position drives abandonment. Both authors get what they wrote, for
> their respective audience.

> Copy — Q1 **"What's your main goal right now?"** · Q2 **"How would you describe your running
> experience?"** · Q3 **"How many days a week can you run?"** *("Count the days you can realistically
> train, not your ideal week.")* · Q4 **"How many kilometres do you run in a typical week?"** *("A rough average over
> the last month is fine — this sets a safe starting point, not a judgment on your training.")* ·
> Q5 **"Do you have a target race?"** · Q6 **"When's race day?"** · Q7 **"Any injuries or physical
> limits we should plan around?"** *("This keeps your plan honest — we won't schedule speed work through
> a lingering injury. Nothing here is diagnosis or medical advice.")*

> **Gap, flagged not filled.** This copy deck covers only Q1–Q7. It is missing question copy for
> **age**, **goal time**, and **recent time** — all three appear in "Controls, by field" above as
> stepper/mono-entry controls but have no headline string here. Goal time and recent time are the
> flow's most complex controls (mono `hh:mm:ss` entry, the recent-time question also needs its own
> distance chip row) and are load-bearing per Part 0. This copy is deliberately **not invented
> here** — it's `ux-copywriter` work for Phase 3 of the build (`docs/mvp-build-prompt.md`).

### Home / Create · *system theme*

> **Superseded, 2026-09-20.** Shipped Home has one shape, not two: the tier · quota header, the
> **subscription box first** (header mark, tier, plans used, "See plans →"), a CURRENT PLAN
> summary row for the newest plan when one exists, the single hivis **"Create a new plan"** —
> which only opens the intake — and the My Plans row. There is no empty-state ghost ribbon, no
> "View plan" hivis swap, no outline demotion, and no target, plan-length, Notes or teaser
> controls; a runner with no intake on file never sees Home's controls at all, since Home pushes
> them to the intake. The quota copy rules in the blockquote below still apply.

Two states, and the focal point moves between them.

**Empty.** Mid-screen, a single desaturated ghost-ribbon row with a short caption framing it as a
preview of what a plan looks like — the motif is the first thing this screen shows, ahead of any
button. Beneath it the quota pip row. Below that, the screen's one hivis element: **"Create a plan."**

**Populated *(rewritten for decision 5, 2026-07-10 — no next-workout card, no current-week ribbon
row, no current-week arithmetic of any kind)*.** The pip row moves up under a small header as
secondary context. The focal point becomes a **plain plan-link row** — the same flat,
hairline-separated, no-shadow, no-registration-tick construction as a My Plans card (an index
entry, not an instrument reading): title, tier pill, generation date, pushing straight to
`plan/[id]` on tap. It carries the screen's hivis slot as **"View plan."** "Create a plan" persists
but demotes to an outline button, because the hivis slot is taken.

A Free user who has spent their one plan sees that button replaced by a plain **"See what Pro unlocks"**
link — not a dead disabled control.

> Copy — heading **"Your next plan starts here."**
> Free, unused: **"Free: 1 plan available, ever."** · Free, used: **"Free: you've used your one plan,
> ever."** · Pro: **"Pro: {plansLeft} of 3 plans left. Resets {resetDate}."** · Elite: **"Elite:
> {plansLeft} of 10 plans left. Resets {resetDate}."**
> At cap: **"Pro: 0 of 3 plans left. More on {resetDate}."**
> **No tier ever says "this month."** Periods are purchase-day-anchored, not calendar months, so
> copy always resets to a date, never a month name. Free's cadence word is "ever," not a date.

### Configure plan · *modal · system theme · deliberately motif-free*

> **Superseded in part by Part 0's 2026-08-15 note.** The sub-fields described below re-ask the
> target race, which is now intake's alone. What survives is the tier caption, the notes
> disclosure, and the generate CTA — shipped inline on Home, which shows the saved target
> read-only with a **Change** link to `/intake` and asks for a plan length only when there is no
> race date to derive one from.

> **Superseded in full, 2026-09-20.** There is no configure surface anywhere — not a modal, not
> inline on Home. The intake is the configure screen: its TARGET section holds the target race
> (required), the optional race date and goal time, and PLAN LENGTH (WEEKS) while the date is
> blank; its bottom **"Create plan"** is the generate CTA (`PUT /api/intake` then
> `POST /api/generate-plan`, then a replace to `plan/[id]` so back lands on Home). The notes
> disclosure is gone — dropped, not moved. Home's "Change" link went with the panel; changing a
> target means creating a new plan, which means a fresh, blank intake. "Where configure-plan and
> generating live" below is therefore historical too.

No ribbon, no wave. This is a decision screen, not a celebration screen — withholding the motif here is
what makes its arrival at the reveal feel *earned* rather than wallpapered everywhere.

Two large cards offer the binary: **race-driven** or **fixed-duration**. Selecting one reveals its
sub-fields beneath — distance chips and a date picker, or an 8/12/16 segmented numeral control. A short
reassurance line makes explicit that this is a per-plan choice that won't touch the saved intake profile,
directly addressing the two-different-"goal"-concepts trap. An optional notes field sits collapsed behind
a disclosure. Bottom-anchored hivis **"Generate my plan."**

> Copy — **"What's this plan for?"** · **"Train for a race"** *("Build toward a specific race day.")* ·
> **"Set a duration"** *("Train for a fixed number of weeks, no race attached.")*
> Caption under the CTA, by tier: Free **"This will be a template plan, matched to your distance and
> schedule."** · Pro **"This plan will be personalized to your training data."** · Elite **"This plan will
> be fully personalized, tuned to your training history."**

### Generating · *pinned dark · terminal state of the configure modal*

Not its own route (see below). Full-bleed. The pending cell grid centre-stage; step lines beneath it.
No progress percentage, no time estimate, no "notify me" — there is nothing to interact with **during
normal operation**, which is the honest representation of a call the client cannot influence.

**Free's steps are honestly shorter**, because no AI runs. Showing a fake "personalizing" step for a
template engine would misrepresent what is happening; the visibly shorter list is itself a wordless,
honest signal that a different engine ran.

> Copy — heading **"Building your plan"**.
> **Pro / Elite steps:** "Reading your intake" → "Choosing your periodization model" → "Writing your
> weeks" → "Checking the result".
> **Free steps:** "Reading your intake" → "Matching your template" → "Checking the result".
> Long wait, **paid only**: **"Still working — personalized plans take a little longer than templates.
> Almost there."** *(This line must never render for Free, for whom it is nonsense.)*

**Failure exits (Ruling 15, 2026-07-10).** The screen is deliberately non-dismissable *while it is
genuinely working*, but it must never trap a user into force-quitting. Four exits, all mandatory:

- **A client-side timeout, ~90s.** Past it, stop waiting and show the error state below rather than
  holding the sealed screen indefinitely.
- **An error state with Retry / Cancel.** On the request failing outright or the timeout firing,
  the pending grid and step lines are replaced by a plain error message and two actions: Retry
  (re-issues the same request, **same `idempotencyKey`**, so it can't double-generate) and Cancel
  (returns to Home; per `docs/design/mvp-blueprint.md` Part 5, no "resume" UI is needed — the edge
  function is the source of truth for whether a plan exists).
- **Offline detection.** Losing connectivity mid-generation surfaces the same error state with
  offline-specific copy, not a spinner that waits forever.
- **VoiceOver live-region announcements.** Step transitions and the "Still working" line fire as an
  accessibility live region, not just a visual crossfade — a screen-reader user gets the same sense
  of forward progress a sighted user gets from the step list.

**Disclaimer fine print (decision, 2026-07-10).** One line of Rule 10 disclaimer text sits in the
generating modal's fine print — small, static, non-interactive — matching the footer section that
appears on every plan view afterward (see "Plan view" below).

### Plan view · *system theme · the hero screen*

Header: plan title at 24–32, metadata line beneath in graphite (tier pill, generation date).

Immediately below, the **periodization wave** — full-width, about a fifth of screen height, drawn once,
annotated with coarse week markers and a single "taper" label.

Then the **week ribbon**: one row per week, mono two-digit week number, seven height-and-colour bars,
rest days as gaps, a trailing chevron that expands an **in-place accordion** rather than pushing a new
screen — so the whole plan keeps reading as one continuous scrollable barcode. Inside an expanded week,
each workout is an effort chip, a text label, a condensed numeral distance, a mono pace, and — paid tiers
only — a dimmer indented "why" line.

**Nothing here is tappable beyond expand/collapse.** No check-offs, no drag handles, no completed states.

Below the ribbon, the screen ends — **no reserved stack of extras cards in v1.** Elite's extras are
cut for MVP (decision 7, 2026-07-10), not merely unconfirmed, so nothing is built to hold them.
`Plan.extras` (`PlanSection[]`) exists in the type so a future card type can land later without a
schema change, but v1's screen shape doesn't reserve space for it.

**Disclaimers (decision, 2026-07-10, resolving `load-rules.md` Rule 10's placement gap).** A
static footer section renders at the very bottom of every plan view — plain text, no dismiss, no
modal. The same disclaimer content also appears as one line in the generating modal's fine print
(see "Generating" above), so it's seen once before a plan exists and once on every plan afterward,
never nagged mid-scroll.

> Copy — race plan: **"{raceDistance} plan"**, sub **"{numberOfWeeks} weeks to race day, {raceDate}"**.
> Duration plan: **"{durationWeeks}-week plan"**. Week heading **"Week {n} of {total}"**. Rest day
> **"Rest day — recovery is training too."** Paid explanation section label: **"Why this week"**.
> Free pace reads **"Effort: easy, conversational pace"**; paid reads **"Pace: {low}–{high} /km · HR zone {n}"**.

### How the three tiers differ *visually*

The tier pill is neutral and identical across tiers. **The real differentiation is structural — crop the
badge out of a screenshot and you should still know the tier.**

- **Free** rows are the shortest in the app: chip, label, distance, and a qualitative effort
  description. No pace, no HR zone, no brackets — nothing was measured.
- **Pro** rows show the same measured numerals as Elite — a bracketed mono pace range and HR
  zone — plus a second line, the indented weekly coach "why." Every row is visibly taller than Free.
- **Elite** rows show the identical bracketed pace-and-HR-zone numerals as Pro, plus a longer,
  per-workout "why." The tallest, densest rows in the app — because Elite explains more, not
  because it measures more.

The wave scales the same way: Free's is unlabelled beyond start and end, Pro's adds week markers, Elite's
adds the taper annotation and simply renders whatever more nuanced multi-peak shape its richer
periodization actually produces. **No fake embellishment — more considered underlying data, drawn honestly.**

An Elite plan still reads *physically longer when scrolled* — but in v1 that's purely from its
longer, per-workout "why" text wrapping more, not from an extras stack (cut for MVP, decision 7).
More plan for more money remains a felt difference, from prose density rather than an extra section.

On Home, the pip row scales the same idea to one glance: one pip, three pips, ten pips in two rows of five.

### The `isFallback` treatment — invented here

No modal, no toast, no warning triangle. That vocabulary belongs to errors, and a fallback plan is a valid,
fully usable plan.

A calm informational card sits in plan view **directly beneath the tier pill and above the wave** — raised
surface, hairline border, neutral tone, never `status.error`, never hivis. Placement is deliberate: "PRO"
and "this one's a template" sit in the same glance, so nothing is hidden on either axis, and the retry sits
right there to resolve the gap.

**A fallback plan's workout rows render at Free density regardless of the user's actual tier**, because a
template genuinely has no "why" content and fabricating one would be dishonest. The card explains exactly
why the rows look sparser than the user is used to, so the reduced richness is *accounted for* rather than
silently confusing.

My Plans tags the row **"Template"** before it is even opened.

> Copy — **"This plan wasn't personalized."**
> Body, **within the 3-per-period exemption**: "We tried twice to build your personalized plan and
> couldn't validate the result, so this is a template plan for your distance and schedule instead —
> no pace targets, HR zones, or coach notes. This attempt didn't use one of your plans."
> Body, **4th+ fallback in the same period (addendum R-B, 2026-07-10)**: identical opening, but ends
> "...This attempt used one of your plans, the same as any other."
> Button **"Regenerate"**, caption **"Uses one plan, unless this one falls back too."** *(honest only
> within the exemption; once the server reports the period's 3 exempt fallbacks are spent, drop the
> "unless" clause — regenerating always uses a plan from that point on, fallback or not.)*
>
> **Resolved 2026-07-10 (decision 2 — was open decision #1 in Part 1; refined by addendum R-B, same
> day).** Fallback plans do not burn quota for the **first 3 in a period**: `is_fallback = false` is
> the count filter in both `generate-plan` and `quota-status`. **Past that cap, a 4th+ fallback keeps
> its already-reserved slot and counts against quota** — nobody is refused, but the card must render
> the "used one of your plans" variant above, not the exempt one. "This attempt didn't use one of
> your plans" is true only within the 3-per-period exemption, never unconditionally. **Never write
> "this month" on this card, for any tier** — Free's quota is 1 total, not monthly (see "Home /
> Create" above and Part 0's "1 plan total, forever").

### My Plans · *system theme*

Plan cards, most recent first, each carrying that plan's **wave sparkline** as its at-a-glance identity —
deliberately the wave, not the ribbon, so the index screen has its own signature distinct from plan view's.
Alongside: label, neutral tier pill, date range, and a quiet "Template" tag where applicable.

Free users always see exactly one card. There is no generate-another affordance buried here; that upsell
lives on Home.

> Copy — empty state **"No plans yet"** / "Your training plans will show up here once you create one." /
> **"Create your first plan"**.

### Paywall · *pinned dark, full-bleed*

Not a blurred sheet — depth comes from typography and layout, per the Android blur constraint.

The hero is **not** a feature-bullet wall. It is the product's own workout row, shown twice, stacked: a
Free row (chip, label, distance, pace) directly above the same slot at Pro density (the same row, plus the
"why" line). The user is shown the literal, pixel-level richness delta they would be paying for, rather
than marketing iconography.

Below, tier cards stack **vertically**, Pro above Elite — two full cards side by side on a phone forces the
type too small to stay premium. Each carries a pip row previewing capacity, a short differentiator list, and
price shown Calm/Headspace-style: the annual plan's effective monthly cost large in condensed numerals, the
plain monthly price smaller alongside as the comparison.

**One bottom-anchored hivis CTA**, matching every other primary CTA's shape and position; the cards carry a
neutral selection state and the CTA label follows the selection. *(This resolves a conflict — see Part 10.)*

Since payment is dummy in v1, confirmation is an honest in-app loading-then-check state, **not a mimicked
native payment sheet**, so v2's real IAP swap doesn't leave a fake StoreKit affordance behind.

> Copy — headline **"Train with a plan that adapts to you."**
> Free bullets: "1 training plan, ever" · "Template-based" · "No pace targets or coach notes".
> Pro: "3 plans a month" · "AI-personalized pace targets and HR zones" · "Warm-ups and drills built into
> every workout" · "A coach's reasoning behind every week".
> Elite: "10 plans a month" · "Everything in Pro" · "A coach's reasoning for every workout, not
> just every week" *(the decided Elite scope — the richest personalization prompt, which injury
> history and race context inform, plus a per-workout "why." Do not promise periodization tuning
> as a standalone feature — that's a cut extra, decision 7, 2026-07-10.)*
> Disclosure: **"This build uses test payments only. Choosing a plan won't charge any card. Real payments
> arrive in a future update."**
> **Mid-plan adjustments and race-day strategy appear nowhere** — cut for MVP (decision 7,
> 2026-07-10), not merely unconfirmed.

### Settings · *system theme · deliberately the calmest screen*

No motif, no texture, no gradients, **no hivis anywhere** — its actions are administrative, not the
primary-action-of-the-screen that earns the accent. Grouped rows on raised surfaces: Account, Subscription
(reusing the pip component a fourth time), Legal, App info.

> Copy — Delete account confirmation: **"Delete your account?"** / "This permanently deletes your account,
> your intake answers, and every plan you've generated. This can't be undone." / **"Delete account forever"**.

### Where configure-plan and generating live

Neither is named as a route in the spec — they appear only in prose flow. **Recommendation:**

**Configure-plan is a modal-presented stack screen**, triggered from Home's CTA and from the paywall's
post-upgrade return path. It is a short, repeatable, single-purpose decision; modal presentation signals
"quick decision, then back to Home."

**Generating is not its own route.** It is the terminal, non-dismissable state of that same modal — no back
button, no swipe-to-dismiss, no cancel — because it genuinely has no navigational actions available. Giving
it an independent route would imply a freedom that does not exist. The moment the crossfade into generating
begins, the sheet's grab handle visibly disappears, because removing a gesture with no visual acknowledgement
feels like a bug rather than a decision.

On completion the modal dismisses itself and the app performs a normal push to `plan/[id]` — the transient
transaction ends when its purpose ends, and the plan lives at its own permanent, revisitable route.

If the modal is interrupted mid-generation, **no "resume" UI is needed.** The edge function is the source of
truth for whether a plan was created; it either appears in My Plans or it was never created. The client never
reconciles a state it was never authoritative over.

---

## Part 6 — Error and edge states

- **402, Free, already spent.** "You've used your one free plan." / "Free includes a single plan, forever —
  not a monthly refill. Upgrade to Pro or Elite to generate more." → **"See Pro and Elite"** / "Not now".
- **402, Pro or Elite at cap.** "You're out of plans for now." / "You've used all {planLimit} of your
  {tierName} plans for this period. More unlock on {resetDate}." Pro sees an Elite upsell; Elite sees none.
- **Generation failed outright.** "Your plan didn't generate." / "We hit an error creating your plan. Your
  quota wasn't used — try again."
  > This follows from the schema: quota is `count(plans)`, and a row is only inserted after a successful or
  > fallback generation, so a total failure creates nothing to count. **Re-verify once `generate-plan` exists.**
- **Offline.** "You're offline." / "You'll need a connection to generate a plan. Your answers are saved."
- **Sign-in.** Wrong credentials: "Incorrect email or password." OAuth cancelled: "Sign-in cancelled." — a
  light toast with no further prompt, because that is a choice, not an error. OAuth genuinely failed: "We
  couldn't complete sign-in. Try again."
- **Free user viewing a plan with no coach notes** — the moment paid value is visible by its absence. Shown
  **once**, near the top, never repeated per week card: "No coach notes on this plan." / "Free plans are
  templates — solid structure, no personalized pacing or weekly coaching notes. Pro adds pace targets, HR
  zones, and a coach's reasoning for every week." → **"See Pro"**.

---

## Part 7 — The accessibility floor

Non-negotiable. Everything here is a **must**, not a nice-to-have.

1. **The collapsed ribbon must carry a non-hue channel.** Bar height, per Part 2. Without it, the signature
   motif violates the project's own written rule and loses four of its five levels to red-green colorblindness.
2. **Use the darker light-mode effort fills.** The originals fail the 3:1 non-text bar against chalk. The 1px
   ink stroke is *not* the fix — it is uniform across hues and fixes nothing about hue perceptibility. Keep it
   for edge definition if you like; never log it as the compliance fix.
3. **Dark mode needs a lifted `text.secondary`.** Graphite on asphalt is 2.83:1. Mandatory, because four
   screens are pinned dark and the user has no escape hatch.
4. **The ribbon row is one accessible node.** Its seven bars must be hidden from the accessibility tree, or a
   screen-reader user hits 112 dead stops across a 16-week plan. The row needs a composed label ("Week 3,
   expand. Day 1 steady, Day 2 rest…") and its expanded state exposed as state, not just visually. **Never
   Mon–Sun** — days are unnamed in this product (Ruling 12, 2026-07-10); a composed label that says "Monday"
   breaks that rule as surely as the UI would.
5. **The wave and the sparkline are silent by default.** A Skia canvas has no accessibility tree; a rasterized
   bitmap has no alt text. Both need a text summary — "Training load, weeks 1–16, builds to a peak around week
   12, tapers weeks 14–16." The sparkline must not be independently focusable inside an already-tappable card.
6. **The generation reveal must announce itself.** A color-snap and a haptic tell a screen-reader user nothing.
   Fire an explicit completion announcement.
7. **The intake hairline needs a role and an accessible name** — `progressbar`, named "Question {n} of
   {total}." **"Question 3 of 7" (the example previously here) is wrong**: total is 8, or 10 with a race
   (see Part 0's "eight are always asked... 8 questions, or 10 with a race"). Visually it stays a bare
   hairline.
8. **Quota pips must be hidden from the accessibility tree** so the paired text count is read once, rather than
   ten dots being narrated.
9. **Focus and selected states must be visually distinct.** Both currently render as "ink border + checkmark."
   For keyboard and Switch Control users these are different things. Focus = ink ring; selected = ink border +
   checkmark; both = combine.
10. **Pinned-dark screens must still honour Increase Contrast / reduce-transparency**, rather than ignoring OS
    accessibility settings because the screen is theme-locked.
11. **The ribbon row needs an explicit minimum height** (≥44). A thin barcode strip is easy to build under
    target size by accident.
12. **Gradients need contrast checked at the lightest and darkest point text actually crosses**, not at the
    midpoint. Verifying the midpoint and shipping an edge failure is the classic gradient defect.
13. **Verify nothing sets `allowFontScaling={false}`**, especially at the 13pt step. Condensed faces at small
    sizes are the classic truncation trap.
14. **The reduced-motion grid pulse is single-shot.** A repeating oscillation reintroduces the motion the user
    opted out of.

---

## Part 8 — Responsive

This design has exactly **one** width threshold and **one** text-scale threshold. Everything else is continuous.

**`MaxContentWidth` 800** is applied unconditionally to every screen's outer container and centred. No phone
(360–430pt) ever reaches it, so on phones it is invisible. It binds on iPad, tablets, unfolded foldables, and
resizable web. When it binds, a "full-width" bottom CTA means full width **of the capped column**, not the screen.

**The accessibility text-size threshold** (iOS AX sizes; Android font scale beyond ~1.3×) is computed once as a
single derived boolean and reused everywhere. It is the only thing that changes a component's *structure*.

**The ribbon.** Cell width is fractional — `(row width − gutter − 6 gaps) ÷ 7` — so the row structurally cannot
overflow; it can only get too small to read. Floor **28pt**. The inter-bar gap shrinks first, floor
`Spacing.half`. The week-number gutter never shrinks; it is capped on the *growth* side instead. **The row never
wraps** — a wrapped week destroys the barcode read. At 375pt this never actually binds; the floor is a guardrail
against large text sizes and Android's separate display-size setting.

**The wave.** Height ≈ ⅕ of *available* height (screen minus insets minus tab bar minus CTA), computed from live
layout, **clamped** to floor 120pt and ceiling 220pt. Below 120pt a recovery dip and a peak crest become
indistinguishable — a meaningless squiggle. On an SE-class phone ⅕ falls below the floor, so the wave clamps *up*
and takes proportionally more of the screen: an unreadable chart is worse than a slightly large one, and
everything under it scrolls anyway.

**Above the fold on the smallest phone.** Home: title + quota line (the CTA is pinned, so it is always visible by
construction). Plan view: the wave **plus at least week 1's ribbon row** — if you must scroll to see even one row,
the "barcode at a glance" premise is dead on the smallest device on day one. Paywall: headline + the Pro card's
header.

**Extra height on large phones is not stretched.** Cards and rows never grow taller because the screen is. Extra
height surfaces as more of the same-sized content visible before scrolling, the wave continuing toward (not past)
its ceiling, and a small clamped amount of extra breathing room.

**Pips never scale with text size.** They are colour glyphs, like ribbon bars and effort chips. The paired text
count scales freely and may wrap to a second line, but must **never truncate** — a user paying for Elite needs to
read the full quota, not "8 of 1…".

**The workout row is where large text breaks.** Past the accessibility threshold it restructures — the one place
in the app where text size changes structure. Row 1: chip + wrapping label. Row 2: the numerals as explicit
"label: value" pairs ("Distance 10km", "Pace 4:49/km", "Zone 3"), wrapping rather than clipping. Row 3: the "why"
line, full width, **never clamped or truncated** — it is paid explanatory copy, and truncating it is the failure a
paying user notices fastest.

**Safe areas.** On the four full-bleed screens, the background layer bleeds under the Dynamic Island, the home
indicator, and Android's nav bar. Everything readable or tappable sits inside a container applying live insets —
never a guessed constant. Bottom padding is `max(insets.bottom, Spacing.three)`, because gesture-nav Android can
report near-zero.

**`BottomTabInset` applies only to Home and My Plans**, the two screens inside the tab navigator. Applying it
everywhere produces a floating dead gap on the other eight; applying the safe-area rule inside the tab bar
double-pads. This distinction is easy to get wrong.

**Keyboard.** The bottom CTA must be the **last child inside** the keyboard-avoiding scroll container, not an
absolutely-positioned sibling. Then its anchor is "bottom of the keyboard-shrunk content area," which equals the
physical bottom exactly when the keyboard is closed. The two multiline fields (injuries, notes) get a min height
computed from line-height and a **capped max visible height**, beyond which they scroll internally — unbounded
growth would otherwise push the CTA off the top of a small phone's shrunken viewport.

**Orientation.** Lock portrait below `sw600dp`; allow free rotation at or above it. The ribbon and workout list are
inherently vertical-scan content, and phone landscape gains nothing while the keyboard would claim half the
viewport. Tablets are a different matter, but this is now moot for v1 — see resolved open decision #2 (decision
12, 2026-07-10): phone-only v1, tablet support (and the `sw600dp` branch above) picked back up in v2.

---

## Part 9 — Implementation prerequisites

**Still needed, none of it installed:** the Skia/gradient/haptics row below. The three font
packages were bundled in `145d7e0` (2026-07-10) and are already installed.

| Package | Needed for | Note |
|---|---|---|
| `@shopify/react-native-skia` | The periodization wave | Config plugin, no bare workflow |
| `expo-linear-gradient` | CTA gradient, wave fill | Trivial add |
| `expo-haptics` | Every haptic beat in the reveal | **Native module — needs a dev-client rebuild, not an OTA update** |
| `@expo-google-fonts/barlow-condensed` | Display + all numerals | **Installed** (`145d7e0`) |
| `@expo-google-fonts/inter` | Body, UI chrome | **Installed** (`145d7e0`) |
| `@expo-google-fonts/ibm-plex-mono` | Pace splits, HR zones, week numbers | **Installed** (`145d7e0`) |

**Already present:** `react-native-reanimated ~4.1.1`, `react-native-gesture-handler ~2.28.0`,
`expo-font ~14.0.12` (loading the three bundled font families via `useFonts` in
`src/app/_layout.tsx`), `react-native-safe-area-context ~5.6.0`.

**Do not install `expo-blur`.** This system has no sanctioned blur use.
**`expo-glass-effect ~0.1.10` — removed** (Ruling 18, `145d7e0`); it contradicted the depth rules
and is no longer installed.
**Do not install `lottie-react-native`.** Build the celebration with Reanimated.

**Done, `145d7e0` (2026-07-10)** — see `docs/change_log.md`'s "theme rewrite" entry:
- Every value in `src/constants/theme.ts` replaced (the shape stayed; the stock Expo values are gone).
- `48` added to the spacing ramp; the old `six` renamed `seven`. The two `Spacing.six` call sites
  lived in `explore.tsx` and were deleted along with it, so no migration was needed.
- Stock template deleted: `explore.tsx`, `animated-icon.*`, `hint-row.tsx`, `web-badge.tsx`,
  `app-tabs.*`, `themed-text.tsx`, `themed-view.tsx`, `external-link.tsx`, `ui/collapsible.tsx`,
  `global.css`.
- The placeholder hero title "Aanya's baby" is gone — `src/app/index.tsx` was renamed to
  `src/app/(tabs)/index.tsx` and rewritten as a token-only placeholder Home screen.

---

## Part 10 — Conflicts between specialists, and how they were resolved

Recorded rather than silently averaged.

1. **Intake progress: numeric or not?** The designer rejected "Question {n} of {total}" as visually noisy; the copywriter
   wrote it. **Resolved on accessibility grounds:** the hairline is the only *visible* indicator, and the same
   element carries `role=progressbar` with "Question {n} of {total}" as its accessible name. A silent hairline is not
   less precise to a screen reader — it is zero information. Both authors get what they wrote.

2. **Generating steps: one list or per-tier?** The copywriter wrote one four-step list including "personalized
   plans take a little longer than templates." The designer specified that Free's list is honestly shorter because
   no AI runs. **Resolved for the designer**, because the copywriter's long-wait line is nonsense to a Free user
   who never triggered an AI call. Free gets a three-step list; the long-wait line is paid-only.

3. **Paywall: one CTA or one per card?** The designer specified a single bottom-anchored hivis button acting on a
   selected card. The copywriter wrote "Get Pro" / "Get Elite" per card. **Resolved for the designer**, because
   "exactly one hivis primary action per screen" is a load-bearing, app-wide rule and per-card buttons would put
   two competing accents on the most important screen in the product. The cards take a neutral selection state and
   the CTA label follows the selection. Note the structural consequence flagged by the responsive pass: the scroll
   content must reserve bottom padding so the last card is never hidden behind the pinned button.

4. **The light-mode contrast fix.** The token pass proposed a 1px ink stroke on every effort swatch. The
   accessibility pass rejected it as a rationalization — a uniform stroke cannot make `steady` distinguishable from
   `tempo`. **Resolved for accessibility:** darker light-mode fills, plus the bar-height channel. The stroke may
   remain for edge definition; it is not the compliance fix.

5. **Ribbon tap target.** Seven cells, or one row? The responsive pass showed that seven 44×44 targets cannot
   coexist with a legible barcode on a 360pt phone; the designer had independently specified that nothing is
   tappable beyond expand/collapse. **They agree: the row is one target.**

6. **Sparkline vs. "one Skia canvas per screen."** Irreconcilable as stated once My Plans has two rows.
   **Resolved by the motion pass:** rasterize each sparkline once to a cached bitmap; My Plans gets zero live
   canvases; plan view holds the only one.
