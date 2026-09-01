# Trailhead — V2.2 visual system

> Captain-approved 2026-09-01 from the Claude Design mockup
> `https://claude.ai/code/artifact/0582e080-871e-4e1a-b723-d7e5c40f6514`.
>
> **This document supersedes `frontend-design-brief.md` Part 2 (tokens) and Part 3 (the ribbon /
> wave motif) as the source of truth for colour, type, and ornament.** The rest of that brief —
> Part 0's law, the tier table, the screen inventory, the accessibility floors, the copy rulings —
> is unchanged and still governs. Where this file and the brief disagree about a *value*, this
> file wins; where they disagree about a *rule*, the brief wins.
>
> The implementing token module is `src/constants/theme.ts`. Every hex here appears there and
> nowhere else. **Never change a hex in either place without re-running the contrast table below
> and updating both in the same commit.**

## 1. The idea

Warm paper and espresso ink. A runner's plan is a document, not a dashboard, so the app is set
like one: a chalk page, a single ink, hairline rules instead of boxes, and numerals that read like
a printed table.

Three rules carry the whole system:

1. **One ember-orange accent, spent on exactly one action per screen.** If a screen has two
   ember elements, one of them is wrong. Ember never appears in navigation — not in the tab bar,
   not in a header, not in an active state.
2. **One ornament: the route line.** A thin elevation/contour stroke, carried through Home, My
   Plans, and Plan view. It replaces the previous system's ribbon-and-wave motif as the signature.
   (The per-week effort ribbon inside a plan is *not* ornament and stays — it encodes real data.)
3. **One deliberate exception.** The signed-out screens get a plum→ember→amber dusk gradient and
   an animated glowing route line. Everything past the session gate is paper and ink.

Screen temperature, for reference when adding a screen:

| Screen | Register |
|---|---|
| Onboarding / sign-in / sign-up | Bold. Dusk gradient hero, animated route line. The exception. |
| Home | Warm minimal, one ember CTA, route line in the header |
| My Plans / Plan view / Paywall | Formal, premium-SaaS: stat rows, tier comparison, dark pricing slabs |
| Glossary / Settings | Flat grouped rows, hairlines, **zero accent**. No exception. |

## 2. Colour

Ratios are WCAG 2.x relative-luminance contrast, computed against the surface named in the row.
Text tokens target ≥4.5:1; meaningful non-text (icons, state fills, the effort ramp) targets ≥3:1;
`progress.disabled` deliberately sits *below* AA because "you cannot use this" is what it means.

### Light — chalk & ink

| Token | Hex | Against | Ratio |
|---|---|---|---|
| `surface.base` (chalk) | `#F4F1EA` | — | — |
| `surface.raised` | `#EAE6DC` | — | — |
| `surface.inverse` | `#1E1815` | — | — |
| `text.primary` | `#241C17` | base | **14.85** |
| `text.secondary` | `#6A6058` | base / raised | **5.43 / 4.92** |
| `text.onInverse` | `#F4F1EA` | inverse | **15.56** |
| `text.onInverseMuted` | `#A1968B` | inverse | **6.06** |
| `progress.informative` | `#6A6058` | base / raised | **5.43 / 4.92** |
| `progress.disabled` | `#A79D92` | base | 2.36 (inert only — never text) |
| `status.error` | `#A32E1E` | base | **6.27** |
| `status.success` | `#2F6B4F` | base | **5.58** |
| `accent.ember` | `#B4400E` | base | **5.06** |
| `accent.onEmber` | `#F4F1EA` | ember | **5.06** |

### Dark — espresso

| Token | Hex | Against | Ratio |
|---|---|---|---|
| `surface.base` (espresso) | `#1E1815` | — | — |
| `surface.raised` | `#2A2320` | — | — |
| `surface.inverse` | `#120E0C` | — | — |
| `text.primary` | `#F4F1EA` | base | **15.56** |
| `text.secondary` | `#A1968B` | base / raised | **6.06 / 5.33** |
| `text.onInverse` | `#F4F1EA` | inverse | **17.02** |
| `text.onInverseMuted` | `#A1968B` | inverse | **6.63** |
| `progress.informative` | `#968C82` | base / raised | **5.32 / 4.69** |
| `progress.disabled` | `#5C524B` | base | 2.31 (inert only — never text) |
| `status.error` | `#E8735A` | base | **5.88** |
| `status.success` | `#5CBE96` | base | **7.74** |
| `accent.ember` | `#E2662E` | base | **5.16** |
| `accent.onEmber` | `#1E1815` | ember | **5.16** |

The accent is **scheme-aware**, unlike the previous system's theme-invariant one. It has to be:
no single ember clears AA on both chalk and espresso. `surface.raised` is the binding constraint
for `progress.informative` in both schemes, because the tab bar sits on it.

### The effort ramp

A colour always means an intensity; it never decorates. Paired with a monotonic bar-height ramp
(`0.4 / 0.55 / 0.7 / 0.85 / 1`) as the mandatory non-hue channel.

