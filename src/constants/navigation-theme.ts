/**
 * React Navigation theme objects — bridges the design system's tokens (`./theme.ts`) into the
 * `Theme` shape `expo-router` expects (see the import note below: expo-router forked
 * react-navigation at SDK 56 and re-exports these from its own package root).
 *
 * Why this exists: React Navigation's stock `DefaultTheme`/`DarkTheme` ship their own colors
 * (`rgb(242, 242, 242)` light background, `rgb(1, 1, 1)` dark, plus their own `card`/`text`/
 * `border`/`primary`). Those are not tokens — nobody in this codebase chose them — but the library uses
 * them to paint chrome the app never styles directly: transition underlays, header defaults, and
 * the reveal behind an in-progress back-swipe. Handing the stock objects to `ThemeProvider` lets
 * that untokened gray leak through (a light-mode push flashing a cold `rgb(242, 242, 242)`
 * against this system's white canvas is a visible seam, and a more obvious one than it was
 * under the previous, cooler palette). Every value below is derived from `Colors` in
 * `./theme.ts` — never a re-typed hex — so this can never drift from the rest of the system.
 *
 * `primary` maps to `text.primary`, not the signal colour: the system spends the signal on the single
 * forward-action per screen and explicitly bars it from nav/tab active states. The tab bar's own
 * active state is an ink tick, drawn in `(tabs)/_layout.tsx`.
 *
 * The `Theme`'s `fonts` block is deliberately left stock, and that is a choice, not an oversight:
 * nothing renders a header title today (`plan/[id].tsx` sets `headerTitle: ''`; every other screen
 * is `headerShown: false`), so there is no way to see it. The day a real header title lands, map
 * this to `FontFamily.body` — the system mandates Public Sans for UI chrome, and the stock block
 * resolves to system San Francisco / Roboto.
 *
 * SDK 56: `expo-router` forked away from `@react-navigation/*` (most direct imports of those
 * packages stop resolving once expo-router no longer pulls them in transitively). `DarkTheme`,
 * `DefaultTheme`, and the `Theme` type are re-exported from the `expo-router` package root
 * instead — verified identical to the react-navigation originals (`expo-router`'s own
 * `build/react-navigation` modules, re-exported unmodified through `build/exports`). Expo's
 * codemod (`npx expo-codemod sdk-56-expo-router-react-navigation-replace`) writes the
 * `expo-router/react-navigation` subpath, but SDK 57 marks these three bindings deprecated there
 * ("Import `DarkTheme` from `expo-router` instead. Will be removed in a future SDK.") — the root
 * is the supported path.
 */

import { type Theme, DarkTheme, DefaultTheme } from 'expo-router';

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
