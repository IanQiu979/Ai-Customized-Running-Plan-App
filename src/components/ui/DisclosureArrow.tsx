import { StyleSheet, View } from 'react-native';

import { Spacing, Stroke } from '@/constants/theme';

/**
 * A drawn disclosure chevron — down when collapsed, up when expanded — whose size and stroke come
 * from the tokens. Decorative: the pressable it sits in carries `accessibilityState.expanded`, so
 * the glyph itself is hidden from screen readers. Shared by the glossary's rows and the plan
 * view's disclaimer footer, which is why it left `glossary.tsx` (2026-10-05).
 */
export function DisclosureArrow({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <View
      style={styles.arrow}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.arrowMark,
          { borderColor: color },
          expanded ? styles.arrowMarkUp : styles.arrowMarkDown,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    width: Spacing.three,
    height: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowMark: {
    width: Spacing.two,
    height: Spacing.two,
    borderRightWidth: Stroke.mark,
    borderBottomWidth: Stroke.mark,
  },
  arrowMarkDown: {
    transform: [{ rotate: '45deg' }],
  },
  arrowMarkUp: {
    transform: [{ rotate: '225deg' }],
  },
});
