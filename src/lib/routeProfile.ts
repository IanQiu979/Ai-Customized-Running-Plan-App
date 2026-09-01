/**
 * The geometry behind Trailhead's signature ornament — the elevation/contour "route line"
 * (`docs/design/trailhead-visual-system.md` §4).
 *
 * Pure: no React, no react-native, no SVG. It turns a normalized elevation profile into an SVG
 * path string, and `components/brand/RouteLine.tsx` is the only thing that renders it. Keeping
 * the math here rather than inside the component is what makes it testable — a smoothing bug that
 * lets the curve overshoot its own box is invisible in a screenshot at 1.5pt stroke weight and
 * obvious in an assertion.
 *
 * The profile is a FIXED constant, not a random walk. The same screen must draw the same ridge on
 * every launch; a route line that reshuffles itself between renders is noise wearing a motif's
 * clothes.
 */

/**
 * Normalized elevations, 0 (valley) to 1 (summit), sampled left to right.
 *
 * Shaped like a real training block rather than a decorative squiggle: a gentle base, three
 * progressively higher efforts each followed by a dip, one clear summit, and a taper down to a
 * value above where it started. That is the same story every plan in the app tells, which is the
 * only reason this shape is allowed to be ornament at all.
 */
export const ROUTE_PROFILE: readonly number[] = [
  0.18, 0.3, 0.22, 0.44, 0.34, 0.58, 0.46, 0.74, 0.62, 0.92, 0.68, 0.5, 0.38,
];

/** Index of the highest point in `ROUTE_PROFILE` — where `RouteLine` may place a summit tick. */
export const ROUTE_SUMMIT_INDEX: number = ROUTE_PROFILE.reduce(
  (best, value, index, all) => (value > all[best] ? index : best),
  0
);

export type Point = { x: number; y: number };

/**
 * Lay a normalized profile out inside a box.
 *
 * `y` is flipped, because SVG's origin is top-left and an elevation of 1 is the TOP of the ridge.
 * `inset` keeps the stroke's own half-width inside the viewBox at the summit and the valley — an
 * un-inset path at elevation 1 clips its top half against the box edge.
 */
export function routePoints(
  profile: readonly number[],
  width: number,
  height: number,
  inset: number
): Point[] {
  if (profile.length === 0) return [];
  const usableHeight = Math.max(0, height - inset * 2);
  const step = profile.length > 1 ? width / (profile.length - 1) : 0;
  return profile.map((elevation, index) => ({
    x: index * step,
    y: inset + (1 - elevation) * usableHeight,
  }));
}

/**
 * A smooth cubic-Bézier path through every point, Catmull-Rom style.
 *
 * `tension` is the fraction of each neighbouring span the control points reach out along. At the
 * canonical 1/6 this interpolates the classic uniform Catmull-Rom spline; lower values pull the
 * curve toward straight segments. It is deliberately capped below the value at which a spline
 * starts overshooting its own control points, because an ornament that pokes outside its box
 * clips against the card it lives in.
 */
export const ROUTE_TENSION = 1 / 6;

export function routePath(points: readonly Point[], tension: number = ROUTE_TENSION): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;

  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    // The endpoints have no outside neighbour; reusing the endpoint itself is what makes the
    // spline arrive flat rather than whipping past the first and last elevations.
    const previous = points[i - 1] ?? points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] ?? next;

    const control1 = {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    };
    const control2 = {
      x: next.x - (after.x - current.x) * tension,
      y: next.y - (after.y - current.y) * tension,
    };

    path +=
      ` C ${round(control1.x)} ${round(control1.y)}` +
      ` ${round(control2.x)} ${round(control2.y)}` +
      ` ${round(next.x)} ${round(next.y)}`;
  }

  return path;
}

/**
 * Approximate arc length of the same curve `routePath` emits.
 *
 * The stroke-draw animation on the signed-out hero needs a `strokeDasharray` equal to the path's
 * own length: too short and the line finishes drawing early, too long and it never finishes. SVG
 * exposes `getTotalLength()` in a browser; React Native's SVG surface does not, so this samples
 * each cubic and sums the chords. `SAMPLES_PER_SEGMENT` polyline sampling under-estimates a
 * curve, so the result is padded — a dash slightly longer than the path draws to completion and
 * then holds, which is the correct failure direction.
 */
const SAMPLES_PER_SEGMENT = 24;
/** ~1% of headroom. Under-shooting leaves a visible unfinished tail; over-shooting is invisible. */
const LENGTH_PADDING = 1.01;

export function routeLength(points: readonly Point[], tension: number = ROUTE_TENSION): number {
  if (points.length < 2) return 0;

  let length = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] ?? points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] ?? next;

    const c1x = current.x + (next.x - previous.x) * tension;
    const c1y = current.y + (next.y - previous.y) * tension;
    const c2x = next.x - (after.x - current.x) * tension;
    const c2y = next.y - (after.y - current.y) * tension;

    let lastX = current.x;
    let lastY = current.y;
    for (let step = 1; step <= SAMPLES_PER_SEGMENT; step += 1) {
      const t = step / SAMPLES_PER_SEGMENT;
      const u = 1 - t;
      const x = u ** 3 * current.x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * next.x;
      const y = u ** 3 * current.y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * next.y;
      length += Math.hypot(x - lastX, y - lastY);
      lastX = x;
      lastY = y;
    }
  }

  return length * LENGTH_PADDING;
}

/** Two decimals is well below a physical pixel at every size this is drawn at, and it keeps the
 * generated path short enough to read in a diff. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
