# The pulse trace — `PulseTraceHero`

> Integration guide for the redesign's signature onboarding animation. Written for the worker
> rebuilding the onboarding screen, who should be able to mount this without reading its internals.
> Concept and colour are captain-approved (2026-09-03); the exact hex values are the animation's own
> until the new token system lands (see "Tokens" below).

## What it is

A thin icy-cyan ECG-style waveform that draws itself across a near-black field. It stands for pace
and effort: it idles along a flat baseline and snaps through each spike, the beats building and
quickening before the last one eases off, then a soft light sweeps the finished line on a slow loop. It is the ONE deliberately
bold, expressive element in an otherwise near-monochrome app, and it is the same in light and dark
mode — it paints its own dark field.

Files:

| File | Role |
|---|---|
| `src/components/brand/PulseTraceHero.tsx` | The component. Rendering plus two Reanimated shared values; nothing else. |
| `src/lib/pulseTrace.ts` | Pure geometry: beats → x-monotonic polyline → path + lookup tables. Fully unit-tested. |
| `src/constants/pulseTrace.ts` | Its palette, timings and layout constants. The only place colour comes from. |
| `src/app/dev/pulse-trace.tsx` | Dev-only preview, `/dev/pulse-trace` in a dev build. Shows both modes. |
| `src/lib/__tests__/pulseTrace.test.ts`, `src/components/__tests__/pulseTraceHero.test.tsx` | The tests. |

## Mounting it

```tsx
import { PulseTraceHero } from '@/components/brand/PulseTraceHero';

// Landing hero: draws itself once on mount, then idles.
<PulseTraceHero onSettled={() => setCtaEnabled(true)}>
  <Text style={eyebrow}>PACE BLUEPRINT</Text>
  <Text style={heading}>Your training plan, built around you.</Text>
</PulseTraceHero>
```

The component fills whatever width it is given (it measures itself with `onLayout`) and takes its
height from `size`:

| `size` | Field height | Use |
|---|---|---|
| `'cover'` (default) | 256pt | A landing hero with copy over it. |
| `'band'` | 128pt | A header-height strip — a form screen, or the sticky header of a scrolling onboarding. |

The trace band is pinned to the bottom of the field and never grows taller than 132pt
(`PulseTraceLayout.maxTraceHeight`); on a `cover` the top half is the copy slot (`children`), on a
`band` the trace fills the field. The field itself is `minHeight`, so tall copy grows the field
rather than overlapping the trace. Pass `style` to add margins or a radius; do not give it a
background — it owns one.

### Props

| Prop | Type | Meaning |
|---|---|---|
| `progress?` | `SharedValue<number>` | 0..1 — how far the drawing head has travelled. **Provide it to drive the trace from scroll; omit it and the trace draws itself on mount.** Values outside 0..1 (overscroll) are clamped. |
| `beats?` | `readonly PulseBeat[]` | Where the spikes peak (`at`, fraction of width) and how tall (`amplitude`, 0..1). Defaults to the fixed house rhythm `PULSE_RHYTHM`. Any list is sanitised (sorted, clamped, overlaps dropped) — you cannot produce a broken trace. |
| `size?` | `'cover' \| 'band'` | See above. |
| `onSettled?` | `() => void` | Self-drawing mode only: fires once the draw completes, immediately under reduced motion, and never later than `lead + draw + slack` even if the animation callback is lost. Never fires in scroll-driven mode. An inline arrow is fine. |
| `children?` | `ReactNode` | Copy rendered over the field, above the trace. |
| `style?` | `StyleProp<ViewStyle>` | Outer container style. |

### Scroll-driven (the onboarding use)

The concept is "draws itself as part of the onboarding scroll, spiking at section transitions". The
recipe, which the dev preview's **Scroll** tab is a working copy of:

```tsx
import Animated from 'react-native-reanimated';
import { PulseTraceHero, usePulseTraceScroll } from '@/components/brand/PulseTraceHero';
import { beatsAtMarks } from '@/lib/pulseTrace';

// Where, as a fraction of the scrollable range, each section hands over to the next. Keep every
// mark within `BEAT_MARGIN` of the edges (0.074 … 0.926) or `normalizeBeats` moves it inward.
const SECTION_MARKS = [0.24, 0.5, 0.76, 0.92];
const beats = beatsAtMarks(SECTION_MARKS); // amplitude ramps 0.5 → 1 across the marks

const { progress, ...scroll } = usePulseTraceScroll();

<Animated.ScrollView {...scroll} scrollEventThrottle={16} stickyHeaderIndices={[0]}>
  <PulseTraceHero progress={progress} beats={beats} size="band" />
  {/* sections… */}
</Animated.ScrollView>
```

