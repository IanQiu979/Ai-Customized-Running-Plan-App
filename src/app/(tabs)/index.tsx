import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalRealismNotice } from '@/components/plan/GoalRealismNotice';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, ApiError, describeError, generatePlan, getIntake, getQuotaStatus } from '@/lib/apiClient';
import { mintIdempotencyKey } from '@/lib/idempotencyKey';
import { assessGoalRealism } from '@/lib/paceDerivation';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { GoalType, IntakeResponses, QuotaStatus, RaceDistance } from '@/lib/planTypes';

const RACE_DISTANCE_OPTIONS: { value: RaceDistance; label: string }[] = [
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
];

/** `generate-plan-flow.ts`'s own cap on free-text `notes` — mirrored here only so the field
 * stops accepting keystrokes rather than the runner discovering the limit from a server error. */
const MAX_NOTES_LENGTH = 1000;

/** As-you-type mask for a `YYYY-MM-DD` field: strips non-digits, caps at 8 digits, and inserts
 * the two `-` separators as they're reached. No native date picker here — see the routing note
 * in AGENTS.md on new dependencies; this is the deliberate text-input fallback. Mirrors
 * `intake.tsx`'s identical helper — kept local rather than shared per this fix's file scope. */
function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 4);
  if (digits.length > 4) out += `-${digits.slice(4, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  return out;
}

/** Inline, complete-but-invalid check for a `YYYY-MM-DD` field. Returns `null` while the runner
 * is still typing (fewer than 8 digits) so the message doesn't flash on every keystroke — only
 * once all 8 digits are in does an out-of-range month/day or non-existent calendar date surface. */
function dateFieldError(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  if (month < 1 || month > 12) return 'Enter a valid month (01-12).';
  if (day < 1 || day > 31) return 'Enter a valid day (01-31).';
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return 'Enter a valid calendar date.';
  }
  return null;
}

/**
 * Home. On mount, checks whether the signed-in runner has completed intake (`getIntake()`). No
 * intake yet: a prompt links to `/intake`. Intake done: a compact generate-configuration panel —
 * goal type, then either a race distance + date or a duration in weeks, plus optional notes —
 * that calls `generatePlan()` and pushes straight to the real plan view on success. The one-time
 * static-fixture demo link this screen used to carry has moved to the "My Plans" tab, where it
 * now sits permanently pinned above real, backend-fetched plans.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [checkingIntake, setCheckingIntake] = useState(true);
  const [hasIntake, setHasIntake] = useState(false);
  const [intake, setIntake] = useState<IntakeResponses | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const [goalType, setGoalType] = useState<GoalType>('race');
  const [raceDistance, setRaceDistance] = useState<RaceDistance | undefined>(undefined);
  const [raceDate, setRaceDate] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('');
  const [notes, setNotes] = useState('');

  // Prefill the panel's race distance/date from the runner's saved intake exactly once per
  // mount — refiring on every refocus would clobber an in-progress edit the moment the runner
  // tabs away and back.
  const hasPrefilled = useRef(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Held across retries of the SAME attempt (a dropped connection, a re-press before the first
  // reply lands) so the backend's idempotency replay returns that attempt's own result rather than
  // reserving a second quota slot. Re-minted only once a generation actually settles, so the next
  // *distinct* "Generate plan" press isn't silently replayed as the previous one
  // (`generate-plan-flow.ts`'s replay path matches on this key alone, not on the request body).
  const [idempotencyKey, setIdempotencyKey] = useState(() => mintIdempotencyKey());

  // Inline, as-you-type feedback for the masked race-date field — derived from the current text
  // on every render, only while it's the active goal type.
  const raceDateError = goalType === 'race' ? dateFieldError(raceDate) : null;

  // Read-only preview of the same `assessGoalRealism()` the server runs — no new request field,
  // computed client-side from the runner's already-saved intake. The saved `goalTimeSec` was
  // entered against `intake.raceDistance` specifically, and this panel's own `raceDistance` chip
  // is independently editable, so the preview is only meaningful while the two still agree —
  // otherwise it'd silently judge a goal time against a distance it was never set for.
  const goalRealismPreview =
    goalType === 'race' &&
    raceDistance &&
    intake?.raceDistance === raceDistance &&
    intake?.goalTimeSec !== undefined &&
    intake?.recentPerformance
      ? assessGoalRealism({
          goalTimeSec: intake.goalTimeSec,
          raceDistance,
          recent: intake.recentPerformance,
        })
      : undefined;

  // `useFocusEffect` (not a plain mount-only `useEffect`) because Expo Router keeps tab screens
  // mounted across navigation — leaving Home for Intake and coming back is a focus event, not a
  // remount, so a mount-only effect would keep showing "complete your intake" forever after the
  // runner had just done exactly that.
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
          setHasIntake(!!fetchedIntake);
          setIntake(fetchedIntake);

          if (!hasPrefilled.current && fetchedIntake) {
            if (fetchedIntake.raceDistance) setRaceDistance(fetchedIntake.raceDistance);
            if (fetchedIntake.raceDate) setRaceDate(fetchedIntake.raceDate);
            hasPrefilled.current = true;
          }
        } catch (fetchError) {
          if (!cancelled) {
            setLoadError(describeError(fetchError, 'Could not load your intake.', API_BASE_URL));
            setHasIntake(false);
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

    if (goalType === 'race') {
      if (!raceDistance) {
        setGenerateError('Select a race distance.');
        return;
      }
      if (!raceDate.trim()) {
        setGenerateError('Race date is required.');
        return;
      }
      if (raceDate.replace(/\D/g, '').length < 8 || dateFieldError(raceDate)) {
        setGenerateError('Race date must be a valid YYYY-MM-DD date.');
        return;
      }
    } else {
      const weeksNum = Number(durationWeeks);
      if (!durationWeeks.trim() || !Number.isInteger(weeksNum) || weeksNum <= 0) {
        setGenerateError('Duration must be a whole number of weeks greater than 0.');
        return;
      }
    }

    setGenerating(true);
    try {
      const response = await generatePlan({
        goalType,
        ...(goalType === 'race' ? { raceDistance, raceDate: raceDate.trim() } : {}),
        ...(goalType === 'duration' ? { durationWeeks: Number(durationWeeks) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        idempotencyKey,
      });
      setIdempotencyKey(mintIdempotencyKey());
      router.push({ pathname: '/plan/[id]', params: { id: response.planId } });
    } catch (generatePlanError) {
      if (generatePlanError instanceof ApiError) {
        if (generatePlanError.body.code === 'intake_required') {
          setHasIntake(false);
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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Pace Blueprint</Text>

          {checkingIntake ? (
            <ActivityIndicator color={theme.text.primary} style={styles.checkingSpinner} />
          ) : !hasIntake ? (
            <View style={styles.section}>
              {loadError && <Text style={[styles.error, { color: theme.status.error }]}>{loadError}</Text>}
              <Text style={[styles.body, { color: theme.text.secondary }]}>
                Complete your intake to generate a plan.
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
                  Complete intake
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.section}>
              {quotaError && <Text style={[styles.error, { color: theme.status.error }]}>{quotaError}</Text>}
              {quota && (
                <Text style={[styles.body, { color: theme.text.secondary }]}>{formatQuotaLine(quota)}</Text>
              )}

              <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>GOAL TYPE</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Race"
                  selected={goalType === 'race'}
                  onPress={() => setGoalType('race')}
                  theme={theme}
                />
                <Chip
                  label="Duration"
                  selected={goalType === 'duration'}
                  onPress={() => setGoalType('duration')}
                  theme={theme}
                />
              </View>

              {goalType === 'race' ? (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>RACE DISTANCE</Text>
                  <View style={styles.chipRow}>
                    {RACE_DISTANCE_OPTIONS.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={raceDistance === option.value}
                        onPress={() => setRaceDistance(option.value)}
                        theme={theme}
                      />
                    ))}
                  </View>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                    RACE DATE (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    value={raceDate}
                    onChangeText={(text) => setRaceDate(formatDateInput(text))}
                    placeholder="2026-09-26"
                    placeholderTextColor={theme.text.secondary}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={[
                      styles.input,
                      {
                        color: theme.text.primary,
                        borderColor: raceDateError ? theme.status.error : theme.hairline,
                        backgroundColor: theme.surface.raised,
                      },
                    ]}
                  />
                  {raceDateError && (
                    <Text style={[styles.fieldError, { color: theme.status.error }]}>
                      {raceDateError}
                    </Text>
                  )}
                  {goalRealismPreview && goalRealismPreview.realism !== 'realistic' ? (
                    <GoalRealismNotice assessment={goalRealismPreview} variant="preview" />
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>DURATION (WEEKS)</Text>
                  <TextInput
                    value={durationWeeks}
                    onChangeText={setDurationWeeks}
                    placeholder="e.g. 12"
                    placeholderTextColor={theme.text.secondary}
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised },
                    ]}
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

function Chip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.text.primary : theme.hairline,
          backgroundColor: selected ? theme.text.primary : theme.surface.raised,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? theme.surface.base : theme.text.primary }]}>
        {label}
      </Text>
    </Pressable>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: Spacing.six,
    borderWidth: 1.5,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
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
  fieldError: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
    marginTop: Spacing.half,
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
