import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/inputs/DateField';
import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { datePartsToIso, dateFieldError, EMPTY_DATE, type DateParts } from '@/lib/fieldInput';

/**
 * The one-way aging transition's only control (captain's decision, 2026-10-01): a recorded 13–17
 * runner enters a date of birth and confirms. Settings renders it only for that account.
 *
 * This component decides nothing. It sends a complete, real calendar date to `onConfirm`; whether
 * that date is 18+ — and whether the account may transition at all — is the Worker's ruling
 * (`POST /api/age-transition`), shown back here through `error`. A client-side "you're not 18 yet"
 * would be a second authority that could drift from the server's clock and time-zone rule.
 *
 * Same shape as `DeleteAccountDialog` — `Modal` on `surface.overlay`, a `surface.raised` card, a
 * plain text Cancel — and, like it, the confirm is a bordered button, not `PrimaryAction`: Settings
 * spends no accent (`settings.tsx`'s header). Its copy is NOT captain/legal-certified; see the PR.
 */
export function AgeTransitionDialog({
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (birthDate: string) => void;
}) {
  const theme = useTheme();
  const [birthDate, setBirthDate] = useState<DateParts>(EMPTY_DATE);

  const iso = datePartsToIso(birthDate);
  const fieldError = dateFieldError(birthDate);
  const disabled = busy || iso === null;
  const shownError = fieldError ?? error;

  function cancel() {
    setBirthDate(EMPTY_DATE);
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      onShow={() => setBirthDate(EMPTY_DATE)}
    >
      <View style={[styles.scrim, { backgroundColor: theme.surface.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={busy ? undefined : cancel}
        />
        <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Turned 18?</Text>
          <Text style={[styles.body, { color: theme.text.secondary }]}>
            Enter your date of birth to move this account to 18 or older. This cannot be undone.
          </Text>

          <DateField
            parts={birthDate}
            onChange={setBirthDate}
            invalid={fieldError !== null}
            accessibilityLabel="Date of birth"
          />

          {shownError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={[styles.error, { color: theme.status.error }]}
            >
              {shownError}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={cancel}
              style={({ pressed }) => [styles.cancel, pressed && !busy && styles.pressed]}
            >
              <Text style={[styles.cancelLabel, { color: theme.text.primary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm date of birth"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => {
                if (iso) onConfirm(iso);
              }}
              style={({ pressed }) => [
                styles.confirm,
                { borderColor: theme.text.primary },
                (pressed || disabled) && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.text.primary} />
              ) : (
                <Text style={[styles.confirmLabel, { color: theme.text.primary }]}>Confirm</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.title,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.body,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.label,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cancel: {
    minHeight: Spacing.six,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.body,
  },
  confirm: {
    minHeight: Spacing.six,
    minWidth: 120,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.button,
    borderWidth: Stroke.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.body,
  },
  pressed: {
    opacity: 0.6,
  },
});
