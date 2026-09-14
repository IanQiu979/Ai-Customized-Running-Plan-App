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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SurveyIntro } from '@/components/build/SurveyIntro';
import { useBuildClock } from '@/components/build/useBuildClock';

import { ClockField } from '@/components/inputs/ClockField';
import { DateField } from '@/components/inputs/DateField';
import { NumberField } from '@/components/inputs/NumberField';
import { IntakeExitAction } from '@/components/intake/IntakeExitAction';
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
import { API_BASE_URL, describeError, getIntake, putIntake } from '@/lib/apiClient';
import {
  clockFieldError,
  clockPartsToSeconds,
  datePartsToIso,
  dateFieldError,
  EMPTY_CLOCK,
  EMPTY_DATE,
  isClockBlank,
  isDateBlank,
  isoToDateParts,
  secondsToClockParts,
  type ClockParts,
  type DateParts,
} from '@/lib/fieldInput';
import { SURVEY_TIMELINE } from '@/lib/buildMotion';
import { getGoalRealismIntakeCopy } from '@/lib/goalRealismDisclosure';
import { assessGoalRealism } from '@/lib/paceDerivation';
import { intakeRaceDateError } from '@/lib/planRequest';
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

/**
 * The intake questionnaire — all 10 `IntakeResponses` fields (`planTypes.ts`), prefilled from
 * `getIntake()` when the runner already has one saved, saved back via `putIntake()`. Hand-rolled
 * throughout (no form library, per project convention): single-selects are a column of
 * `Pressable` rows, multi-selects are toggle chips. Numeric answers go through
 * `components/inputs/` — `NumberField` for age and weekly volume, `DateField` for the race date,
 * `ClockField` for the two times — so a date or a time is entered one component per box with the
 * `-`/`:` printed between them, never typed, and no free text is ever parsed. That replaced a
 * masked single field the captain could not enter values into on a phone (2026-08-15); see
 * `src/lib/fieldInput.ts`'s header for the repro. Validation here mirrors only what the server
 * itself rejects with an actionable message (the recent-performance half-filled pair) — every
 * other rule is the server's `validateIntake` to own, surfaced via `ApiError.body.error`.
 *
 * This screen is the ONLY place the runner is asked for their target race. Home reads it back
 * from the saved intake and never re-asks — see `src/lib/planRequest.ts`.
 *
 * A first-time runner sees the survey intro first (V22-03, `components/build/SurveyIntro.tsx`):
 * a full-viewport build of a week stacking into a plan that holds, then PRESS TO CONTINUE; a tap
 * reveals the questions below exactly as they render otherwise. It shows only when `getIntake()`
 * returns nothing — a runner editing an existing intake (Home's "Change") goes straight to the
 * form — and the questions themselves never animate.
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
  // The intro is dismissed by a tap on its settled end frame and never comes back this visit.
  const [introDone, setIntroDone] = useState(false);
  const showIntro = !loading && !hadIntakeOnLoad && !introDone;
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { T: introClock, settled: introSettled } = useBuildClock({
    total: SURVEY_TIMELINE.total,
    play: showIntro,
  });

  const intakeHeaderOptions = {
    headerShown: true,
    headerTitle: 'About your running',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: theme.surface.base },
    // The one place in the app that renders a native header *title*. The nav theme deliberately
    // leaves its `fonts` block stock (`constants/navigation-theme.ts` says why), so without this
    // the header title would be the only San Francisco / Roboto glyphs on the screen.
    headerTitleStyle: { fontFamily: FontFamily.body.semiBold, fontSize: FontSize.md },
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
  const [raceDate, setRaceDate] = useState<DateParts>(EMPTY_DATE);
  const [goalTime, setGoalTime] = useState<ClockParts>(EMPTY_CLOCK);

  const [recentDistance, setRecentDistance] = useState<RaceDistance | undefined>(undefined);
  const [recentTime, setRecentTime] = useState<ClockParts>(EMPTY_CLOCK);

  const [injuries, setInjuries] = useState<InjuryFlag[]>(['none']);
  const [injuryNotes, setInjuryNotes] = useState('');

  // Inline, as-you-type feedback for the three structured date/time fields — derived from the
  // current parts on every render rather than held in their own state, so there's nothing to keep
  // in sync. Each stays quiet until the runner has typed enough for a box to be judged.
  const raceDateError = raceDistance ? dateFieldError(raceDate) : null;
  const goalTimeError = raceDistance ? clockFieldError(goalTime) : null;
  const recentTimeError = clockFieldError(recentTime);

  // Derived, not stateful — recomputed every render like the error checks above. Only meaningful
  // once both a complete goal time and a complete recent performance are entered; `undefined`
  // otherwise (mirrors `assessGoalRealism`'s own "both or neither" contract).
  const goalTimeSecForRealism = raceDistance ? clockPartsToSeconds(goalTime) : null;
  const recentTimeSecForRealism = recentDistance ? clockPartsToSeconds(recentTime) : null;
  const goalRealism =
    raceDistance && goalTimeSecForRealism !== null && recentDistance && recentTimeSecForRealism !== null
      ? assessGoalRealism({
          goalTimeSec: goalTimeSecForRealism,
          raceDistance,
          recent: { distance: recentDistance, timeSec: recentTimeSecForRealism },
        })
      : undefined;
  const goalRealismCopy = getGoalRealismIntakeCopy(goalRealism);

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
        setRaceDate(isoToDateParts(intake.raceDate));
        setGoalTime(secondsToClockParts(intake.goalTimeSec));
        setRecentDistance(intake.recentPerformance?.distance);
        setRecentTime(secondsToClockParts(intake.recentPerformance?.timeSec));
        setInjuries(intake.injuries.length > 0 ? intake.injuries : ['none']);
        setInjuryNotes(intake.injuryNotes ?? '');
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            describeError(fetchError, 'Could not load your intake.', API_BASE_URL)
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
    if (!age.trim() || !Number.isInteger(ageNum) || ageNum < 13 || ageNum > 100) {
      setError('Age must be a whole number between 13 and 100.');
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
    if (!weeklyKm.trim() || !Number.isFinite(weeklyKmNum) || weeklyKmNum < 0) {
      setError('Weekly distance must be 0 km or more.');
      return;
    }

    // Mirrors the server's own half-filled-pair rejection (`workers/src/routes.ts`,
    // `validateIntake`) — a recent performance with only a distance or only a time disables
    // every numeric pace without saying so.
    const hasRecentDistance = recentDistance !== undefined;
    const hasRecentTime = !isClockBlank(recentTime);
    if (hasRecentDistance !== hasRecentTime) {
      setError('Provide both a recent distance and a time, or leave both blank.');
      return;
    }
    let recentTimeSec: number | null = null;
    if (hasRecentDistance && hasRecentTime) {
      recentTimeSec = clockPartsToSeconds(recentTime);
      if (recentTimeSec === null) {
        setError('Enter your recent time as hours, minutes and seconds.');
        return;
      }
    }

    let raceDateIso: string | undefined;
    if (raceDistance && !isDateBlank(raceDate)) {
      const parsed = datePartsToIso(raceDate);
      if (parsed === null) {
        setError('Enter your race date as a real calendar date, or clear it.');
        return;
      }
      raceDateIso = parsed;
    }
    const staleRaceDateError = intakeRaceDateError(raceDateIso, new Date());
    if (staleRaceDateError) {
      setError(staleRaceDateError);
      return;
    }

    let goalTimeSec: number | undefined;
    if (raceDistance && !isClockBlank(goalTime)) {
      const parsed = clockPartsToSeconds(goalTime);
      if (parsed === null) {
        setError('Enter your goal time as hours, minutes and seconds, or clear it.');
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
      ...(raceDateIso ? { raceDate: raceDateIso } : {}),
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
      setError(describeError(saveError, 'Something went wrong. Try again.', API_BASE_URL));
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

  if (showIntro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
        {/* The intro's canvas carries its own top safe area, so the native header steps aside. */}
        <Stack.Screen options={{ headerShown: false }} />
        <SurveyIntro
          T={introClock}
          width={viewportWidth}
          height={viewportHeight}
          settled={introSettled}
          onContinue={() => setIntroDone(true)}
        />
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
              maxLength={500}
              placeholder="e.g. Finish my first 10K"
              placeholderTextColor={theme.text.secondary}
              style={[styles.input, inputThemeStyle(theme)]}
            />
          </Field>

          <Field label="Age" theme={theme}>
            <NumberField
              accessibilityLabel="Age"
              value={age}
              onChangeValue={setAge}
              maxIntegerDigits={3}
              placeholder="e.g. 34"
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
            <NumberField
              accessibilityLabel="Weekly distance in kilometres"
              value={weeklyKm}
              onChangeValue={setWeeklyKm}
              mode="decimal"
              maxIntegerDigits={3}
              placeholder="e.g. 35"
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
              <Field label="Race date (optional)" theme={theme}>
                <DateField
                  accessibilityLabel="Race date"
                  parts={raceDate}
                  onChange={setRaceDate}
                  invalid={raceDateError !== null}
                />
                {raceDateError && (
                  <Text style={[styles.fieldError, { color: theme.status.error }]}>
                    {raceDateError}
                  </Text>
                )}
              </Field>

              <Field label="Goal time (optional)" theme={theme}>
                <ClockField
                  accessibilityLabel="Goal time"
                  parts={goalTime}
                  onChange={setGoalTime}
                  invalid={goalTimeError !== null}
                />
                {goalTimeError && (
                  <Text style={[styles.fieldError, { color: theme.status.error }]}>
                    {goalTimeError}
                  </Text>
                )}
                {!goalTimeError && goalRealismCopy ? (
                  <Text style={[styles.fieldError, { color: theme.text.secondary }]}>
                    {goalRealismCopy}
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
            <View style={styles.recentTimeInput}>
              <ClockField
                accessibilityLabel="Recent performance time"
                parts={recentTime}
                onChange={setRecentTime}
                invalid={recentTimeError !== null}
              />
            </View>
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
              maxLength={2000}
              placeholder="Anything else worth knowing"
              placeholderTextColor={theme.text.secondary}
              multiline
              style={[styles.input, inputThemeStyle(theme), styles.notesInput]}
            />
          </Field>

          {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

          <PrimaryAction
            label="Save intake"
            disabled={submitting}
            busy={submitting}
            onPress={handleSave}
          />
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
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  input: {
    minHeight: Spacing.six,
    borderWidth: Stroke.thin,
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
    borderWidth: Stroke.mark,
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
    borderWidth: Stroke.mark,
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
  pressed: {
    opacity: PressedOpacity,
  },
});
