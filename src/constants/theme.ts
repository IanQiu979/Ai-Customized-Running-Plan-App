/**
 * V2.2 design tokens — "Instrument & Matter".
 *
 * Source of truth: `docs/design/frontend-design-brief.md` Part 2 (contrast-verified color
 * values — never edit a hex here without re-verifying contrast and updating that doc) and
 * `docs/design/mvp-blueprint.md` Part 2 (the `grid.*` measurement tokens) and Part 5 (motion).
 *
 * Every value below is either lifted verbatim from the brief, or — where the brief explicitly
 * flagged a value as an unresolved defect — computed here to the contrast target the brief
 * specified. Those two cases are documented individually below; nothing is guessed.
 *
 * Naming is by role ("surface.base", "text.secondary"), never by appearance ("gray600"), so a
 * future rebrand only ever changes a value, never every call site.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------------------------
// Color scheme
// ---------------------------------------------------------------------------------------------

export type ColorScheme = 'light' | 'dark';

/**
 * Bases, hairline @ opacity — brief Part 2 "Bases and text" + "Supporting tokens".
 *
 * `hairline` is asphalt-at-alpha in light mode and chalk-at-alpha in dark mode: the only
 * separator in the app outside the two shadow users (modals/sheets).
 */
const hairlineLight = 'rgba(20, 23, 28, 0.10)'; // asphalt @ 10%
const hairlineDark = 'rgba(247, 247, 244, 0.12)'; // chalk @ 12%

export const Colors = {
  light: {
    surface: {
      base: '#F7F7F4', // chalk — the page canvas
      raised: '#EDEDE8', // cards, rows, inputs, chips, sheets — darker than base in light mode
      overlay: 'rgba(20, 23, 28, 0.55)', // asphalt @ 55% — solid modal scrim, never a blur
    },
    hairline: hairlineLight,
    text: {
      primary: '#14171C', // asphalt on chalk — 16.74:1
      // graphite on chalk — 5.91:1 (passes AA). The brief's recorded value is correct as-is
      // for light mode; only dark mode needed a lift (see below).
      secondary: '#5A6069',
    },
    // color.progress split (Ruling 13, 2026-07-10): "disabled" (inert) vs "informative"
    // (meaningful but quiet) are different roles and were failing contrast in the second one.
    progress: {
      disabled: '#8D93A0', // original single value — kept for genuinely inert states only
      // COMPUTED — the brief left this "Exact hex TBD when design-system implements theme.ts;
      // record the contrast targets, not a guessed value." Target: >=4.5:1 for text (inactive
      // quota captions), >=3:1 for meaningful non-text (intake progress-hairline fill, active
      // quota pips), against surface.base (#F7F7F4). Same hue/saturation family as the original
      // progress value, lightness lowered until AA text-contrast cleared.
      // Verified: #676D7B on #F7F7F4 = 4.83:1.
      informative: '#676D7B',
    },
    status: {
      error: '#AB214F', // 6.39:1 against chalk
      success: '#206F6C', // 5.51:1 against chalk
    },
    chart: {
      loadLine: '#745E3E', // desaturated bronze
      loadFill: 'rgba(90, 96, 105, 0.12)', // graphite @ 12%
    },
    // The three tokens Part 2 of the blueprint derives from `hairline`. Baselines and tick
    // marks reuse `hairline` directly per that doc and have no token of their own.
    grid: {
      frame: 'rgba(20, 23, 28, 0.05)', // ~half of hairline's own opacity
      registrationTick: hairlineLight,
      readoutBracket: hairlineLight,
    },
  },
  dark: {
    surface: {
      base: '#14171C', // asphalt
      raised: '#1D2128', // lighter than base in dark mode
      overlay: 'rgba(20, 23, 28, 0.80)', // asphalt @ 80%
    },
    hairline: hairlineDark,
    text: {
      primary: '#F7F7F4', // chalk on asphalt — 16.74:1
      // COMPUTED — "verified defect": graphite on asphalt measures 2.83:1 (fails AA). The brief
      // mandates a lifted dark-mode value at >=4.5:1, "not optional... four screens are pinned
      // dark and a user cannot escape it." Same hue/saturation family as graphite, lightness
      // raised until AA text-contrast cleared against asphalt (#14171C).
      // Verified: #7E8590 on #14171C = 4.83:1.
      secondary: '#7E8590',
    },
    progress: {
      disabled: '#4B5561', // original single value — kept for genuinely inert states only
      // COMPUTED — same brief instruction as the light-mode value above. Target: >=4.5:1 text
      // (inactive tab labels — the original value measured 2.13:1 here), >=3:1 non-text, against
      // surface.base (#14171C). Same hue/saturation family as the original progress value.
      // Verified: #788696 on #14171C = 4.83:1.
      informative: '#788696',
    },
    status: {
      error: '#DE5482', // 4.87:1 against asphalt
      success: '#37BEB9', // 7.89:1 against asphalt
    },
    chart: {
      loadLine: '#BCA98F', // desaturated bronze
      loadFill: 'rgba(90, 96, 105, 0.18)', // graphite @ 18%
    },
    grid: {
      frame: 'rgba(247, 247, 244, 0.06)', // ~half of hairline's own opacity
      registrationTick: hairlineDark,
      readoutBracket: hairlineDark,
    },
  },
} as const;

export type ThemeColors = (typeof Colors)[ColorScheme];

