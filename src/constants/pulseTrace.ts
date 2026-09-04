/**
 * The pulse trace's own tokens — the ONE deliberately bold, expressive element of the redesigned,
 * near-monochrome "cool scientific" house style V2.2 shares with V2.3 (captain-approved,
 * 2026-09-03). Everything here is read by exactly two files: `components/brand/PulseTraceHero.tsx`
 * and the dev preview at `app/dev/pulse-trace.tsx`.
 *
 * Why this is not in `theme.ts`: that file still holds the outgoing "Trailhead" system (warm
 * paper/espresso, ember accent), which a parallel effort is replacing wholesale. Building the
 * animation against tokens that are about to be deleted would couple it to the wrong system, and
 * editing `theme.ts` from this branch would collide with that rewrite mid-flight. So the values
 * the animation depends on live here, self-contained, ready to be folded into (or re-exported
 * from) the new token system once it lands. The intended end state is that
 * `PulseTracePalette.trace` IS the new system's single bright highlight — icy cyan, locked — and
 * that no other surface in the app is allowed to use it except the true primary call-to-action.
 *
 * Two rules ride with the palette:
 *
 * 1. The animation is drawn on ITS OWN near-black field, whatever the surrounding screen's colour
 *    scheme. Light mode does not get a light pulse trace — the bold moment is the same in both
 *    schemes, which is what makes it read as a signature rather than a theme-dependent decoration.
 * 2. Nothing in here is decoration for other screens. The cyan does not become a link colour, a
 *    chart colour or a badge. If a second use appears, the highlight has stopped being a
 *    highlight.
 */

export const PulseTracePalette = {
  /** The dark field the trace is drawn on. A cool, blue-leaning near-black rather than pure
   * `#000`: pure black next to icy cyan reads as a screensaver, this reads as an instrument. */
  field: '#0A0E13',
  /** The trace's core stroke — icy cyan, locked. Pale enough to feel cold, bright enough to be
   * the single most luminous thing on any screen it appears on. */
  trace: '#A8F0FF',
  /** The bloom around the core stroke and the light that sweeps along it. Deeper than the core so
   * the stacked glow strokes read as one line with a halo, not as two lines. */
  glow: '#3FD3F2',
  /** The drawing head's centre — nearly white, so the tip is the hottest point on the line. */
  head: '#EAFDFF',
  /** The ECG-paper grid and the resting baseline share the trace colour at low alpha, so the whole
   * field is one hue and the only thing that changes is how much light is in it. */
  grid: 'rgba(168, 240, 255, 0.07)',
  baseline: 'rgba(168, 240, 255, 0.18)',
  /** Copy that sits over the field, for the preview and for any caller that puts a heading on the
   * hero. Not the trace colour — text in the highlight colour would spend it on something other
   * than the CTA and the animation. */
  onField: '#F2F6F8',
  onFieldMuted: 'rgba(242, 246, 248, 0.62)',
} as const;

/**
 * Motion timings, in ms. These are the pulse trace's own exceptions to the house rule that
 * "if nothing is happening, nothing moves", and they are scoped as tightly as Trailhead's
 * `Motion.duration.reveal`/`ambient` were: the draw runs once, the sweep runs only along an
 * already-drawn trace, and neither may be borrowed by another component.
 */
export const PulseTraceMotion = {
  /** How long the flat baseline is shown alone before the trace starts drawing — the "flatline,
   * then life" beat. Long enough to register as stillness, short enough not to read as a stall. */
  lead: 400,
  /** The paper speed: how long the drawing head takes to cross the full width. Constant, like a
   * real strip chart — the spikes read as spikes precisely because the head does NOT slow down
   * for them. */
  draw: 2200,
  /** One pass of the ambient light along the drawn trace. */
  sweep: 1600,
  /** The rest between sweeps. Together with `sweep` this is the trace's resting heart rate. */
  sweepRest: 1400,
  /** A ceiling's worth of slack added to `lead + draw` for the settled callback's fallback timer,
   * in case the animation completion never fires (backgrounded app, dropped cold-start frames). */
  settleSlack: 400,
} as const;

/**
 * Geometry that is design, not layout: how the trace sits in its field.
 */
export const PulseTraceLayout = {
  /** The field's heights per variant. `cover` is a landing hero; `band` is a header-height strip
   * a form screen can carry without spending half the viewport against a keyboard. */
  height: {
    cover: 256,
    band: 128,
  },
  /** The trace band inside the field never grows past this, so on a tall hero the trace stays a
   * strip and the copy keeps the room — a 256pt-tall ECG is a poster, not an instrument. */
  maxTraceHeight: 132,
  /** The resting baseline sits this fraction of the way down the trace band: room above for the
   * tall R-spike, less room below for the S-undershoot. */
  baselineFraction: 0.66,
  /** The ECG-paper grid pitch, in points. */
  gridPitch: 32,
} as const;
