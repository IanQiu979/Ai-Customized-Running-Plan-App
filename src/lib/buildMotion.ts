/**
 * The build animations' shared vocabulary — "the plan builds itself" (design spec §B.0,
 * 2026-09-12; approved V22 pages, 2026-09-13). Every animation in V2.2 is the same idea at a
 * different scale: an empty strip → blocks and numbers snap into place → a finished plan.
 *
 * This module is a straight port of the pages' own runtime (`v22-0N-scene.jsx`,
 * `animations-v3.jsx` in the handoff): the easing functions, the three motion primitives, the
 * snap curve, and each page's cue table. The numbers are the pages' numbers — change them here
 * and the build stops matching what the captain approved.
 *
 * Everything is a pure function of `T`, the composition's master clock in SECONDS, exactly as the
 * pages are written. A component owns one shared value for `T` (see `useBuildClock`) and derives
 * every opacity, height and translate from it on the UI thread, so the whole choreography stays
 * a table lookup off one number rather than a tree of chained timers. Every function here is a
 * worklet so it can be called from `useAnimatedStyle`; each is also plain JS, so the tests run
 * them directly.
 *
 * Pure: no React, no Reanimated import, no Node. Shared-vocabulary style, like `planTypes.ts`.
 */

// --- Easing (animations-v3.jsx `Easing`) -----------------------------------------------------

