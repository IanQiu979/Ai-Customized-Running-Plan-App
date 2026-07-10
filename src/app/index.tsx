import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Placeholder shell only — proves the token/font pipeline boots. The real Home screen (Part 5 of
 * `docs/design/frontend-design-brief.md`) is `frontend-builder` work for a later wave.
 */
export default function HomeScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Running Plan Builder</Text>
        <Text style={[styles.body, { color: theme.text.secondary }]}>
          Intake, generation, and plan view land in later build phases.
        </Text>
        <Text style={[styles.mono, { color: theme.text.secondary }]}>PHASE 1 — TOKEN SHELL</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
    textAlign: 'center',
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  mono: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