| Effort | Light | vs chalk | Dark | vs espresso |
|---|---|---|---|---|
| recovery | `#3E7C8C` | 4.17 | `#67AABC` | 6.73 |
| easy | `#3F7D57` | 4.35 | `#5FB183` | 6.77 |
| steady | `#94711A` | 4.02 | `#C79B2E` | 6.82 |
| tempo | `#A85A12` | 4.50 | `#DD8A3C` | 6.50 |
| interval | `#992040` | 7.06 | `#DE5C7E` | 4.96 |

Two constraints produced these, not taste:

- **Headroom.** The previous light ramp sat at 3.00–3.06:1 — four of five efforts were barely
  above the 3:1 floor at *full opacity*, which is what forced the old `AmbientPulseFloor` hack.
  Every value above clears 4:1, so the floor is no longer a design constraint anywhere.
- **No collision with ember.** A plan ribbon full of accent-coloured bars would destroy rule 1.
  `tempo` is therefore a distinctly browner orange (`#A85A12`) than ember (`#B4400E`).

### The dusk gradient — the exception

`stops: ['#2E1740', '#8C2F1B', '#C8721C']` at offsets `[0, 0.55, 1]`, plum at the top.
Theme-invariant: the hero looks the same at 3pm and 3am, which is what makes it read as a cover.

| On | Against | Ratio |
|---|---|---|
| `onDusk` `#F4F1EA` | plum `#2E1740` | 14.18 |
| `onDusk` `#F4F1EA` | ember stop `#8C2F1B` | 7.34 |
| `onDusk` `#F4F1EA` | amber `#C8721C` | 3.17 — **no text here** |
| `onDuskMuted` `#E6D8C6` | plum | 11.43 |
| `onDuskMuted` `#E6D8C6` | ember stop | 5.91 |

Copy is confined to the top ~60% of the field, where the darkest two stops are. The amber tail is
the last 15% and carries nothing but the route line.

## 3. Type

| Role | Family | Weights |
|---|---|---|
| Display + **every numeral** | Big Shoulders Display | 600 / 700 / 800 |
| Body and UI chrome | Public Sans | 400 / 500 / 600 / 700 |
| Pace, HR, week numbers, all-caps labels | Space Mono | 400 / 700 |

Steps: **13 / 15 / 17 / 20 / 24 / 32 / 44**.

- `hero` (44) is new. Big Shoulders Display is a condensed face with a much smaller optical size
  than the Barlow Condensed it replaced, so a 32pt title no longer carries a screen. Display-only
  — on body or mono text it is merely oversized, not emphatic.
- Space Mono ships **only 400 and 700**. Google publishes no Medium or SemiBold, so the previous
  system's `mono.medium` / `mono.semiBold` roles collapse onto `regular` / `bold`. Aliasing a
  `medium` that resolved to the same file would be a token that lies.
- Tracking: `display: -0.4` (Big Shoulders runs tight at large sizes), `label: 1.1` (all-caps mono
  field labels). Body copy is never tracked.
- RN does not substitute fonts per character range: a numeral inside Public Sans body copy needs
  its own styled `<Text>` wrapper to reach Big Shoulders.

## 4. Shape, stroke, ornament

- **Radius** — `control: 10`, `card: 16`, `pill: 999`. Both non-pill steps tightened from the
  previous system (12 / 20): paper and ink is a squarer language, and a 20pt card radius reads as
  consumer-app softness next to a hairline-ruled pricing table.
- **Stroke** — `hairline` (rules, baselines, separators), `thin: 1` (input and secondary-button
  borders), `mark: 1.5` (icons, chevrons, the route line, the locked-field dash). A glyph should
  weigh the same on every device, which is why `mark` is fixed rather than a hairline.
- **The route line** — a contour/elevation polyline drawn at `mark` weight in `grid.routeLine`.
  Three variants, all the same component (`src/components/brand/RouteLine.tsx`): a `header` rule
  under a screen title, a `card` stroke inside a summary card, and a `hero` stroke on the dusk
  field. It is generated from a fixed seeded profile, not random, so the same screen always draws
  the same ridge.
- **`LockedOpacity` (0.45)** — the resting dim of a Free-tier locked surface. Not `PressedOpacity`
  wearing a second hat: press feedback is a 100ms transient on a live control, this is the resting
  state of something the runner cannot use. Applied only to surfaces whose text is decorative.

## 5. What was removed, and why

| Removed | Reason |
|---|---|
| `Accent.hivis` / `hivisDeep` (`#D8F14A` / `#BBD911`) | The accent is ember now. `hivis` was appearance-named and described a colour the system no longer contains. |
| `AmbientPulseFloor` | Existed only because the old light effort ramp had no contrast headroom for an opacity dip. The new ramp does, and its one consumer (`HeroRibbon`) is gone. |
| `HeroRibbon` | Replaced by `components/brand/DuskHero.tsx`. The signature motif is the route line; a hero-scale week ribbon now competes with the plan's own data viz. |
| Barlow Condensed / Inter / IBM Plex Mono | Replaced by Big Shoulders Display / Public Sans / Space Mono. Packages uninstalled in the same commit. |
