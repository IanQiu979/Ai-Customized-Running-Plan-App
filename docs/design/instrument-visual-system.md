# Instrument — V2.2 visual system

> Captain-approved 2026-09-03. Replaces **Trailhead** (warm paper/espresso ink, ember-orange
> accent, dusk-gradient bold exception), which replaced "Instrument & Matter" before it. The house
> style is shared with V2.3 ("Pace AnalysisAI").
>
> **This document supersedes `frontend-design-brief.md` Part 2 (tokens) and Part 3 (the ribbon /
> wave motif) as the source of truth for colour, type, and ornament.** The rest of that brief —
> Part 0's law, the tier table, the screen inventory, the accessibility floors, the copy rulings —
> is unchanged and still governs. Where this file and the brief disagree about a *value*, this
> file wins; where they disagree about a *rule*, the brief wins.
>
> The implementing token module is `src/constants/theme.ts`. Every hex here appears there and
> nowhere else — with one deliberate exception, `src/constants/pulseTrace.ts`, covered in §2.
>
> **The floors behind the contrast table are executable.**
> `src/constants/__tests__/theme.contrast.test.ts` recomputes every ratio below from the hexes in
> `theme.ts` and asserts it against its floor — and, for the handful that are deliberately *below*
> a floor, against its ceiling. A hex edited into illegibility therefore fails the suite instead
> of shipping. It deliberately does **not** pin the exact numbers printed here: that would turn
> every legitimate re-tune into a test edit. So re-running the table and updating these rows
> remains a human step, and the standing `CLAUDE.md` rule still applies — what changed is that the
> rule is now backed by a floor nobody can quietly fall through, which is what it lacked under
> Trailhead (issue #70).

## 1. The idea

A cool scientific instrument. Near-monochrome — white and graphite in light mode, deep charcoal in
dark — with one bright signal in it, the way a readout has one live trace and everything else is
housing.

Three rules carry the whole system:

1. **Two-tier accent.** Near-black carries almost everything: buttons, chrome, structure. ONE
   much brighter highlight — **icy cyan `#A8F0FF`, locked** — is spent on exactly one call to
   action per screen and on the onboarding pulse trace, and nowhere else. If a screen has two cyan
   elements, one of them is wrong. Cyan never appears in navigation.
2. **The accent is theme-invariant, and the cyan is never a fill.** See §2 — this is the one
   structural difference from Trailhead's accent, and it is forced by measurement, not taste.
3. **One deliberate exception.** The signed-out screens carry a near-black pulse-trace field: an
   icy-cyan ECG-style waveform that draws itself. Everything past the session gate is
   near-monochrome. Trailhead's dusk gradient is retired; the bold moment is now motion and a
   single colour, not a three-stop gradient.

Screen temperature, for reference when adding a screen:

| Screen | Register |
|---|---|
| Onboarding | Bold. Full-height pulse-trace cover, then a scroll-down read. The exception. |
| Sign-in / sign-up | The same field at `band` height, then an ordinary form. Identity, not spectacle. |
| Home | Minimal, one signal CTA, route line in the header |
| My Plans / Plan view / Paywall | Formal, premium-SaaS: stat rows, tier comparison, dark pricing slabs |
| Glossary / Settings | Flat grouped rows, hairlines, **zero accent**. No exception. |

## 2. Colour

Ratios are WCAG 2.x relative-luminance contrast, computed against the surface named in the row.
Text tokens target ≥4.5:1; meaningful non-text (icons, state fills, the effort ramp, a control's
boundary) targets ≥3:1; `progress.disabled` deliberately sits *below* AA because "you cannot use
this" is what it means.

Both columns are given for every token, because **`raised` is the binding constraint, not `base`**
— the tab bar and every card sit on it, and a value tuned only against the page is exactly the
class of miss issue #70 reported.

### Light — white & graphite

| Token | Hex | Against | Ratio (base / raised) |
|---|---|---|---|
| `surface.base` | `#FFFFFF` | — | — |
| `surface.raised` | `#F0F3F5` | base | 1.11 (adjacent surfaces, not a contrast pair) |
| `surface.inverse` | `#0A0E13` | — | — |
| `text.primary` | `#101619` | base / raised | **18.25 / 16.37** |
| `text.secondary` | `#646F75` | base / raised | **5.16 / 4.63** |
| `text.onInverse` | `#EDF2F5` | inverse | **17.16** |
| `text.onInverseMuted` | `#8B979D` | inverse | **6.46** |
| `progress.informative` | `#646F75` | base / raised | **5.16 / 4.63** |
| `progress.disabled` | `#9FA9B0` | base / raised | 2.39 / 2.15 (inert only) |
| `status.error` | `#B32318` | base / raised | **6.62 / 5.94** |
| `status.success` | `#20674F` | base / raised | **6.74 / 6.05** |
| `chart.loadLine` | `#4A6270` | base / raised | **6.42 / 5.76** |

### Dark — charcoal

| Token | Hex | Against | Ratio (base / raised) |
|---|---|---|---|
| `surface.base` | `#0E1317` | — | — |
| `surface.raised` | `#171D22` | base | 1.10 |
| `surface.inverse` | `#05080B` | base | 1.07 |
| `text.primary` | `#EDF2F5` | base / raised | **16.56 / 15.07** |
| `text.secondary` | `#829097` | base / raised | **5.68 / 5.17** |
| `text.onInverse` | `#EDF2F5` | inverse | **17.80** |
| `text.onInverseMuted` | `#8B979D` | inverse | **6.70** |
| `progress.informative` | `#829097` | base / raised | **5.68 / 5.17** |
| `progress.disabled` | `#455158` | base / raised | 2.29 / 2.08 (inert only) |
| `status.error` | `#F1786A` | base / raised | **6.79 / 6.18** |
| `status.success` | `#5CC5A0` | base / raised | **8.85 / 8.05** |
| `chart.loadLine` | `#8FA9B8` | base / raised | **7.59 / 6.91** |

`progress.disabled` is inert *as a fill*, which is not the same as illegible. A disabled
`PrimaryAction` is labelled in ordinary ink on that dead slab: **7.63:1** in light, **7.24:1** in
dark. The fill is allowed to look dead; the word on it is not.

### The accent — a near-black field, one cyan signal

| Token | Hex | Role |
|---|---|---|
| `Accent.field` | `#0A0E13` | The slab a primary action is drawn on. Also `Colors.light.surface.inverse`, and also the pulse trace's own field. |
| `Accent.signal` | `#A8F0FF` | The one bright highlight. The primary action's 1.5pt edge and its label; the pulse trace's stroke. Nothing else. |
| `Accent.onField` | `#EDF2F5` | Copy over the dark field that is *not* the signal. 17.16:1. |
| `Accent.onFieldMuted` | `#8B979D` | Muted copy over the field. 6.46:1. |

**Theme-invariant**, unlike Trailhead's scheme-keyed ember. The cyan is locked — it is the same
value the onboarding animation is drawn in — and that lock forces the structure:

| Measurement | Ratio | What it decides |
|---|---|---|
| `signal` vs light `base` | **1.27** | The cyan can never be a fill. A cyan slab on a white page is a button with no visible edge. |
| `signal` vs `field` | **15.27** | So the cyan is the *label and edge* on a near-black slab instead. |
| `field` vs light `base` | **19.35** | In light mode the slab itself is the control's boundary. |
| `field` vs dark `base` | **1.04** | In dark mode the slab is invisible against the page — deliberate, not a bug. |
| `signal` vs dark `base` | **14.74** | …so in dark mode the cyan *edge* is the boundary. |

One appearance, legible in both schemes, through a different channel in each. That is what
"theme-invariant" has to mean to be worth having, and all five rows are asserted in the contrast
test — including the two that assert something is *below* the floor, so a future edit cannot
"fix" them without noticing what they were for.

`Accent.field` is also `surface.inverse` in light mode on purpose: every dark plane in the app is
one plane, so a primary action sitting on the Paywall's pricing slab reads as an inset in it
rather than as a second, slightly different black. Paywall's recommended tier therefore needs no
special case — the cyan edge is the whole control there.

**The one duplicated hex.** `src/constants/pulseTrace.ts` (`PulseTracePalette.field` / `.trace`)
carries `#0A0E13` and `#A8F0FF` independently, because the animation was built in parallel with
this system and could not depend on tokens that were mid-rewrite. The contrast test pins both
values, so the two files cannot drift; folding `pulseTrace.ts`'s palette into a re-export from
`theme.ts` is the tidy-up to do once both branches have landed.

### The effort ramp

A colour always means an intensity; it never decorates. Paired with a monotonic bar-height ramp
(`0.4 / 0.55 / 0.7 / 0.85 / 1`) as the mandatory non-hue channel.

Instrument re-tunes all ten hues into a cooler key (captain's explicit call — left warm, the ramp
reads as a leftover from Trailhead). The method is Trailhead's own and not a new one: each hue
keeps its identity and its place in the ordering, and only its hue-angle and lightness move, the
angle toward the blue side of its own family.

| Effort | Identity | Light | vs base / raised | Dark | vs base / raised |
|---|---|---|---|---|---|
| recovery | steel blue | `#2F6E8F` | 5.60 / 5.03 | `#5FA6C8` | 6.92 / 6.29 |
| easy | sea green | `#2C7562` | 5.49 / 4.92 | `#4FB394` | 7.30 / 6.64 |
| steady | brass | `#6F6A2E` | 5.56 / 4.99 | `#B0A64C` | 7.48 / 6.80 |
| tempo | rust | `#9A4A22` | 6.22 / 5.58 | `#E08652` | 6.85 / 6.23 |
| interval | raspberry | `#96234C` | 7.95 / 7.13 | `#E2648F` | 5.74 / 5.22 |

Two constraints produced these, not taste, and both are asserted rather than eyeballed:

- **Headroom.** Trailhead's light ramp sat at 4.02–4.50:1 against `base` with nothing checked
  against `raised` at all — issue #70. The tightest value above is **4.92:1**, against the
  binding surface.
- **No collision with the signal.** A plan ribbon full of highlight-coloured bars would destroy
  rule 1. This is measured as **CIE76 ΔE in Lab, not as a contrast ratio**: ratio is blind to hue
  and would happily pass an icy-cyan `recovery`. The floor is 25. The tightest value is dark
  `recovery` at **28.3**, which is the same order as the ramp's own tightest adjacent pair (light
  recovery/easy, 33.3) — i.e. no effort is closer to the highlight than the ramp's own steps are
  to each other.

