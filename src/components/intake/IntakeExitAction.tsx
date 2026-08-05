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
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
