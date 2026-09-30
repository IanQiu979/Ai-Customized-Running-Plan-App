import { useRef, useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as NativeView,
} from 'react-native';

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
import type { AgeBand } from '@/lib/ageAssurance';
import { openPrivacyPolicy } from '@/lib/openPrivacyPolicy';

interface AgeBandChoiceProps {
  value: AgeBand | null;
  onChange: (band: AgeBand) => void;
  guardianConsent: boolean;
  onToggleGuardianConsent: () => void;
  disabled?: boolean;
  testIDPrefix: string;
}

const GUARDIAN_ATTESTATION =
  'I am 13–17, and a parent or guardian has read the privacy policy and agrees to it on my behalf.';

const AGE_BANDS: readonly AgeBand[] = ['18_plus', '13_17'];

/**
 * RN 0.86 forwards `onKeyDown` to native/web Views, but its public Pressable declaration still
 * omits the generated prop. Keep that declaration lag isolated here instead of casting the whole
 * component or leaking DOM-only types through the shared control.
 */
interface NativeKeyDownEvent {
  nativeEvent: { key: string };
  preventDefault: () => void;
}

function keyboardProps(
  tabIndex: 0 | -1,
  onKeyDown: (event: NativeKeyDownEvent) => void
): { tabIndex: 0 | -1; onKeyDown: (event: NativeKeyDownEvent) => void } {
  return { tabIndex, onKeyDown };
}

/** The shared, controlled age choice used by email signup and the OAuth first-use gate. */
export function AgeBandChoice({
  value,
  onChange,
  guardianConsent,
  onToggleGuardianConsent,
  disabled = false,
  testIDPrefix,
}: AgeBandChoiceProps) {
  const theme = useTheme();
  const [policyError, setPolicyError] = useState<string | null>(null);
  const radioRefs = useRef<(NativeView | null)[]>([]);

  function select(band: AgeBand) {
    if (band !== '13_17' && guardianConsent) onToggleGuardianConsent();
    onChange(band);
    setPolicyError(null);
  }

  async function handleOpenPolicy() {
    setPolicyError(null);
    setPolicyError(await openPrivacyPolicy());
  }

  function handleRadioKeyDown(event: NativeKeyDownEvent, currentIndex: number) {
    if (disabled) return;
    const { key } = event.nativeEvent;
    let nextIndex: number | null = null;

    if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % AGE_BANDS.length;
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + AGE_BANDS.length) % AGE_BANDS.length;
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = AGE_BANDS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    select(AGE_BANDS[nextIndex]);
    radioRefs.current[nextIndex]?.focus();
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Your age" style={styles.group}>
      <Text style={[styles.legend, { color: theme.text.secondary }]}>YOUR AGE</Text>
      <RadioRow
        testID={`${testIDPrefix}-18-plus`}
        label="18 or older"
        accessibilityLabel="I am 18 or older"
        selected={value === '18_plus'}
        disabled={disabled}
        tabIndex={!disabled && (value === null || value === '18_plus') ? 0 : -1}
        radioRef={(node) => {
          radioRefs.current[0] = node;
        }}
        onKeyDown={(event) => handleRadioKeyDown(event, 0)}
        onPress={() => select('18_plus')}
      />
      <RadioRow
        testID={`${testIDPrefix}-13-17`}
        label="13–17 — my parent or guardian agrees"
        accessibilityLabel="I am 13 to 17 and my parent or guardian agrees"
        selected={value === '13_17'}
        disabled={disabled}
        tabIndex={!disabled && value === '13_17' ? 0 : -1}
        radioRef={(node) => {
          radioRefs.current[1] = node;
        }}
        onKeyDown={(event) => handleRadioKeyDown(event, 1)}
        onPress={() => select('13_17')}
      />

      {value === '13_17' ? (
        <View style={styles.guardianGroup}>
          <Pressable
            testID={`${testIDPrefix}-guardian-consent`}
            accessibilityRole="checkbox"
            accessibilityLabelledBy={`${testIDPrefix}-guardian-attestation`}
            accessibilityState={{ checked: guardianConsent, disabled }}
            disabled={disabled}
            onPress={onToggleGuardianConsent}
            style={({ pressed }) => [
              styles.row,
              styles.guardianRow,
              {
                backgroundColor: theme.surface.raised,
                borderColor: guardianConsent ? theme.text.primary : theme.progress.informative,
              },
              pressed && !disabled && styles.pressed,
            ]}
          >
            <ChoiceBox checked={guardianConsent} radio={false} />
            <Text
              nativeID={`${testIDPrefix}-guardian-attestation`}
              style={[styles.guardianText, { color: theme.text.primary }]}
            >
              {GUARDIAN_ATTESTATION}
            </Text>
          </Pressable>
          <Pressable
            testID={`${testIDPrefix}-privacy-policy`}
            accessibilityRole="link"
            accessibilityHint="Opens the Pace Blueprint privacy policy"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={handleOpenPolicy}
            style={({ pressed }) => [
              styles.policyLink,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text style={[styles.link, { color: theme.text.primary }]}>Read the privacy policy</Text>
          </Pressable>
          {policyError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              selectable
              style={[styles.error, { color: theme.status.error }]}
            >
              {policyError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.eligibility, { color: theme.text.secondary }]}>
        Pace Blueprint is for ages 13 and up.
      </Text>
    </View>
  );
}

function RadioRow({
  testID,
  label,
  accessibilityLabel,
  selected,
  disabled,
  tabIndex,
  radioRef,
  onKeyDown,
  onPress,
}: {
  testID: string;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  disabled: boolean;
  tabIndex: 0 | -1;
  radioRef: Ref<NativeView>;
  onKeyDown: (event: NativeKeyDownEvent) => void;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      ref={radioRef}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      {...keyboardProps(tabIndex, onKeyDown)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface.raised,
          borderColor: selected ? theme.text.primary : theme.progress.informative,
        },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <ChoiceBox checked={selected} radio />
      <Text style={[styles.rowText, { color: theme.text.primary }]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceBox({ checked, radio }: { checked: boolean; radio: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: checked ? theme.text.primary : theme.progress.informative,
          backgroundColor: radio || !checked ? theme.surface.raised : theme.text.primary,
        },
      ]}
    >
      {checked ? (
        radio ? (
          <View style={[styles.radioMark, { backgroundColor: theme.text.primary }]} />
        ) : (
          <Text style={[styles.checkMark, { color: theme.surface.base }]}>✓</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  legend: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  row: {
    minHeight: Spacing.six,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    padding: Spacing.three,
  },
  guardianGroup: { gap: Spacing.one },
  guardianRow: { marginStart: Spacing.four },
  policyLink: {
    minHeight: Spacing.six,
    marginStart: Spacing.four,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  box: {
    width: Spacing.four,
    height: Spacing.four,
    marginTop: Spacing.half,
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioMark: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Radius.control,
  },
  checkMark: {
    fontFamily: FontFamily.body.bold,
    fontSize: FontSize.xs,
  },
  rowText: {
    flex: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  guardianText: {
    flex: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  link: {
    fontFamily: FontFamily.body.semiBold,
    textDecorationLine: 'underline',
  },
  eligibility: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  pressed: { opacity: PressedOpacity },
});
