import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisclaimerFooter } from '@/components/plan/DisclaimerFooter';
import { FallbackNotice } from '@/components/plan/FallbackNotice';
import { PlanNameplate } from '@/components/plan/PlanNameplate';
import { WeekAccordion } from '@/components/plan/WeekAccordion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { examplePlan } from '@/lib/fixtures/examplePlan';

/**
 * Plan view — the hero screen. Phase 1 has no backend, so the `[id]` route segment is
 * intentionally unread here: every id renders the same local fixture
 * (`src/lib/fixtures/examplePlan.ts`). Phase 2 swaps this for a real fetch by id; the
 * loading/error states that fetch will need are a design TODO
 * (`docs/design/mvp-blueprint.md` Part 13), not built here.
 *
 * Plain native scroll, one continuous surface — no per-row stagger, no wave, no
 * scroll-driven animation (all Phase 6+). `Animated.ScrollView` (Reanimated) is used in place
 * of the plain RN `ScrollView` only so a scroll handler can attach later without restructuring
 * the screen — nothing is animated on scroll yet.
 */
export default function PlanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const plan = examplePlan;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerShadowVisible: false,
          // Deliberate deviation from the nav theme's `card` (surface.raised): this screen wants
          // a header flush with the page canvas, not a wrong theme needing compensation.
          headerStyle: { backgroundColor: theme.surface.base },
        }}
      />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, Spacing.four) + Spacing.five },
        ]}
      >
        <PlanNameplate plan={plan} />
        {/*
          `variant` is hardcoded because `Plan` carries no signal for it: `isFallback` is a bare
          boolean, and only the server knows whether this fallback landed inside the 3-per-period
          exemption or past it. `exempt` is correct for the fixture and for the common case;
          rendering the true variant needs `generate-plan` to return it (issue #45).
        */}
        {plan.isFallback ? <FallbackNotice variant="exempt" /> : null}
        <View style={styles.ribbon}>
          {plan.weeks.map((week) => (
            <WeekAccordion key={week.weekNumber} week={week} />
          ))}
        </View>
        <DisclaimerFooter disclaimers={plan.disclaimers} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.five,
  },
  ribbon: {
    gap: Spacing.one,
  },
});
