import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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

import { IntakeExitAction } from '@/components/intake/IntakeExitAction';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, getIntake, putIntake } from '@/lib/apiClient';
import { assessGoalRealism } from '@/lib/paceDerivation';
import type { ExperienceAnswer, InjuryFlag, IntakeResponses, RaceDistance } from '@/lib/planTypes';

const EXPERIENCE_OPTIONS: { value: ExperienceAnswer; label: string }[] = [
  { value: 'new', label: 'New to running' },
  { value: 'some', label: 'Some running experience' },
  { value: 'regular', label: 'Regular runner' },
  { value: 'experienced', label: 'Experienced runner' },
  { value: 'competitive', label: 'Competitive runner' },
];

const RACE_DISTANCE_OPTIONS: { value: RaceDistance; label: string }[] = [
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
];

const INJURY_OPTIONS: { value: InjuryFlag; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle_achilles', label: 'Ankle / Achilles' },
  { value: 'shin_splints', label: 'Shin splints' },
  { value: 'it_band', label: 'IT band' },
  { value: 'hip_glute', label: 'Hip / glute' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'plantar_arch', label: 'Plantar / arch' },
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

/** "MM:SS" for under an hour, "H:MM:SS" once it runs past one — mirrors the clock format
 * runners already read splits in. Returns '' for undefined so a fresh intake starts blank. */
function secToClock(sec: number | undefined): string {
  if (sec === undefined) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Parses "MM:SS" or "H:MM:SS" into total seconds. `null` on anything unparseable — the caller
 * turns that into an inline error rather than guessing. */
function clockToSec(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (numbers.length === 2) {
    const [m, s] = numbers;
    return m * 60 + s;
  }
  const [h, m, s] = numbers;
  return h * 3600 + m * 60 + s;
}

/** As-you-type mask for a `YYYY-MM-DD` field: strips non-digits, caps at 8 digits, and inserts
 * the two `-` separators as they're reached. No native date picker here — see the routing note
 * in AGENTS.md on new dependencies; this is the deliberate text-input fallback. */
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

/** As-you-type mask for a "MM:SS"/"H:MM:SS" field: strips non-digits, caps at 6 digits, and
 * groups them from the right into seconds, then minutes, then whatever's left as hours — so
 * "1234" becomes "12:34" and "12345" becomes "1:23:45", matching `secToClock`'s own format. */
function formatTimeInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
  }
  const seconds = digits.slice(-2);
  const minutes = digits.slice(-4, -2);
  const hours = digits.slice(0, -4);
  return `${hours}:${minutes}:${seconds}`;
}

/** Inline, complete-but-invalid check for a "MM:SS"/"H:MM:SS" field. Waits until the seconds
 * group has both digits typed before judging anything "complete", so an in-progress "1:2" isn't
 * flagged while the runner is still typing. */
function timeFieldError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const secondsPart = parts[parts.length - 1];
  if (secondsPart.length < 2) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) {
    return 'Enter a valid time (MM:SS or H:MM:SS).';
  }
  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  if (seconds > 59) return 'Seconds must be less than 60.';
  if (parts.length === 3 && minutes > 59) return 'Minutes must be less than 60.';
  return null;
}

/**
 * The intake questionnaire — all 10 `IntakeResponses` fields (`planTypes.ts`), prefilled from
 * `getIntake()` when the runner already has one saved, saved back via `putIntake()`. Hand-rolled
 * throughout (no form library, per project convention): single-selects are a column of
 * `Pressable` rows, multi-selects are toggle chips, races/goal-time/recent-performance fields are
 * plain `TextInput`s converted at submit time. Validation here mirrors only what the server
 * itself rejects with an actionable message (the recent-performance half-filled pair) — every
 * other rule is the server's `validateIntake` to own, surfaced via `ApiError.body.error`.
 */
