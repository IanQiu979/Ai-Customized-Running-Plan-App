import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VerifyEmailBanner } from '@/components/auth/VerifyEmailBanner';
import { HeaderMark } from '@/components/build/HeaderMark';
import { useBuildClock } from '@/components/build/useBuildClock';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PrimaryAction } from '@/components/ui/ActionButton';
import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { loadPlan } from '@/hooks/use-plan';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  describeError,
  getIntake,
  getQuotaStatus,
  listPlans,
  type PlanSummary,
} from '@/lib/apiClient';
import { MARK_TIMELINE } from '@/lib/buildMotion';
import { planProgress } from '@/lib/planProgress';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { QuotaStatus } from '@/lib/planTypes';

/**
 * Home. Since the captain's 2026-09-20 phone test this screen asks nothing and generates
 * nothing: the intake owns every question and the "Create plan" press (`src/app/intake.tsx`).
 * Home does three things:
 *
 *  1. **Gates first entry.** On focus it reads `getIntake()`; a signed-in runner with no intake
 *     on file is pushed to `/intake`, which they cannot leave until a plan exists (ruling 1). The
 *     push is skipped once the screen has blurred — the root layout's post-signup redirect may
 *     already have sent them there — so a fresh account never gets two intakes stacked.
 *  2. **Shows the subscription box first** — tier, plans used, "See plans" — above the current
 *     plan's summary (the newest plan by `createdAt`, opening it on tap), then the one CTA,
 *     **"Create a new plan"**, which always opens the intake, blank.
 *  3. **Links to My Plans.**
 *
 * Gone with that ruling: the read-only "Your target" card and its "Change" link, the plan-length
 * field, the Notes field and its Free-tier locked panel, and the "On Pro & Elite" teaser
 * (`docs/change_log.md`, 2026-09-20). Tier is still a **display** of `getQuotaStatus()`, never a
 * decision made here; quota and paywall outcomes belong to the intake's create press now.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [checkingIntake, setCheckingIntake] = useState(true);
  const [hasLoadedIntake, setHasLoadedIntake] = useState(false);
  const [hasIntake, setHasIntake] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // The newest plan, for the summary row and the header mark (V22-04): the mark fills to the day
  // of the current plan week, counted from the day that plan was created (`planProgress.ts` — the
  // app logs nothing).
  const [mostRecentPlan, setMostRecentPlan] = useState<PlanSummary | null>(null);
  const [mostRecentWeeks, setMostRecentWeeks] = useState<number | null>(null);

  // `useFocusEffect` (not a plain mount-only `useEffect`) because Expo Router keeps tab screens
  // mounted across navigation — coming back from the intake or a plan is a focus event, not a
  // remount, so a mount-only effect would never notice the intake that was just completed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setCheckingIntake(true);
      setLoadError(null);
      setQuotaError(null);

      (async () => {
        try {
          const { intake } = await getIntake();
          if (cancelled) return;
          setHasIntake(intake !== null);
          setHasLoadedIntake(true);
          if (intake === null) {
            // Ruling 1: intake is mandatory on first entry. `cancelled` doubles as the "still
            // focused" check — if something already navigated away (the post-signup redirect),
            // this must not push a second copy of the intake on top of it.
            router.push('/intake');
          }
        } catch (fetchError) {
          // Only `loadError` — the last known answer stays. A failed fetch is not proof that the
          // runner has no intake, so it never sends them to the intake.
          if (!cancelled) {
            setLoadError(describeError(fetchError, 'Could not load your intake.', API_BASE_URL));
          }
        } finally {
          if (!cancelled) setCheckingIntake(false);
        }

        try {
          const quotaStatus = await getQuotaStatus();
          if (!cancelled) setQuota(quotaStatus);
        } catch (quotaFetchError) {
          if (!cancelled) {
            setQuotaError(describeError(quotaFetchError, 'Could not load your quota.', API_BASE_URL));
          }
        }

        try {
          const { plans } = await listPlans();
          if (!cancelled) setMostRecentPlan(newestPlan(plans));
        } catch {
          // A failed refresh is not proof that the runner has no plan. Keep the last known plan
          // so a transient network error cannot blank the summary.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [router])
  );

  // The plan's length comes from its detail (summaries carry no weeks); cached after the first
  // read, so a focus refresh costs nothing.
  useEffect(() => {
    if (!mostRecentPlan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronising with the newest plan
      setMostRecentWeeks(null);
      return;
    }
    let cancelled = false;
    loadPlan(mostRecentPlan.planId)
      .then((loaded) => {
        if (!cancelled) setMostRecentWeeks(loaded.plan.durationWeeks);
      })
      .catch(() => {
        // Unknown length: the mark stays empty rather than guessing.
      });
    return () => {
      cancelled = true;
    };
  }, [mostRecentPlan]);

  const progress =
    mostRecentPlan && mostRecentWeeks !== null
      ? planProgress(mostRecentPlan.createdAt, mostRecentWeeks, new Date())
      : null;
  const completedDays = progress?.completedDays ?? 0;

  // The mark fills once on screen open and re-runs only when the data changes — never a loop.
  const mark = useBuildClock({ total: MARK_TIMELINE.total });
  const lastMarked = useRef<number | null>(null);
  useEffect(() => {
    if (lastMarked.current !== null && lastMarked.current !== completedDays) mark.restart();
    lastMarked.current = completedDays;
  }, [completedDays, mark]);

  function openMostRecentPlan() {
    if (!mostRecentPlan) return;
    router.push({
      pathname: '/plan/[id]',
      params: { id: mostRecentPlan.planId, createdAt: mostRecentPlan.createdAt },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            eyebrow={quota ? `${quota.tier} · ${formatQuotaLine(quota)}` : undefined}
            title="Today"
          />

          {/* Renders nothing for a verified account or an unconfigured mail provider — it decides
              for itself (`VerifyEmailBanner`), so Home carries no verification state. */}
          <VerifyEmailBanner />

          {loadError && <Text style={[styles.error, { color: theme.status.error }]}>{loadError}</Text>}

          {checkingIntake && !hasLoadedIntake ? (
            <ActivityIndicator color={theme.text.primary} style={styles.checkingSpinner} />
          ) : !hasIntake && !loadError ? (
            // The first-entry push is already in flight; nothing to offer underneath it. A runner
            // who somehow lands back here with no intake is sent again on the next focus.
            <ActivityIndicator color={theme.text.primary} style={styles.checkingSpinner} />
          ) : (
            <View style={styles.section}>
              {quotaError && <Text style={[styles.error, { color: theme.status.error }]}>{quotaError}</Text>}

              {/* The subscription box (V22-04), first by the captain's 2026-09-20 ruling: the
                  header mark beside the tier / plans-used counter, and the door to the paywall.
                  Only once the quota is known — an unknown tier is not "free". */}
              {quota ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${tierName(quota.tier)}, ${formatQuotaLine(quota)}. See plans`}
                  onPress={() => router.push('/paywall')}
                  style={({ pressed }) => [
                    styles.tierRow,
                    { borderColor: theme.hairline },
                    pressed && styles.pressed,
                  ]}
                >
                  <HeaderMark T={mark.T} completedDays={completedDays} />
                  <View style={styles.tierCopy}>
                    <Text style={[styles.tierName, { color: theme.text.primary }]}>
                      {tierName(quota.tier)}
                    </Text>
                    <Text style={[styles.tierQuota, { color: theme.text.secondary }]}>
                      {formatQuotaLine(quota).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.tierName, { color: theme.text.primary }]}>See plans →</Text>
                </Pressable>
              ) : null}

              {/* The plan summary: the newest plan, one flat row, opening it on tap. Absent
                  until a plan exists — no empty-state card for it. */}
              {mostRecentPlan ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Current plan: ${mostRecentPlan.title ?? 'Untitled plan'}. Open plan`}
                  onPress={openMostRecentPlan}
                  style={({ pressed }) => [
                    styles.planCard,
                    { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>CURRENT PLAN</Text>
                  <Text style={[styles.planTitle, { color: theme.text.primary }]}>
                    {mostRecentPlan.title ?? 'Untitled plan'}
                  </Text>
                  <Text style={[styles.planMeta, { color: theme.text.secondary }]}>
                    {planMetaLine(mostRecentWeeks, progress?.weekIndex ?? null)}
                  </Text>
                </Pressable>
              ) : null}

              {/* The screen's one accent. Always the intake, always blank (ruling 2 + 4). */}
              <PrimaryAction label="Create a new plan" onPress={() => router.push('/intake')} />

              {/* The push toward My Plans. A row, not a second button — this screen already spent
                  its one accent above, and a competing CTA is exactly what that rule prevents. */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Go to My Plans"
                onPress={() => router.push('/(tabs)/my-plans')}
                style={({ pressed }) => [
                  styles.navRow,
                  { borderTopColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.navRowText, { color: theme.text.primary }]}>
                  Everything you&apos;ve built
                </Text>
                <Text style={[styles.navRowHint, { color: theme.text.secondary }]}>My Plans →</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** The newest plan by `createdAt`, or `null` — the server's list order is its own business. */
function newestPlan(plans: readonly PlanSummary[]): PlanSummary | null {
  if (plans.length === 0) return null;
  return plans.reduce((latest, plan) => (plan.createdAt > latest.createdAt ? plan : latest));
}

function tierName(tier: QuotaStatus['tier']): string {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan`;
}

/** `12 WEEKS · WEEK 3` once the plan's length is known; `OPEN PLAN` until it is. */
function planMetaLine(weeks: number | null, weekIndex: number | null): string {
  if (weeks === null || weekIndex === null) return 'OPEN PLAN →';
  return `${weeks} WEEKS · WEEK ${weekIndex + 1}`;
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
  checkingSpinner: {
    marginTop: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  planCard: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  planTitle: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
    letterSpacing: Tracking.display,
  },
  planMeta: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: Stroke.hairline,
    paddingTop: Spacing.three,
    minHeight: Spacing.six,
  },
  navRowText: {
    flexShrink: 1,
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
  },
  navRowHint: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: Stroke.thin,
    borderRadius: Radius.button,
  },
  tierCopy: {
    flex: 1,
    gap: 3,
  },
  tierName: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.xs,
  },
  tierQuota: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 9,
    letterSpacing: 1,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
