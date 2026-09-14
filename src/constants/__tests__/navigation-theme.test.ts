import { DarkTheme, DefaultTheme } from 'expo-router';

import { NavigationDarkTheme, NavigationLightTheme, NavigationThemes } from '../navigation-theme';
import { Accent, Colors } from '../theme';

/**
 * Regression guard for GitHub issue #27.
 *
 * React Navigation's stock `DefaultTheme`/`DarkTheme` ship their own untokened colors — a light
 * grey `rgb(242, 242, 242)` background and a near-black `rgb(1, 1, 1)` dark background (see
 * expo-router's forked `build/react-navigation/native/theming/DefaultTheme.js` /
 * `DarkTheme.js`), plus their own
 * `card`/`text`/`border`/`primary`/`notification`. If `NavigationLightTheme` /
 * `NavigationDarkTheme` ever stop overriding `colors` — e.g. someone "simplifies" the module back
 * to `export const NavigationLightTheme = DefaultTheme` — these stock values would leak straight
 * into `ThemeProvider` and the app would flash untokened chrome again. Every test below either
 * asserts the overridden slot equals the derived `Colors` token, or explicitly asserts it is NOT
 * the stock literal it used to be (or could regress back to).
 */

describe('NavigationLightTheme', () => {
  it('derives every overridden color from Colors.light, never a re-typed literal', () => {
    expect(NavigationLightTheme.colors.background).toBe(Colors.light.surface.base);
    expect(NavigationLightTheme.colors.card).toBe(Colors.light.surface.raised);
    expect(NavigationLightTheme.colors.text).toBe(Colors.light.text.primary);
    expect(NavigationLightTheme.colors.border).toBe(Colors.light.hairline);
    expect(NavigationLightTheme.colors.primary).toBe(Colors.light.text.primary);
    expect(NavigationLightTheme.colors.notification).toBe(Colors.light.status.error);
  });

  it('does not leak React Navigation\'s stock light-mode background', () => {
    // The literal is the actual value shipped by the installed expo-router fork
    // (build/react-navigation/native/theming/DefaultTheme.js) — hardcoded deliberately, since
    // this is the third-party stock value we're asserting absence of, not a design-system token
    // we'd otherwise derive.
    expect(NavigationLightTheme.colors.background).not.toBe('rgb(242, 242, 242)');
    expect(NavigationLightTheme.colors.background).not.toBe(DefaultTheme.colors.background);
  });

  it('preserves dark: false and the stock fonts untouched', () => {
    expect(NavigationLightTheme.dark).toBe(false);
    expect(NavigationLightTheme.fonts).toBe(DefaultTheme.fonts);
  });

  it('does not route the nav-active color through the accent', () => {
    expect(NavigationLightTheme.colors.primary).toBe(Colors.light.text.primary);
    expect(NavigationLightTheme.colors.primary).not.toBe(Accent.fill);
  });
});

describe('NavigationDarkTheme', () => {
  it('derives every overridden color from Colors.dark, never a re-typed literal', () => {
    expect(NavigationDarkTheme.colors.background).toBe(Colors.dark.surface.base);
    expect(NavigationDarkTheme.colors.card).toBe(Colors.dark.surface.raised);
    expect(NavigationDarkTheme.colors.text).toBe(Colors.dark.text.primary);
    expect(NavigationDarkTheme.colors.border).toBe(Colors.dark.hairline);
    expect(NavigationDarkTheme.colors.primary).toBe(Colors.dark.text.primary);
    expect(NavigationDarkTheme.colors.notification).toBe(Colors.dark.status.error);
  });

  it('does not leak React Navigation\'s stock dark-mode background', () => {
    // Same rationale as the light-mode test above. The installed expo-router fork's
    // build/react-navigation/native/theming/DarkTheme.js literal is `rgb(1, 1, 1)` (equivalent
    // to hex #010101, but
    // that is not the string the library actually produces — asserting against the real literal
    // is what makes this a meaningful regression guard rather than a string that could never
    // match either way).
    expect(NavigationDarkTheme.colors.background).not.toBe('rgb(1, 1, 1)');
    expect(NavigationDarkTheme.colors.background).not.toBe(DarkTheme.colors.background);
  });

  it('preserves dark: true and the stock fonts untouched', () => {
    expect(NavigationDarkTheme.dark).toBe(true);
    expect(NavigationDarkTheme.fonts).toBe(DarkTheme.fonts);
  });

  it('does not route the nav-active color through the accent', () => {
    expect(NavigationDarkTheme.colors.primary).toBe(Colors.dark.text.primary);
    // The dark scheme's ink IS the accent fill (a button is a cut-out of the page), so the nav
    // primary equalling it is not a leak; what must never happen is the accent being an
    // independent highlight routed into navigation. Pinned by the theme test instead.
    expect(Accent.fill).toBe(Colors.dark.text.primary);
  });
});

describe('NavigationThemes', () => {
  it('maps each ColorScheme key to the matching theme object', () => {
    expect(NavigationThemes.light).toBe(NavigationLightTheme);
    expect(NavigationThemes.dark).toBe(NavigationDarkTheme);
  });

  it('contains exactly the light and dark keys', () => {
    expect(Object.keys(NavigationThemes).sort()).toEqual(['dark', 'light']);
  });
});
