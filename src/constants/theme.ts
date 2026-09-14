/**
 * V2.2 design tokens — **"Blueprint"** (the captain's settled V2.2 theme sheet, `V22 theme.md`
 * in the 2026-09-13 design handoff; supersedes "Instrument" of 2026-09-03 for colour and type).
 *
 * The sheet in one line: one near-black field (`#0B0E12`) with a slightly raised card plane,
 * near-white ink for every heading, number and the primary button's fill, a dim grey for labels
 * and units, and exactly TWO session colours — easy green and hard orange — that are applied to
 * bars and tiles and never to text or chrome. Type is Barlow Condensed for display and numerals,
 * IBM Plex Mono for tracked labels, IBM Plex Sans for body.
 *
 * Source of truth for every value: `docs/design/instrument-visual-system.md` (the "Blueprint"
 * section, 2026-09-14) and the handoff's `V22 theme.md`. The floors behind the ratios are
 * enforced, not merely documented: `src/constants/__tests__/theme.contrast.test.ts` recomputes
 * each ratio from the hexes in this file and asserts it against its floor, so a hex edited into
 * illegibility fails the suite instead of shipping. It does NOT pin the exact documented numbers
 * — that would make every legitimate re-tune a test edit.
 *
 * **The app renders the dark scheme only.** The sheet defines one background, and every approved
 * V22 page is composed on it, so `use-theme.ts` resolves to `dark` regardless of the OS setting.
 * The `light` palette is kept intact (and still measured by the contrast suite) so re-enabling a
 * light scheme is a one-line change in the hook, not a re-derivation.
 *
 * Naming is by role ("surface.base", "text.secondary"), never by appearance, so a future rebrand
 * only ever changes a value, never every call site.
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
 * `hairline` is graphite-at-alpha in light mode and white-at-alpha in dark mode: the only
 * separator in the app outside the two shadow users (modals/sheets). The sheet's value for the
 * dark scheme is `rgba(255,255,255,0.10)`, verbatim.
 */
const hairlineLight = 'rgba(16, 22, 25, 0.10)'; // graphite @ 10%
const hairlineDark = 'rgba(255, 255, 255, 0.10)'; // V22 "Hairline"

export const Colors = {
  light: {
    surface: {
      base: '#FFFFFF', // paper white — the page canvas
      raised: '#F0F3F5', // cards, rows, inputs, chips, sheets, the tab bar. Cool, not warm.
      overlay: 'rgba(10, 14, 19, 0.55)', // field @ 55% — solid modal scrim, never a blur
      /**
       * The dark slab. Paywall's pricing cards are dark in BOTH schemes — that inversion is the
       * whole "premium pricing page" gesture. Pair only with `text.onInverse` /
       * `text.onInverseMuted`.
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
      // tab bar sits on raised.
      informative: '#646F75',
    },
    status: {
      error: '#B32318', // 6.62:1 against white
      success: '#20674F', // 6.74:1 against white
    },
    // Derived from `hairline`. Baselines and tick marks reuse `hairline` directly and have no
    // token of their own.
    grid: {
      frame: 'rgba(16, 22, 25, 0.05)', // ~half of hairline's own opacity
      registrationTick: hairlineLight,
      readoutBracket: hairlineLight,
      /** An empty slot in a week strip — a rest day's dash, an unfilled cell of the header mark.
       * Heavier than `hairline`: it is a mark that stands for something (a day with no run), not
       * a rule between two things. */
      slot: 'rgba(16, 22, 25, 0.14)',
      /**
       * The edge of a `surface.inverse` slab. White-at-alpha in BOTH schemes, unlike `hairline`,
       * because the slab is dark in both and the ordinary light-mode hairline (graphite @ 10%)
       * would be invisible on it.
       */
      inverseHairline: hairlineDark,
    },
  },
  dark: {
    surface: {
      base: '#0B0E12', // V22 "Background"
      raised: '#141920', // V22 "Raised" — cards, inputs
      overlay: 'rgba(5, 8, 11, 0.80)',
      // Deeper than `base`, not lighter: the pricing slab still has to read as a distinct, denser
      // object rather than dissolving into the page.
      inverse: '#05080B',
    },
    hairline: hairlineDark,
    text: {
      primary: '#EEF1F4', // V22 "Ink" — 17.06:1 on base, 15.57:1 on raised
      secondary: '#8B9299', // V22 "Dim" — 6.14:1 on base, 5.61:1 on raised
      onInverse: '#EEF1F4',
      onInverseMuted: '#8B9299',
    },
    progress: {
      disabled: '#3A424A', // 1.82:1 — inert only, same rule as light mode
      // Same value as `text.secondary` today; a separate token because the two roles have
      // different floors and will not always move together.
      informative: '#8B9299',
    },
    status: {
      error: '#F1786A', // 7.08:1 against base
      success: '#5CC5A0', // 9.24:1 against base
    },
    grid: {
      frame: 'rgba(255, 255, 255, 0.05)',
      registrationTick: hairlineDark,
      readoutBracket: hairlineDark,
      slot: 'rgba(255, 255, 255, 0.14)', // V22 "Empty slot", verbatim
      inverseHairline: hairlineDark,
    },
  },
} as const;

