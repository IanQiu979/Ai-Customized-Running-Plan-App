import { Stack, useNavigation, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
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
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  ApiError,
  describeError,
  generatePlan,
  getIntake,
  putIntake,
} from '@/lib/apiClient';
import { CUE_DELAY, SURVEY_TIMELINE } from '@/lib/buildMotion';
import {
  clockFieldError,
  clockPartsToSeconds,
  datePartsToIso,
  dateFieldError,
  EMPTY_CLOCK,
  EMPTY_DATE,
  isClockBlank,
  isDateBlank,
  type ClockParts,
  type DateParts,
} from '@/lib/fieldInput';
import { getGoalRealismIntakeCopy } from '@/lib/goalRealismDisclosure';
import { mintIdempotencyKey } from '@/lib/idempotencyKey';
import { openPrivacyPolicy } from '@/lib/openPrivacyPolicy';
import { assessGoalRealism } from '@/lib/paceDerivation';
import {
  buildGeneratePlanRequest,
  DEFAULT_PLAN_WEEKS,
  intakeRaceDateError,
  planTargetFromIntake,
} from '@/lib/planRequest';
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

/** The answer a validation failure points at, so the message can sit under the field it names. */
type FieldKey =
  | 'goal'
  | 'age'
  | 'consent'
  | 'experience'
  | 'daysPerWeek'
  | 'weeklyKm'
  | 'raceDistance'
  | 'raceDate'
  | 'goalTime'
  | 'planLength'
  | 'recent';

type FormError = { field?: FieldKey; message: string };

/** Copy for the required target race — the one field the captain's 2026-09-20 test found wrongly
 * marked optional. */
const RACE_DISTANCE_REQUIRED_MESSAGE = 'Choose your target race distance.';

/**
 * The intake questionnaire, and — since the captain's 2026-09-20 phone test — the only place a
 * plan is created. All 10 `IntakeResponses` fields (`planTypes.ts`) plus one question that is not
 * an intake field, the plan length, asked only when no race date fixes it (`needsPlanLength`).
 * The single "Create plan" at the bottom saves the answers (`putIntake`) and generates from them
 * (`generatePlan`) in one press, then replaces this screen with the new plan so its back arrow
 * lands on Home.
 *
 * **The form starts blank every time.** `getIntake()` is read once, for a boolean only — whether
 * this runner has an intake on file — and never to prefill. The stored intake stays on the server
 * as the record of what the last plan was built from; the runner re-enters everything for the
 * next one (captain's ruling 4). Two things hang off that boolean:
 *
 *  - **First entry** (no intake on file): the survey intro (V22-03) plays first, there is no
 *    Cancel, the swipe-back gesture is off and `beforeRemove` is refused — the intake cannot be
 *    skipped (ruling 1). Home's own gate pushes the runner here, and would again if they somehow
 *    left.
 *  - **Re-entry** (Home's "Create a new plan"): straight to the questions, with a Cancel back to
 *    Home in the header row.
 *
 * Hand-rolled throughout (no form library, per project convention): single-selects are a column
 * of `Pressable` rows, multi-selects are toggle chips. Numeric answers go through
 * `components/inputs/` — `NumberField`, `DateField`, `ClockField` — so a date or a time is entered
 * one component per box with the `-`/`:` printed, never typed (`src/lib/fieldInput.ts`'s header
 * has the 2026-08-15 repro). Validation here mirrors what the server rejects with an actionable
 * message, plus the two client-side rules — the required target race and the stale race date —
 * and every failure names the field it belongs to so the message renders under that field as
 * well as beside the button.
 *
 * Quota outcomes are surfaced exactly as Home used to: `over_quota` pushes the paywall with the
 * server's `quota` object, a terminal `invalid_request` re-mints the idempotency key, and a
 * transport failure keeps it so a lost success replays safely (`generate-plan-flow.ts`).
 *
 * Blueprint re-cut (2026-09-20): `ScreenHeader` and grouped sections on hairlines, the same
 * tokens Home and Settings use; two body sizes (`FontSize.xs` labels and messages, `FontSize.sm`
 * controls) under the header's own.
 */
