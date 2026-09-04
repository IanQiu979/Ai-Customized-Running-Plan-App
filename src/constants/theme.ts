/**
 * V2.2 design tokens — **"Instrument"** (captain-approved 2026-09-03, replacing "Trailhead").
 *
 * Source of truth: `docs/design/instrument-visual-system.md`, which records every hex below
 * together with the contrast ratio it was verified at. The *floors* behind those ratios are
 * enforced rather than merely documented: `src/constants/__tests__/theme.contrast.test.ts`
 * recomputes each ratio from the hexes in this file and asserts it against its floor (and, for
 * the values that are deliberately sub-floor, against its ceiling), so a hex edited into
 * illegibility fails the suite instead of shipping. It does NOT pin the exact documented numbers,
 * on purpose — that would make every legitimate re-tune a test edit. Re-running the table and
 * updating the comments below is still a human step, and still the standing rule in `CLAUDE.md`.
 * That test is what issue #70 ("light-mode effort hexes have no contrast headroom") was missing.
 *
 * The system in one line: a near-monochrome, cool-scientific field — white and graphite in light
 * mode, deep charcoal in dark — carrying every button, rule and piece of chrome in near-black,
 * with ONE much brighter highlight (icy cyan, locked) spent on exactly one call-to-action per
 * screen and on the onboarding pulse trace, and nowhere else.
 *
 * Naming is by role ("surface.base", "text.secondary"), never by appearance ("gray600"), so a
 * future rebrand only ever changes a value, never every call site. That rule is why the accent is
 * `accent.field`/`accent.signal` rather than the outgoing appearance-named `ember`/`onEmber`: the
 * previous names described a warm orange that no longer exists anywhere in the system, and the
 * new pair describes what the two colours *do* — a near-black slab, and the one bright mark on it.
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
 * `hairline` is graphite-at-alpha in light mode and chalk-at-alpha in dark mode: the only
 * separator in the app outside the two shadow users (modals/sheets). Instrument leans on it at
 * least as hard as Trailhead did — with the warm paper gone, hairlines and whitespace are what
 * carry structure.
 */
const hairlineLight = 'rgba(16, 22, 25, 0.10)'; // graphite @ 10%
const hairlineDark = 'rgba(237, 242, 245, 0.12)'; // chalk @ 12%

