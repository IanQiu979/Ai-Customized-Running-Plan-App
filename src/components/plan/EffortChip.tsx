import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { EffortLevel } from '@/lib/planTypes';

/**
 * A pure colored swatch — 8pt, within the brief's 8–12px range. Always paired with its own
 * label text rendered beside it (never inside it): `frontend-design-brief.md` Part 2, "Chip".
 * Hidden from the accessibility tree; the row that renders it supplies the composed label.
 */
export function EffortChip({ effort }: { effort: EffortLevel }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.swatch, { backgroundColor: theme.effort[effort] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.half,
  },
});
