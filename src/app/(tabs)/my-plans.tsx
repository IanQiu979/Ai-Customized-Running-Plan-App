import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/build/FadeIn';
import { PlanHero } from '@/components/build/PlanHero';
import { useBuildClock } from '@/components/build/useBuildClock';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PlanListRow } from '@/components/plan/PlanListRow';
import { PrimaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { loadPlan, type LoadedPlan } from '@/hooks/use-plan';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, describeError, listPlans } from '@/lib/apiClient';
import type { PlanSummary } from '@/lib/apiClient';
import { PLAN_HERO_TIMELINE } from '@/lib/buildMotion';
import { EXAMPLE_PLAN_ID, examplePlan } from '@/lib/fixtures/examplePlan';
import type { Plan } from '@/lib/planTypes';
import { EMPTY_STRIP_WEEK, stripFromWeek } from '@/lib/weekStrip';

/**
 * My Plans (V22-05). The hero is the runner's REAL most recent plan building itself: its actual
 * first week's blocks snap in with their real distances and the total counts to the real
 * number, once per screen open. If no plan exists yet the hero plays the pinned example plan —
 * there is no empty state, because the example plan is always there (the captain's explicit
 * "never remove the sample plan" call). Below it, once the build holds: "Open plan", and the
 * whole library as rows, the example plan pinned first.
 *
 * `listPlans()` returns summaries with no weeks, so the first-week miniatures come from
 * `loadPlan` (a session-long cache — a plan is immutable) for up to `DETAIL_LIMIT` plans,
 * filled in as each one lands; a row whose detail has not arrived draws the empty strip.
 *
 * The list is cache-first across focus refreshes: a second focus keeps the last known plans on
 * screen while the request runs (`__tests__/tab-cache-first.test.tsx`).
 */

/** How many listed plans get their detail fetched for a miniature. */
const DETAIL_LIMIT = 12;

export default function MyPlansScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasLoadedPlans, setHasLoadedPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  // Details land here as `loadPlan` resolves; keyed by plan id so each row re-renders alone.
  const [details, setDetails] = useState<Record<string, LoadedPlan>>({});
  const [detailFailed, setDetailFailed] = useState<Record<string, true>>({});
  const mostRecentPlan = latestPlan(plans);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      (async () => {
        try {
          const response = await listPlans();
          if (!cancelled) {
            setPlans(response.plans);
            setHasLoadedPlans(true);
          }
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

  // Fetch details for the miniatures — the most recent plan first, since the hero waits on it.
  useEffect(() => {
    let cancelled = false;
    const wanted = [...plans]
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
      .slice(0, DETAIL_LIMIT);
    for (const summary of wanted) {
      // A cached plan resolves on the next microtask, so the same path serves both cases.
      loadPlan(summary.planId)
        .then((loaded) => {
          if (!cancelled) setDetails((current) => ({ ...current, [summary.planId]: loaded }));
        })
        .catch(() => {
          // One miniature stays empty; the row is still a working link to the plan.
          if (!cancelled) setDetailFailed((current) => ({ ...current, [summary.planId]: true }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [plans]);

  // The hero's plan: the most recent real plan once its detail has arrived, otherwise — no plans
  // at all, or a list that failed to load — the example plan. While the list or the most recent
  // detail is still in flight, the hero waits rather than playing the example and then swapping.
  const mostRecentDetail = mostRecentPlan ? details[mostRecentPlan.planId] : undefined;
  let heroPlan: Plan | null = null;
  let heroId: string | null = null;
  if (mostRecentDetail && mostRecentPlan) {
    heroPlan = mostRecentDetail.plan;
    heroId = mostRecentPlan.planId;
  } else if (
    (hasLoadedPlans && plans.length === 0) ||
    (!hasLoadedPlans && error) ||
    (mostRecentPlan && detailFailed[mostRecentPlan.planId])
  ) {
    heroPlan = examplePlan;
    heroId = EXAMPLE_PLAN_ID;
  }
  const heroReady = heroPlan !== null;

  const { T, restart } = useBuildClock({ total: PLAN_HERO_TIMELINE.total, play: heroReady });
  // Plays once per screen open, and again only when the plan the hero shows changes.
  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!heroId) return;
    if (playedFor.current !== null && playedFor.current !== heroId) restart();
    playedFor.current = heroId;
  }, [heroId, restart]);

  const heroWeek = heroPlan?.weeks[0] ? stripFromWeek(heroPlan.weeks[0]) : EMPTY_STRIP_WEEK;
  const listed = [...plans].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader eyebrow="Your library" title="My Plans" />

          {heroPlan ? (
            <>
              <PlanHero
                T={T}
                week={heroWeek}
                eyebrow={heroId === EXAMPLE_PLAN_ID ? 'EXAMPLE' : 'MOST RECENT'}
                title={heroPlan.title}
                weekCount={heroPlan.durationWeeks}
              />
              <FadeIn T={T} at={PLAN_HERO_TIMELINE.cues.Hold} duration={0.5} lift={8} style={styles.afterHero}>
                <PrimaryAction
                  label="Open plan"
                  onPress={() =>
                    router.push({ pathname: '/plan/[id]', params: { id: heroId ?? EXAMPLE_PLAN_ID } })
                  }
                />
              </FadeIn>
            </>
          ) : loading && !hasLoadedPlans ? (
            <ActivityIndicator color={theme.text.primary} style={styles.spinner} />
          ) : null}

          <FadeIn T={T} at={PLAN_HERO_TIMELINE.cues.Hold} duration={0.5} lift={8} style={styles.list}>
            <Text style={[styles.listLabel, { color: theme.text.secondary }]}>
              ALL PLANS · {listed.length + 1}
            </Text>

            {error ? <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text> : null}

            <PlanListRow
              planId={EXAMPLE_PLAN_ID}
              title="Example Plan (5K)"
              meta={`${examplePlan.durationWeeks} WEEKS · SAMPLE`}
              week={stripFromWeek(examplePlan.weeks[0])}
              accessibilityLabel="Example Plan, 5K — a sample plan, always available"
            />

            {listed.map((plan) => {
              const detail = details[plan.planId];
              const meta = [
                detail ? `${detail.plan.durationWeeks} WEEKS` : null,
                plan.tierAtGeneration.toUpperCase(),
                plan.isFallback ? 'FALLBACK' : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <PlanListRow
                  key={plan.planId}
                  planId={plan.planId}
                  title={plan.title ?? 'Untitled plan'}
                  meta={meta}
                  week={detail?.plan.weeks[0] ? stripFromWeek(detail.plan.weeks[0]) : EMPTY_STRIP_WEEK}
                />
              );
            })}
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** The plan with the newest `createdAt`, or `null` when there are none.
 *
 * Computed rather than read off `plans[0]`: `GET /api/plans`'s ordering is the server's business
 * and this would silently become "the first row" the day that changes. */
function latestPlan(plans: readonly PlanSummary[]): PlanSummary | null {
  if (plans.length === 0) return null;
  return plans.reduce((latest, plan) => (plan.createdAt > latest.createdAt ? plan : latest));
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
    gap: Spacing.four,
  },
  afterHero: {
    marginTop: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  listLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 2,
    marginBottom: Spacing.half,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  spinner: {
    marginTop: Spacing.four,
  },
});
