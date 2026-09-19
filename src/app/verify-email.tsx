import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinkAction, PrimaryAction, SecondaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  authClient,
  describeError,
  resendVerificationEmail,
  useSessionUser,
} from '@/lib/apiClient';
import { resolveVerifyEmailEntry } from '@/lib/authEmail';

/**
 * Verify email (issue #94) — where the mailed verification link lands, after the Worker has
 * already consumed the token. Outside both `Stack.Protected` groups for the same reason as
 * `reset-password.tsx`: the runner may or may not hold a session when the link opens (they do
 * when verification is optional and they signed up moments ago; they do not when the deployment
 * requires verification before the first sign-in, or when the link opened on another device).
 *
 * On success there is nothing to submit — the address is already verified server-side — so this
 * screen only says so and refetches the session, which is how Home's banner learns to go away.
 * On failure (`?error=`) it offers a resend when it knows the address (a session) and a route to
 * sign-in otherwise, because the unverified sign-in path is where the resend lives for a
 * signed-out runner (`sign-in.tsx`).
 */
/** The wordmark's size on the V22 pages (`v22-0N-scene.jsx`: 21pt Barlow Condensed 600). */
const WORDMARK_SIZE = 21;

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ error?: string | string[] }>();
  const session = useSessionUser();
  const entry = resolveVerifyEmailEntry(params);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `emailVerified` on the cached session is stale by definition here: the Worker flipped it
  // before redirecting. One refetch, on arrival, and only for the success case.
  useEffect(() => {
    if (entry.kind === 'verified') authClient.$store.notify('$sessionSignal');
  }, [entry.kind]);

  const email = session?.email;

  async function handleResend() {
    if (!email) return;
    setError(null);
    setSending(true);
    try {
      const outcome = await resendVerificationEmail(email);
      if (outcome.ok) setSent(true);
      else setError(outcome.message);
    } catch (resendError) {
      setError(describeError(resendError, 'Could not send the link. Try again.', API_BASE_URL));
    } finally {
      setSending(false);
    }
  }

  function handleContinue() {
    router.replace(session ? '/(tabs)' : '/(auth)/sign-in');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
            {entry.kind === 'verified' ? (
              <>
                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: theme.text.primary }]}>Email verified</Text>
                  <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    {session ? "You're all set." : 'Sign in to continue.'}
                  </Text>
                </View>
                <PrimaryAction label={session ? 'Continue' : 'Sign in'} onPress={handleContinue} />
              </>
            ) : (
              <>
                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: theme.text.primary }]}>Link expired</Text>
                  <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    {sent && email ? `Sent. Check ${email} for a new link.` : entry.message}
                  </Text>
                </View>

                {error && (
                  <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>
                )}

                {email && !sent && (
                  <SecondaryAction
                    label="Send a new link"
                    busy={sending}
                    disabled={sending}
                    onPress={handleResend}
                  />
                )}

                <View style={styles.links}>
                  {session ? (
                    <LinkAction onPress={handleContinue}>
                      Back to <Text style={{ color: theme.text.primary }}>Today</Text>
                    </LinkAction>
                  ) : (
                    <LinkAction onPress={handleContinue}>
                      <Text style={{ color: theme.text.primary }}>Sign in</Text> to request a new
                      link
                    </LinkAction>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Identical to `sign-in.tsx`'s sheet, deliberately — see `sign-up.tsx` for why it is not shared.
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