## 3. Type

Unchanged from Trailhead. The faces were never what made that system warm — the colours were —
and re-picking them would mean a font-loading change in `_layout.tsx` for no visual gain in a
near-monochrome system.

| Role | Family | Weights |
|---|---|---|
| Display + **every numeral** | Big Shoulders Display | 600 / 700 / 800 |
| Body and UI chrome | Public Sans | 400 / 500 / 600 / 700 |
| Pace, HR, week numbers, all-caps labels | Space Mono | 400 / 700 |

Steps: **13 / 15 / 17 / 20 / 24 / 32 / 44**.

- `hero` (44) is display-only. Big Shoulders Display is a condensed face with a much smaller
  optical size than a normal-width grotesque, so a 32pt title no longer carries a screen. On body
  or mono text it is merely oversized, not emphatic.
- Space Mono ships **only 400 and 700**; there is no Medium or SemiBold to alias, and inventing
  one that resolved to the same file would be a token that lies.
- Tracking: `display: -0.4`, `label: 1.1`. Body copy is never tracked.
- RN does not substitute fonts per character range: a numeral inside Public Sans body copy needs
  its own styled `<Text>` wrapper to reach Big Shoulders.

## 4. Shape, stroke, ornament, motion

- **Radius** — `control: 8`, `card: 14`, `pill: 999`. Both non-pill steps tightened again from
  Trailhead (10 / 16). Trailhead squared off the previous system's consumer-app softness against a
  paper metaphor; a cool instrument panel is squarer still. Kept 6pt apart so the two steps stay
  distinguishable rather than becoming a "two values 2px apart" trap.