export const Colors = {
  light: {
    surface: {
      base: '#FFFFFF', // paper white — the page canvas
      raised: '#F0F3F5', // cards, rows, inputs, chips, sheets, the tab bar. Cool, not warm.
      overlay: 'rgba(10, 14, 19, 0.55)', // field @ 55% — solid modal scrim, never a blur
      /**
       * The dark slab. Paywall's pricing cards are dark in BOTH schemes — that inversion is the
       * whole "premium pricing page" gesture, and a card that quietly turns into ordinary
       * `raised` in dark mode loses it. Pair only with `text.onInverse` / `text.onInverseMuted`.
       *
       * Deliberately the SAME near-black as `Accent.field` and as the pulse trace's own field
       * (`constants/pulseTrace.ts`): every dark plane in the app is one plane, so a primary CTA
       * sitting on a pricing slab reads as an inset in it rather than as a second, slightly
       * different black.
       */
      inverse: '#0A0E13',
    },
    hairline: hairlineLight,
    text: {
      primary: '#101619', // graphite on white — 18.25:1
      secondary: '#646F75', // 5.16:1 on base, 4.63:1 on raised — AA on both
      onInverse: '#EDF2F5', // chalk on surface.inverse — 17.16:1
      onInverseMuted: '#8B979D', // 6.46:1 on surface.inverse
    },
    // The `progress` split (carried over from Ruling 13, 2026-07-10): "disabled" (inert) vs
    // "informative" (quiet but meaningful) are different roles with different contrast floors.
    progress: {
      // Genuinely inert only — a disabled control's own fill. 2.39:1: deliberately below AA,
      // because "you cannot use this" is exactly what it must communicate. `text.primary` on it
      // is still 7.63:1, which is what makes a disabled button's *label* readable while the fill
      // itself stays visibly dead.
      disabled: '#9FA9B0',
      // Meaningful non-decorative state: inactive tab labels/icons, the intake progress hairline,
      // quota pips. Target >=4.5:1 text / >=3:1 non-text against BOTH base and raised, since the
      // tab bar sits on raised. Same value as `text.secondary` today; a separate token because
      // the two roles have different floors and will not always move together.
      informative: '#646F75',
    },
    status: {
      error: '#B32318', // 6.62:1 against white
      success: '#20674F', // 6.74:1 against white
    },
    chart: {
      loadLine: '#4A6270', // cool steel — the load curve's stroke (was warm bronze)
      loadFill: 'rgba(100, 111, 117, 0.12)', // text.secondary @ 12%
    },
    // Derived from `hairline`. Baselines and tick marks reuse `hairline` directly and have no
    // token of their own.
    grid: {
      frame: 'rgba(16, 22, 25, 0.05)', // ~half of hairline's own opacity
      registrationTick: hairlineLight,
      readoutBracket: hairlineLight,
      /** The contour motif's stroke. Heavier than `hairline` — it is a drawn line, not a rule. */
      routeLine: 'rgba(16, 22, 25, 0.28)',
      /**
       * The edge of a `surface.inverse` slab. Chalk-at-alpha in BOTH schemes, unlike `hairline`,
       * and that is the point: the slab is dark in both, so the ordinary light-mode hairline
       * (graphite @ 10%) would be invisible on it.
       *
       * It exists because in dark mode `surface.inverse` measures only 1.04:1 against
       * `surface.base` — the same order as any adjacent-surface pair, but on a card whose entire
       * job is to read as a distinct object. Without a defined edge the Paywall's pricing slabs
       * simply dissolve into the page.
       */
      inverseHairline: hairlineDark,
    },
  },
  dark: {
    surface: {
      base: '#0E1317', // deep cool charcoal
      raised: '#171D22', // lighter than base in dark mode
      overlay: 'rgba(5, 8, 11, 0.80)',
      // Deeper than `base`, not lighter: in dark mode the pricing slab still has to read as a
      // distinct, denser object rather than dissolving into the page.
      inverse: '#05080B',
    },
    hairline: hairlineDark,
    text: {
      primary: '#EDF2F5', // chalk on charcoal — 16.56:1
      secondary: '#829097', // 5.68:1 on base, 5.17:1 on raised — AA on both
      onInverse: '#EDF2F5', // 17.80:1 on surface.inverse
      onInverseMuted: '#8B979D', // 6.70:1 on surface.inverse
    },
    progress: {
      disabled: '#455158', // 2.29:1 — inert only, same rule as light mode
      // Verified: 5.68:1 on base, 5.17:1 on raised. The lighter tab-bar surface is the binding
      // constraint here, exactly as it is in light mode.
      informative: '#829097',
    },
    status: {
      error: '#F1786A', // 6.79:1 against charcoal
      success: '#5CC5A0', // 8.85:1 against charcoal
    },
    chart: {
      loadLine: '#8FA9B8', // cool steel
      loadFill: 'rgba(130, 144, 151, 0.18)', // text.secondary @ 18%
    },
    grid: {
      frame: 'rgba(237, 242, 245, 0.06)', // ~half of hairline's own opacity
      registrationTick: hairlineDark,
      readoutBracket: hairlineDark,
      routeLine: 'rgba(237, 242, 245, 0.32)',
      inverseHairline: hairlineDark, // identical to light mode on purpose — see that comment
    },
  },
} as const;

export type ThemeColors = (typeof Colors)[ColorScheme];

