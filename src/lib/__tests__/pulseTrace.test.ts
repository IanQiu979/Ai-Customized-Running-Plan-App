import { PulseTraceLayout } from '@/constants/pulseTrace';
import {
  BEAT_MARGIN,
  MIN_BEAT_SPACING,
  PULSE_RHYTHM,
  beatsAtMarks,
  normalizeBeats,
  pulseTracePath,
  pulseTracePoints,
  pulseTraceTables,
  scrollProgress,
} from '../pulseTrace';

const WIDTH = 360;
const HEIGHT = PulseTraceLayout.maxTraceHeight;
const INSET = 5;
const BASELINE = PulseTraceLayout.baselineFraction;

function trace(beats = PULSE_RHYTHM, width: number = WIDTH, height: number = HEIGHT) {
  return pulseTracePoints(beats, width, height, INSET, BASELINE);
}

describe('PULSE_RHYTHM', () => {
  it('is already normalized — nothing about the default gets silently dropped or clamped', () => {
    expect(normalizeBeats(PULSE_RHYTHM)).toEqual(PULSE_RHYTHM);
  });

  it('quickens: every interval is no longer than the one before it', () => {
    const intervals = PULSE_RHYTHM.slice(1).map((beat, i) => beat.at - PULSE_RHYTHM[i].at);
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1] + 1e-9);
    }
  });

  it('peaks once, at full amplitude, before the final beat eases off', () => {
    const amplitudes = PULSE_RHYTHM.map((beat) => beat.amplitude);
    expect(Math.max(...amplitudes)).toBe(1);
    expect(amplitudes.indexOf(1)).toBe(amplitudes.length - 2);
  });
});

describe('normalizeBeats', () => {
  it('sorts, clamps into the margins, and clamps amplitude', () => {
    const beats = normalizeBeats([
      { at: 1.4, amplitude: 2 },
      { at: -0.5, amplitude: 0 },
      { at: 0.5, amplitude: 0.7 },
    ]);
    expect(beats.map((b) => b.at)).toEqual([BEAT_MARGIN, 0.5, 1 - BEAT_MARGIN]);
    expect(beats[0].amplitude).toBeGreaterThan(0);
    expect(beats[2].amplitude).toBe(1);
  });

  it('drops a beat that would overlap the previous one', () => {
    const beats = normalizeBeats([
      { at: 0.4, amplitude: 1 },
      { at: 0.4 + MIN_BEAT_SPACING / 2, amplitude: 1 },
      { at: 0.4 + MIN_BEAT_SPACING, amplitude: 1 },
    ]);
    expect(beats.map((b) => b.at)).toEqual([0.4, 0.4 + MIN_BEAT_SPACING]);
  });

  it('discards non-finite input rather than producing NaN geometry', () => {
    expect(normalizeBeats([{ at: NaN, amplitude: 1 }, { at: 0.5, amplitude: Infinity }])).toEqual([]);
  });

  it('is idempotent', () => {
    const once = normalizeBeats(PULSE_RHYTHM);
    expect(normalizeBeats(once)).toEqual(once);
  });
});

describe('beatsAtMarks', () => {
  it('ramps amplitude up across the marks by default', () => {
    const beats = beatsAtMarks([0.2, 0.5, 0.8]);
    expect(beats.map((b) => b.amplitude)).toEqual([0.5, 0.75, 1]);
  });

  it('gives a single mark full amplitude', () => {
    expect(beatsAtMarks([0.5])).toEqual([{ at: 0.5, amplitude: 1 }]);
  });

  it('honours caller-supplied amplitudes and still normalizes', () => {
    const beats = beatsAtMarks([0.8, 0.2], [0.3, 0.9]);
    expect(beats).toEqual([
      { at: 0.2, amplitude: 0.9 },
      { at: 0.8, amplitude: 0.3 },
    ]);
  });
});

