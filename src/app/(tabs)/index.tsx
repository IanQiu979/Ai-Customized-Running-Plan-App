import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EXAMPLE_PLAN_ID } from '@/lib/fixtures/examplePlan';

/**
 * Placeholder shell only — proves the token/font pipeline boots. The real Home screen (Part 5 of
 * `docs/design/frontend-design-brief.md`) is `frontend-builder` work for a later wave.
 *
 * The link below is a temporary demo gate for Phase 1's plan-view work
 * (`docs/mvp-build-prompt.md` Phase 1, step 3) — it is not the real "View plan" row Home will
 * carry once `quota-status` and a plan list exist.
 */
export default function HomeScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Pace Blueprint</Text>
        <Text style={[styles.body, { color: theme.text.secondary }]}>
          Intake, generation, and plan view land in later build phases.
        </Text>
        <Text style={[styles.mono, { color: theme.text.secondary }]}>PHASE 1 — TOKEN SHELL</Text>
        <Link href={{ pathname: '/plan/[id]', params: { id: EXAMPLE_PLAN_ID } }} asChild>
          <Pressable
            style={({ pressed }) => [
              styles.demoLink,
              { borderColor: theme.text.primary },
              pressed && styles.demoLinkPressed,
            ]}
          >
            <Text style={[styles.demoLinkText, { color: theme.text.primary }]}>
              View the sample 5K plan (demo)
            </Text>
          </Pressable>
        </Link>
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
  demoLink: {
    marginTop: Spacing.four,
    minHeight: Spacing.six, // 48pt minimum tap target
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.control,
    // Outline button — 1.5px ink border, per frontend-design-brief.md Part 2 "Base components".
    borderWidth: 1.5,
  },
  demoLinkPressed: {
    opacity: PressedOpacity,
  },
  demoLinkText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
});
