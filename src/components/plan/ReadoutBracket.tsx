import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Flanks a genuinely *measured* mono numeral in hairline brackets — a real pace, a real HR
 * zone, a self-reported RPE. `frontend-design-brief.md` Part 2, "Readout brackets": reserved
 * exclusively for numbers that were actually measured; a qualitative description never earns
 * this. Callers are responsible for only rendering this around `pace`/`hrZone`/`rpe`, never
 * around prose.
 */
export function ReadoutBracket({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.wrap, { borderColor: theme.grid.readoutBracket }]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth * 2,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.one,
  },
});
