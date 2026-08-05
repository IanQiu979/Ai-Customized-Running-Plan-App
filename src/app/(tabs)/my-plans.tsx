import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatPlanDate } from '@/components/plan/format';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, listPlans } from '@/lib/apiClient';
import type { PlanSummary } from '@/lib/apiClient';
import { EXAMPLE_PLAN_ID } from '@/lib/fixtures/examplePlan';

/**
 * My Plans. A pinned "Example Plan" row (the static `examplePlan` fixture — the captain's
 * explicit "never remove the sample plan" call) always renders at the top, whatever `listPlans()`
 * returns or fails with. Below it: loading, an inline error, an empty-state message, or one row
 * per `PlanSummary`. Every row pushes to `plan/[id]`, which knows to render the fixture for
 * `EXAMPLE_PLAN_ID` and fetch everything else.
 */
export default function MyPlansScreen() {
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  // A mount-only effect would never refresh after generating a new plan and tabbing back here —
  // Expo Router's tab navigator keeps this screen mounted across navigation, the same staleness
  // class already fixed on Home's intake check.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      (async () => {
        try {
          const response = await listPlans();
          if (!cancelled) setPlans(response.plans);
        } catch (fetchError) {
          if (!cancelled) {
            setError(fetchError instanceof ApiError ? fetchError.body.error : 'Could not load your plans.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text.primary }]}>My Plans</Text>

          <Link href={{ pathname: '/plan/[id]', params: { id: EXAMPLE_PLAN_ID } }} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.row,
                styles.sampleRow,
                { borderColor: theme.text.secondary, backgroundColor: theme.surface.raised },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Example Plan (5K)</Text>
                <View style={[styles.sampleTag, { borderColor: theme.text.secondary }]}>
                  <Text style={[styles.sampleTagText, { color: theme.text.secondary }]}>SAMPLE</Text>
                </View>
              </View>
              <Text style={[styles.rowMeta, { color: theme.text.secondary }]}>
                Always available — a hand-built plan to see the app in action.
              </Text>
            </Pressable>
          </Link>

          {loading ? (
            <ActivityIndicator color={theme.text.primary} style={styles.spinner} />
          ) : error ? (
            <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>
          ) : plans.length === 0 ? (
            <Text style={[styles.body, { color: theme.text.secondary }]}>
              No plans yet — generate one from Home.
            </Text>
          ) : (
            plans.map((plan) => <PlanRow key={plan.planId} plan={plan} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlanRow({ plan }: { plan: PlanSummary }) {
  const theme = useTheme();
  const metadata = [
    `TIER: ${plan.tierAtGeneration.toUpperCase()}`,
    plan.isFallback ? 'FALLBACK' : null,
    formatPlanDate(plan.createdAt.slice(0, 10)),
  ]
    .filter(Boolean)
    .join('   ·   ');

  return (
    <Link href={{ pathname: '/plan/[id]', params: { id: plan.planId } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [
          styles.row,
          { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.rowTitle, { color: theme.text.primary }]}>
          {plan.title ?? 'Untitled plan'}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.text.secondary }]}>{metadata}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
    marginBottom: Spacing.two,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sampleRow: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTitle: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.md,
  },
  rowMeta: {
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xs,
  },
  sampleTag: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  sampleTagText: {
    fontFamily: FontFamily.mono.semiBold,
    fontSize: FontSize.xs,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  spinner: {
    marginTop: Spacing.four,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
