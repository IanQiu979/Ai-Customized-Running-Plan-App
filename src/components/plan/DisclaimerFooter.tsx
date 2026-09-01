import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Rule 10 (`load-rules.md`) — legally required, static, never dismissed. Renders at the bottom
 * of every plan view, every tier, every time. `frontend-design-brief.md` Part 5, "Plan view".
 */
export function DisclaimerFooter({ disclaimers }: { disclaimers: readonly string[] }) {
  const theme = useTheme();
  if (disclaimers.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderTopColor: theme.hairline }]}>
      {disclaimers.map((text) => (
        <Text key={text} style={[styles.text, { color: theme.text.secondary }]}>
          {text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: Stroke.hairline,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  text: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
});
