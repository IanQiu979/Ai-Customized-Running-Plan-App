import { Pressable, StyleSheet, Text } from 'react-native';

import { FontFamily, FontSize, PressedOpacity, Spacing } from '@/constants/theme';

export function IntakeExitAction({
  color,
  onPress,
  label,
}: {
  color: string;
  onPress: () => void;
  /** "Skip for now" before a save, "Done" once intake existed on load or was just saved. */
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
  // The navigation header gives `headerRight` no edge inset of its own, so without this the label
  // sits flush against the screen edge — verified in the web build 2026-09-01, where the
  // pressable's right edge measured exactly the viewport width while the header *title* carried
  // the usual 16pt margin. The padding is the inset; `hitSlop` above still widens the target.
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
