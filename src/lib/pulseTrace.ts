/**
 * The geometry behind the pulse trace — the redesign's signature onboarding animation, an
 * ECG-style waveform that draws itself across a near-black field (`constants/pulseTrace.ts` for
 * the palette and the reasoning).
 *
 * Pure: no React, no react-native, no SVG, no Reanimated. It turns a list of "beats" into a
 * strictly x-monotonic polyline plus the lookup tables the animated component needs, and
 * `components/brand/PulseTraceHero.tsx` is the only thing that renders it. Keeping the math here
 * is what makes the shape testable — a beat whose P-wave overlaps the previous T-wave produces a
 * path that doubles back on itself, which is invisible at 1.5pt and obvious in an assertion.
 *
 * Why x-monotonic matters: the animation is driven by ONE number, the drawing head's horizontal
 * position as a fraction of the width — either the clock (self-draw) or the onboarding scroll
 * (`progress`). Everything else is a lookup: `y` at that x for the head dot, arc length at that x
 * for the `strokeDashoffset` reveal. That is also where the "rhythm" comes from for free. The head
 * moves at constant paper speed, like a real strip chart, and a spike has a lot of arc length
 * packed into very little width — so the trace idles across the baseline and then SNAPS through
 * each spike without a single bespoke easing curve.
 *
 * The default rhythm is a FIXED constant, not a random walk. The same screen draws the same trace
 * on every launch; an animation that reshuffles itself between renders is noise.
 */

export type PulseBeat = {
  /** Where the R-spike peaks, as a fraction of the trace width (0 = left edge, 1 = right). */
  at: number;
  /** Spike height, 0..1, as a fraction of the room above the baseline. */
  amplitude: number;
};

export type Point = { x: number; y: number };

/**
 * The default rhythm: four beats, each taller than the last except the final one, with the
 * interval between them shortening from left to right. Four, not more: at phone width a fifth
 * complex leaves no flat baseline between beats, and the baseline is what makes a spike read as
 * an event rather than as texture. Effort building, heart rate climbing,
 * then a beat that eases off — the same story every plan in the app tells (build, peak, taper),
 * which is the only reason a heartbeat is allowed to stand for pace at all.
 *
 * The spacings must respect `MIN_BEAT_SPACING`; `pulseTrace.test.ts` pins that.
 */
export const PULSE_RHYTHM: readonly PulseBeat[] = [
  { at: 0.14, amplitude: 0.55 },
  { at: 0.4, amplitude: 0.75 },
  { at: 0.63, amplitude: 1 },
  { at: 0.84, amplitude: 0.7 },
];

/**
 * One beat's silhouette, in fractions of the trace WIDTH for x and fractions of the room above the
 * baseline for y. Stylised, not clinical: a real P-QRS-T complex is far narrower than this at any
 * legible paper speed, and a literal one would read as a medical device rather than as pace.
 *
 * `MIN_BEAT_SPACING` and `BEAT_MARGIN` are derived from these extents so the constants cannot
 * drift apart: a beat runs from `pOffset - pHalfWidth` to `tOffset + tHalfWidth`.
 */
const BEAT_SHAPE = {
  pOffset: -0.056,
  pHalfWidth: 0.016,
  pHeight: 0.08,
  qOffset: -0.018,
  qDepth: 0.07,
  sOffset: 0.014,
  /** As a fraction of the room above the baseline, like the others — the field's
   * `baselineFraction` leaves enough room below for it (`pulseTrace.test.ts`). */
  sDepth: 0.24,
  returnOffset: 0.026,
  tOffset: 0.052,
  tHalfWidth: 0.02,
  tHeight: 0.16,
} as const;

/** Half the horizontal extent of one beat, from P-wave onset to T-wave end. */
const BEAT_HALF_EXTENT = Math.max(
  Math.abs(BEAT_SHAPE.pOffset) + BEAT_SHAPE.pHalfWidth,
  BEAT_SHAPE.tOffset + BEAT_SHAPE.tHalfWidth
);

/** Two beats closer than this would have their T- and P-waves overlap, so `normalizeBeats` drops
 * the later one. A little wider than the raw extent so consecutive beats keep a sliver of
 * baseline between them — a trace with no flat between complexes is a tremor, not a rhythm. */
export const MIN_BEAT_SPACING = BEAT_HALF_EXTENT * 2 + 0.004;

/** How far from either edge a beat may peak, so a complex is never clipped by the field's edge. */
export const BEAT_MARGIN = BEAT_HALF_EXTENT + 0.002;

/** Amplitudes below this are noise on the baseline rather than a beat. */
const MIN_AMPLITUDE = 0.15;

/** Interior samples on the rounded P- and T-waves. The waves are half-sines drawn as polylines
 * with round joins, and at the widths they are drawn at this many points is past the threshold
 * where the segments stop being visible as segments. */
const P_SAMPLES = 9;
const T_SAMPLES = 11;

/**
 * Make any caller's beat list renderable: clamp every field into range, sort left to right, and
 * drop any beat that would overlap the one before it. Idempotent, and the only way beats reach
 * `pulseTracePoints` — a scroll-driven caller that places beats at its section boundaries does
 * not have to know the geometry's spacing rule to get a clean trace.
 */
export function normalizeBeats(beats: readonly PulseBeat[]): PulseBeat[] {
  const clamped = beats
    .filter((beat) => Number.isFinite(beat.at) && Number.isFinite(beat.amplitude))
    .map((beat) => ({
      at: clamp(beat.at, BEAT_MARGIN, 1 - BEAT_MARGIN),
      amplitude: clamp(beat.amplitude, MIN_AMPLITUDE, 1),
    }))
    .sort((a, b) => a.at - b.at);

  const spaced: PulseBeat[] = [];
  for (const beat of clamped) {
    const previous = spaced[spaced.length - 1];
    if (!previous || beat.at - previous.at >= MIN_BEAT_SPACING) spaced.push(beat);
  }
  return spaced;
}

