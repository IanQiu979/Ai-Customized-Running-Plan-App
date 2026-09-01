/**
 * V2.2 design tokens — **"Trailhead"** (captain-approved 2026-09-01, replacing "Instrument &
 * Matter").
 *
 * Source of truth: `docs/design/trailhead-visual-system.md`, which records every hex below
 * together with the contrast ratio it was verified at. Never edit a hex here without re-running
 * that document's contrast table and updating it in the same commit — the standing rule from
 * `CLAUDE.md` carries over unchanged from the previous system.
 *
 * The system in one line: warm paper and espresso ink, one ember-orange accent spent on exactly
 * one action per screen, a thin contour "route line" as the only ornament, and a single
 * deliberate bold exception (the signed-out dusk gradient, `DuskGradient` below).
 *
 * Naming is by role ("surface.base", "text.secondary"), never by appearance ("gray600"), so a
 * future rebrand only ever changes a value, never every call site. That rule is why the accent is
 * `accent.ember`/`accent.onEmber` rather than the old appearance-named `hivis`: the previous name
 * described a high-visibility yellow-green that no longer exists anywhere in the system.
 */

import { Platform, StyleSheet } from 'react-native';

import { EFFORT_LEVELS, EFFORT_ORDINAL, EffortLevel } from '@/lib/planTypes';

// ---------------------------------------------------------------------------------------------
// Color scheme
// ---------------------------------------------------------------------------------------------

export type ColorScheme = 'light' | 'dark';

/**
 * Bases, hairline @ opacity.
 *
 * `hairline` is ink-at-alpha in light mode and chalk-at-alpha in dark mode: the only separator in
 * the app outside the two shadow users (modals/sheets). Trailhead leans on it far harder than the
 * previous system did — grouped rows in Glossary and Settings are hairlines and nothing else.
 */
const hairlineLight = 'rgba(30, 24, 21, 0.10)'; // espresso @ 10%
const hairlineDark = 'rgba(244, 241, 234, 0.12)'; // chalk @ 12%

export const Colors = {
  light: {
    surface: {
      base: '#F4F1EA', // chalk — warm paper, the page canvas
      raised: '#EAE6DC', // cards, rows, inputs, chips, sheets, the tab bar
      overlay: 'rgba(30, 24, 21, 0.55)', // espresso @ 55% — solid modal scrim, never a blur
      /**
       * The dark slab. Paywall's pricing cards are dark in BOTH schemes — that inversion is the
       * whole "premium pricing page" gesture, and a card that quietly turns into ordinary
       * `raised` in dark mode loses it. Pair only with `text.onInverse` / `text.onInverseMuted`.
       */
      inverse: '#1E1815',
    },
    hairline: hairlineLight,
    text: {
      primary: '#241C17', // espresso ink on chalk — 14.85:1
      secondary: '#6A6058', // 5.43:1 on base, 4.92:1 on raised — AA on both
      onInverse: '#F4F1EA', // chalk on surface.inverse — 15.56:1
      onInverseMuted: '#A1968B', // 6.06:1 on surface.inverse
    },
    // The `progress` split (carried over from Ruling 13, 2026-07-10): "disabled" (inert) vs
    // "informative" (quiet but meaningful) are different roles with different contrast floors.
    progress: {
      // Genuinely inert only — a disabled control's own fill. 2.36:1: deliberately below AA,
      // because "you cannot use this" is exactly what it must communicate. Never put text on it.
      disabled: '#A79D92',
      // Meaningful non-decorative state: inactive tab labels/icons, the intake progress hairline,
      // quota pips. Target >=4.5:1 text / >=3:1 non-text against BOTH base and raised, since the
      // tab bar sits on raised. Verified: 5.43:1 on base, 4.92:1 on raised.
      informative: '#6A6058',
    },
    status: {
      error: '#A32E1E', // 6.27:1 against chalk
      success: '#2F6B4F', // 5.58:1 against chalk
    },
    chart: {
      loadLine: '#8A6A3A', // warm bronze — the load curve's stroke
      loadFill: 'rgba(106, 96, 88, 0.12)', // text.secondary @ 12%
    },
    // Derived from `hairline`. Baselines and tick marks reuse `hairline` directly and have no
    // token of their own.
    grid: {
      frame: 'rgba(30, 24, 21, 0.05)', // ~half of hairline's own opacity
      registrationTick: hairlineLight,
      readoutBracket: hairlineLight,
      /** The contour motif's stroke. Heavier than `hairline` — it is a drawn line, not a rule. */
      routeLine: 'rgba(30, 24, 21, 0.28)',
      /**
       * The edge of a `surface.inverse` slab. Chalk-at-alpha in BOTH schemes, unlike `hairline`,
       * and that is the point: the slab is dark in both, so the ordinary light-mode hairline
       * (espresso @ 10%) would be invisible on it.
       *
       * It exists because in dark mode `surface.inverse` measures only 1.09:1 against
       * `surface.base` — the same order as any adjacent-surface pair, but on a card whose entire
       * job is to read as a distinct object. Without a defined edge the Paywall's pricing slabs
       * simply dissolve into the page.
       */
      inverseHairline: hairlineDark,
    },
  },
  dark: {
    surface: {
      base: '#1E1815', // espresso
      raised: '#2A2320', // lighter than base in dark mode
      overlay: 'rgba(30, 24, 21, 0.80)', // espresso @ 80%
      // Deeper than `base`, not lighter: in dark mode the pricing slab still has to read as a
      // distinct, denser object rather than dissolving into the page.
      inverse: '#120E0C',
    },
    hairline: hairlineDark,
    text: {
      primary: '#F4F1EA', // chalk on espresso — 15.56:1
      secondary: '#A1968B', // 6.06:1 on base, 5.33:1 on raised — AA on both
      onInverse: '#F4F1EA', // 17.02:1 on surface.inverse
      onInverseMuted: '#A1968B', // 6.63:1 on surface.inverse
    },
    progress: {
      disabled: '#5C524B', // 2.31:1 — inert only, same rule as light mode
      // Verified: 5.32:1 on base, 4.69:1 on raised. The lighter tab-bar surface is the binding
      // constraint here, exactly as it is in light mode.
      informative: '#968C82',
    },
    status: {
      error: '#E8735A', // 5.88:1 against espresso
      success: '#5CBE96', // 7.74:1 against espresso
    },
    chart: {
      loadLine: '#C4A375', // warm bronze
      loadFill: 'rgba(161, 150, 139, 0.18)', // text.secondary @ 18%
    },
    grid: {
      frame: 'rgba(244, 241, 234, 0.06)', // ~half of hairline's own opacity
      registrationTick: hairlineDark,
      readoutBracket: hairlineDark,
      routeLine: 'rgba(244, 241, 234, 0.32)',
      inverseHairline: hairlineDark, // identical to light mode on purpose — see that comment
    },
  },
} as const;

