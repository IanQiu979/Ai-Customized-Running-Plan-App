import { Pressable, StyleSheet, Text } from 'react-native';

import { FontFamily, FontSize, PressedOpacity, Spacing } from '@/constants/theme';

export function IntakeExitAction({
  color,
  onPress,
  label,
}: {
  color: string;
  onPress: () => void;
  /** "Cancel" — rendered only on a re-entry from Home's "Create a new plan". A first entry has no
   * exit at all (captain's 2026-09-20 ruling: the intake cannot be skipped). */
  label: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Sits on `ScreenHeader`'s eyebrow row since the 2026-09-20 re-cut (the native header is off);
  // the padding keeps a finger's width of target around a short word, `hitSlop` widens it further.
  action: {
    paddingHorizontal: Spacing.two,
  },
  text: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
