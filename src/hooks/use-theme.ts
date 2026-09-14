/**
 * Resolves the design system's semantic tokens (`src/constants/theme.ts`). Components read
 * colors from here, never from a raw hex.
 *
 * **The app renders one scheme.** The captain's V2.2 theme sheet (`V22 theme.md`, 2026-09-13)
 * defines a single dark field, and every approved V22 page is composed on it, so this hook
 * resolves to `dark` regardless of the OS setting. The `light` palette in `theme.ts` is kept
 * intact and still measured by the contrast suite; re-enabling it is a one-line change here
 * (read `useColorScheme()` again), not a re-derivation.
 */

import { Accent, Colors, ColorScheme, Effort, EffortOrder, Session } from '@/constants/theme';
import type { EffortLevel } from '@/lib/planTypes';

export function useTheme() {
  const scheme: ColorScheme = 'dark';

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
    // Theme-invariant. Spread here rather than left as bare imports so that every call site reads
    // colour the same way — `theme.accent.fill`, `theme.session.easy` — and nothing has to know
    // which tokens happen to depend on the scheme.
    accent: Accent,
    session: Session,
  };
}