describe('pulseTracePoints', () => {
  it('returns nothing before layout', () => {
    expect(trace(PULSE_RHYTHM, 0, HEIGHT)).toEqual([]);
    expect(trace(PULSE_RHYTHM, WIDTH, 0)).toEqual([]);
  });

  it('is strictly x-monotonic — the invariant every UI-thread lookup depends on', () => {
    const points = trace();
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x);
    }
  });

  it('stays strictly monotonic even for a hostile beat list', () => {
    const points = trace([
      { at: 0.5, amplitude: 1 },
      { at: 0.5, amplitude: 1 },
      { at: 0.52, amplitude: 0.3 },
      { at: 0.1, amplitude: 1 },
      { at: 0.99, amplitude: 1 },
    ]);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x);
    }
  });

  it('spans the full width and starts and ends on the baseline', () => {
    const points = trace();
    const baselineY = INSET + (HEIGHT - 2 * INSET) * BASELINE;
    expect(points[0]).toEqual({ x: 0, y: baselineY });
    expect(points[points.length - 1].x).toBe(WIDTH);
    expect(points[points.length - 1].y).toBeCloseTo(baselineY);
  });

  it('keeps every vertex inside the inset box, at the top and at the bottom', () => {
    // The full-amplitude spike reaches exactly the inset at the top; the S-undershoot and every
    // other excursion must stay above the bottom inset — the field's `baselineFraction` and the
    // shape's `sDepth` are tuned together for that, and this is what keeps them honest.
    const points = trace();
    const ys = points.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(INSET);
    expect(Math.max(...ys)).toBeLessThanOrEqual(HEIGHT - INSET);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WIDTH);
    }
  });

  it('puts each R-peak where its beat says, at the height its amplitude says', () => {
    const points = trace();
    const baselineY = INSET + (HEIGHT - 2 * INSET) * BASELINE;
    const roomAbove = (HEIGHT - 2 * INSET) * BASELINE;
    for (const beat of PULSE_RHYTHM) {
      const peak = points.find((p) => Math.abs(p.x - beat.at * WIDTH) < 1e-6);
      expect(peak).toBeDefined();
      expect(peak!.y).toBeCloseTo(baselineY - beat.amplitude * roomAbove);
    }
  });

  it('draws a flat line when there are no beats at all', () => {
    const points = trace([]);
    expect(points).toHaveLength(2);
    expect(points[0].y).toBe(points[1].y);
  });
});

describe('pulseTracePath', () => {
  it('is empty for no points, and a moveto plus linetos otherwise', () => {
    expect(pulseTracePath([])).toBe('');
    const d = pulseTracePath(trace());
    expect(d).toMatch(/^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+)+$/);
    expect(d).not.toContain('NaN');
  });
});

describe('pulseTraceTables', () => {
  it('produces parallel, cumulative tables whose total is the polyline length', () => {
    const points = trace();
    const { xs, ys, arcs, total } = pulseTraceTables(points);
    expect(xs).toHaveLength(points.length);
    expect(ys).toHaveLength(points.length);
    expect(arcs).toHaveLength(points.length);
    expect(arcs[0]).toBe(0);
    for (let i = 1; i < arcs.length; i += 1) expect(arcs[i]).toBeGreaterThan(arcs[i - 1]);
    expect(total).toBe(arcs[arcs.length - 1]);
    // Longer than the width it spans — the spikes are where the extra length lives.
    expect(total).toBeGreaterThan(WIDTH);
  });

  it('packs most of the length into the spikes, which is where the snap comes from', () => {
    // Constant paper speed plus this concentration IS the rhythm: the head idles across the
    // baseline and rips through a complex. If the spikes ever flatten into a gentle wave this
    // assertion is the first thing that notices.
    const points = trace();
    const { xs, arcs, total } = pulseTraceTables(points);
    const peak = PULSE_RHYTHM.reduce((best, beat) => (beat.amplitude > best.amplitude ? beat : best));
    const start = xs.findIndex((x) => x >= (peak.at - 0.02) * WIDTH);
    const end = xs.findIndex((x) => x >= (peak.at + 0.02) * WIDTH);
    const spikeLength = arcs[end] - arcs[start];
    const spikeWidthShare = 0.04;
    expect(spikeLength / total).toBeGreaterThan(spikeWidthShare * 4);
  });
});

describe('scrollProgress', () => {
  it('maps the scrollable range onto 0..1 and clamps overscroll', () => {
    expect(scrollProgress(0, 2000, 800)).toBe(0);
    expect(scrollProgress(600, 2000, 800)).toBeCloseTo(0.5);
    expect(scrollProgress(1200, 2000, 800)).toBe(1);
    expect(scrollProgress(-80, 2000, 800)).toBe(0);
    expect(scrollProgress(1500, 2000, 800)).toBe(1);
  });

  it('reads as fully drawn when there is nothing to scroll', () => {
    expect(scrollProgress(0, 600, 800)).toBe(1);
    expect(scrollProgress(0, 800, 800)).toBe(1);
    expect(scrollProgress(0, 0, 0)).toBe(1);
  });
});
