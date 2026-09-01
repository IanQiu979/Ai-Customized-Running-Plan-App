/**
 * Resolves the current color scheme into the design system's semantic tokens
 * (`src/constants/theme.ts`). Components read colors from here, never from a raw hex.
 *
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Accent, Colors, ColorScheme, Effort, EffortOrder } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EffortLevel } from '@/lib/planTypes';

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
    // Scheme-resolved, unlike the previous system's theme-invariant accent: no single ember
    // clears AA on both chalk and espresso, so `Accent` is keyed by scheme the same way `Effort`
    // is. Call sites read `theme.accent.ember` / `theme.accent.onEmber` and never index a scheme
    // themselves.
    accent: Accent[scheme],
  };
}
