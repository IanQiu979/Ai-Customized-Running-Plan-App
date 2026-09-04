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
    // Theme-INVARIANT, unlike Trailhead's scheme-keyed ember: the signal cyan is locked (it is the
    // pulse trace's own colour) and is never a fill, so it has no per-scheme variant to resolve.
    // It is spread here rather than left as a bare import so that every call site reads colour the
    // same way — `theme.accent.field` / `theme.accent.signal` — and nothing has to know which
    // tokens happen to depend on the scheme.
    accent: Accent,
  };
}
