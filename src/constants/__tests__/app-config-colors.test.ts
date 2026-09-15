import appConfig from '../../../app.json';
import { Colors } from '../theme';

/**
 * The native chrome `app.json` paints before any JS runs, pinned to the Blueprint tokens.
 *
 * `app.json` is the one surface the theme cannot reach: it is strict JSON (no comments, no
 * imports), and `theme.ts` pulls in `react-native`, so an `app.config.ts` could not import it at
 * config-evaluation time either. The hexes there are therefore retyped literals — and retyped
 * literals drift. Issues #20 and #49 are what that drift looks like: the stock create-expo-app
 * splash blue (`#208AEF`) and adaptive-icon tint (`#E6F4FE`) survived the whole rebrand because
 * nothing compared them against the palette. This suite is that comparison, so the next field
 * change fails here instead of shipping a mismatched cold start. Each case pins one parsed field
 * to the token; there is no substring scan of the file.
 *
 * Why both splash variants pin to the SAME token: `use-theme.ts` renders the dark scheme only
 * (the V22 sheet defines one field), so the canvas the splash cuts to is `Colors.dark.surface.base`
 * whatever the OS setting. A light-mode splash keyed to the light palette would flash white and
 * then drop to near-black — the exact cut this fixes. If the light scheme is ever re-enabled in
 * `use-theme.ts`, the base variant here is the line to revisit.
 *
 * The root layout holds the splash (`preventAutoHideAsync`) until three font families load, so
 * this colour is the app's longest first impression — which is why a config value gets a test.
 */

const FIELD = Colors.dark.surface.base;

type SplashPluginOptions = {
  backgroundColor?: string;
  dark?: { backgroundColor?: string };
};

function splashOptions(): SplashPluginOptions {
  // `plugins` is a union of bare names and `[name, options]` tuples; widen it rather than lean on
  // the JSON import's inferred shape, which is exactly what this suite exists to check.
  const plugins: unknown[] = appConfig.expo.plugins;
  const entry = plugins.find(
    (plugin): plugin is [string, SplashPluginOptions] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
  );
  if (!entry) throw new Error('app.json has no expo-splash-screen plugin entry');
  return entry[1];
}

describe('app.json native chrome colours', () => {
  it('paints the splash with the Blueprint field', () => {
    expect(splashOptions().backgroundColor).toBe(FIELD);
  });

  it('paints the dark-mode splash with the same field, so a dark cold start never flashes light', () => {
    expect(splashOptions().dark?.backgroundColor).toBe(FIELD);
  });

  it('tints the Android adaptive icon background with the Blueprint field', () => {
    expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe(FIELD);
  });
});
