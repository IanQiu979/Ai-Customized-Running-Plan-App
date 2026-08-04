import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisclaimerFooter } from '@/components/plan/DisclaimerFooter';
import { FallbackNotice } from '@/components/plan/FallbackNotice';
import { PlanNameplate } from '@/components/plan/PlanNameplate';
import { WeekAccordion } from '@/components/plan/WeekAccordion';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, getPlan } from '@/lib/apiClient';
import { EXAMPLE_PLAN_ID, examplePlan } from '@/lib/fixtures/examplePlan';
import type { Plan } from '@/lib/planTypes';

/**
 * Plan view — the hero screen. Branches on the `[id]` route param: `EXAMPLE_PLAN_ID` always
 * renders the local `examplePlan` fixture with no fetch (the captain's explicit "never remove
 * the sample plan" call — it stays reachable from `(tabs)/my-plans.tsx`'s pinned row forever).
 * Any other id is a real plan, fetched via `getPlan(id)` — `loading` and `error` states cover the
 * fetch; a successful fetch renders through the exact same JSX below, since `PlanNameplate`,
 * `FallbackNotice`, `WeekAccordion`, and `DisclaimerFooter` only ever need a `Plan`-shaped object
 * and carry no opinion on where it came from.
 *
 * Plain native scroll, one continuous surface — no per-row stagger, no wave, no
 * scroll-driven animation (all Phase 6+). `Animated.ScrollView` (Reanimated) is used in place
 * of the plain RN `ScrollView` only so a scroll handler can attach later without restructuring
 * the screen — nothing is animated on scroll yet.
 */
export default function PlanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isExample = id === EXAMPLE_PLAN_ID;

  const [plan, setPlan] = useState<Plan | null>(isExample ? examplePlan : null);
  const [loading, setLoading] = useState(!isExample);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExample) {
      setPlan(examplePlan);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await getPlan(id);
        if (!cancelled) setPlan(response.plan);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof ApiError ? fetchError.body.error : 'Could not load this plan.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isExample]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={{ headerShown: true, headerTitle: '' }} />
        <ActivityIndicator color={theme.text.primary} />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={{ headerShown: true, headerTitle: '' }} />
        <Text style={[styles.error, { color: theme.status.error }]}>
          {error ?? 'This plan could not be found.'}
        </Text>
      </View>
    );
  }

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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
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
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