export type ThemeColors = (typeof Colors)[ColorScheme];

// ---------------------------------------------------------------------------------------------
// The accent — ink. The V22 sheet spends "Ink" on headings, numbers AND the primary button's
// fill: the one forward action on a screen is a near-white slab with the page colour as its
// label. There is no second highlight colour anywhere in the system any more — the icy cyan of
// the retired pulse trace went with the trace (2026-09-14). Theme-invariant, like its
// predecessor, because the app renders one scheme.
//
// Keep it to ONE `PrimaryAction` per screen: `src/components/ui/ActionButton.tsx` is the only
// module allowed to paint `Accent.fill`, so "one accent per screen" stays a question about
// imports rather than a review of hand-rolled stylesheets.
// ---------------------------------------------------------------------------------------------

export const Accent = {
  /** The primary action's fill — V22 "Ink". 17.06:1 against the dark page. */
  fill: '#EEF1F4',
  /** The label on that fill — the page colour itself, so the button reads as a cut-out. */
  onFill: '#0B0E12',
} as const;

export type ThemeAccent = typeof Accent;

// ---------------------------------------------------------------------------------------------
// Session tones — the V22 sheet's two session colours, and the only colours that ever touch a
// bar or a tile. "Easy effort" covers easy, recovery and long runs; "hard effort" covers tempo,
// intervals and anything else at or above threshold. Applied to bars and tiles, never to text
// or chrome. Theme-invariant: they are drawn on the one dark field the app has.
//
// Both clear the 3:1 non-text floor with room to spare (easy 7.65:1 / hard 7.08:1 on base) and
// are asserted in `theme.contrast.test.ts`.
// ---------------------------------------------------------------------------------------------

export type SessionTone = 'easy' | 'hard';

export const Session: Record<SessionTone, string> = {
  easy: '#4DB58C',
  hard: '#E0864E',
} as const;

/**
 * Which of the two tones a workout's `effort` is drawn in. `steady` sits above easy on the
 * intensity ramp (`planTypes.ts`'s `EFFORT_ORDINAL`), so it takes the hard tone: the sheet's own
 * rule is "easy, recovery, long run" versus "tempo, intervals", and steady is neither easy nor
 * recovery. Pure and shared so every strip in the app answers this the same way.
 */
export function sessionToneFor(effort: EffortLevel): SessionTone {
  return EFFORT_ORDINAL[effort] <= EFFORT_ORDINAL.easy ? 'easy' : 'hard';
}

// ---------------------------------------------------------------------------------------------
// The effort scale — five levels, ordered by intensity, with `barHeight` as the mandatory
// non-hue accessibility channel. `EffortLevel`, its render order, and its intensity ordinal are
// owned by `planTypes.ts`, so this file only ever derives from it, never redeclares it.
//
// The V22 sheet collapses the DISPLAY of effort onto the two `Session` tones above; this ramp is
// retained for the places that still name all five levels (the glossary, the effort chip on a
// session's detail, the Pro/Elite content teaser). Every value clears 4.5:1 against its own
// scheme's base and raised and every adjacent pair stays >= 25 dE apart — both asserted.
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
  recovery: { light: '#2F6E8F', dark: '#5FA6C8', barHeight: barHeightFor('recovery') },
  easy: { light: '#2C7562', dark: '#4DB58C', barHeight: barHeightFor('easy') }, // = Session.easy
  steady: { light: '#6F6A2E', dark: '#B0A64C', barHeight: barHeightFor('steady') },
  tempo: { light: '#9A4A22', dark: '#E0864E', barHeight: barHeightFor('tempo') }, // = Session.hard
  interval: { light: '#96234C', dark: '#E2648F', barHeight: barHeightFor('interval') },
};