export type ThemeColors = (typeof Colors)[ColorScheme];

// ---------------------------------------------------------------------------------------------
// The accent — ember orange. ONE forward action per screen, and never in navigation.
//
// Unlike the previous system's accent this is scheme-aware, and it has to be: a single ember that
// clears AA on chalk is too dark to clear it on espresso, and vice versa. `onEmber` is the only
// legal text/icon color on an ember fill in its own scheme.
// ---------------------------------------------------------------------------------------------

export const Accent = {
  light: {
    /** The screen's single primary forward-action. Nothing else. 5.06:1 vs chalk. */
    ember: '#B4400E',
    /** The second gradient stop of the primary CTA only. Never standalone, never for text. */
    emberDeep: '#8C2F1B',
    /** Chalk on ember — 5.06:1. */
    onEmber: '#F4F1EA',
  },
  dark: {
    ember: '#E2662E', // 5.16:1 vs espresso
    emberDeep: '#B4400E',
    onEmber: '#1E1815', // espresso on ember — 5.16:1
  },
} as const;

export type ThemeAccent = (typeof Accent)[ColorScheme];

// ---------------------------------------------------------------------------------------------
// The dusk gradient — the ONE deliberate bold exception, and it is scoped to the signed-out
// screens (`(auth)/onboarding`, `sign-in`, `sign-up`). Everything past the session gate is
// paper-and-ink. Theme-invariant on purpose: this hero looks the same at 3pm and 3am, which is
// what makes it read as a cover rather than as a screen.
//
// `stops` runs plum -> ember -> amber, top to bottom. Copy sits in the top 60% of the field,
// where the darkest two stops are: chalk on plum is 14.18:1 and chalk on the ember mid-stop is
// 7.34:1. The amber tail is 3.17:1 against chalk and therefore carries NO text — it is the last
// 15% of the gradient and nothing but the route line crosses it.
// ---------------------------------------------------------------------------------------------

export const DuskGradient = {
  stops: ['#2E1740', '#8C2F1B', '#C8721C'] as const,
  /** Fractional offsets for the three stops above. */
  offsets: [0, 0.55, 1] as const,
  /** Headlines on the dusk field. */
  onDusk: '#F4F1EA',
  /** Supporting copy on the dusk field — 11.43:1 against the plum stop and 5.91:1 against the
   * ember mid-stop, so it clears AA everywhere copy is allowed to sit. */
  onDuskMuted: '#E6D8C6',
  /** The animated route line drawn across the hero. */
  routeLine: 'rgba(244, 241, 234, 0.55)',
  /** The glow that travels the route line as it draws. */
  routeGlow: '#F6C56A',
} as const;

