import {
  ROUTE_PROFILE,
  ROUTE_SUMMIT_INDEX,
  ROUTE_TENSION,
  routeLength,
  routePath,
  routePoints,
  type Point,
} from '../routeProfile';

/**
 * Guards the route-line ornament's geometry (`docs/design/trailhead-visual-system.md` §4).
 *
 * The failure this suite exists for: at a 1.5pt stroke, a spline that overshoots its own box, or
 * a profile that silently reshuffles, is invisible in a screenshot and obvious in an assertion.
 */

describe('ROUTE_PROFILE', () => {
  it('stays inside the normalized 0…1 range the layout assumes', () => {
    // `routePoints` maps 0 → the bottom inset and 1 → the top inset. A value outside the range
    // doesn't error, it just draws outside the box.
    for (const elevation of ROUTE_PROFILE) {
      expect(elevation).toBeGreaterThanOrEqual(0);
      expect(elevation).toBeLessThanOrEqual(1);
    }
  });

  it('has exactly one summit, and ROUTE_SUMMIT_INDEX points at it', () => {
    const peak = Math.max(...ROUTE_PROFILE);
    expect(ROUTE_PROFILE.filter((elevation) => elevation === peak)).toHaveLength(1);
    expect(ROUTE_PROFILE[ROUTE_SUMMIT_INDEX]).toBe(peak);
  });

  it('ends above where it starts — the taper resolves higher than the base', () => {
    expect(ROUTE_PROFILE[ROUTE_PROFILE.length - 1]).toBeGreaterThan(ROUTE_PROFILE[0]);
  });
});

describe('routePoints', () => {
  it('spans the full width and flips elevation so 1 is the TOP of the box', () => {
    const points = routePoints([0, 1], 100, 40, 2);
    expect(points[0]).toEqual({ x: 0, y: 38 }); // elevation 0 → bottom, inset in by 2
    expect(points[1]).toEqual({ x: 100, y: 2 }); // elevation 1 → top, inset in by 2
  });

  it('keeps every point inside the inset box, so a 1.5pt stroke cannot clip', () => {
    const inset = 3;
    const height = 48;
    const points = routePoints(ROUTE_PROFILE, 320, height, inset);
    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(inset);
      expect(point.y).toBeLessThanOrEqual(height - inset);
    }
  });

  it('degrades rather than dividing by zero on a one-point profile', () => {
    expect(routePoints([0.5], 100, 40, 0)).toEqual([{ x: 0, y: 20 }]);
    expect(routePoints([], 100, 40, 0)).toEqual([]);
  });
});

describe('routePath', () => {
  it('emits one cubic segment per span, starting with a moveto', () => {
    const points = routePoints(ROUTE_PROFILE, 300, 40, 2);
    const path = routePath(points);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.match(/ C /g)).toHaveLength(ROUTE_PROFILE.length - 1);
  });

  it('is deterministic — the same screen draws the same ridge every launch', () => {
    const points = routePoints(ROUTE_PROFILE, 300, 40, 2);
    expect(routePath(points)).toBe(routePath(points));
  });

  it('stays inside the drawn box — the bound `inset` actually has to protect', () => {
    // The real risk of a Catmull-Rom spline: at a high tension the curve bulges past the control
    // points it interpolates, and the ornament clips against the card it sits in. Sampling the
    // Béziers is the only way to catch that — the endpoints alone always look fine.
    //
    // Note what is asserted: the *box*, not the vertices. At `ROUTE_TENSION` this profile does
    // overshoot its own summit vertex, by 0.004pt at a 40pt height — which is what `inset` is
    // sized to absorb, alongside the stroke's own half-width. Asserting the tighter
    // vertex bound would fail on a mathematically correct curve; asserting the box is the bound
    // that has a visible consequence.
    const height = 40;
    const inset = 2;
    const points = routePoints(ROUTE_PROFILE, 300, height, inset);

    for (const { y } of sampleCubics(points, ROUTE_TENSION)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(height);
    }
  });

  it('keeps that overshoot well under a physical pixel, so `inset` can absorb it', () => {
    // If someone raises `ROUTE_TENSION`, this is the test that says how much room they just ate.
    const points = routePoints(ROUTE_PROFILE, 300, 40, 2);
    const minY = Math.min(...points.map((point) => point.y));
    const overshoot = minY - Math.min(...sampleCubics(points, ROUTE_TENSION).map((p) => p.y));
    expect(overshoot).toBeLessThan(0.5);
  });

  it('handles the degenerate inputs a zero-width layout pass can produce', () => {
    expect(routePath([])).toBe('');
    expect(routePath([{ x: 0, y: 5 }])).toBe('M 0 5');
  });
});

describe('routeLength', () => {
  it('is at least the straight-line distance through every point — a curve is never shorter', () => {
    const points = routePoints(ROUTE_PROFILE, 300, 40, 2);
    const chordSum = points
      .slice(1)
      .reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
    expect(routeLength(points)).toBeGreaterThanOrEqual(chordSum);
  });

  it('over-estimates rather than under-estimates, so the stroke-draw always completes', () => {
    // The failure this guards: a dasharray shorter than the path leaves a permanently unfinished
    // tail on the signed-out hero. Sampling a curve as a polyline under-estimates it, which is
    // why `routeLength` pads — this asserts the padding survives.
    const points = routePoints(ROUTE_PROFILE, 300, 40, 2);
    const dense = denseLength(points, ROUTE_TENSION);
    expect(routeLength(points)).toBeGreaterThan(dense);
  });

  it('returns 0 for a path that cannot be drawn', () => {
    expect(routeLength([])).toBe(0);
    expect(routeLength([{ x: 0, y: 0 }])).toBe(0);
  });
});

/** A far finer sampling than `routeLength` uses, as an independent reference value. */
function denseLength(points: readonly Point[], tension: number): number {
  const samples = sampleCubics(points, tension, 400);
  return samples
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(point.x - samples[i].x, point.y - samples[i].y), 0);
}

/** Re-derives the same control points `routePath` builds and samples each cubic, so the bounds
 * assertion above tests the curve rather than just the vertices. */
function sampleCubics(points: readonly Point[], tension: number, steps = 20): Point[] {
  const samples: Point[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] ?? points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] ?? next;
    const c1 = {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    };
    const c2 = {
      x: next.x - (after.x - current.x) * tension,
      y: next.y - (after.y - current.y) * tension,
    };
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      samples.push({
        x: u ** 3 * current.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * next.x,
        y: u ** 3 * current.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * next.y,
      });
    }
  }
  return samples;
}
