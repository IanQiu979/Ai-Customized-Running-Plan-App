import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteLine } from '@/components/brand/RouteLine';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { formatPlanDate } from '@/components/plan/format';
import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, describeError, listPlans } from '@/lib/apiClient';
import type { PlanSummary } from '@/lib/apiClient';
import { EXAMPLE_PLAN_ID } from '@/lib/fixtures/examplePlan';

/**
 * My Plans. A pinned "Example Plan" row (the static `examplePlan` fixture — the captain's
 * explicit "never remove the sample plan" call) always renders at the top, whatever `listPlans()`
 * returns or fails with. Below it: loading, an inline error, an empty state, or one row per
 * `PlanSummary`. Every row pushes to `plan/[id]`, which knows to render the fixture for
 * `EXAMPLE_PLAN_ID` and fetch everything else.
 *
 * Trailhead's register here is the formal one — a stat-row header counting what the runner has
 * built, then rows that read like entries in a ledger rather than cards in a feed. No ember: the
 * screen's forward action is generating a plan, and that lives on Home. A row is a destination,
 * not a call to action.
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
            setError(describeError(fetchError, 'Could not load your plans.', API_BASE_URL));
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
          <ScreenHeader eyebrow="Your library" title="My Plans" routeLine />

          {/* The count is only honest once the fetch has settled — a "0 PLANS" that flips to "3"
              a moment later is worse than no number at all. */}
          {!loading && !error && (
            <View
              style={[
                styles.statRow,
                { borderTopColor: theme.hairline, borderBottomColor: theme.hairline },
              ]}
            >
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>{plans.length}</Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                  {plans.length === 1 ? 'PLAN GENERATED' : 'PLANS GENERATED'}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.hairline }]} />
              <View style={styles.stat}>
                {/* Both stats are plain readings of the list. Nothing here infers a quality the
                    data doesn't state — an earlier draft counted non-`isFallback` plans as
                    "personalized", which is the client deciding what a tier means. */}
                <Text style={[styles.statValueDate, { color: theme.text.primary }]}>
                  {latestPlanDate(plans) ?? '—'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>MOST RECENT</Text>
              </View>
            </View>
          )}

          <Link href={{ pathname: '/plan/[id]', params: { id: EXAMPLE_PLAN_ID } }} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Example Plan, 5K — a sample plan, always available"
              style={({ pressed }) => [
                styles.row,
                styles.sampleRow,
                { borderColor: theme.progress.informative, backgroundColor: theme.surface.raised },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Example Plan (5K)</Text>
                <View style={[styles.tag, { borderColor: theme.progress.informative }]}>
                  <Text style={[styles.tagText, { color: theme.text.secondary }]}>SAMPLE</Text>
                </View>
              </View>
              <Text style={[styles.rowBody, { color: theme.text.secondary }]}>
                Always available — a hand-built plan to see the app in action.
              </Text>
              <RouteLine variant="header" style={styles.rowRoute} />
            </Pressable>
          </Link>

          {loading ? (
            <ActivityIndicator color={theme.text.primary} style={styles.spinner} />
          ) : error ? (
            <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>
          ) : plans.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>Nothing here yet.</Text>
              <Text style={[styles.rowBody, { color: theme.text.secondary }]}>
                Your generated plans will collect here. Start one from Home.
              </Text>
            </View>
          ) : (
            plans.map((plan) => <PlanRow key={plan.planId} plan={plan} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** The newest `createdAt` in the list, formatted, or `null` when there are none.
 *
 * Computed rather than read off `plans[0]`: `GET /api/plans`'s ordering is the server's business
 * and this stat would silently become "the first row" the day that changes. */
function latestPlanDate(plans: readonly PlanSummary[]): string | null {
  if (plans.length === 0) return null;
  const newest = plans.reduce((latest, plan) => (plan.createdAt > latest.createdAt ? plan : latest));
  return formatPlanDate(newest.createdAt.slice(0, 10));
}

function PlanRow({ plan }: { plan: PlanSummary }) {
  const theme = useTheme();

  // One glyph, one job: `·` separates peer fields. Same convention as `PlanNameplate`'s serial
  // plate, so the two read as the same system.
  const metadata = [plan.isFallback ? 'FALLBACK' : null, formatPlanDate(plan.createdAt.slice(0, 10))]
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
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, { color: theme.text.primary }]}>
            {plan.title ?? 'Untitled plan'}
          </Text>
          <View style={[styles.tag, { borderColor: theme.hairline }]}>
            <Text style={[styles.tagText, { color: theme.text.secondary }]}>
              {plan.tierAtGeneration.toUpperCase()}
            </Text>
          </View>
        </View>
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: Stroke.hairline,
    borderBottomWidth: Stroke.hairline,
    paddingVertical: Spacing.three,
    gap: Spacing.four,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  statDivider: {
    width: Stroke.hairline,
  },
  statValue: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
  },
  // A date is several glyphs where the count is one, so it takes the step below rather than
  // wrapping at `xxl`. Same family and weight — it still reads as the pair's other half.
  statValueDate: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.lg,
    letterSpacing: Tracking.display,
  },
  statLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  row: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sampleRow: {
    borderWidth: Stroke.mark,
    borderStyle: 'dashed',
  },
  rowRoute: {
    marginTop: Spacing.one,
    opacity: 0.7,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTitle: {
    flexShrink: 1,
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.lg,
    letterSpacing: Tracking.display,
  },
  rowBody: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  rowMeta: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  tag: {
    borderWidth: Stroke.thin,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  tagText: {
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  empty: {
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
    letterSpacing: Tracking.display,
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