// ---------------------------------------------------------------------------------------------
// The accent — a near-black field carrying one icy-cyan signal. ONE forward action per screen,
// and never in navigation.
//
// Unlike Trailhead's ember this is theme-INVARIANT, and it has to be: the cyan is locked (it is
// the same value the onboarding pulse trace is drawn in), and a locked pale cyan cannot be a fill
// on a white page — `#A8F0FF` measures 1.27:1 against `surface.light.base`, so a cyan slab there
// would have no boundary at all. The system resolves that by never making the cyan the fill:
//
//   * the primary CTA's fill is `field`, a near-black slab, in BOTH schemes;
//   * the cyan is the slab's 1.5pt edge and its label.
//
// That gives the control a boundary in both schemes through different channels, each proven in
// `theme.contrast.test.ts`: in light mode the slab itself carries it (19.35:1 against the page),
// in dark mode the slab is invisible (1.04:1) and the cyan edge carries it (14.74:1). One
// component, one appearance, legible either way — which is exactly what "theme-invariant" has to
// mean to be worth having.
//
// `field` and `signal` are duplicated in `src/constants/pulseTrace.ts` (`PulseTracePalette.field`
// / `.trace`), which the onboarding animation owns and which was written before this file. The
// contrast test pins THESE values only — that file is not on this branch and cannot be imported,
// so nothing yet stops the animation's copy drifting away from them. The pin becomes two-sided
// once `fm/v22-redesign-animation` lands and the palette can be asserted equal.
// ---------------------------------------------------------------------------------------------

export const Accent = {
  /**
   * The near-black slab a primary action is drawn on — and the same plane as `surface.inverse`
   * and the pulse trace's field. Theme-invariant.
   */
  field: '#0A0E13',
  /**
   * The single bright highlight: icy cyan, locked. Legal in exactly two places — the edge and
   * label of the ONE primary call-to-action on a screen, and the onboarding pulse trace. Not a
   * link colour, not a chart colour, not a badge. 15.27:1 on `field`. If a second use appears on
   * a screen, the highlight has stopped being a highlight.
   */
  signal: '#A8F0FF',
  /**
   * Copy on `field` that is NOT the signal — a caption over the dark plane, or a spinner in a
   * control whose label slot is busy. 17.16:1 on `field`.
   */
  onField: '#EDF2F5',
  /** Muted copy on `field`. 6.46:1. */
  onFieldMuted: '#8B979D',
} as const;

export type ThemeAccent = typeof Accent;

// ---------------------------------------------------------------------------------------------
// The effort scale — a color always means an intensity; it never decorates. `barHeight` is the
// mandatory non-hue accessibility channel: the ramp is monotonic and identical in both schemes.
//
// `EffortLevel`, its render order, and its intensity ordinal are owned by `planTypes.ts` — the
// module both this app and the `generate-plan` edge function import — so this file only ever
// derives from it, never redeclares it.
//
// Instrument re-tunes all ten hues into a cooler key (captain's explicit call: left warm, the
// ramp would read as a leftover from Trailhead). The method is the one Trailhead used and not a
// new one: each hue keeps its identity and its position in the ordering — steel blue, sea green,
// brass, rust, raspberry — and only its hue-angle and lightness move, the angle toward the blue
// side of its own family and the lightness to clear the new surfaces.
//
// Two constraints bound every value, and both are asserted in `theme.contrast.test.ts` rather
// than eyeballed:
//   1. >=4.5:1 against its own scheme's `surface.base` AND `surface.raised`. Trailhead's light
//      ramp sat at 4.02-4.50 against base alone with nothing checked against `raised`, which is
//      what issue #70 reported; the tightest value below is 4.92:1.
//   2. No effort hue may be confusable with `Accent.signal` — a plan ribbon full of
//      highlight-coloured bars would destroy the "one signal per screen" rule the whole system
//      rests on. Measured as CIE76 dE in Lab, not as a contrast ratio: contrast ratio is blind to
//      hue and would happily pass an icy-cyan `recovery`. The floor is 25; the tightest pair is
//      dark `recovery` at 28.3, which is on the same order as the ramp's own tightest adjacent
//      pair (light recovery/easy, 33.3).
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
  // Ratios are `light against light base / light raised` and `dark against dark base / dark
  // raised`. The floor for this non-text channel is 3:1; every value below clears 4.9:1.
  recovery: { light: '#2F6E8F', dark: '#5FA6C8', barHeight: barHeightFor('recovery') }, // 5.60/5.03 · 6.92/6.29
  easy: { light: '#2C7562', dark: '#4FB394', barHeight: barHeightFor('easy') }, // 5.49/4.92 · 7.30/6.64
  steady: { light: '#6F6A2E', dark: '#B0A64C', barHeight: barHeightFor('steady') }, // 5.56/4.99 · 7.48/6.80
  tempo: { light: '#9A4A22', dark: '#E08652', barHeight: barHeightFor('tempo') }, // 6.22/5.58 · 6.85/6.23
  interval: { light: '#96234C', dark: '#E2648F', barHeight: barHeightFor('interval') }, // 7.95/7.13 · 5.74/5.22
};

