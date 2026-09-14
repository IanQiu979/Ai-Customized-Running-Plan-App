import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, PressedOpacity, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The plan-detail screens' own top bar (V22-06): a back arrow, a tracked mono label in the
 * middle, and a spacer the arrow's width on the right so the label sits centred. The native
 * header is hidden on these screens because they are three read-only pushes over one plan and
 * the bar is part of the page, not chrome around it.
 */
export function PlanTopBar({ label }: { label: string }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={Spacing.three}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={[styles.arrow, { color: theme.text.secondary }]}>←</Text>
      </Pressable>
      <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

/** The page's spacer: the arrow glyph's width, so the label centres on the screen. */
const ARROW_WIDTH = 14;

const styles = StyleSheet.create({
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -Spacing.three,
    paddingLeft: Spacing.three,
  },
  arrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 14,
    width: ARROW_WIDTH,
  },
  label: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 2,
  },
  spacer: {
    width: ARROW_WIDTH,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