// ---------------------------------------------------------------------------------------------
// The effort scale — brief Part 2 "The effort scale". A color always means an intensity; it
// never decorates. `barHeight` is the mandatory non-hue accessibility channel (Part 7 #1): the
// bar-height ramp is monotonic and identical in both color schemes.
// ---------------------------------------------------------------------------------------------

export type EffortLevel = 'recovery' | 'easy' | 'steady' | 'tempo' | 'interval';

/** Low to high intensity, in ribbon-render order. */
export const EffortOrder: readonly EffortLevel[] = ['recovery', 'easy', 'steady', 'tempo', 'interval'];

export const Effort: Record<EffortLevel, { light: string; dark: string; barHeight: number }> = {
  recovery: { dark: '#6FA8C9', light: '#5196BE', barHeight: 0.4 },
  easy: { dark: '#4FA97E', light: '#4A9F76', barHeight: 0.55 },
  steady: { dark: '#C9A227', light: '#AB8A21', barHeight: 0.7 },
  tempo: { dark: '#D9772B', light: '#D87427', barHeight: 0.85 },
  interval: { dark: '#C6402F', light: '#C6402F', barHeight: 1 },
} as const;

// ---------------------------------------------------------------------------------------------
// The accent — brief Part 2 "The accent". Theme-invariant: hivis means the same thing whether
// the screen is light or dark, so it is never nested under `Colors`.
// ---------------------------------------------------------------------------------------------

export const Accent = {
  /** The single primary forward-action of whatever screen you're on. Nothing else. */
  hivis: '#D8F14A',
  /** The second gradient stop of the primary CTA only. Never standalone, never for text. */
  hivisDeep: '#BBD911',
  /** The only legal text/icon color on a hivis fill — asphalt, 14.20:1, both schemes. */
  onAccent: '#14171C',
} as const;

// ---------------------------------------------------------------------------------------------
// Typography — brief Part 2 "Type". Six fixed steps; three families, each isolated to its role.
// Barlow Condensed carries display text AND every numeral in the app (pace, distance, splits,
// week counts, prices, the intake stepper) — a number inline in Inter body copy needs its own
// styled wrapper; RN does not substitute fonts per character range.
// ---------------------------------------------------------------------------------------------

export const FontFamily = {
  /** Display text, and every numeral in the app. */
  display: {
    semiBold: 'BarlowCondensed_600SemiBold',
    bold: 'BarlowCondensed_700Bold',
    extraBold: 'BarlowCondensed_800ExtraBold',
  },
  /** Body copy and UI chrome. */
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  /** Pace splits, HR zones, unit labels, ribbon week numbers — genuinely monospace/tabular. */
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
    semiBold: 'IBMPlexMono_600SemiBold',
  },
} as const;

/** The six fixed steps from the brief: 32 / 24 / 20 / 17 / 15 / 13. */
export const FontSize = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

// ---------------------------------------------------------------------------------------------
// Spacing — brief Part 2 "Spacing, radii, depth". `48` inserted between the old `five` (32) and
// `six` (64): the ramp decelerated (×1.5, then ×1.33) then jumped ×2 with no "large section gap"
// step. The old `six` (64) is renamed `seven`; nothing in the app still references the old name
// (its only two call sites were in `src/app/explore.tsx`, deleted in this same change).
// ---------------------------------------------------------------------------------------------

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
  seven: 64,
} as const;

// ---------------------------------------------------------------------------------------------
// Radius — brief Part 2. Deliberately 8px apart, not a "two values 2px apart" trap.
// ---------------------------------------------------------------------------------------------

export const Radius = {
  /** Buttons, chips, inputs, segmented tracks. */
  control: 12,
  /** Cards, sheets, modals. */
  card: 20,
} as const;

// ---------------------------------------------------------------------------------------------
// Motion — brief Part 4 / mvp-blueprint Part 5. Ten values total; `reveal` is reserved
// exclusively for the wave's one-time stroke-draw and must never be reused elsewhere.
// Springs are recorded as the design-specified damping ratio (0 = undamped, 1 = critically
// damped) rather than a platform spring config — the motion implementation translates this into
// Reanimated's `withSpring` parameters when it lands (Phase 6).
// ---------------------------------------------------------------------------------------------

export const Motion = {
  duration: {
    instant: 100, // press feedback
    quick: 180, // state crossfades, toggles
    standard: 250, // the default; entrances
    slow: 350, // full-screen pushes
    reveal: 650, // RESERVED — the wave's one-time stroke-draw only
  },
  curve: {
    /** Anything arriving. Cubic-bezier control points. */
    easeOut: [0, 0, 0.2, 1],
    /** Anything leaving. */
    easeIn: [0.4, 0, 1, 1],
    /** Progress hairlines and quota fills ONLY — an eased progress bar lies about pace. */
    linear: [0, 0, 1, 1],
  },
  spring: {
    /** Direct manipulation, the reveal bounce — damping ≈0.6, one crisp overshoot. */
    snappy: { dampingRatio: 0.6 },
    /** Accordions, sheet arrivals — damping ≈0.85, no meaningful overshoot. */
    gentle: { dampingRatio: 0.85 },
  },
} as const;

// ---------------------------------------------------------------------------------------------
// Layout constants — unchanged from the template scaffold; still load-bearing (brief Part 8).
// ---------------------------------------------------------------------------------------------

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Binds only on iPad/tablet/resizable web — invisible on every phone (360–430pt). Phone-only
 * v1 (decision 12, 2026-07-10) makes this dead weight until v2, per the brief. */
export const MaxContentWidth = 800;
