import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteLine } from '@/components/brand/RouteLine';
import { LockedPanel } from '@/components/home/LockedPanel';
import { PlanContentTeaser } from '@/components/home/PlanContentTeaser';
import { NumberField } from '@/components/inputs/NumberField';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { GoalRealismNotice } from '@/components/plan/GoalRealismNotice';
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
import { PrimaryAction } from '@/components/ui/ActionButton';
import { API_BASE_URL, ApiError, describeError, generatePlan, getIntake, getQuotaStatus } from '@/lib/apiClient';
import { mintIdempotencyKey } from '@/lib/idempotencyKey';
import { assessGoalRealism } from '@/lib/paceDerivation';
import {
  buildGeneratePlanRequest,
  DEFAULT_PLAN_WEEKS,
  describePlanTarget,
  needsPlanLength,
  planTargetFromIntake,
} from '@/lib/planRequest';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { IntakeResponses, QuotaStatus } from '@/lib/planTypes';

/** `generate-plan-flow.ts`'s own cap on free-text `notes` — mirrored here only so the field
 * stops accepting keystrokes rather than the runner discovering the limit from a server error. */
const MAX_NOTES_LENGTH = 1000;

/**
 * Home. Checks whether the signed-in runner has completed intake (`getIntake()`). No intake yet: a
 * prompt links to `/intake`. Intake done: their target, read back from what they already answered,
 * and a single "Generate plan".
 *
 * **This screen asks no question intake has already asked.** It used to carry its own goal
 * type / race distance / race date panel, which the captain met as a second run through the same
 * survey and which blocked him outright when he had no race (2026-08-15). The target now comes
 * from `planTargetFromIntake`; the only field left is a plan length, and only when there is no
 * race date to derive one from. "Change" goes back to `/intake` — one place, one answer.
 *
 * Trailhead ships three states here, plus the two the network forces:
 *
 *  - **Empty** — no intake yet.
 *  - **Populated** — the target, the one ember "Generate plan", and a row pushing to My Plans.
 *  - **Free tier** — the same, with Notes locked behind a dashed `LockedPanel` and a second panel
 *    teasing what a Pro/Elite plan actually contains.
 *  - Loading, and a load error that keeps the last known intake on screen.
 *
 * The Free-tier lock is a **display** of `getQuotaStatus().tier`, never a decision made here.
 * Free tier is template-only and never reaches the model, so notes typed by a Free runner were
 * already being discarded server-side; showing the field as open was the bug.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [checkingIntake, setCheckingIntake] = useState(true);
  const [intake, setIntake] = useState<IntakeResponses | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const [planLengthWeeks, setPlanLengthWeeks] = useState(String(DEFAULT_PLAN_WEEKS));
  const [notes, setNotes] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Held across retries of the SAME attempt (a dropped connection, a re-press before the first
  // reply lands) so the backend's idempotency replay returns that attempt's own result rather than
  // reserving a second quota slot. Re-minted only once a generation actually settles, so the next
  // *distinct* "Generate plan" press isn't silently replayed as the previous one
  // (`generate-plan-flow.ts`'s replay path matches on this key alone, not on the request body).
  const [idempotencyKey, setIdempotencyKey] = useState(() => mintIdempotencyKey());

  const hasIntake = intake !== null;
  const target = planTargetFromIntake(intake);
  const askPlanLength = needsPlanLength(target);

  // Strictly a read of the server's answer. `quota === null` means "not answered yet", which is
  // NOT the same as "free" — rendering the lock on an unknown tier would flash a paywall at a
  // paying runner for as long as the request takes.
  const notesLocked = quota?.tier === 'free';
  const tierKnown = quota !== null;

  // Read-only preview of the same `assessGoalRealism()` the server runs — no new request field,
  // computed client-side from the runner's already-saved intake. Both the goal time and the
  // distance it was entered against come from that one saved record now, so the mismatch the old
  // independently-editable distance chip could create is gone.
  //
  // Gated on a *race* target specifically, not merely on a saved distance. A distance with no race
  // date generates a `duration` plan, which carries no `goalRealism`, no `racePaceTarget` and no
  // race-pace sessions — warning that a goal is ambitious when the plan does not target or assess
  // that goal is the same dishonest copy PR #75 removed.
  const goalRealismPreview =
    target.kind === 'race' && intake?.goalTimeSec !== undefined && intake.recentPerformance
      ? assessGoalRealism({
          goalTimeSec: intake.goalTimeSec,
          raceDistance: target.raceDistance,
          recent: intake.recentPerformance,
        })
      : undefined;

  // `useFocusEffect` (not a plain mount-only `useEffect`) because Expo Router keeps tab screens
  // mounted across navigation — leaving Home for Intake and coming back is a focus event, not a
  // remount, so a mount-only effect would keep showing "complete your intake" forever after the
  // runner had just done exactly that. It is also what makes a target edited in `/intake` show up
  // here the moment the runner returns.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setCheckingIntake(true);
      setLoadError(null);
      setQuotaError(null);

      (async () => {
        try {
          const { intake: fetchedIntake } = await getIntake();
          if (cancelled) return;
          setIntake(fetchedIntake);
        } catch (fetchError) {
          // Only `loadError` — the last known intake stays. A failed fetch is not an answer, and
          // rendering the empty state ("Answer a few questions… You only do this once") tells a
          // runner who has already completed intake that they have not.
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
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleGenerate() {
    setGenerateError(null);

    const built = buildGeneratePlanRequest({
      target,
      planLengthWeeks,
      // A locked field collects nothing, so there is nothing to send. This is not the client
      // enforcing the tier — the server already ignores notes on a template-only plan — it is the
      // request matching what the runner was actually able to type.
      notes: notesLocked ? '' : notes,
      idempotencyKey,
      now: new Date(),
    });
    if (!built.ok) {
      setGenerateError(built.error);
      return;
    }

    setGenerating(true);
    try {
      const response = await generatePlan(built.request);
      setIdempotencyKey(mintIdempotencyKey());
      router.push({ pathname: '/plan/[id]', params: { id: response.planId } });
    } catch (generatePlanError) {
      if (generatePlanError instanceof ApiError) {
        if (generatePlanError.body.code === 'intake_required') {
          setIntake(null);
        } else if (generatePlanError.body.code === 'over_quota') {
          router.push({
            pathname: '/paywall',
            params: { quota: JSON.stringify(generatePlanError.body.quota) },
          });
        } else {
          setGenerateError(generatePlanError.body.error);
          // A released idempotency key can never succeed on another retry. Mint a fresh key after
          // the server says the previous attempt is terminal; transport failures keep the key so
          // a lost successful response still replays safely.
          if (
            generatePlanError.body.code === 'invalid_request' &&
            generatePlanError.body.error.includes('previously failed')
          ) {
            setIdempotencyKey(mintIdempotencyKey());
          }
        }
      } else {
        setGenerateError(describeError(generatePlanError, 'Something went wrong. Try again.', API_BASE_URL));
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ScreenHeader eyebrow="Pace Blueprint" title="Today" routeLine />

          {/*
            Outside the branches on purpose. A failed refresh keeps the last known intake, so the
            has-intake branch is exactly where the runner most needs telling: the target below is
            the last one that loaded, not necessarily what the server holds now.
          */}
          {loadError && <Text style={[styles.error, { color: theme.status.error }]}>{loadError}</Text>}

          {checkingIntake ? (
            <ActivityIndicator color={theme.text.primary} style={styles.checkingSpinner} />
          ) : !hasIntake ? (
            <View style={styles.section}>
              <Text style={[styles.lede, { color: theme.text.primary }]}>
                Let&apos;s find your starting line.
              </Text>
              <Text style={[styles.body, { color: theme.text.secondary }]}>
                Answer a few questions about your running and we&apos;ll build your plan. You only
                do this once.
              </Text>

              {/* The mockup's plan-shape preview: the route line pencilled in as dots over its
                  baseline, because the plan it previews doesn't exist yet. Pure ornament — the
                  caption below it carries the meaning for assistive tech. */}
              <View
                style={[
                  styles.previewCard,
                  { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
                ]}
              >
                <RouteLine variant="card" dashed baseline />
                <Text style={[styles.previewCaption, { color: theme.text.secondary }]}>
                  A preview of what your plan&apos;s shape will look like — no plan yet.
                </Text>
              </View>

              <PrimaryAction label="Start intake" onPress={() => router.push('/intake')} />
            </View>
          ) : (
            <View style={styles.section}>
              {quotaError && <Text style={[styles.error, { color: theme.status.error }]}>{quotaError}</Text>}

              {/* The stat row: tier and remaining quota as a plate, not a caption. */}
              {quota && (
                <View
                  style={[
                    styles.statRow,
                    { borderTopColor: theme.hairline, borderBottomColor: theme.hairline },
                  ]}
                >
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>TIER</Text>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                      {quota.tier.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.hairline }]} />
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>PLANS</Text>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                      {formatQuotaLine(quota)}
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.targetCard,
                  { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
                ]}
              >
                <View style={styles.targetHeader}>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>YOUR TARGET</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change target"
                    hitSlop={Spacing.two}
                    onPress={() => router.push('/intake')}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={[styles.changeLink, { color: theme.text.primary }]}>Change</Text>
                  </Pressable>
                </View>
                <Text style={[styles.targetText, { color: theme.text.primary }]}>
                  {describePlanTarget(target)}
                </Text>
              </View>

              {goalRealismPreview && goalRealismPreview.realism !== 'realistic' ? (
                <GoalRealismNotice assessment={goalRealismPreview} variant="preview" />
              ) : null}

              {askPlanLength && (
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                    PLAN LENGTH (WEEKS)
                  </Text>
                  <NumberField
                    accessibilityLabel="Plan length in weeks"
                    value={planLengthWeeks}
                    onChangeValue={setPlanLengthWeeks}
                    maxIntegerDigits={3}
                    placeholder={String(DEFAULT_PLAN_WEEKS)}
                  />
                </View>
              )}

              {/* Held back until the server has answered — see `tierKnown`. */}
              {tierKnown && (
                <LockedPanel
                  locked={notesLocked}
                  label="Notes"
                  onUnlock={() => router.push('/paywall')}
                >
                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                      NOTES (OPTIONAL)
                    </Text>
                    <TextInput
                      accessibilityLabel="Notes"
                      value={notes}
                      onChangeText={(text) => setNotes(text.slice(0, MAX_NOTES_LENGTH))}
                      placeholder="Anything else the plan should account for"
                      placeholderTextColor={theme.progress.informative}
                      editable={!notesLocked}
                      multiline
                      maxLength={MAX_NOTES_LENGTH}
                      style={[
                        styles.notesInput,
                        {
                          color: theme.text.primary,
                          borderColor: theme.hairline,
                          backgroundColor: theme.surface.raised,
                        },
                      ]}
                    />
                  </View>
                </LockedPanel>
              )}

              {notesLocked && (
                <LockedPanel
                  locked
                  label="Pace targets, HR zones and coach's notes"
                  onUnlock={() => router.push('/paywall')}
                >
                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                      ON PRO &amp; ELITE
                    </Text>
                    <PlanContentTeaser />
                  </View>
                </LockedPanel>
              )}

              {generateError && (
                <Text style={[styles.error, { color: theme.status.error }]}>{generateError}</Text>
              )}

              <PrimaryAction
                label="Generate plan"
                disabled={generating}
                busy={generating}
                onPress={handleGenerate}
              />

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
  lede: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
    letterSpacing: Tracking.display,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
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
  statLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  statValue: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.lg,
  },
  previewCard: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  previewCaption: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  targetCard: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  targetText: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
    letterSpacing: Tracking.display,
  },
  changeLink: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  notesInput: {
    minHeight: Spacing.six * 1.5,
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  primaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
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
  pressed: {
    opacity: PressedOpacity,
  },
});
