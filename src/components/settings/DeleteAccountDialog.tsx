import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/auth/AuthField';
import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Delete-account's re-auth step (captain's decision, change-list item 10, 2026-09-20 — "confirm
 * identity with the password, like V2.3"). Mirrors `running-form-v2.3`'s
 * `app/settings.tsx` + `components/ui/confirm-dialog.tsx` password modal, in V2.2's own theme and
 * components: `Modal` on `theme.surface.overlay`, a `theme.surface.raised` card, `AuthField` for
 * the password, and a `status.error`-toned Delete button next to a plain text Cancel — not
 * `PrimaryAction`, which IS the accent (`ActionButton.tsx`'s "one accent per screen") and is never
 * spent on a destructive control; Settings' own delete row already colours only the label in
 * `status.error`, and this dialog's confirm follows the same convention.
 *
 * `requiresPassword` is decided by the caller from `accountHasPassword()` (`apiClient.ts`), never
 * here — this component only renders the two shapes: a password field plus a destructive confirm
 * when the account has a credential, or the original confirm-only copy when it does not (a
 * Google/OAuth-only account, which must never be locked out of deleting itself).
 *
 * The dialog owns the password field's own local state so a cancel, or the settings screen
 * clearing `error` after a fresh open, never leaves a stale password sitting in memory or on
 * screen — it resets whenever `visible` flips true.
 */
export function DeleteAccountDialog({
  visible,
  requiresPassword,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  requiresPassword: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const theme = useTheme();
  const [password, setPassword] = useState('');

  const disabled = busy || (requiresPassword && password.length === 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      // Not a `useEffect` — resetting from render would be a setState-in-effect cascade. `onShow`
      // is RN's own "the native dialog just became visible" callback, so a stale password from a
      // previous open (or the last runner's, if the screen re-mounts across sessions) never shows.
      onShow={() => setPassword('')}
    >
      <View style={[styles.scrim, { backgroundColor: theme.surface.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={busy ? undefined : onCancel}
        />
        <View style={[styles.card, { backgroundColor: theme.surface.raised }]}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Delete account</Text>
          <Text style={[styles.body, { color: theme.text.secondary }]}>
            This permanently deletes your account, intake, and plans. This cannot be undone.
          </Text>

          {requiresPassword ? (
            <AuthField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              editable={!busy}
            />
          ) : null}

          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={[styles.error, { color: theme.status.error }]}
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancel, pressed && !busy && styles.pressed]}
            >
              <Text style={[styles.cancelLabel, { color: theme.text.primary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm delete account"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onConfirm(password)}
              style={({ pressed }) => [
                styles.confirm,
                { borderColor: theme.status.error },
                (pressed || disabled) && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.status.error} />
              ) : (
                <Text style={[styles.confirmLabel, { color: theme.status.error }]}>Delete</Text>
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
    fontSize: FontSize.md,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
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
    fontSize: FontSize.sm,
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
    fontSize: FontSize.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