- **Stroke** — `hairline` (rules, baselines, separators), `thin: 1` (input borders, the Paywall
  badge), `mark: 1.5` (icons, chevrons, the route line, **the primary action's signal edge**). A
  glyph should weigh the same on every device, which is why `mark` is fixed rather than a
  hairline.
- **`grid.inverseHairline`** — the edge of a `surface.inverse` slab, chalk-at-alpha in *both*
  schemes because the slab is dark in both. In dark mode `surface.inverse` measures 1.07:1 against
  `surface.base` — ordinary for an adjacent-surface pair, fatal for a card whose whole job is to
  read as a distinct object.
- **The route line** — kept. A contour/elevation polyline at `mark` weight in `grid.routeLine`,
  three variants from one component (`src/components/brand/RouteLine.tsx`), generated from a fixed
  seeded profile so the same screen always draws the same ridge. It survived the recolour because
  it was only ever a thin monochrome stroke; it now reads as a plotted trace rather than a hiking
  contour, which suits the system better than it suited Trailhead.
- **`LockedOpacity` (0.45)** — the resting dim of a Free-tier locked surface. Not `PressedOpacity`
  wearing a second hat: press feedback is a 100ms transient on a live control, this is the resting
  state of something the runner cannot use. Applied only to surfaces whose text is decorative.
- **Motion** — `instant / quick / standard / slow`, plus two curves and two springs. The house
  rule is "if nothing is happening, nothing moves". The ONE sanctioned exception is the onboarding
  pulse trace, and it carries its own timings in `constants/pulseTrace.ts` rather than in
  `theme.ts`, so nothing else in the app can reach for them by accident. This is why onboarding's
  scroll sections do **not** fade or rise on scroll: a second motion moment on the same screen
  competes with the signature one, and the scroll itself is already the mechanic.

## 5. The components that carry the rules

Two rules used to be enforced by review and are now enforced by the module graph:

- **`src/components/ui/ActionButton.tsx`** — `PrimaryAction` / `SecondaryAction` /
  `ActionDivider` / `LinkAction`. `PrimaryAction` *is* the signal, so "one signal per screen"
  reduces to "how many `<PrimaryAction>` does this file render?". Before this, eight screens each
  hand-rolled the accent's treatment in their own `StyleSheet`, and it drifted.
- **`src/components/onboarding/PulseTraceSlot.tsx`** — the mount point for the signature
  animation. Currently a placeholder rendering the animation's *static end state*, with a prop
  subset matching `<PulseTraceHero>` exactly; see its header for the one-line swap once
  `fm/v22-redesign-animation` lands.

## 6. What was removed, and why

| Removed | Reason |
|---|---|
| `Accent.ember` / `emberDeep` / `onEmber` | The accent is a field-and-signal pair now, named by role. `ember` was appearance-named and described a colour the system no longer contains — the same mistake `hivis` made before it. |
| `DuskGradient` | The bold moment is the pulse trace, not a gradient. A three-stop dusk field also carried a permanent hazard: its amber tail was 3.17:1 against the copy colour, so a whole band of the hero was off-limits to text and every change had to remember that. |
| `DuskHero` / `DuskSpark` | The only consumers of `DuskGradient`. Replaced by `PulseTraceSlot` / `PulseTraceHero`. |
| `Motion.duration.reveal` / `.ambient` | Reserved for the dusk hero's stroke-draw and glow. Both went with it; the pulse trace owns its own timings. |
| Scheme-keyed `Accent` | The signal is locked and is never a fill, so it has no per-scheme variant to resolve. `useTheme()` returns it unresolved. |