// ---------------------------------------------------------------------------------------------
// Typography — three families, each isolated to its role. Unchanged from Trailhead: the faces
// were never what made that system warm, the colours were, and re-picking them would mean a font
// -loading change in `_layout.tsx` for no visual gain in a near-monochrome system.
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
   * SemiBold for it). Quiet labels take `regular`, emphatic ones take `bold`. Inventing a
   * `medium` alias that resolved to the same file as `regular` would be a token that lies.
   */
  mono: {
    regular: 'SpaceMono_400Regular',
    bold: 'SpaceMono_700Bold',
  },
} as const;

/**
 * Seven steps: 13 / 15 / 17 / 20 / 24 / 32 / 44.
 *
 * `hero` (44) exists for one reason: Big Shoulders Display is a condensed face with a much
 * smaller optical size than a normal-width grotesque, so a 32pt screen title no longer carries a
 * screen. It is display-only — never legal on body or mono text, which would simply be oversized
 * rather than emphatic.
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
// Radius — Instrument tightens both steps again (control 10 -> 8, card 16 -> 14). Trailhead
// squared the previous system's consumer-app softness off against a paper metaphor; a cool
// instrument panel is squarer still. Kept 6pt apart, deliberately, so the two steps stay
// distinguishable rather than becoming a "two values 2px apart" trap.
// ---------------------------------------------------------------------------------------------

export const Radius = {
  /** Buttons, chips, inputs, segmented tracks. */
  control: 8,
  /** Cards, sheets, modals. */
  card: 14,
  /** Tier badges and other true capsules. Never on anything that contains a paragraph. */
  pill: 999,
} as const;

// ---------------------------------------------------------------------------------------------
// Stroke weights. This is a line-drawing system, so these are tokens rather than incidental
// literals scattered through components.
// ---------------------------------------------------------------------------------------------

export const Stroke = {
  /** Rules, baselines, row separators — one physical pixel is the whole point. */
  hairline: StyleSheet.hairlineWidth,
  /** Input and secondary-button borders. */
  thin: 1,
  /** Icons, chevrons, the route line, the primary action's signal edge — a glyph should weigh the
   * same on every device, so this is a fixed 1.5 rather than a hairline. */
  mark: 1.5,
} as const;

// ---------------------------------------------------------------------------------------------
// Motion.
// Springs are recorded as the design-specified damping ratio (0 = undamped, 1 = critically
// damped) rather than a platform spring config — callers translate this into Reanimated's
// `withSpring` parameters.
//
// Trailhead's `duration.reveal` and `duration.ambient` are gone with the dusk hero they were
// reserved for. The one sanctioned exception to "if nothing is happening, nothing moves" is now
// the onboarding pulse trace, and it carries its own timings in `constants/pulseTrace.ts` so that
// nothing else in the app can reach for them by accident.
// ---------------------------------------------------------------------------------------------

export const Motion = {
  duration: {
    instant: 100, // press feedback
    quick: 180, // state crossfades, toggles
    standard: 250, // the default; entrances. No consumer in `src/` yet — nothing reads `Motion`.
    slow: 350, // full-screen pushes
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