// ---------------------------------------------------------------------------------------------
// The effort scale — a color always means an intensity; it never decorates. `barHeight` is the
// mandatory non-hue accessibility channel: the ramp is monotonic and identical in both schemes.
//
// `EffortLevel`, its render order, and its intensity ordinal are owned by `planTypes.ts` — the
// module both this app and the `generate-plan` edge function import — so this file only ever
// derives from it, never redeclares it.
//
// Trailhead re-tunes all ten hues into the warm palette. Two things drove the values, not taste:
// every hue clears 4:1 against its own base (the previous system's light ramp sat at 3.00–3.06:1,
// with no headroom at all), and no effort hue may collide with `Accent.ember` — a plan ribbon
// full of accent-colored bars would destroy the "one accent per screen" rule the whole system
// rests on. That is why `tempo` is a distinctly browner orange (#A85A12) than ember (#B4400E).
// ---------------------------------------------------------------------------------------------

/** Low to high intensity, in ribbon-render order — `planTypes.ts`'s `EFFORT_LEVELS`, not a
 * second literal array that could drift from it. */
export const EffortOrder: readonly EffortLevel[] = EFFORT_LEVELS;

/**
 * `barHeight` is `0.4 + 0.15 × EFFORT_ORDINAL[level]`: recovery through interval land on exactly
 * 0.4 / 0.55 / 0.7 / 0.85 / 1. Deriving it from `planTypes.ts`'s ordinal, rather than
 * hand-writing each fraction, means a future reorder there fails loudly instead of silently
 * skewing these bar heights out of sync with the colours below.
 */
const barHeightFor = (level: EffortLevel): number => 0.4 + 0.15 * EFFORT_ORDINAL[level];

export const Effort: Record<EffortLevel, { light: string; dark: string; barHeight: number }> = {
  // Ratios are against each scheme's own `surface.base`; the floor for this non-text channel is
  // 3:1 and every value below clears 4:1.
  recovery: { light: '#3E7C8C', dark: '#67AABC', barHeight: barHeightFor('recovery') }, // 4.17 / 6.73
  easy: { light: '#3F7D57', dark: '#5FB183', barHeight: barHeightFor('easy') }, // 4.35 / 6.77
  steady: { light: '#94711A', dark: '#C79B2E', barHeight: barHeightFor('steady') }, // 4.02 / 6.82
  tempo: { light: '#A85A12', dark: '#DD8A3C', barHeight: barHeightFor('tempo') }, // 4.50 / 6.50
  interval: { light: '#992040', dark: '#DE5C7E', barHeight: barHeightFor('interval') }, // 7.06 / 4.96
};

// ---------------------------------------------------------------------------------------------
// Typography — three families, each isolated to its role.
//
// Big Shoulders Display carries display text AND every numeral in the app (pace, distance,
// splits, week counts, prices, the intake stepper). A number inline in Public Sans body copy
// needs its own styled wrapper; RN does not substitute fonts per character range.
// ---------------------------------------------------------------------------------------------

export const FontFamily = {
  /** Display text, and every numeral in the app. */
  display: {
    semiBold: 'BigShoulders_600SemiBold',
    bold: 'BigShoulders_700Bold',
    extraBold: 'BigShoulders_800ExtraBold',
  },
  /** Body copy and UI chrome. */
  body: {
    regular: 'PublicSans_400Regular',
    medium: 'PublicSans_500Medium',
    semiBold: 'PublicSans_600SemiBold',
    bold: 'PublicSans_700Bold',
  },
  /**
   * Pace splits, HR zones, unit labels, week numbers, all-caps field labels — genuinely
   * monospace/tabular.
   *
   * Two weights, not three: Space Mono only ships 400 and 700 (Google publishes no Medium or
   * SemiBold for it). The previous system's `mono.medium` / `mono.semiBold` roles collapse onto
   * these — quiet labels take `regular`, emphatic ones take `bold`. Inventing a `medium` alias
   * that resolved to the same file as `regular` would be a token that lies.
   */
  mono: {
    regular: 'SpaceMono_400Regular',
    bold: 'SpaceMono_700Bold',
  },
} as const;

/**
 * Seven steps: 13 / 15 / 17 / 20 / 24 / 32 / 44.
 *
 * `hero` (44) is new in Trailhead and exists for one reason: Big Shoulders Display is a
 * condensed face with a much smaller optical size than the Barlow Condensed it replaced, so a
 * 32pt screen title no longer carries a screen. It is display-only — never legal on body or mono
 * text, which would simply be oversized rather than emphatic.
 */