/**
 * Beats placed at a caller's own marks — the fractions of its scroll range where one onboarding
 * section gives way to the next — so a spike fires exactly as the runner crosses into a new
 * section. Amplitude ramps up across the marks (a crescendo), which is the "building effort"
 * reading, unless the caller passes its own.
 */
export function beatsAtMarks(marks: readonly number[], amplitudes?: readonly number[]): PulseBeat[] {
  const count = marks.length;
  return normalizeBeats(
    marks.map((at, index) => ({
      at,
      amplitude:
        amplitudes?.[index] ?? (count <= 1 ? 1 : 0.5 + (0.5 * index) / Math.max(1, count - 1)),
    }))
  );
}

/**
 * Lay the trace out inside a box, as a polyline whose x is STRICTLY increasing.
 *
 * `inset` keeps the stroke's own half-width inside the box at the tallest spike and the deepest
 * undershoot. `baselineFraction` is how far down the box the resting line sits — more room above
 * (for the R-spike) than below (for the S-undershoot).
 *
 * Beats are normalized on the way in, so an unsorted or overlapping list still yields a valid
 * trace. Any point that would not advance x is dropped rather than emitted — the monotonic
 * invariant is load-bearing for every lookup the component does, and a test pins it.
 */
export function pulseTracePoints(
  beats: readonly PulseBeat[],
  width: number,
  height: number,
  inset: number,
  baselineFraction: number
): Point[] {
  if (width <= 0 || height <= 0) return [];

  const usable = Math.max(0, height - inset * 2);
  const baseline = inset + usable * baselineFraction;
  const roomAbove = usable * baselineFraction;

  const points: Point[] = [{ x: 0, y: baseline }];
  const push = (xFraction: number, y: number) => {
    const x = xFraction * width;
    const last = points[points.length - 1];
    if (x > last.x) points.push({ x, y });
  };
  const bump = (center: number, halfWidth: number, rise: number, samples: number) => {
    push(center - halfWidth, baseline);
    for (let k = 1; k <= samples; k += 1) {
      const t = k / (samples + 1);
      push(center - halfWidth + 2 * halfWidth * t, baseline - rise * Math.sin(Math.PI * t));
    }
    push(center + halfWidth, baseline);
  };

  for (const beat of normalizeBeats(beats)) {
    const rise = beat.amplitude * roomAbove;
    const s = BEAT_SHAPE;

    bump(beat.at + s.pOffset, s.pHalfWidth, s.pHeight * rise, P_SAMPLES);

    // The QRS complex: a small dip, the spike, the undershoot, then back to the line. Sharp
    // vertices on purpose — this is the part of the trace that has to read as electrical.
    push(beat.at + s.qOffset - 0.006, baseline);
    push(beat.at + s.qOffset, baseline + s.qDepth * rise);
    push(beat.at, baseline - rise);
    push(beat.at + s.sOffset, baseline + s.sDepth * rise);
    push(beat.at + s.returnOffset, baseline);

    bump(beat.at + s.tOffset, s.tHalfWidth, s.tHeight * rise, T_SAMPLES);
  }

  push(1, baseline);
  return points;
}

/** The SVG `d` for a polyline through `points`. Straight segments only: the sharp QRS vertices
 * are the point, and the P/T waves are already sampled finely enough to read as curves. */
export function pulseTracePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${round(points[i].x)} ${round(points[i].y)}`;
  }
  return d;
}

export type PulseTraceTables = {
  /** Vertex x-positions, strictly increasing. The input range for every lookup. */
  xs: number[];
  /** Vertex y-positions, parallel to `xs`. */
  ys: number[];
  /** Arc length from the start of the trace to each vertex, parallel to `xs`. Exact for a
   * polyline — no sampling, no padding, unlike a Bézier's length estimate. */
  arcs: number[];
  /** The whole trace's length; the `strokeDasharray` that hides it and the offset that reveals it. */
  total: number;
};

/**
 * The lookup tables the animated component interpolates over on the UI thread. Built once per
 * measured width, never per frame.
 */
export function pulseTraceTables(points: readonly Point[]): PulseTraceTables {
  const xs: number[] = [];
  const ys: number[] = [];
  const arcs: number[] = [];
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    xs.push(points[i].x);
    ys.push(points[i].y);
    arcs.push(length);
  }
  return { xs, ys, arcs, total: length };
}

/**
 * How far a scroll position is through its scrollable range, 0..1 — the number a scroll-driven
 * caller hands the hero as `progress`. Defined here rather than in a screen so both the preview
 * and the real onboarding derive it the same way, and so a content shorter than its viewport
 * (nothing to scroll) reads as fully drawn instead of dividing by zero.
 *
 * Marked as a worklet so it can be called from inside a Reanimated scroll handler, which runs on
 * the UI thread. The directive is inert everywhere else — under Node and Jest this is an ordinary
 * function — and it is the one concession this otherwise pure module makes to the animation
 * runtime that consumes it.
 */
export function scrollProgress(offsetY: number, contentHeight: number, viewportHeight: number): number {
  'worklet';
  const range = contentHeight - viewportHeight;
  if (!(range > 0)) return 1;
  return clamp(offsetY / range, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Two decimals is well below a physical pixel at every size this is drawn at, and it keeps the
 * generated path short enough to read in a diff. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