export function clamp01(value: number): number {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function easeOutQuart(t: number): number {
  'worklet';
  const u = t - 1;
  return 1 - u * u * u * u;
}

export function easeOutCubic(t: number): number {
  'worklet';
  const u = t - 1;
  return u * u * u + 1;
}

export function easeInOutCubic(t: number): number {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export function easeInOutSine(t: number): number {
  'worklet';
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// --- The three primitives every page composes with -------------------------------------------

/** Something arriving: ease-out over `duration` seconds from `start`. 0 before, 1 after. */
export function enter(T: number, start: number, duration: number): number {
  'worklet';
  return easeOutQuart(clamp01((T - start) / duration));
}

/** Linear progress — a baseline drawing, a number counting, an outline tracing. */
export function draw(T: number, start: number, duration: number): number {
  'worklet';
  return clamp01((T - start) / duration);
}

/** Something moving from one place to another: ease-in-out. */
export function move(T: number, start: number, duration: number): number {
  'worklet';
  return easeInOutCubic(clamp01((T - start) / duration));
}

/** A snap lasts 350 ms (the sheet: "snap = 350 ms rise, 3 % settle"). */
export const SNAP_SECONDS = 0.35;
/** The rise takes 72% of the snap and overshoots to 1.03; the remaining 28% settles back to 1. */
export const SNAP_RISE_SHARE = 0.72;
export const SNAP_OVERSHOOT = 1.03;

/**
 * A block snapping into its slot: 0 → 1.03 → 1, one settle, never a second bounce. The pages
 * apply it to a bar's height (scale from the baseline), so the overshoot reads as the bar
 * landing rather than as a spring.
 */
export function snap(T: number, start: number): number {
  'worklet';
  const p = clamp01((T - start) / SNAP_SECONDS);
  if (p < SNAP_RISE_SHARE) return SNAP_OVERSHOOT * easeOutCubic(p / SNAP_RISE_SHARE);
  return (
    SNAP_OVERSHOOT -
    (SNAP_OVERSHOOT - 1) * easeInOutSine((p - SNAP_RISE_SHARE) / (1 - SNAP_RISE_SHARE))
  );
}

/** The instant a snapping block has finished rising and its number may land on the total. */
export function snapLandsAt(start: number): number {
  'worklet';
  return start + SNAP_SECONDS * SNAP_RISE_SHARE;
}

/** How long a landed block's kilometres take to tick onto the running total. */
export const TICK_SECONDS = 0.15;

// --- Cue tables ------------------------------------------------------------------------------

/** One authored section of a page's timeline (`window.OM_SCENES`): a name and a duration. */
export interface Scene {
  name: string;
  /** Seconds. */
  dur: number;
}

/** A page's timeline resolved to absolute starts: `cues[name]` is that section's start, and
 * `total` the authored end, in seconds. */
export interface Timeline<Name extends string> {
  cues: Record<Name, number>;
  total: number;
}

/**
 * Resolves a scene list to cue starts the way the pages' `useComposition()` does: each section
 * starts where the previous one ended, and the authored total is the running sum.
 */
export function timelineFrom<Name extends string>(
  scenes: readonly (Scene & { name: Name })[]
): Timeline<Name> {
  const cues = {} as Record<Name, number>;
  let at = 0;
  for (const scene of scenes) {
    cues[scene.name] = round3(at);
    at += scene.dur;
  }
  return { cues, total: round3(at) };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** V22-01 Main onboarding animation. 3.0 s of build, then a 2.2 s hold on the end frame. */
export const HERO_SCENES = [
  { name: 'Outline', dur: 0.4 },
  { name: 'Blocks', dur: 1.4 },
  { name: 'Weeks', dur: 0.8 },
  { name: 'Settle', dur: 0.4 },
  { name: 'Hold', dur: 2.2 },
] as const;
export const HERO_TIMELINE = timelineFrom(HERO_SCENES);
/** Blocks snap in one per 220 ms on the hero (the page's `PER`). */
export const HERO_BLOCK_STAGGER = 0.22;
/** The Continue cue appears 0.8 s into the hold, never over moving content (spec §0). */
export const CUE_DELAY = 0.8;

/** V22-02 Step animations. Each step piece is authored on its own 0-based clock; the page shows
 * them back to back with 2.4 s per step, of which the motion is ≤ 1.5 s and the rest a hold. */
export const STEP_SECONDS = 2.4;
export const STEP_SCENES = [
  { name: 'Intake', dur: STEP_SECONDS },
  { name: 'Engine', dur: STEP_SECONDS },
  { name: 'Plan', dur: STEP_SECONDS },
  { name: 'GetStarted', dur: STEP_SECONDS },
] as const;
export const STEP_TIMELINE = timelineFrom(STEP_SCENES);

/** V22-03 Survey intro. Week 1 builds, weeks 2–6 stack below, PRESS TO CONTINUE at hold + 0.8. */
export const SURVEY_SCENES = [
  { name: 'Outline', dur: 0.4 },
  { name: 'Blocks', dur: 1.0 },
  { name: 'Weeks', dur: 0.9 },
  { name: 'Hold', dur: 2.2 },
] as const;
export const SURVEY_TIMELINE = timelineFrom(SURVEY_SCENES);
export const SURVEY_BLOCK_STAGGER = 0.2;

/** V22-04 Home header mark. Completed days fill left to right in 0.6 s, then hold. */
export const MARK_SCENES = [
  { name: 'Fill', dur: 0.6 },
  { name: 'Hold', dur: 2.0 },
] as const;
export const MARK_TIMELINE = timelineFrom(MARK_SCENES);
/** Each filled cell rises over 300 ms, 70 ms after the one before it. */
export const MARK_CELL_STAGGER = 0.07;
export const MARK_CELL_RISE = 0.3;

/** V22-05 My Plans hero. The real first week builds in 2.0 s; Open plan and the list fade in on
 * the hold. */
export const PLAN_HERO_SCENES = [
  { name: 'Outline', dur: 0.4 },
  { name: 'Blocks', dur: 1.1 },
  { name: 'Weeks', dur: 0.5 },
  { name: 'Hold', dur: 2.0 },
] as const;
export const PLAN_HERO_TIMELINE = timelineFrom(PLAN_HERO_SCENES);
export const PLAN_HERO_BLOCK_STAGGER = 0.18;

/** The baseline of every strip draws left to right in 0.4 s. */
export const OUTLINE_SECONDS = 0.4;
/** Day numerals under a strip fade in 50 ms apart, each over 0.3 s. */
export const NUMERAL_STAGGER = 0.05;
export const NUMERAL_FADE = 0.3;
