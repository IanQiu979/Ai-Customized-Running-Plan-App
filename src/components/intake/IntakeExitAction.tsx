import { Pressable, StyleSheet, Text } from 'react-native';

import { FontFamily, FontSize, PressedOpacity, Spacing } from '@/constants/theme';

export function IntakeExitAction({ color, onPress }: { color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Skip intake for now"
      accessibilityRole="button"
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={[styles.text, { color }]}>Skip for now</Text>
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