export const FontSize = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 44,
} as const;

/**
 * Letter-spacing. Two values, each bound to one role.
 *
 * `display` counteracts Big Shoulders' natural tightness at large sizes; `label` opens up the
 * all-caps mono field labels that carry most of the app's structure. Body copy is never tracked.
 */
export const Tracking = {
  display: -0.4,
  label: 1.1,
} as const;

// ---------------------------------------------------------------------------------------------
// Spacing.
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
// Radius — Trailhead tightens both steps (control 12 -> 10, card 20 -> 16). Paper and ink is a
// flatter, squarer language than the previous system's; a 20pt card radius reads as consumer-app
// softness next to a hairline-ruled pricing table. Still deliberately 6pt apart, not a "two
// values 2px apart" trap.
// ---------------------------------------------------------------------------------------------

export const Radius = {
  /** Buttons, chips, inputs, segmented tracks. */
  control: 10,
  /** Cards, sheets, modals. */
  card: 16,
  /** Tier badges and other true capsules. Never on anything that contains a paragraph. */
  pill: 999,
} as const;

// ---------------------------------------------------------------------------------------------
// Stroke weights. Trailhead is a line-drawing system, so these stopped being incidental and
// became tokens: before this, `1.5` was hardcoded in four components and `1` in three.
// ---------------------------------------------------------------------------------------------

export const Stroke = {
  /** Rules, baselines, row separators — one physical pixel is the whole point. */
  hairline: StyleSheet.hairlineWidth,
  /** Input and secondary-button borders. */
  thin: 1,
  /** Icons, chevrons, the route line, the locked-field dash — a glyph should weigh the same on
   * every device, so this is a fixed 1.5 rather than a hairline. */
  mark: 1.5,
} as const;

// ---------------------------------------------------------------------------------------------
// Motion.
// Springs are recorded as the design-specified damping ratio (0 = undamped, 1 = critically
// damped) rather than a platform spring config — callers translate this into Reanimated's
// `withSpring` parameters.
// ---------------------------------------------------------------------------------------------

export const Motion = {
  duration: {
    instant: 100, // press feedback
    quick: 180, // state crossfades, toggles
    standard: 250, // the default; entrances
    slow: 350, // full-screen pushes
    /** RESERVED — the route line's one-time stroke-draw, and nothing else. */
    reveal: 650,
    /**
     * RESERVED — the one-way period of the auth hero's settled ambient glow (yoyo cycle).
     *
     * This is the single sanctioned exception to "if nothing is happening, nothing moves", and it
     * is scoped tightly: opacity only, on the dusk hero's route line only, never on a paper-and-
     * ink screen. Unlike the previous system's ambient pulse this one has no contrast floor to
     * negotiate — it glows a light stroke against a dark gradient that carries no text where the
     * stroke travels — which is why there is no longer an `AmbientPulseFloor` token.
     */
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
// Interaction. Every `Pressable` in the app dims to the same opacity on press.
// ---------------------------------------------------------------------------------------------

export const PressedOpacity = 0.7;

/**
 * The opacity a locked/teaser surface is dimmed to — the Free-tier Notes field and the blurred
 * plan-content teaser on Home.
 *
 * It is NOT `PressedOpacity` wearing a second hat: press feedback is a 100ms transient on a live
 * control, this is the resting state of something the runner cannot use. Deliberately shallow, so
 * the teaser still reads as real content worth paying for rather than as a rendering failure, and
 * applied only to surfaces whose text is decorative — never to text a runner must actually read.
 */
export const LockedOpacity = 0.45;

// ---------------------------------------------------------------------------------------------
// Layout constants.
// ---------------------------------------------------------------------------------------------

/**
 * PARKED — deliberately uncalled.
 *
 * This models the height of a tab bar that *floats over* screen content — the case where a screen
 * must pad its own bottom because nothing else reserves that space. `src/app/(tabs)/_layout.tsx`
 * sets no `position: 'absolute'` on `tabBarStyle`, so React Navigation lays the bar out in normal
 * flow and the bar applies the bottom safe-area inset itself. A tab screen's viewport therefore
 * already ends where the tab bar begins: padding it by this constant adds trailing void, not
 * clearance.
 *
 * It becomes correct — and should be applied to every scrolling tab screen at once — the day
 * `tabBarStyle` goes `position: 'absolute'`.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Binds only on iPad/tablet/resizable web — invisible on every phone (360–430pt). */
export const MaxContentWidth = 800;
