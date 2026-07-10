# V2.2 — MVP UI/UX Blueprint

> **Aesthetic: Instrument & Matter.** Plain English, no code. For a designer building this in
> Claude Design, and an implementer building it in React Native.
>
> Assembled from a visual pass and a motion pass, reconciled. Where they disagreed, the ruling is
> in Part 12. This document **extends** [`frontend-design-brief.md`](frontend-design-brief.md)
> (tokens, contrast math, accessibility floor) — it does not replace it.
>
> **v1 is function over finish.** The core loop — intake in, plan out — must work before anything is
> made beautiful. The sand-man is deferred to v2 (Part 4). Everything else here is either structural
> (the grid, the ribbon's height channel, the row anatomy) or cheap (Reanimated over plain Views).

---

## Part 0 — What ships

**Eight screens.** Sign-in · Sign-up · Intake (8-10 questions + review) · Home/Create ·
Configure (modal) · Generating (terminal state of that modal) · Plan view · My Plans.

**Not in the MVP:** paywall, Settings. The tab bar ships with **two tabs** and holds a third slot
in reserve (Part 7).

**Engineering facts the UI depends on**, decided outside this document but load-bearing inside it:

- A **fallback plan never burns quota** (`count(plans) where is_fallback = false`).
- `generate-plan` carries an **idempotency key**, minted when the configure modal opens.
- Plans are **immutable JSONB**. "Regenerate" makes a new plan and spends a slot. There is no editing.
- Quota periods anchor to the **purchase day** (May 26 → June 26), clamped at month end.
- The normal generation path is **one Claude call**. The retry fires only on structural validation
  failure, and the template skeleton makes that rare.

---

## Part 1 — The manifesto

Read this before rejecting a pull request.

> The app looks like it is **measuring something real**, not simulating something imaginary.
>
> Every mark on screen is either the data itself, or the ruled surface the data is measured
> against — a hairline, a tick, a baseline, a monospace readout. Nothing is added to signal
> sophistication.
>
> Matter behaves like matter. It assembles, settles, compresses, and erodes. It never floats,
> glows, or frosts — that is the vocabulary of a screen pretending to be a hologram. This one is
> pretending to be a lab bench.
>
> **The test:** does this element encode information, or is it the ruled structure that lets
> information be read? If the honest answer is "it just looks cool," it gets cut, however good it
> looks in isolation.

**Banned outright:** violet/cyan AI gradients · neon glow · glassmorphism · frosted panels ·
iridescent borders · decorative particle fields · holographic anything · idle floating · ambient
looping · "breathing" gradients.

**If nothing is happening, nothing moves.** Every animation must be earned by a real event: an
arrival, a user action, or genuine server work.

---

## Part 2 — The measurement grid

This is the connective tissue. It is what makes sign-in and My Plans feel like the same instrument
despite sharing almost no components. Five elements, all derived from the existing `hairline` token.

**Frame grid.** Horizontal hairline rules at the `Spacing.five` (32pt) interval, at roughly half
the `hairline` token's own opacity — the memory of graph paper, not a visible line. It appears
**only** in hero and empty-state zones: the top 40% of sign-in/sign-up, the generating backdrop,
and the empty states of Home and My Plans. Never behind populated content: once real bars and real
numbers exist, a grid beneath them is noise competing with signal.

**Baseline rule.** A single hairline that every bar-based element rises from. The ghost ribbon, the
week ribbon, and the wave's zero-axis all sit on a visible baseline rather than floating. This is
not decoration — it is what makes a bar read as a *measurement* rather than a shape.

> **The baseline never breaks at a rest-day gap.** The rule runs through unbroken; only the bar is
> absent. That one detail is how rest reads as *"the instrument recorded nothing here"* rather than
> *"the instrument is broken."* Matter's absence, not a glitch.

**Tick marks.** Short perpendicular hairline strokes at discrete intervals — one per week under the
wave, one per question along the intake rule, one per position along the generating grid. Only a
coarse subset carries a mono numeral (every second or fourth), the way a real ruler labels every
fifth mark and lets the rest imply themselves.

**Registration ticks.** Tiny corner crosshairs, reserved **exclusively** for the two surfaces in
the whole app permitted a real shadow — the next-workout card, and modals/sheets. They mark *this
object is being measured*, the way lab equipment ships with calibration marks on its housing. If a
third element starts wanting registration ticks, the shadow budget is being violated. Catch it in
review.

**Readout brackets.** A small hairline flank on either side of a genuinely **measured** mono numeral
— a real pace range, a real HR zone.

> **This is the most load-bearing rule in the system.** The instrument vocabulary is reserved for
> numbers that were actually measured. Free's qualitative effort string ("easy, conversational
> pace") is a *description*, not a measurement, and **never earns the bracket**. Flanking it with
> measurement marks would be a small structural lie.
>
> The consequence is that Free's poverty is legible not because the row is grayed out or nagged at,
> but because the row simply never earns the instrument's marks. The visual language and the
> honesty constraint turn out to be the same thing.

**Three new tokens** fall out of this: `grid.frame`, `grid.registrationTick`, `grid.readoutBracket`.
Ticks and baselines reuse `hairline` directly.

---

## Part 3 — The motifs, at MVP scale

**The week ribbon (micro).** Seven bars per week. **Colour** is that day's effort. **Height** is
that day's effort, on a monotonic ramp: recovery 40% → easy 55% → steady 70% → tempo 85% →
interval 100%. Rest days are gaps. The height channel is not styling — it is the accessibility fix
that keeps the barcode legible in grayscale, under glare, and to a colourblind runner, and it is
what makes the motif satisfy the project's own rule that colour is never the only signal.

**The periodization wave (macro).** A monochrome bronze Skia area chart of weekly load, deliberately
outside the effort palette so volume is never misread as intensity. Once per plan, at the top of
plan view. On My Plans it becomes a **pre-rasterized bitmap** sparkline — zero live canvases on that
screen.

**The ghost ribbon.** Seven desaturated gray bars on their baseline, cropped at the screen edge.
Plain Views, not Skia. It appears on sign-in, sign-up, and both empty states — the motif established
as a texture before it means anything.

**One material world.** On sign-in, the topo contour texture is the literal ground, and the ghost
ribbon rises from its baseline as the ground plane — the shape of the thing the runner is about to
make, shown before they make it. Everything before a plan exists is achromatic graphite. Colour
enters the app only once real data justifies it.

---

## Part 4 — The auth hero *(sand-man deferred to v2)*

### What ships in v1

Nothing animates on sign-in or sign-up. The hero zone is **static furniture**: topo contours at
4–6%, the frame grid at half hairline opacity, and the **ghost ribbon** cropped at the screen edge,
resting on its baseline with unlabelled ticks beneath it.

The ghost ribbon becomes the hero, and it is the better one on this system's own terms: it **encodes
information** — the shape of the plan the runner is about to make — where the sand-man encoded none.
Everything here is plain coloured Views. No Skia, no shader, no canvas.

### Deferred: the sand-man (v2/v3)

Recorded so the thinking survives. **Do not build this in v1.**

An **SkSL fragment shader** sweeping a dissolve threshold across a low-frequency noise field, masked
to a runner silhouette. **Not a particle simulation** — no per-grain state, no physics. One
`progress` shared value, driven on the UI thread, feeds every uniform.

- **Silhouette:** a single frozen mid-stride pose — leading knee driven up, trailing leg extended,
  arms in opposition. A photo-finish silhouette, not a mascot, not a running cycle. Its feet land on
  the ghost ribbon's baseline, so the runner strides across the ground plane the future ribbon
  occupies.
- **Grain:** matte, low-frequency, sediment-like. Never fizzing static, never sparkle, never
  countable particles. A glittery colourful dissolve reads as "magic AI particles" — the exact
  aesthetic this system exists to reject. A matte gray silhouette eroding in dim light reads as sand.
  Graphite tones only, never hivis, never an effort hue.
- **Arc, ~2.9s, one `progress` value:** *assemble* (grain coheres from the feet upward, 900ms) →
  *hold* (a flat 200ms dwell — the instrument taking its reading; a pause reads as intention, not
  lag) → *dissolve* (1200ms, trailing-heel first, a narrow torn cutoff band, not a soft fade) →
  *settle* (the last residue clears into the topo contours beneath it — the erosion has somewhere to
  go) → *freeze*.
- **How it stops:** a single timing run with no repeat. Skia only redraws when a bound value changes,
  so it stops requesting frames on its own. Unmount the `Canvas` on screen blur — don't just hide it
  — or a navigator keeping the screen warm for swipe-back leaves a shader idling underneath.
- **Degrade path, mandatory:** if shader compilation fails (some GPUs and emulators reject SkSL) or a
  calibration probe finds frames over budget, render a static tinted silhouette in the identical pose
  and position. Nothing reflows.
- **Re-entry:** plays once per app process, not once per screen visit.

> **Why it was cut.** Both the visual and motion passes independently nominated it as the first thing
> to go — the visual pass because it is the only element in the system encoding *no information*, and
> therefore the only thing that fails this document's own manifesto; the motion pass because its
> static degrade path has to exist anyway, making the cut free rather than a compromise. The owner
> cut it to get the core loop working first. All three reasons agree.

---

## Part 5 — The motion system

Eight values you reach for constantly, plus one reserved duration that must never be borrowed —
borrowing it is how a reserved moment stops feeling special.

**Durations.** `instant` 100ms (press feedback) · `quick` 180ms (state crossfades, toggles) ·
`standard` 250ms (the default; entrances) · `slow` 350ms (full-screen pushes) · **reserved:**
`reveal` 650ms (the wave's one-time stroke-draw, nowhere else).

**Curves.** `easeOut` (arriving) · `easeIn` (leaving) · `linear` (literal proportion only — the
intake hairline, the quota fill; *a progress bar that eases is lying about pace*) · `springSnappy`
(damping ≈0.6, one crisp overshoot then a hard catch) · `springGentle` (damping ≈0.85, no meaningful
overshoot).

*(`erosion` and `matterCurve` belonged to the sand-man and are deferred with it — Part 4.)*

### What "instrument" easing actually feels like

Generic ease-out decelerates smoothly to zero velocity — a leaf settling, a long gentle tail.

**Instrument easing arrives with authority and stops at a discrete instant.** The last 10–15% of the
motion decelerates *faster* than the middle, so it reads as hitting a mechanical stop rather than
running out of energy. That is why `springSnappy`'s tiny overshoot-then-catch is the house style for
anything meant to feel *registered* — a needle swinging to a reading and catching on the pin.

**Nothing in this app should ever feel like it is gently running out of momentum. Everything should
feel like it locked.**

---

## Part 6 — The centrepiece: the generation reveal

### Geometry, decided first

The pending grid's seven cell slots share the **exact** width, inset, and geometry as plan view's
ribbon rows. Each slot is pre-sized to the tallest possible bar (`interval` height) from first
paint; the **fill inside** is what moves, via bottom-anchored vertical scale. The slot never resizes.

This is what makes the handoff trivial: "freeze the ribbon's screen position" means *apply no
transform to it at all.* There is nothing to reconcile between two layouts, because there was only
ever one layout.

### Pending

All seven fills sit at a shared neutral scale (~45%) in `color.progress` gray — inert, at rest,
reading as *a bar not yet resolved.* **Never pulsing.**

Beneath, the step list. Each row has a hollow ink ring that crossfades to a **filled ink dot** the
instant its step becomes active, and **stays lit** — a lamp that records ground covered, not a
spinner. The active label carries full ink weight; superseded labels drop to secondary. No indicator
pulses, ever. A real instrument reads a value and holds it.

### The honesty mechanic

The server call is one synchronous request with no intermediate progress. **The step lines are
client-side theatre.** They run on a client timeline with a 400ms floor per step, and the reveal is
gated on **both** the timeline finishing **and** the response arriving.

- **Response lands early** → the remaining steps still play their full floors at normal cadence.
  Never accelerated, never skipped. Visibly speeding up would betray the theatre worse than the wait.
- **Steps finish early** → the last step stays lit, and after ~1500–2000ms of extra dwell, *"Still
  working — personalized plans take a little longer than templates. Almost there."* fades in once,
  static. No spinner.

> **For paid tiers, expect "still working" to be the *normal* path, not an edge case.** A real AI
> call will usually outlast a 1600ms client floor. Design it to feel calm and expected, not like a
> warning.

**Free never shows that line** — no AI ran, so it is nonsense. Free's list is genuinely three steps;
the card is pre-sized to the longest possible list (four rows) so it never visibly shrinks.

### The cascade

Last step dims. Then a flat **100ms breath** — dead air, so the haptic lands clean.

Then, left to right, **45ms stagger**: each cell's fill animates its scale toward its true effort
fraction (40 / 55 / 70 / 85 / 100%) via `springSnappy` — dipping ~10% below target first over ~90ms,
springing through to ~106%, settling exactly on target. The cascade resolves near t=600ms.

**The colour flips at the bottom of the compression dip.** A discrete swap, never an interpolation.
It is hidden inside the smallest, darkest instant of the bounce, where a hard cut is least visible as
a cut and most readable as *something just landed here*. Crossfading gray into an effort hue would
pass through muddy intermediate colours that correspond to no real intensity, and look like a
rendering bug.

**Rest-day cells get the identical stagger slot and the identical compression beat** — but their
target is zero, not a colour. They settle to nothing. The gap is *registered* by the same physical
grammar as everything else, rather than simply never having moved.

**One haptic.** Success-weight, timed to the compression trough of **the first cell that resolves to
an actual colour** — skipping any leading rest-day gap, since a haptic timed to a gap resolving to
nothing wouldn't read as an impact. It marks itself as the cause of the cascade, not an afterthought.

**Hold 200ms, static.** Let the revealed row be seen before anything else moves.

### The handoff

Because the geometry was shared from the start, the ribbon gets **no transform**. Everything else —
backdrop, step list, card chrome — crossfades to zero over ~200–250ms while plan view's header, tier
nameplate, and wave-axis furniture crossfade in around the untouched ribbon.

**Only once the modal chrome has fully reached zero and unmounted** does the wave begin its 650ms
stroke-draw. That sequencing is load-bearing: the Reanimated cascade and the Skia stroke must never
share a frame — both because the two canvases must never co-mount, and because two animation
categories overlapping reads as noise rather than craft.

---

## Part 7 — Screen by screen

### Sign-in · *pinned dark*

A **hard hairline marks the boundary** where the instrument's *stage* ends and the *bench* begins.
Above it: texture. Below it: clean, static, functional.

In the stage — topo contours deepest (static, 4–6%), frame grid just above at half that visibility,
and along the very bottom edge the **ghost ribbon**, cropped at the screen edge, resting on its
baseline with unlabelled ticks beneath it. Seven gray bars: the shape of the thing the runner is
about to make, shown before they make it. All plain Views. **No canvas on this screen.**

Below the boundary: a Barlow Condensed 32 headline, an Inter 15 subline, native Apple and Google
buttons in their **own mandated brand styles** (never reskinned), a plain divider, two raised-surface
inputs, and the screen's single hivis element — "Sign in". Sign-up is a bare underlined link, never a
second button.

**No grid, no tick, no texture below the boundary.** The form is where decisions happen and gets
nothing to look at but itself.

*Motion:* everything below the boundary is present at frame 1, with at most a 30–40ms top-to-bottom
stagger. Field focus is a 2px ink border crossfade, no layout shift. Brand buttons, the divider, and
hairlines never animate.

### Sign-up · *pinned dark*

A deliberate visual twin. Same stage, same boundary. The one intentional difference: **the ghost
ribbon crops one bar further into view** — a felt sense of *one step closer* with no new mechanics.
Confirm-password appears only on the email path. No welcome screen; it hands straight to intake.

### Intake — 8-10 questions + review · *system theme, motif and grid withdrawn*

The calmest screen in the app, on purpose. The **only** ruled element is the progress hairline, and
it does double duty: subdivided by a near-invisible tick at each question boundary, so it is
quietly a **ruler with one segment per question** rather than a generic bar. The filled portion reads as
distance travelled along the rule.

No frame grid, no topo, no ghost ribbon. Nothing competes with the single decision on screen, which
sits in the top third at Barlow Condensed 24.

The **numeral steppers** (age, days/week, weekly mileage) get the only instrument flourish this screen
allows: a large condensed numeral centre-stage, a mono unit label directly beneath, both anchored to
their own short baseline — a digital scale readout, not a slider. The 48×48 `−`/`+` targets flank it.
Several of the questions are steppers, which is what makes the numeral-forward identity read as
the app's native way of asking for a number rather than a one-off flourish.

The **review screen** reads like a manifest: one label/value row per answer, hairline-separated, numeric
values in mono where genuinely numeric, each with an inline Edit that jumps back to that step.

*Motion:* the hairline fills via `scaleX` (never `width`), `linear`, always — symmetric on advance
and Back. Questions cross with a **6–8px** travel, capped deliberately: anything larger starts to
feel like the full-screen push reserved for stack transitions, and this is an intra-route change.
**No haptic on question advance** — haptics stay scarce so they still mean something. Each stepper
tap fires a tick haptic and a `springSnappy` numeral pulse (1.0→0.96→1.0, ~130ms), and is fully
**interruptible**: a rapid second tap cancels the settle and restarts, so a burst never queues behind
the finger. The review rows arrive as a `springGentle` cascade, 30–40ms apart — calmer and
structurally different from the reveal's compress-and-bounce, keeping that language exclusive.

> **Accessibility, non-negotiable:** the hairline carries `role=progressbar` and the accessible name
> *"Question {n} of {total}"*, even though no number is visible. A bare hairline is not *less precise* to a
> screen reader — it is silent.

### Home / Create · *system theme*

**Empty.** Frame grid faint behind a single ghost-ribbon row on its baseline — the auth screen's
motif, now in daylight. Beneath it the quota pip row; below that the screen's one hivis element,
"Create a plan."

**Populated.** The grid recedes — real content earns its own structure. The focal point becomes the
**next-workout card**: raised surface, one of the app's two sanctioned shadows, hivis edge and hivis
"View", and the app's only other user of **registration ticks** — four faint corner crosshairs
marking it as the one measured, important object on screen. A sample under a loupe.

Directly beneath, one current-week ribbon row on its baseline, mono week-number gutter. "Create a
plan" persists as a demoted outline button, because the hivis slot has moved to the card. A Free user
who has spent their plan sees a plain link there, never a dead disabled button.

*Motion:* while `quota-status` is in flight, the pip row shows dim ungrouped placeholder dots that
pulse — the one sanctioned "working" treatment — and **the pulse is killed the instant data lands**,
not allowed to finish its cycle. Once resolved, pips never animate again.

The **moment a plan is generated and the user returns** is a real state transition and earns
choreography: the ghost ribbon crossfades out as the next-workout card and week row crossfade in, and
**the hivis slot relocates** — "Create a plan" demotes via a plain colour/border crossfade at the same
instant the card's edge picks up its glow. Only one object holds the accent in any frame; the handoff
is instant, never a blend between two accent states.

The quota caption updates with a plain crossfade — **no count-up animation on the numeral.** A rolling
odometer would misrepresent a discrete server fact as a gradual local one.

Tapping the ribbon row is an **ordinary stack push**, not a shared-element grow-into-place. That
bespoke handoff is reserved for the reveal; spending it on a daily action would cost complexity for no
communicative gain.

### Configure plan · *modal, system theme, deliberately motif- and grid-free*

No ribbon, no wave, no frame grid. This is a decision surface, and withholding the entire visual
system here is what makes its return at the reveal feel **earned** rather than wallpapered.

The modal is a shadow user, so its four corners carry **registration ticks** — a discrete instrument
panel floating on the solid scrim, not the page beneath it.

Two large binary cards (race-driven / fixed-duration); selecting one reveals sub-fields. One flourish
belongs here: the **8/12/16-week segmented control reads as a three-detent dial** — tick marks between
the settings, condensed numerals at each stop, the active detent taking the ink-capsule treatment.
Bottom-anchored hivis "Generate my plan."

*Motion:* the sheet rises on `springGentle`; the scrim fades in **solid**, never blurred. Sub-field
reveals reuse the one sanctioned accordion technique (measured once, cached, UI-thread shared value) —
not a second kind of layout animation.

### Generating · *pinned dark, terminal state of the same modal*

The most "instrument" screen in the app, because it is literally a readout of a running process. The
pending grid sits centre-stage on its baseline with a faint left-edge tick numbering positions one
through seven — a **diagnostic panel, not a spinner**. Beneath it, the step lines read like a build
log rather than a friendly status message. Frame grid and topo sit very faint in the backdrop.

*Motion:* the Configure→Generating transition is one 250ms cross-dissolve — decision cards out as
pending grid and step list come in, while the surface crossfades from card colour to asphalt.

**The grab handle vanishes on its own faster beat** (~150ms), distinctly quicker than the main
crossfade, so losing a gesture with no ceremony reads as *this control was just revoked* rather than a
lingering fade that looks like a bug.

Then the centrepiece (Part 6). The reveal is a **gauge needle settling after a reading completes**,
not a firework.

### Plan view · *system theme, the hero screen, tab bar hidden*

The header reads as an **equipment nameplate**, not a caption: title at 24–32, and beneath it a small
mono metadata line, uppercase tokens separated by middots — `TIER · PRO   GENERATED · 07.10.26` — the
way a serial plate reads, not a casual sentence.

Below it, the wave gets the fullest grid treatment in the app: faint horizontal load-interval
gridlines behind the bronze fill, a solid zero-axis baseline, week-number ticks along the bottom with
mono numerals at coarse intervals, and a single "taper" label pointing at one specific tick near the
close. **The grid and axis are present from frame zero as static hairlines; only the bronze stroke and
fill perform the one-time draw over them** — a chart recorder's pen sweeping across a pre-printed
sheet.

If a next workout exists, the same registration-ticked, shadowed card from Home reappears beneath the
wave. Reused, not reinvented.

Then the ribbon: one row per week, mono week-number gutter, seven height-and-colour bars rising from
an **unbroken baseline**, rest days as gaps in the bars but never in the rule. Expanding a week reveals
workout rows where pace and (paid) HR-zone numerals carry the **readout bracket**, while the
descriptive label beside them gets none.

The `isFallback` card, when present, sits directly beneath the nameplate — calm, neutral, and
**deliberately the one card on this screen with no instrument flourish**, because it is explaining an
absence, not presenting a reading.

*Motion:* two entrance paths. Via the generation handoff, Part 6. **Via ordinary navigation — the
common, repeat-visit path — a plain stack push, then content in its final state, with at most one
180–200ms whole-screen fade. No per-row stagger.** Staggering sixteen rows on every revisit is exactly
the repeated-motion failure this spec exists to prevent.

The wave's stroke-draw plays **only if this plan ID has never had it play**, checked against a
persisted (AsyncStorage) set. The common case on a revisited plan is that the wave renders finished,
instantly, with zero delay to usefulness.

Scroll is plain native scroll. No parallax, no shrinking header, no scroll-linked worklet. **A runner
checking Tuesday's workout at the track waits for nothing.**

### My Plans · *system theme*

Cards, most recent first, each carrying a **pre-rasterized bitmap** of that plan's wave sparkline —
zero live canvases on this screen, full stop. The baseline rule beneath each sparkline is **baked into
the bitmap at rasterization time**, so the grid vocabulary survives the no-live-canvas constraint
without a second render pass. Date ranges in mono, log-entry style. Flat, hairline-separated, no
shadow, no registration ticks — this is an index, not an instrument reading.

*Motion:* one modest whole-screen fade on first mount of the tab **this session**. No per-card stagger.

**Why the sparklines must never each reveal themselves.** Architecturally there is no stroke-path to
reveal — they are bitmaps, so a "reveal" would have to be faked with a mask wipe over a static image,
which is manufactured spectacle. Experientially, a list is scrolled past dozens of times across the
product's life, and a chart that performs its arrival on every scroll-into-view is the single clearest
case of repeated motion in the field of view. Each sparkline gets **one** opacity fade, on the list's
very first render pass. Any card mounting later — via scroll, pagination, or list recycling — renders
at full opacity immediately. **There is exactly one first paint per app-open, and only that paint
fades.**

---

## Part 8 — The two-tab bar

Flat `surface.raised`, a single top hairline, **no shadow** (that budget is spent elsewhere). Icons
are thin line marks matched to the hairline's own visual weight, so the bar reads as schematic rather
than illustrative.

**The active state never touches hivis.** The active tab's icon and label render in `text.primary`,
with a short **hairline tick beneath the label** — a caliper mark indicating *current setting* on a
dial, not a filled pill or a coloured dot. Inactive tabs render in `color.progress`, no tick.

**Reserving the third slot.** The bar's content width is divided into **three equal columns from day
one.** Home and My Plans occupy the first two; they do not stretch to fill 50/50. The third column is a
genuinely reserved slot, marked with a very faint hairline outline where a future icon will sit — a
blank instrument-panel knockout, not empty space that reads as a layout bug. Non-interactive, nearly
subliminal. When Settings ships, it drops in exactly as drawn. **Nothing about Home or My Plans moves.**

---

## Part 9 — Free vs Pro vs Elite, as row anatomy

| Tier | Line 1 | Line 2 | Brackets? |
|---|---|---|---|
| **Free** | chip · label · condensed distance · *qualitative* effort string | — | **No.** Nothing was measured. |
| **Pro** | chip · label · condensed distance · **mono pace range + HR zone** | indented, dimmer weekly coach "why" | Yes, on both |
| **Elite** | chip · label · condensed distance · **mono pace + HR zone** (same measured numerals as Pro) | longer, per-workout "why", often wrapping, plus (if confirmed) the extras stack | Yes, on both |

**Crop the tier pill out of a screenshot and the row anatomy alone tells you the tier.** Chip / label /
distance / qualitative-text is unmistakably Free. Bracketed pace-and-HR-zone plus one short weekly
why-line is unmistakably Pro. The identical bracketed numerals plus a longer, per-workout why-line
(and, once confirmed, the extras stack) is unmistakably Elite — the row is taller because it explains
more, not because it measures more.

The wave scales the same way — unlabelled beyond start and end for Free, week markers for Pro, taper
annotation plus whatever multi-peak shape richer periodization actually produces for Elite. **No fake
embellishment. More considered underlying data, drawn honestly.**

A **fallback plan renders at Free density regardless of the user's tier**, because a template genuinely
has no "why" content and fabricating one would be dishonest. The informational card explains exactly
why the rows look sparser than the user is used to.

---

## Part 10 — Reduced motion

Driven from the OS `isReduceMotionEnabled` signal. iOS handles reduced motion for native stack
transitions automatically; **Android does not**, so every stack push must be manually forced to a
crossfade on Android when the flag is set. Consistency beats platform-idiom purity here.

- **The auth screens:** nothing to do. Their hero is already static furniture.
- **The reveal:** all seven cells crossfade **simultaneously** from gray/45% to true colour and true
  height over one 250ms window. No stagger, no bounce. The whole grid performs a **single-shot** duck to
  0.85 opacity and back in that same window, so there is still a felt moment without travel. The success
  haptic still fires, now at the start of the crossfade — and now carries *more* of the moment, because
  it isn't sharing attention with choreography. **The duck is single-shot; a repeating oscillation would
  reintroduce exactly the motion the user opted out of.**
- **The handoff needs no change.** It was already opacity-only by construction — the frozen ribbon never
  had a transform to remove. This is the one place reduced motion is free.
- **The wave:** skip the stroke-draw; crossfade the completed path in over 250ms, still gated by the same
  persisted per-plan set. A reduced-motion user still gets one deliberate arrival per plan.
- **Intake:** the linear hairline fill is **kept** — functional state, low amplitude, the same category
  OS progress indicators keep. What goes is the 6–8px question travel (becomes opacity-only) and the
  stepper's scale pulse (becomes an instant value change, haptic intact).
- **Accordions keep animating.** They reveal genuinely new content the user asked for, which is not the
  category reduced-motion guidance targets (parallax, zoom, vestibular triggers). They lose their spring
  overshoot and run critically damped.

---

## Part 11 — Implementation prerequisites

**Install with `npx expo install`, never `npm install`.** npm pulls latest; Expo pins the version SDK 54
was tested against. Getting this wrong is exactly the trap `AGENTS.md` warns about.

| Package | Expo SDK 54 pin | Needed for | v1? |
|---|---|---|---|
| `@expo-google-fonts/barlow-condensed` | — | Display + **all** numerals | **Yes** |
| `@expo-google-fonts/inter` | — | Body, chrome | **Yes** |
| `@expo-google-fonts/ibm-plex-mono` | — | Pace, HR zones, week numbers | **Yes** |
| `@shopify/react-native-skia` | **2.2.12** | The wave, and (v2) the sand-man | Only if the wave ships |
| `expo-haptics` | **~15.0.8** | Every tick and the success beat | Fast-follow |
| `expo-linear-gradient` | **~15.0.8** | CTA gradient | Optional — see below |

> **With the sand-man deferred, Skia's only remaining consumer is the periodization wave.** If the
> wave is also deferred, Skia leaves the v1 dependency set entirely — and with it the heaviest native
> module and the biggest engineering risk in the blueprint. Plan view remains fully usable without
> the wave: nameplate, next-workout card, ribbon.
>
> The CTA's hivis→hivisDeep gradient is **decoration** — it encodes nothing, so by this document's own
> manifesto it should be a flat hivis fill until something justifies the gradient. That drops
> `expo-linear-gradient` too.

Already present: `react-native-reanimated ~4.1.1`, `react-native-gesture-handler ~2.28.0`,
`expo-font ~14.0.12` (**zero font files bundled**), `react-native-safe-area-context ~5.6.0`.
Peer requirements verified: `react 19.1.0` and `react-native 0.81.5` satisfy Skia's `>=19` / `>=0.78`.

**Both Skia and haptics are native modules — they need a dev-client rebuild, not an OTA update.** If that
rebuild hasn't happened, ship the identical visual choreography with haptic calls absent (they must
no-op, never crash), and treat haptics as a fast-follow rather than a blocker.

**Do not install `expo-blur`.** This system has no sanctioned blur. **Remove `expo-glass-effect`
(`~0.1.10`)**, which is installed and contradicts the depth rules.

Also required: replace every value in `src/constants/theme.ts`; add `48` to the spacing ramp (renaming
old `six`→`seven`, migrating two call sites in `explore.tsx`); delete the stock template screens; fix the
placeholder title `"Aanya's baby"` at `src/app/index.tsx:38`.

---

## Part 12 — Cut list, and conflicts resolved

### If the MVP shipped in a week, cut in this order

*(The sand-man is already cut — Part 4.)*

1. **The periodization wave.** Now the only thing keeping Skia in the dependency set. Cutting it
   removes a native module, a rebuild cycle, and the persisted reveal-tracking bookkeeping. Plan view
   keeps its nameplate, next-workout card, and ribbon — the ribbon was always the screen's real
   information. My Plans loses its sparkline and falls back to label + date range.
2. **The CTA gradient** → a flat hivis fill. It encodes nothing; it fails the manifesto's own test.
   Drops `expo-linear-gradient`.
3. **Haptics** → let the calls no-op. Drops `expo-haptics` and its rebuild. The reveal still works;
   it just loses its punctuation.
4. **The review screen's staggered row settle** → one simultaneous crossfade.
5. **Sign-in's single-tap error nudge** → plain crossfade of the error text and border.
6. **Registration ticks and the reserved-tab ghost outline.** Polish on an already-functional layout.
7. **The reveal's spring overshoot magnitude**, as a last resort.

> Cuts 1–3 together take v1's native-module additions to **zero**. Everything left is Reanimated
> (already installed), plain Views, and three font packages.

> **What must survive any cut:** the honesty-gated client timeline, the discrete colour swap hidden in
> the compression trough, the single haptic on the first colour-resolving cell, and the frozen-ribbon
> handoff. **That structure, not the flourish on top of it, is what is actually being sold.**

### Where the two passes disagreed

**The sand-man's arc.** The visual pass had it assemble, partially erode, then re-cohere — the runner
remains. The motion pass had it snap in fully formed, hold, then fully dissolve — the runner is gone.
Resolved toward the owner's own words (*"a man made out of sand running, then it slowly dissolves"*)
while keeping the visual pass's assembly opening: **assemble → hold → dissolve → residue settles into
the terrain.** That resolution is preserved in Part 4 for v2. It is not built in v1.

**Grain colour.** Visual pass said graphite/ink; motion pass said `color.progress` gray. Same family;
resolved to the neutral gray the ghost ribbon already uses, so the achromatic motifs on the auth screen
share one register. Also deferred with Part 4.

**Both passes independently nominated the sand-man as the first thing to cut** — the visual pass because
it is the one element in the system encoding no information, and therefore the only thing that fails the
manifesto's own test; the motion pass because its static degrade path must exist anyway. The owner then
cut it to get the core loop working first. **Three independent reasons, one conclusion.**