// ---------------------------------------------------------------------------------------------
// Typography — the V22 sheet's three families, each isolated to its role.
//
//   Display  Barlow Condensed 600   numbers, titles (500 for quieter display, 700/800 kept for
//                                   the existing hero hierarchy)
//   Label    IBM Plex Mono 400/500  uppercase, tracked — labels, units, day numerals
//   Body     IBM Plex Sans 400–600
//
// The keys here ARE the `fontFamily` strings the app writes and the faces `_layout.tsx` loads;
// the two lists cannot drift without a missing font silently falling back to the system face.
// Barlow Condensed carries display text AND every numeral in the app. A number inline in body
// copy needs its own styled wrapper; RN does not substitute fonts per character range.
// ---------------------------------------------------------------------------------------------

export const FontFamily = {
  /** Display text, and every numeral in the app. */
  display: {
    medium: 'BarlowCondensed_500Medium',
    semiBold: 'BarlowCondensed_600SemiBold',
    bold: 'BarlowCondensed_700Bold',
    extraBold: 'BarlowCondensed_800ExtraBold',
  },
  /** Body copy and UI chrome. */
  body: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semiBold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
  /** Tracked all-caps labels, units, day numerals, pace splits — genuinely monospace/tabular. */
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
    bold: 'IBMPlexMono_700Bold',
  },
} as const;

/**
 * The type scale. The seven original steps (13 / 15 / 17 / 20 / 24 / 32 / 44) plus the steps
 * the V22 pages compose with: `tiny` (10) and `xxs` (11) for the mono labels and day numerals
 * that sit under a strip, `numeral` (64) and `giant` (96) for the one counting number a hero
 * carries. Display-only at the top, label-only at the bottom.
 */
export const FontSize = {
  tiny: 10,
  xxs: 11,
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 44,
  numeral: 64,
  giant: 96,
} as const;

/**
 * Letter-spacing. `display` counteracts a condensed face's tightness at large sizes; `label`
 * opens up the all-caps mono field labels that carry most of the app's structure, and `wide` is
 * the sheet's most tracked setting (the "KM / WEEK" unit under a hero number, the PRESS TO
 * CONTINUE cue). Body copy is never tracked.
 */
export const Tracking = {
  display: -0.4,
  label: 1.1,
  wide: 2.5,
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
// Radius — the V22 sheet: bars 5pt top radius; cards 10–14pt; buttons 12pt. `control` (8) stays
// for inputs, chips and segmented tracks, which the sheet does not restate.
// ---------------------------------------------------------------------------------------------

export const Radius = {
  /** A session bar's top corners. */
  bar: 5,
  /** Inputs, chips, segmented tracks. */
  control: 8,
  /** Buttons. */
  button: 12,
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
  /** Input and secondary-button borders; a strip's baseline while it is being drawn. */
  thin: 1,
  /** Icons, chevrons — a glyph should weigh the same on every device, so this is a fixed 1.5
   * rather than a hairline. */
  mark: 1.5,
} as const;

// ---------------------------------------------------------------------------------------------
// Motion.
// Springs are recorded as the design-specified damping ratio (0 = undamped, 1 = critically
// damped) rather than a platform spring config — callers translate this into Reanimated's
// `withSpring` parameters.
//
// The build animations ("the plan builds itself" — onboarding hero, step pieces, survey intro,
// header mark, My Plans hero) carry their own timings in `src/lib/buildMotion.ts`, ported from
// the approved V22 pages, so nothing else in the app can reach for them by accident.
// ---------------------------------------------------------------------------------------------

export const Motion = {
  duration: {
    instant: 100, // press feedback
    quick: 180, // state crossfades, toggles
    standard: 250, // the default; entrances and the plan detail's push (spec §0: 250 ms fade)
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

/**
 * The width the V22 pages were composed at (iPhone 15/16 class, spec §0). The build animations
 * are laid out in points against this width and scaled down, never up, so an iPad centres the
 * composition rather than stretching it.
 */
export const DesignWidth = 393;