export default function IntakeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Distinct from `saved` (which only reflects a save made *this* session) — set once from the
  // initial load, so the header reads "Done" for a runner revisiting an already-completed intake
  // even before they touch anything.
  const [hadIntakeOnLoad, setHadIntakeOnLoad] = useState(false);

  const intakeHeaderOptions = {
    headerShown: true,
    headerTitle: 'Intake',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: theme.surface.base },
    headerRight: () => (
      <IntakeExitAction
        color={theme.text.primary}
        onPress={() => router.replace('/(tabs)')}
        label={hadIntakeOnLoad || saved ? 'Done' : 'Skip for now'}
      />
    ),
  };

  const [goal, setGoal] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState<ExperienceAnswer | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [weeklyKm, setWeeklyKm] = useState('');

  const [raceDistance, setRaceDistance] = useState<RaceDistance | undefined>(undefined);
  const [raceDate, setRaceDate] = useState('');
  const [goalTime, setGoalTime] = useState('');

  const [recentDistance, setRecentDistance] = useState<RaceDistance | undefined>(undefined);
  const [recentTime, setRecentTime] = useState('');

  const [injuries, setInjuries] = useState<InjuryFlag[]>(['none']);
  const [injuryNotes, setInjuryNotes] = useState('');

  // Inline, as-you-type feedback for the three masked date/time fields — derived from the current
  // text on every render rather than held in their own state, so there's nothing to keep in sync.
  const raceDateError = raceDistance ? dateFieldError(raceDate) : null;
  const goalTimeError = raceDistance ? timeFieldError(goalTime) : null;
  const recentTimeError = timeFieldError(recentTime);

  // Derived, not stateful — recomputed every render like the error checks above. Only meaningful
  // once both a complete goal time and a complete recent performance are entered; `undefined`
  // otherwise (mirrors `assessGoalRealism`'s own "both or neither" contract).
  const goalTimeSecForRealism =
    raceDistance && !goalTimeError && goalTime.trim() ? clockToSec(goalTime) : null;
  const recentTimeSecForRealism =
    recentDistance && !recentTimeError && recentTime.trim() ? clockToSec(recentTime) : null;
  const goalRealism =
    raceDistance && goalTimeSecForRealism !== null && recentDistance && recentTimeSecForRealism !== null
      ? assessGoalRealism({
          goalTimeSec: goalTimeSecForRealism,
          raceDistance,
          recent: { distance: recentDistance, timeSec: recentTimeSecForRealism },
        })
      : undefined;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { intake } = await getIntake();
        if (cancelled || !intake) return;
        setHadIntakeOnLoad(true);
        setGoal(intake.goal);
        setAge(String(intake.age));
        setExperience(intake.experience);
        setDaysPerWeek(intake.daysPerWeek);
        setWeeklyKm(String(intake.weeklyKm));
        setRaceDistance(intake.raceDistance);
        setRaceDate(intake.raceDate ?? '');
        setGoalTime(secToClock(intake.goalTimeSec));
        setRecentDistance(intake.recentPerformance?.distance);
        setRecentTime(intake.recentPerformance ? secToClock(intake.recentPerformance.timeSec) : '');
        setInjuries(intake.injuries.length > 0 ? intake.injuries : ['none']);
        setInjuryNotes(intake.injuryNotes ?? '');
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof ApiError ? fetchError.body.error : 'Could not load your intake.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleInjury(flag: InjuryFlag) {
    setInjuries((current) => {
      if (flag === 'none') return ['none'];
      const withoutNone = current.filter((f) => f !== 'none');
      if (withoutNone.includes(flag)) {
        const next = withoutNone.filter((f) => f !== flag);
        return next.length > 0 ? next : ['none'];
      }
      return [...withoutNone, flag];
    });
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!goal.trim()) {
      setError('Goal is required.');
      return;
    }
    const ageNum = Number(age);
    if (!age.trim() || Number.isNaN(ageNum)) {
      setError('Age is required.');
      return;
    }
    if (!experience) {
      setError('Select your experience level.');
      return;
    }
    if (!daysPerWeek) {
      setError('Select how many days a week you run.');
      return;
    }
    const weeklyKmNum = Number(weeklyKm);
    if (!weeklyKm.trim() || Number.isNaN(weeklyKmNum)) {
      setError('Weekly distance is required.');
      return;
    }

    // Mirrors the server's own half-filled-pair rejection (`workers/src/routes.ts`,
    // `validateIntake`) — a recent performance with only a distance or only a time disables
    // every numeric pace without saying so.
    const hasRecentDistance = recentDistance !== undefined;
    const hasRecentTime = recentTime.trim().length > 0;
    if (hasRecentDistance !== hasRecentTime) {
      setError('Provide both a recent distance and a time, or leave both blank.');
      return;
    }
    let recentTimeSec: number | null = null;
    if (hasRecentDistance && hasRecentTime) {
      recentTimeSec = clockToSec(recentTime);
      if (recentTimeSec === null) {
        setError('Recent time must be in MM:SS or H:MM:SS format.');
        return;
      }
    }

    if (
      raceDistance &&
      raceDate.trim().length > 0 &&
      (raceDate.replace(/\D/g, '').length < 8 || dateFieldError(raceDate))
    ) {
      setError('Race date must be a valid YYYY-MM-DD date.');
      return;
    }

    let goalTimeSec: number | undefined;
    if (raceDistance && goalTime.trim().length > 0) {
      const parsed = clockToSec(goalTime);
      if (parsed === null) {
        setError('Goal time must be in MM:SS or H:MM:SS format.');
        return;
      }
      goalTimeSec = parsed;
    }

    const payload: IntakeResponses = {
      goal: goal.trim(),
      age: ageNum,
      experience,
      daysPerWeek,
      weeklyKm: weeklyKmNum,
      ...(raceDistance ? { raceDistance } : {}),
      ...(raceDistance && raceDate.trim() ? { raceDate: raceDate.trim() } : {}),
      ...(goalTimeSec !== undefined ? { goalTimeSec } : {}),
      ...(recentDistance && recentTimeSec !== null
        ? { recentPerformance: { distance: recentDistance, timeSec: recentTimeSec } }
        : {}),
      injuries,
      ...(injuryNotes.trim() ? { injuryNotes: injuryNotes.trim() } : {}),
    };

    setSubmitting(true);
    try {
      await putIntake(payload);
      setSaved(true);
      router.replace('/(tabs)');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.body.error : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={intakeHeaderOptions} />
        <ActivityIndicator color={theme.text.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={intakeHeaderOptions} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Goal" theme={theme}>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Finish my first 10K"
              placeholderTextColor={theme.text.secondary}
              style={[styles.input, inputThemeStyle(theme)]}
            />
          </Field>

          <Field label="Age" theme={theme}>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="e.g. 34"
              placeholderTextColor={theme.text.secondary}
              keyboardType="number-pad"
              style={[styles.input, inputThemeStyle(theme)]}
            />
          </Field>

          <Field label="Experience" theme={theme}>
            <View style={styles.optionColumn}>
              {EXPERIENCE_OPTIONS.map((option) => (
                <OptionRow
                  key={option.value}
                  label={option.label}
                  selected={experience === option.value}
                  onPress={() => setExperience(option.value)}
                  theme={theme}
                />
              ))}
            </View>
          </Field>

          <Field label="Days per week" theme={theme}>
            <View style={styles.chipRow}>
              {DAY_OPTIONS.map((day) => (
                <Chip
                  key={day}
                  label={String(day)}
                  selected={daysPerWeek === day}
                  onPress={() => setDaysPerWeek(day)}
                  theme={theme}
                />
              ))}
            </View>
          </Field>

          <Field label="Weekly distance (km)" theme={theme}>
            <TextInput
              value={weeklyKm}
              onChangeText={setWeeklyKm}
              placeholder="e.g. 35"
              placeholderTextColor={theme.text.secondary}
              keyboardType="decimal-pad"
              style={[styles.input, inputThemeStyle(theme)]}
            />
          </Field>

          <Field label="Target race (optional)" theme={theme}>
            <View style={styles.chipRow}>
              {RACE_DISTANCE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={raceDistance === option.value}
                  onPress={() =>
                    setRaceDistance((current) => (current === option.value ? undefined : option.value))
                  }
                  theme={theme}
                />
              ))}
            </View>
          </Field>

          {raceDistance ? (
            <>
              <Field label="Race date (optional, YYYY-MM-DD)" theme={theme}>
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
                    inputThemeStyle(theme),
                    raceDateError && { borderColor: theme.status.error },
                  ]}
                />
                {raceDateError && (
                  <Text style={[styles.fieldError, { color: theme.status.error }]}>
                    {raceDateError}
                  </Text>
                )}
              </Field>

              <Field label="Goal time (optional, MM:SS or H:MM:SS)" theme={theme}>
                <TextInput
                  value={goalTime}
                  onChangeText={(text) => setGoalTime(formatTimeInput(text))}
                  placeholder="24:00"
                  placeholderTextColor={theme.text.secondary}
                  keyboardType="number-pad"
                  maxLength={8}
                  style={[
                    styles.input,
                    inputThemeStyle(theme),
                    goalTimeError && { borderColor: theme.status.error },
                  ]}
                />
                {goalTimeError && (
                  <Text style={[styles.fieldError, { color: theme.status.error }]}>
                    {goalTimeError}
                  </Text>
                )}
                {!goalTimeError && goalRealism && goalRealism.realism !== 'realistic' ? (
                  <Text style={[styles.fieldError, { color: theme.text.secondary }]}>
                    Based on your recent performance, that goal is {goalRealism.realism} — the plan
                    will target a more sustainable pace.
                  </Text>
                ) : null}
              </Field>
            </>
          ) : null}

          <Field label="Recent performance (optional)" theme={theme}>
            <View style={styles.chipRow}>
              {RACE_DISTANCE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={recentDistance === option.value}
                  onPress={() =>
                    setRecentDistance((current) => (current === option.value ? undefined : option.value))
                  }
                  theme={theme}
                />
              ))}
            </View>
            <TextInput
              value={recentTime}
              onChangeText={(text) => setRecentTime(formatTimeInput(text))}
              placeholder="Time — MM:SS or H:MM:SS"
              placeholderTextColor={theme.text.secondary}
              keyboardType="number-pad"
              maxLength={8}
              style={[
                styles.input,
                inputThemeStyle(theme),
                styles.recentTimeInput,
                recentTimeError && { borderColor: theme.status.error },
              ]}
            />
            {recentTimeError && (
              <Text style={[styles.fieldError, { color: theme.status.error }]}>
                {recentTimeError}
              </Text>
            )}
          </Field>

          <Field label="Injuries" theme={theme}>
            <View style={styles.chipRow}>
              {INJURY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={injuries.includes(option.value)}
                  onPress={() => toggleInjury(option.value)}
                  theme={theme}
                />
              ))}
            </View>
          </Field>

          <Field label="Injury notes (optional)" theme={theme}>
            <TextInput
              value={injuryNotes}
              onChangeText={setInjuryNotes}
              placeholder="Anything else worth knowing"
              placeholderTextColor={theme.text.secondary}
              multiline
              style={[styles.input, inputThemeStyle(theme), styles.notesInput]}
            />
          </Field>

          {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.accent.hivis },
              (pressed || submitting) && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={theme.accent.onAccent} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.accent.onAccent }]}>
                Save intake
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function inputThemeStyle(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.text.primary,
    borderColor: theme.hairline,
    backgroundColor: theme.surface.raised,
  };
}

function Field({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ReturnType<typeof useTheme>;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function OptionRow({
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
        styles.optionRow,
        {
          borderColor: selected ? theme.text.primary : theme.hairline,
          backgroundColor: theme.surface.raised,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionRowText, { color: theme.text.primary }]}>{label}</Text>
    </Pressable>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xs,
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
  recentTimeInput: {
    marginTop: Spacing.two,
  },
  optionColumn: {
    gap: Spacing.two,
  },
  optionRow: {
    minHeight: Spacing.six,
    borderWidth: 1.5,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  optionRowText: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
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
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
