import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { LinkAction, PrimaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, describeError, useSessionUser } from '@/lib/apiClient';
import { newPasswordProblem, resolveResetPasswordEntry } from '@/lib/authEmail';

/**
 * Reset password (issue #94) — where the mailed link lands.
 *
 * WHY THIS ROUTE SITS OUTSIDE BOTH `Stack.Protected` GROUPS (`src/app/_layout.tsx`): it is
 * opened from a deep link (`paceblueprint://reset-password?token=…`, or the same path on web) and
 * has to render whatever the session state is. A signed-out runner is the normal case; a signed-in
 * one who reset from another device is valid too, and their session on this device is about to be
 * revoked anyway (`revokeSessionsOnPasswordReset` in `workers/src/auth.ts`). Putting it in
 * `(auth)` would bounce the second case to Home with the token unconsumed.
 *
 * The token never touches app state beyond this screen: it is read from the URL
 * (`resolveResetPasswordEntry`), posted once to `reset-password`, and forgotten. Nothing logs it.
 */
/** The wordmark's size on the V22 pages (`v22-0N-scene.jsx`: 21pt Barlow Condensed 600). */
const WORDMARK_SIZE = 21;

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    token?: string | string[];
    error?: string | string[];
  }>();
  const session = useSessionUser();
  const entry = resolveResetPasswordEntry(params);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = newPasswordProblem(password, confirmation);

  // See `sign-in.tsx` for why every `authClient` call needs a try/catch and not just an `error`
  // check — an unreachable backend rejects rather than resolving to `{ error }`.
  async function handleReset() {
    if (entry.kind !== 'form') return;
    setError(null);
    setSubmitting(true);
    try {
      // `minPasswordLength: 8` is enforced server-side and not duplicated here, as on sign-up.
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token: entry.token,
      });
      if (resetError) {
        setError(resetError.message ?? 'Could not reset your password. Try again.');
        return;
      }
      setDone(true);
      // Every session for this account was just revoked server-side, this device's included if it
      // had one. Refetch so `Stack.Protected` learns that now rather than on the next focus.
      authClient.$store.notify('$sessionSignal');
    } catch (resetError) {
      setError(
        describeError(resetError, 'Could not reset your password. Try again.', API_BASE_URL)
      );
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !password || !confirmation || mismatch !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Same scroll/keyboard rationale as `sign-in.tsx`. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={[
                styles.wordmark,
                {
                  color: theme.text.primary,
                  paddingTop: insets.top + Spacing.four,
                },
              ]}
            >
              Pace Blueprint
            </Text>

            <View style={styles.form}>
              {done ? (
                <>
                  <View style={styles.formHeader}>
                    <Text style={[styles.title, { color: theme.text.primary }]}>
                      Password updated
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                      Sign in with your new password.
                    </Text>
                  </View>
                  <PrimaryAction
                    label="Sign in"
                    onPress={() => router.replace('/(auth)/sign-in')}
                  />
                </>
              ) : entry.kind === 'invalid' ? (
                <>
                  <View style={styles.formHeader}>
                    <Text style={[styles.title, { color: theme.text.primary }]}>Link expired</Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                      {entry.message}
                    </Text>
                  </View>
                  <View style={styles.links}>
                    {/* A signed-in runner cannot reach `(auth)` — `Stack.Protected` guards it —
                        so they are sent home instead of at a route that would bounce them. */}
                    {session ? (
                      <LinkAction onPress={() => router.replace('/(tabs)')}>
                        Back to <Text style={{ color: theme.text.primary }}>Today</Text>
                      </LinkAction>
                    ) : (
                      <LinkAction onPress={() => router.replace('/(auth)/forgot-password')}>
                        Request a <Text style={{ color: theme.text.primary }}>new link</Text>
                      </LinkAction>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.formHeader}>
                    <Text style={[styles.title, { color: theme.text.primary }]}>New password</Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                      Choose a new password for your account.
                    </Text>
                  </View>

                  <AuthField
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    autoCapitalize="none"
                    autoComplete="password-new"
                    secureTextEntry
                  />
                  <AuthField
                    label="Confirm password"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    placeholder="Same again"
                    autoCapitalize="none"
                    autoComplete="password-new"
                    secureTextEntry
                  />

                  {(mismatch ?? error) && (
                    <Text style={[styles.error, { color: theme.status.error }]}>
                      {mismatch ?? error}
                    </Text>
                  )}

                  <PrimaryAction
                    label="Set new password"
                    disabled={disabled}
                    busy={submitting}
                    onPress={handleReset}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Identical to `sign-in.tsx`'s sheet, deliberately — see `sign-up.tsx` for why it is not shared.
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  wordmark: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: WORDMARK_SIZE,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingBottom: Spacing.four,
  },
  formHeader: {
    gap: Spacing.one,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
  },
  subtitle: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  links: {
    gap: Spacing.half,
  },
});