Notes:

- `usePulseTraceScroll` hands back `onScroll`, `onLayout` and `onContentSizeChange` — spread all
  three. `onScroll` alone is not enough: React Native emits no initial scroll event, and a page
  whose content is shorter than its viewport emits none at all, so the other two are what let
  `scrollProgress`'s "nothing to scroll" branch return 1 and a short page show a finished trace
  rather than a flat line. `scrollProgress` itself is a worklet, so the handler can call it
  directly if you ever need to drive `progress` from somewhere else.
- The head moves with the *x-position*, not with arc length, so scrolling through the flat parts
  advances the baseline and crossing a mark fires the whole spike in a few points of scroll. That
  is the "punctuation" — no separate trigger is needed.
- The ambient sweep runs along whatever has been drawn so far, so it is alive from the first pixel.
- If your section boundaries are only known after layout, compute the marks from the measured
  section offsets and pass a new `beats` — the geometry rebuilds; the head position (a fraction)
  carries over. Keep `beats` referentially stable between renders (a module constant or a
  `useMemo`): an inline array on every render rebuilds the lookup tables every time.
- Under reduced motion the trace still follows the scroll (that motion is the runner's own); only
  the self-draw and the sweep are suppressed.

### Self-drawing (the landing hero use)

Omit `progress`. Timeline, in ms, from `PulseTraceMotion`:

| Phase | Duration | What the runner sees |
|---|---|---|
| lead | 400 | The flat baseline alone on the grid — "flatline, then life". |
| draw | 2200 | The head crosses the field at constant paper speed, snapping through each spike; the fresh line glows hotter behind the head. `onSettled` fires at the end. |
| sweep / rest | 1600 / 1400, looped | A soft light travels the finished trace, pauses, travels again. |

Gate a CTA on `onSettled` if the screen needs the hero settled before the button is live (the
previous landing screen did). The fallback ceiling resolves the gate for any hero that measures — it is timed from layout, so a hero mounted in a container that lays out at zero width never measures and therefore never settles.

## Tokens

The animation reads colour ONLY from `PulseTracePalette` in `src/constants/pulseTrace.ts`, never
from `theme.ts` — the outgoing Trailhead tokens are being replaced in a parallel effort and this
must not couple to them. When the new token system lands:

- `PulseTracePalette.trace` (`#A8F0FF`) is meant to become the system's single bright highlight —
  icy cyan, locked — shared with the true primary CTA and nothing else. Either fold the palette
  into the new tokens and re-export it from here, or point these constants at the new tokens. The
  component does not care which.
- The cyan must not appear anywhere else. It is not a link colour, a chart colour or a badge.
- The field is always dark (`#0A0E13`), whatever the surrounding scheme.

Layout tokens it does take from `theme.ts` are scheme-independent: `Spacing` (copy-slot padding)
and `Stroke` (line weights).

## Accessibility

The trace band is a single `image` for screen readers with a label describing the illustration.
The outer field is deliberately NOT an accessibility element — on iOS an `accessible` container
swallows its descendants — so the copy slot's text is traversed like any other text on the screen. Reduced motion (system setting, via Reanimated's `useReducedMotion`):
no self-draw (the trace is simply present), no ambient sweep, and `onSettled` fires at once.

## Tuning

Everything that is a feel decision is a named constant at the top of `PulseTraceHero.tsx` (glow
opacities, head radii, kick timing, trail and sweep lengths) or in `constants/pulseTrace.ts`
(palette, durations, field heights, baseline position, grid pitch). The beat silhouette itself
(`BEAT_SHAPE`) is in `lib/pulseTrace.ts`, with its spacing rules derived from it so they cannot
drift. Iterate against `/dev/pulse-trace` — **Replay** remounts the self-drawing hero.

## The dev preview

`src/app/dev/pulse-trace.tsx` is reachable in a dev build only (it redirects home otherwise) and is
linked from nowhere. It is fine to delete once the onboarding rebuild mounts the component for
real, or to keep as the start of a component gallery — the rebuild worker's call.
