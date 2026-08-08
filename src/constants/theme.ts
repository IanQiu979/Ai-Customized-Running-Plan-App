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

import { EFFORT_LEVELS, EFFORT_ORDINAL, EffortLevel } from '@/lib/planTypes';

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
//
// `EffortLevel`, its render order, and its intensity ordinal are owned by `planTypes.ts` — the
// module both this app and the `generate-plan` edge function import — so this file only ever
// derives from it, never redeclares it. Before this (issue #32 finding 4), the level, its order,
// and its ordinal were each duplicated here, and a reorder in one could silently desync the
// others.
// ---------------------------------------------------------------------------------------------

/** Low to high intensity, in ribbon-render order — `planTypes.ts`'s `EFFORT_LEVELS`, not a
 * second literal array that could drift from it. */
export const EffortOrder: readonly EffortLevel[] = EFFORT_LEVELS;

/**
 * `barHeight` is `0.4 + 0.15 × EFFORT_ORDINAL[level]`: recovery through interval land on exactly
 * 0.4 / 0.55 / 0.7 / 0.85 / 1, the ramp `frontend-design-brief.md` Part 2 records. Deriving it
 * from `planTypes.ts`'s ordinal, rather than hand-writing each fraction, means a future reorder
 * there fails loudly instead of silently skewing these bar heights out of sync with the colours
 * below.
 */
const barHeightFor = (level: EffortLevel): number => 0.4 + 0.15 * EFFORT_ORDINAL[level];

export const Effort: Record<EffortLevel, { light: string; dark: string; barHeight: number }> = {
  recovery: { dark: '#6FA8C9', light: '#5196BE', barHeight: barHeightFor('recovery') },
  easy: { dark: '#4FA97E', light: '#4A9F76', barHeight: barHeightFor('easy') },
  steady: { dark: '#C9A227', light: '#AB8A21', barHeight: barHeightFor('steady') },
  tempo: { dark: '#D9772B', light: '#D87427', barHeight: barHeightFor('tempo') },
  interval: { dark: '#C6402F', light: '#C6402F', barHeight: barHeightFor('interval') },
};

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
// Motion — brief Part 4 / mvp-blueprint Part 5. Eleven values total; `reveal` and `ambient` are
// each reserved to their one named use and must never be reused elsewhere.
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
    // RESERVED — the one-way period of the onboarding hero ribbon's settled ambient opacity
    // pulse (yoyo cycle), the same way `reveal` above is reserved to the wave's stroke-draw: it
    // must never become a generic "make it feel alive" duration elsewhere. A genuine addition,
    // not a reuse — every duration above is a sub-350ms response to an event; this is a loop
    // period, a different kind of quantity, and none of the other nine fit it without either
    // making the shimmer frantic or silently redefining what that token means.
    // This is also the single sanctioned exception to mvp-blueprint.md Part 1's manifesto, which
    // bans "idle floating", "ambient looping", and "breathing gradients" ("if nothing is
    // happening, nothing moves"). The exception is scoped tightly: opacity only, all cells in
    // phase (never a travelling sweep — that's loading-skeleton vocabulary), amplitude capped
    // per color scheme — see `AmbientPulseFloor` below, which is where the actual floor values
    // and the contrast math behind them live.
    ambient: 2800,
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
// Interaction — issue #32 finding 3. Every `Pressable` in the app dims to the same opacity on
// press; before this token, `index.tsx` and `WeekAccordion.tsx` each hardcoded their own `0.7`.
// `Motion.duration.instant` is reserved for animating this transition once Phase 6 wires real
// press-in/press-out springs — until then it's a flat, unanimated opacity swap.
// ---------------------------------------------------------------------------------------------

export const PressedOpacity = 0.7;

// ---------------------------------------------------------------------------------------------
// Ambient pulse floor — accessibility-reviewer finding 1 (onboarding hero ribbon, 2026-08-08).
// `PressedOpacity` (0.7) is safe as the settled ambient pulse's trough in dark mode — worst case
// there is dark `recovery` at 4.04:1 against `Colors.dark.surface.base`, still clear of the
// brief's 3:1 floor for this channel — but it is NOT safe in light mode. Verified with the
// standard WCAG relative-luminance formula against the actual hexes (`Effort[level].light`,
// alpha-blended toward `Colors.light.surface.base`, vs. that same base):
//   recovery 3.03:1 full -> 2.10:1 at .7   easy   3.00:1 full -> 2.10:1 at .7
//   steady   3.06:1 full -> 2.11:1 at .7   tempo  3.03:1 full -> 2.15:1 at .7
//   interval 4.69:1 full -> 2.94:1 at .7
// Four of the five light-mode efforts are already only barely above 3:1 AT FULL OPACITY (`easy`
// the tightest, 3.0045:1 with zero pulse at all) — there is essentially no contrast headroom
// left for a shared opacity dip. `easy` needs alpha >= 0.9988 to hold 3:1; 0.999 is the smallest
// floor that clears every light-mode effort with a hair of margin (0.999 -> easy 3.001:1,
// recovery 3.027:1, steady 3.059:1, tempo 3.031:1, interval 4.679:1). The resulting light-mode
// pulse is barely perceptible by design — that thinness is inherent to how close these five
// hexes already sit to the floor, not something this token can fix. A genuinely visible light-
// mode pulse would need `design-system` to revisit the light effort hexes for more headroom.
export const AmbientPulseFloor = {
  light: 0.999,
  dark: PressedOpacity,
} as const;

// ---------------------------------------------------------------------------------------------
// Layout constants.
// ---------------------------------------------------------------------------------------------

/**
 * PARKED — deliberately uncalled, and not to be given a call site until the condition below is
 * met (issue #32 finding 8, which asked "use it or fix the comment"; this is the "fix the
 * comment" half, and the reason).
 *
 * This models the height of a tab bar that *floats over* screen content — the case where a
 * screen must pad its own bottom because nothing else reserves that space. That tab bar was
 * never built. `src/app/(tabs)/_layout.tsx` sets no `position: 'absolute'` on `tabBarStyle`, so
 * React Navigation lays the bar out **in normal flow**, as a sibling below the screen container,
 * and the bar applies the bottom safe-area inset itself. A tab screen's viewport therefore
 * already ends where the tab bar begins: padding it by this constant adds trailing void, not
 * clearance — the "floating dead gap" `frontend-design-brief.md` Part 8 warns about.
 *
 * It becomes correct — and should be applied to every scrolling tab screen at once — the day
 * `tabBarStyle` goes `position: 'absolute'`. Until then, a tab screen's bottom padding is an
 * ordinary `Spacing` value like any other.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Binds only on iPad/tablet/resizable web — invisible on every phone (360–430pt). Phone-only
 * v1 (decision 12, 2026-07-10) makes this dead weight until v2, per the brief. */
export const MaxContentWidth = 800;
