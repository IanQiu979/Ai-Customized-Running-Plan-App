/**
 * Resolves the current color scheme into the design system's semantic tokens
 * (`src/constants/theme.ts`). Components read colors from here, never from a raw hex.
 *
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Accent, Colors, ColorScheme, Effort, EffortLevel, EffortOrder } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // useColorScheme returns null when the device reports no preference on SDK 54.
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const effort = EffortOrder.reduce<Record<EffortLevel, string>>(
    (resolved, level) => {
      resolved[level] = Effort[level][scheme];
      return resolved;
    },
    {} as Record<EffortLevel, string>
  );

  return {
    scheme,
    ...Colors[scheme],
    effort,
    accent: Accent,
  };
}
