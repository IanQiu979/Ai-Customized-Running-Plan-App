/**
 * React Navigation theme objects — bridges the design system's tokens (`./theme.ts`) into the
 * `Theme` shape `@react-navigation/native` expects.
 *
 * Why this exists: React Navigation's stock `DefaultTheme`/`DarkTheme` ship their own colors
 * (`rgb(242, 242, 242)` light background, `rgb(1, 1, 1)` dark, plus their own `card`/`text`/
 * `border`/`primary`). Those are not tokens — nobody in this codebase chose them — but the library uses
 * them to paint chrome the app never styles directly: transition underlays, header defaults, and
 * the reveal behind an in-progress back-swipe. Handing the stock objects to `ThemeProvider` lets
 * that untokened gray leak through (a light-mode push flashing a cold `rgb(242, 242, 242)`
 * against Trailhead's warm chalk canvas is a visible seam, and a more obvious one than it was
 * under the previous, cooler palette). Every value below is derived from `Colors` in
 * `./theme.ts` — never a re-typed hex — so this can never drift from the rest of the system.
 *
 * `primary` maps to `text.primary`, not the ember accent: Trailhead spends ember on the single
 * forward-action per screen and explicitly bars it from nav/tab active states. The tab bar's own
 * active state is an ink tick, drawn in `(tabs)/_layout.tsx`.
 *
 * The `Theme`'s `fonts` block is deliberately left stock, and that is a choice, not an oversight:
 * nothing renders a header title today (`plan/[id].tsx` sets `headerTitle: ''`; every other screen
 * is `headerShown: false`), so there is no way to see it. The day a real header title lands, map
 * this to `FontFamily.body` — Trailhead mandates Public Sans for UI chrome, and the stock block
 * resolves to system San Francisco / Roboto.
 */

import type { Theme } from '@react-navigation/native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import { Colors, ColorScheme } from './theme';

export const NavigationLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.surface.base,
    card: Colors.light.surface.raised,
    text: Colors.light.text.primary,
    border: Colors.light.hairline,
    primary: Colors.light.text.primary,
    notification: Colors.light.status.error,
  },
};

export const NavigationDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.surface.base,
    card: Colors.dark.surface.raised,
    text: Colors.dark.text.primary,
    border: Colors.dark.hairline,
    primary: Colors.dark.text.primary,
    notification: Colors.dark.status.error,
  },
};

export const NavigationThemes: Record<ColorScheme, Theme> = {
  light: NavigationLightTheme,
  dark: NavigationDarkTheme,
};
