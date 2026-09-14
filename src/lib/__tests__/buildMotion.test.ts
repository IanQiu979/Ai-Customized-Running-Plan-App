import {
  CUE_DELAY,
  HERO_TIMELINE,
  MARK_TIMELINE,
  PLAN_HERO_TIMELINE,
  SNAP_OVERSHOOT,
  SNAP_RISE_SHARE,
  SNAP_SECONDS,
  STEP_TIMELINE,
  SURVEY_TIMELINE,
  draw,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  easeOutQuart,
  enter,
  move,
  snap,
  snapLandsAt,
  timelineFrom,
} from '../buildMotion';

/**
 * The build vocabulary is a port of the approved pages' own runtime. These tests pin the shape
 * of each primitive (endpoints, monotonicity, the one overshoot) and the cue tables the pages
 * were authored with — the numbers a visual-match pass compares against.
 */

describe('easing', () => {
  it.each([easeOutQuart, easeOutCubic, easeInOutCubic, easeInOutSine])(
    '%p maps 0 → 0 and 1 → 1 and never leaves the unit interval',
    (ease) => {
      expect(ease(0)).toBeCloseTo(0, 9);
      expect(ease(1)).toBeCloseTo(1, 9);
      let previous = 0;
      for (let i = 1; i <= 100; i += 1) {
        const value = ease(i / 100);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
        expect(value).toBeLessThanOrEqual(1 + 1e-12);
        previous = value;
      }
    }
  );

  it('ease-out curves arrive fast and settle slow', () => {
    expect(easeOutQuart(0.5)).toBeGreaterThan(0.9);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.85);
  });
});

describe('the three primitives', () => {
  it('enter is 0 before its start, 1 after its end, and eased between', () => {
    expect(enter(0.1, 0.2, 0.4)).toBe(0);
    expect(enter(0.6, 0.2, 0.4)).toBe(1);
    expect(enter(5, 0.2, 0.4)).toBe(1);
    expect(enter(0.4, 0.2, 0.4)).toBeCloseTo(easeOutQuart(0.5), 9);
  });

  it('draw is linear — a baseline drawing must not lie about pace', () => {
    expect(draw(0.3, 0.2, 0.4)).toBeCloseTo(0.25, 9);
    expect(draw(0.4, 0.2, 0.4)).toBeCloseTo(0.5, 9);
    expect(draw(0.5, 0.2, 0.4)).toBeCloseTo(0.75, 9);
    expect(draw(-1, 0.2, 0.4)).toBe(0);
    expect(draw(9, 0.2, 0.4)).toBe(1);
  });

  it('move is symmetric ease-in-out', () => {
    expect(move(0.5, 0, 1)).toBeCloseTo(0.5, 9);
    expect(move(0.25, 0, 1) + move(0.75, 0, 1)).toBeCloseTo(1, 9);
  });
});

describe('snap — 350 ms rise, 3% settle, one overshoot and no bounce', () => {
  it('rests at 0 before the start and at exactly 1 after 350 ms', () => {
    expect(snap(0.9, 1)).toBe(0);
    expect(snap(1 + SNAP_SECONDS, 1)).toBeCloseTo(1, 9);
    expect(snap(9, 1)).toBeCloseTo(1, 9);
  });

  it('peaks at the overshoot exactly when the rise hands over to the settle', () => {
    const peakAt = 1 + SNAP_SECONDS * SNAP_RISE_SHARE;
    expect(snap(peakAt, 1)).toBeCloseTo(SNAP_OVERSHOOT, 9);
    expect(snapLandsAt(1)).toBeCloseTo(peakAt, 9);
    // Rising monotonically up to the peak...
    let previous = 0;
    for (let t = 1; t <= peakAt; t += 0.005) {
      const value = snap(t, 1);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
    // ...and easing back down monotonically after it: no second bounce.
    previous = SNAP_OVERSHOOT;
    for (let t = peakAt; t <= 1 + SNAP_SECONDS; t += 0.005) {
      const value = snap(t, 1);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      expect(value).toBeGreaterThanOrEqual(1 - 1e-9);
      previous = value;
    }
  });
});

describe('cue tables — the pages’ authored timelines', () => {
  it('resolves each section to the running sum of the ones before it', () => {
    const { cues, total } = timelineFrom([
      { name: 'A', dur: 0.4 },
      { name: 'B', dur: 1.4 },
      { name: 'C', dur: 0.2 },
    ] as const);
    expect(cues).toEqual({ A: 0, B: 0.4, C: 1.8 });
    expect(total).toBe(2);
  });

  it('V22-01: build for 3.0 s, hold 2.2 s, cue at hold + 0.8', () => {
    expect(HERO_TIMELINE.cues).toEqual({ Outline: 0, Blocks: 0.4, Weeks: 1.8, Settle: 2.6, Hold: 3 });
    expect(HERO_TIMELINE.total).toBe(5.2);
    expect(HERO_TIMELINE.cues.Hold + CUE_DELAY).toBe(3.8);
  });

  it('V22-02: four 2.4 s steps', () => {
    expect(STEP_TIMELINE.cues).toEqual({ Intake: 0, Engine: 2.4, Plan: 4.8, GetStarted: 7.2 });
    expect(STEP_TIMELINE.total).toBe(9.6);
  });

  it('V22-03: 2.3 s of build then a 2.2 s hold', () => {
    expect(SURVEY_TIMELINE.cues).toEqual({ Outline: 0, Blocks: 0.4, Weeks: 1.4, Hold: 2.3 });
    expect(SURVEY_TIMELINE.total).toBe(4.5);
  });

  it('V22-04: a 0.6 s fill', () => {
    expect(MARK_TIMELINE.cues).toEqual({ Fill: 0, Hold: 0.6 });
    expect(MARK_TIMELINE.total).toBe(2.6);
  });

  it('V22-05: 2.0 s of build then a 2.0 s hold', () => {
    expect(PLAN_HERO_TIMELINE.cues).toEqual({ Outline: 0, Blocks: 0.4, Weeks: 1.5, Hold: 2 });
    expect(PLAN_HERO_TIMELINE.total).toBe(4);
  });
});