export default function IntakeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  // 'first' = no intake on file (a brand-new account); 'repeat' = one exists, so this is
  // "Create a new plan". A failed lookup settles on 'repeat': the Cancel it adds is harmless, and
  // Home's gate re-sends a genuinely new runner here either way.
  const [entry, setEntry] = useState<'loading' | 'first' | 'repeat'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // The intro is dismissed by a tap once its PRESS TO CONTINUE cue is showing and never comes
  // back this visit.
  const [introDone, setIntroDone] = useState(false);
  const showIntro = entry === 'first' && !introDone;
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { T: introClock, ready: introCueShown } = useBuildClock({
    total: SURVEY_TIMELINE.total,
    play: showIntro,
    readyAt: SURVEY_TIMELINE.cues.Hold + CUE_DELAY,
  });

  const [goal, setGoal] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState<ExperienceAnswer | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [weeklyKm, setWeeklyKm] = useState('');

  const [raceDistance, setRaceDistance] = useState<RaceDistance | undefined>(undefined);
  const [raceDate, setRaceDate] = useState<DateParts>(EMPTY_DATE);
  const [goalTime, setGoalTime] = useState<ClockParts>(EMPTY_CLOCK);
  const [planLengthWeeks, setPlanLengthWeeks] = useState(String(DEFAULT_PLAN_WEEKS));

  const [recentDistance, setRecentDistance] = useState<RaceDistance | undefined>(undefined);
  const [recentTime, setRecentTime] = useState<ClockParts>(EMPTY_CLOCK);

  const [injuries, setInjuries] = useState<InjuryFlag[]>(['none']);
  const [injuryNotes, setInjuryNotes] = useState('');

  // Captain's ruling (2026-09-19): 13–17 requires a parent/guardian's affirmed consent, recorded
  // server-side. This is a one-time-per-save affirmation, never persisted or reloaded — it always
  // starts unchecked and must be re-affirmed on every save while the runner is a minor.
  const [guardianConsent, setGuardianConsent] = useState(false);
  const ageNumForMinorCheck = Number(age);
  const isMinor =
    Number.isInteger(ageNumForMinorCheck) && ageNumForMinorCheck >= 13 && ageNumForMinorCheck <= 17;

  // Held across retries of the SAME attempt (a dropped connection, a re-press before the first
  // reply lands) so the backend's idempotency replay returns that attempt's own result rather than
  // reserving a second quota slot. Re-minted only once a generation actually settles.
  const [idempotencyKey, setIdempotencyKey] = useState(() => mintIdempotencyKey());

  // Inline, as-you-type feedback for the three structured date/time fields — derived from the
  // current parts on every render rather than held in their own state. Each stays quiet until
  // the runner has typed enough for a box to be judged.
  const raceDateError = dateFieldError(raceDate);
  const goalTimeError = clockFieldError(goalTime);
  const recentTimeError = clockFieldError(recentTime);

  // The plan length is asked only while no race date fixes it — `planRequest.ts`'s
  // `needsPlanLength` rule, applied live to the date being typed rather than to a saved target.
  const askPlanLength = isDateBlank(raceDate);

  // Derived, not stateful. Only meaningful once both a complete goal time and a complete recent
  // performance are entered; `undefined` otherwise (mirrors `assessGoalRealism`'s own contract).
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
        if (!cancelled) setEntry(intake ? 'repeat' : 'first');
      } catch {
        if (!cancelled) setEntry('repeat');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ruling 1: a first entry cannot be left until a plan exists. `beforeRemove` covers the hardware
  // back button and any programmatic pop; the swipe gesture is switched off in the screen options
  // below. The one removal allowed through is our own `router.replace` to the new plan.
  const leaveAllowed = useRef(false);
  useEffect(() => {
    if (entry !== 'first') return;
    return navigation.addListener('beforeRemove', (event) => {
      if (!leaveAllowed.current) event.preventDefault();
    });
  }, [entry, navigation]);

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

  function handleCancel() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  /** Every client-side rule, in the order the fields appear. Returns the payload or the failure. */
  function validate():
    | { ok: true; payload: IntakeResponses & { guardianConsent?: boolean } }
    | { ok: false; error: FormError } {
    if (!goal.trim()) {
      return { ok: false, error: { field: 'goal', message: 'Goal is required.' } };
    }
    const ageNum = Number(age);
    if (!age.trim() || !Number.isInteger(ageNum) || ageNum < 13 || ageNum > 100) {
      return {
        ok: false,
        error: { field: 'age', message: 'Age must be a whole number between 13 and 100.' },
      };
    }
    if (isMinor && !guardianConsent) {
      return {
        ok: false,
        error: {
          field: 'consent',
          message: 'A parent or guardian must confirm consent before saving.',
        },
      };
    }
    if (!experience) {
      return { ok: false, error: { field: 'experience', message: 'Select your experience level.' } };
    }
    if (!daysPerWeek) {
      return {
        ok: false,
        error: { field: 'daysPerWeek', message: 'Select how many days a week you run.' },
      };
    }
    const weeklyKmNum = Number(weeklyKm);
    if (!weeklyKm.trim() || !Number.isFinite(weeklyKmNum) || weeklyKmNum < 0) {
      return {
        ok: false,
        error: { field: 'weeklyKm', message: 'Weekly distance must be 0 km or more.' },
      };
    }

    // Captain's ruling 5 (2026-09-20): the target race distance is required; its date and the
    // goal time stay optional.
    if (!raceDistance) {
      return { ok: false, error: { field: 'raceDistance', message: RACE_DISTANCE_REQUIRED_MESSAGE } };
    }

    let raceDateIso: string | undefined;
    if (!isDateBlank(raceDate)) {
      const parsed = datePartsToIso(raceDate);
      if (parsed === null) {
        return {
          ok: false,
          error: {
            field: 'raceDate',
            message: 'Enter your race date as a real calendar date, or clear it.',
          },
        };
      }
      raceDateIso = parsed;
    }
    const staleRaceDateError = intakeRaceDateError(raceDateIso, new Date());
    if (staleRaceDateError) {
      return { ok: false, error: { field: 'raceDate', message: staleRaceDateError } };
    }

    let goalTimeSec: number | undefined;
    if (!isClockBlank(goalTime)) {
      const parsed = clockPartsToSeconds(goalTime);
      if (parsed === null) {
        return {
          ok: false,
          error: {
            field: 'goalTime',
            message: 'Enter your goal time as hours, minutes and seconds, or clear it.',
          },
        };
      }
      goalTimeSec = parsed;
    }

    // Mirrors the server's own half-filled-pair rejection (`workers/src/routes.ts`,
    // `validateIntake`) — a recent performance with only a distance or only a time disables
    // every numeric pace without saying so.
    const hasRecentDistance = recentDistance !== undefined;
    const hasRecentTime = !isClockBlank(recentTime);
    if (hasRecentDistance !== hasRecentTime) {
      return {
        ok: false,
        error: {
          field: 'recent',
          message: 'Provide both a recent distance and a time, or leave both blank.',
        },
      };
    }
    let recentTimeSec: number | null = null;
    if (hasRecentDistance && hasRecentTime) {
      recentTimeSec = clockPartsToSeconds(recentTime);
      if (recentTimeSec === null) {
        return {
          ok: false,
          error: { field: 'recent', message: 'Enter your recent time as hours, minutes and seconds.' },
        };
      }
    }

    return {
      ok: true,
      payload: {
        goal: goal.trim(),
        age: ageNum,
        experience,
        daysPerWeek,
        weeklyKm: weeklyKmNum,
        raceDistance,
        ...(raceDateIso ? { raceDate: raceDateIso } : {}),
        ...(goalTimeSec !== undefined ? { goalTimeSec } : {}),
        ...(recentDistance && recentTimeSec !== null
          ? { recentPerformance: { distance: recentDistance, timeSec: recentTimeSec } }
          : {}),
        injuries,
        ...(injuryNotes.trim() ? { injuryNotes: injuryNotes.trim() } : {}),
        ...(isMinor ? { guardianConsent: true } : {}),
      },
    };
  }

  async function handleCreate() {
    setError(null);

    const validated = validate();
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    const { payload } = validated;

    // The request is built from the answers being saved, never from a re-read of the server —
    // the two can only agree this way. `notes` is empty on purpose: the per-plan notes field
    // left Home with the rest of its generate panel (2026-09-20); free-text context for the
    // model still reaches it through `injuryNotes`.
    const built = buildGeneratePlanRequest({
      target: planTargetFromIntake(payload),
      planLengthWeeks,
      notes: '',
      idempotencyKey,
      now: new Date(),
    });
    if (!built.ok) {
      setError({ field: 'planLength', message: built.error });
      return;
    }

    setSubmitting(true);
    try {
      await putIntake(payload);
      const response = await generatePlan(built.request);
      setIdempotencyKey(mintIdempotencyKey());
      // Replace, not push: the plan's back arrow should land on Home, not on a spent form.
      leaveAllowed.current = true;
      router.replace({ pathname: '/plan/[id]', params: { id: response.planId } });
    } catch (createError) {
      if (createError instanceof ApiError) {
        if (createError.body.code === 'over_quota') {
          router.push({
            pathname: '/paywall',
            params: { quota: JSON.stringify(createError.body.quota) },
          });
        } else {
          setError({ message: createError.body.error });
          // A released idempotency key can never succeed on another retry. Mint a fresh key after
          // the server says the previous attempt is terminal; transport failures keep the key so
          // a lost successful response still replays safely.
          if (
            createError.body.code === 'invalid_request' &&
            createError.body.error.includes('previously failed')
          ) {
            setIdempotencyKey(mintIdempotencyKey());
          }
        }
      } else {
        setError({
          message: describeError(createError, 'Something went wrong. Try again.', API_BASE_URL),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const screenOptions = { headerShown: false, gestureEnabled: entry !== 'first' };

  if (entry === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={theme.text.primary} />
      </View>
    );
  }

  if (showIntro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={screenOptions} />
        <SurveyIntro
          T={introClock}
          width={viewportWidth}
          height={viewportHeight}
          cueShown={introCueShown}
          onContinue={() => setIntroDone(true)}
        />
      </View>
    );
  }

  const fieldMessage = (field: FieldKey) =>
    error?.field === field ? <FieldMessage message={error.message} theme={theme} /> : null;
  const invalid = (field: FieldKey) => error?.field === field;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={screenOptions} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ScreenHeader
            eyebrow="Intake"
            title="About your running"
            supporting="Every plan is built from these answers. Two minutes."
            action={
              entry === 'repeat' ? (
                <IntakeExitAction color={theme.text.primary} onPress={handleCancel} label="Cancel" />
              ) : undefined
            }
          />

          <Section title="You" theme={theme}>
            <Field label="Goal" theme={theme}>
              <TextInput
                accessibilityLabel="Goal"
                value={goal}
                onChangeText={setGoal}
                maxLength={500}
                placeholder="e.g. Finish my first 10K"
                placeholderTextColor={theme.text.secondary}
                style={[styles.input, inputThemeStyle(theme, invalid('goal'))]}
              />
              {fieldMessage('goal')}
            </Field>

            <Field label="Age" theme={theme}>
              <NumberField
                accessibilityLabel="Age"
                value={age}
                onChangeValue={setAge}
                maxIntegerDigits={3}
                placeholder="e.g. 34"
                invalid={invalid('age')}
              />
              {fieldMessage('age')}
            </Field>

            {isMinor ? (
              <>
                <GuardianConsentRow
                  checked={guardianConsent}
                  onToggle={() => setGuardianConsent((current) => !current)}
                  theme={theme}
                />
                {fieldMessage('consent')}
              </>
            ) : null}

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
              {fieldMessage('experience')}
            </Field>
          </Section>

          <Section title="Training" theme={theme}>
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
              {fieldMessage('daysPerWeek')}
            </Field>

            <Field label="Weekly distance (km)" theme={theme}>
              <NumberField
                accessibilityLabel="Weekly distance in kilometres"
                value={weeklyKm}
                onChangeValue={setWeeklyKm}
                mode="decimal"
                maxIntegerDigits={3}
                placeholder="e.g. 35"
                invalid={invalid('weeklyKm')}
              />
              {fieldMessage('weeklyKm')}
            </Field>

          </Section>

          <Section title="Target" theme={theme}>
            <Field label="Target race" theme={theme}>
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
              {fieldMessage('raceDistance')}
            </Field>

            <Field label="Race date" optional theme={theme}>
              <DateField
                accessibilityLabel="Race date"
                parts={raceDate}
                onChange={setRaceDate}
                invalid={raceDateError !== null || invalid('raceDate')}
              />
              {raceDateError ? <FieldMessage message={raceDateError} theme={theme} /> : null}
              {fieldMessage('raceDate')}
            </Field>

            <Field label="Goal time" optional theme={theme}>
              <ClockField
                accessibilityLabel="Goal time"
                parts={goalTime}
                onChange={setGoalTime}
                invalid={goalTimeError !== null || invalid('goalTime')}
              />
              {goalTimeError ? <FieldMessage message={goalTimeError} theme={theme} /> : null}
              {fieldMessage('goalTime')}
              {!goalTimeError && goalRealismCopy ? (
                <Text style={[styles.fieldMessage, { color: theme.text.secondary }]}>
                  {goalRealismCopy}
                </Text>
              ) : null}
            </Field>

            {/* Only while no race date fixes the length — a runner who gave a date is never asked
                how long their plan should be (`needsPlanLength`). */}
            {askPlanLength ? (
              <Field label="Plan length (weeks)" theme={theme}>
                <NumberField
                  accessibilityLabel="Plan length in weeks"
                  value={planLengthWeeks}
                  onChangeValue={setPlanLengthWeeks}
                  maxIntegerDigits={3}
                  placeholder={String(DEFAULT_PLAN_WEEKS)}
                  invalid={invalid('planLength')}
                />
                {fieldMessage('planLength')}
              </Field>
            ) : null}
          </Section>

          {/* After the target on purpose: the goal-time realism note above needs both, and a
              runner reads their target before their evidence for it. */}
          <Section title="Recent result" theme={theme}>
            <Field label="Recent performance" optional theme={theme}>
              <View style={styles.chipRow}>
                {RACE_DISTANCE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={recentDistance === option.value}
                    onPress={() =>
                      setRecentDistance((current) =>
                        current === option.value ? undefined : option.value
                      )
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
                  invalid={recentTimeError !== null || invalid('recent')}
                />
              </View>
              {recentTimeError ? <FieldMessage message={recentTimeError} theme={theme} /> : null}
              {fieldMessage('recent')}
            </Field>
          </Section>

          <Section title="Health" theme={theme}>
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

            <Field label="Injury notes" optional theme={theme}>
              <TextInput
                accessibilityLabel="Injury notes"
                value={injuryNotes}
                onChangeText={setInjuryNotes}
                maxLength={2000}
                placeholder="Anything else worth knowing"
                placeholderTextColor={theme.text.secondary}
                multiline
                style={[styles.input, inputThemeStyle(theme, false), styles.notesInput]}
              />
            </Field>
          </Section>

          <View style={styles.footer}>
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={[styles.error, { color: theme.status.error }]}
              >
                {error.message}
              </Text>
            ) : null}

            <PrimaryAction
              label="Create plan"
              disabled={submitting}
              busy={submitting}
              onPress={handleCreate}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

function inputThemeStyle(theme: Theme, invalid: boolean) {
  return {
    color: theme.text.primary,
    borderColor: invalid ? theme.status.error : theme.hairline,
    backgroundColor: theme.surface.raised,
  };
}

/** A titled group on a hairline — the same construction as `GroupedRows`' `Group`, for fields
 * rather than rows. */
function Section({ title, theme, children }: { title: string; theme: Theme; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionBody, { borderTopColor: theme.hairline }]}>{children}</View>
    </View>
  );
}

function Field({
  label,
  optional = false,
  theme,
  children,
}: {
  label: string;
  /** Prints "(OPTIONAL)" after the label. Everything without it is required. */
  optional?: boolean;
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
        {label.toUpperCase()}
        {optional ? ' (OPTIONAL)' : ''}
      </Text>
      {children}
    </View>
  );
}

function FieldMessage({ message, theme }: { message: string; theme: Theme }) {
  return <Text style={[styles.fieldMessage, { color: theme.status.error }]}>{message}</Text>;
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
  theme: Theme;
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

/**
 * Required consent affirmation for a 13–17 runner (captain's ruling, 2026-09-19: GDPR Art. 9(2)(a),
 * Thai PDPA s.26). Not persisted — `guardianConsent` always starts `false` and must be re-affirmed
 * every save; the server independently rejects a minor's intake without it. Copy needs the
 * captain's / legal certification before ship.
 */
function GuardianConsentRow({
  checked,
  onToggle,
  theme,
}: {
  checked: boolean;
  onToggle: () => void;
  theme: Theme;
}) {
  const [policyError, setPolicyError] = useState<string | null>(null);

  async function handleOpenPolicy() {
    setPolicyError(null);
    setPolicyError(await openPrivacyPolicy());
  }

  return (
    <View style={styles.consentGroup}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Parent or guardian consent"
        onPress={onToggle}
        style={({ pressed }) => [
          styles.consentRow,
          {
            borderColor: checked ? theme.text.primary : theme.hairline,
            backgroundColor: theme.surface.raised,
          },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.consentBox,
            {
              borderColor: checked ? theme.text.primary : theme.hairline,
              backgroundColor: checked ? theme.text.primary : 'transparent',
            },
          ]}
        >
          {checked ? (
            <Text style={[styles.consentBoxMark, { color: theme.surface.base }]}>✓</Text>
          ) : null}
        </View>
        <Text style={[styles.consentText, { color: theme.text.primary }]}>
          I am 13–17, and a parent or guardian has read{' '}
          <Text
            accessibilityRole="link"
            accessibilityHint="Opens the Pace Blueprint privacy policy"
            style={[styles.consentLink, { color: theme.text.primary }]}
            onPress={handleOpenPolicy}
          >
            the privacy policy
          </Text>{' '}
          and agrees to it on my behalf.
        </Text>
      </Pressable>
      {policyError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.fieldMessage, { color: theme.status.error }]}
        >
          {policyError}
        </Text>
      ) : null}
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
  theme: Theme;
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  sectionBody: {
    borderTopWidth: Stroke.hairline,
    paddingTop: Spacing.three,
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
  footer: {
    gap: Spacing.three,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  fieldMessage: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
    marginTop: Spacing.half,
  },
  pressed: {
    opacity: PressedOpacity,
  },
  consentGroup: {
    gap: Spacing.one,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Stroke.mark,
    borderRadius: Radius.control,
    padding: Spacing.three,
  },
  consentBox: {
    width: Spacing.four,
    height: Spacing.four,
    borderWidth: Stroke.mark,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.half,
  },
  consentBoxMark: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  consentText: {
    flex: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  consentLink: {
    fontFamily: FontFamily.body.semiBold,
    textDecorationLine: 'underline',
  },
});
