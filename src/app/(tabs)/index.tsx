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

import { NumberField } from '@/components/inputs/NumberField';
import { GoalRealismNotice } from '@/components/plan/GoalRealismNotice';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
 * race date to derive one from. "Change target" goes back to `/intake` — one place, one answer.
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
          if (!cancelled) {
            setLoadError(describeError(fetchError, 'Could not load your intake.', API_BASE_URL));
            setIntake(null);
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
      notes,
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
          <Text style={[styles.title, { color: theme.text.primary }]}>Pace Blueprint</Text>

          {checkingIntake ? (
            <ActivityIndicator color={theme.text.primary} style={styles.checkingSpinner} />
          ) : !hasIntake ? (
            <View style={styles.section}>
              {loadError && <Text style={[styles.error, { color: theme.status.error }]}>{loadError}</Text>}
              <Text style={[styles.body, { color: theme.text.secondary }]}>
                Answer a few questions about your running and we&apos;ll build your plan. You only
                do this once.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/intake')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accent.hivis },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryButtonText, { color: theme.accent.onAccent }]}>
                  Start intake
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.section}>
              {quotaError && <Text style={[styles.error, { color: theme.status.error }]}>{quotaError}</Text>}
              {quota && (
                <Text style={[styles.body, { color: theme.text.secondary }]}>{formatQuotaLine(quota)}</Text>
              )}

              <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>YOUR TARGET</Text>
              <View style={styles.targetRow}>
                <Text style={[styles.targetText, { color: theme.text.primary }]}>
                  {describePlanTarget(target)}
                </Text>
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

              {goalRealismPreview && goalRealismPreview.realism !== 'realistic' ? (
                <GoalRealismNotice assessment={goalRealismPreview} variant="preview" />
              ) : null}

              {askPlanLength && (
                <>
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
                </>
              )}

              <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                value={notes}
                onChangeText={(text) => setNotes(text.slice(0, MAX_NOTES_LENGTH))}
                placeholder="Anything else the plan should account for"
                placeholderTextColor={theme.text.secondary}
                multiline
                maxLength={MAX_NOTES_LENGTH}
                style={[
                  styles.input,
                  styles.notesInput,
                  { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised },
                ]}
              />

              {generateError && (
                <Text style={[styles.error, { color: theme.status.error }]}>{generateError}</Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={generating}
                onPress={handleGenerate}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accent.hivis },
                  (pressed || generating) && styles.pressed,
                ]}
              >
                {generating ? (
                  <ActivityIndicator color={theme.accent.onAccent} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.accent.onAccent }]}>
                    Generate plan
                  </Text>
                )}
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
  title: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
  },
  checkingSpinner: {
    marginTop: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xs,
    marginTop: Spacing.two,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  targetText: {
    flexShrink: 1,
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.md,
  },
  changeLink: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },
  input: {
    minHeight: Spacing.six,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  notesInput: {
    minHeight: Spacing.six * 1.5,
    paddingVertical: Spacing.two,
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
  pressed: {
    opacity: PressedOpacity,
  },
});
