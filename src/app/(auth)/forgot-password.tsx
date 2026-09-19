import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { LinkAction, PrimaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, describeError, getEmailStatus } from '@/lib/apiClient';
import {
  createResetPasswordURL,
  MAIL_NOT_CONFIGURED_MESSAGE,
  RESET_LINK_LIFETIME_COPY,
} from '@/lib/authEmail';

/**
 * Forgot password (issue #94). A peer of `sign-in.tsx` — same wordmark, same page form, same
 * single ink action — with two states: the email form, and the "check your inbox" confirmation
 * it becomes once the request is accepted.
 *
 * HONESTY FIRST. The Worker only sends mail when the captain has configured a provider
 * (`docs/email-setup.md`), so this screen reads `GET /api/email-status` on mount and, when
 * `mailConfigured` is false, says so in place of the form rather than accepting an email it can
 * do nothing with. The confirmation copy is deliberately generic ("if an account exists") — the
 * Worker answers `200` for unknown addresses too, so this screen cannot and must not reveal
 * whether one was found (`workers/test/auth-email.test.ts`, "keeps the reset response generic").
 *
 * The link the mail carries is the Worker's own; the app only tells it where to send the runner
 * afterwards (`createResetPasswordURL`, see `authEmail.ts`'s header for the contract).
 */
/** The wordmark's size on the V22 pages (`v22-0N-scene.jsx`: 21pt Barlow Condensed 600). */
const WORDMARK_SIZE = 21;

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // `null` until the capability read answers; the form is held back rather than shown and then
  // replaced, so a runner never starts typing into a form that is about to disappear.
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getEmailStatus();
        if (!cancelled) setMailConfigured(status.mailConfigured);
      } catch (statusError) {
        if (!cancelled) {
          setError(describeError(statusError, 'Could not reach the server.', API_BASE_URL));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // See `sign-in.tsx` for why every `authClient` call needs a try/catch and not just an `error`
  // check — an unreachable backend rejects rather than resolving to `{ error }`.
  async function handleRequest() {
    setError(null);
    setSubmitting(true);
    try {
      const { error: requestError } = await authClient.requestPasswordReset({
        email,
        redirectTo: createResetPasswordURL(),
      });
      if (requestError) {
        setError(requestError.message ?? 'Could not send a reset link. Try again.');
        return;
      }
      setSentTo(email);
    } catch (requestError) {
      setError(
        describeError(requestError, 'Could not send a reset link. Try again.', API_BASE_URL)
      );
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !email || mailConfigured !== true;

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
              {sentTo ? (
                <>
                  <View style={styles.formHeader}>
                    <Text style={[styles.title, { color: theme.text.primary }]}>
                      Check your inbox
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                      If an account exists for {sentTo}, a reset link is on its way.{' '}
                      {RESET_LINK_LIFETIME_COPY}
                    </Text>
                  </View>
                  <View style={styles.links}>
                    <LinkAction onPress={() => router.navigate('/(auth)/sign-in')}>
                      Back to <Text style={{ color: theme.text.primary }}>Sign in</Text>
                    </LinkAction>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.formHeader}>
                    <Text style={[styles.title, { color: theme.text.primary }]}>
                      Reset password
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                      {mailConfigured === false
                        ? MAIL_NOT_CONFIGURED_MESSAGE
                        : "Enter your email and we'll send a link."}
                    </Text>
                  </View>

                  {mailConfigured !== false && (
                    <AuthField
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      editable={mailConfigured === true && !submitting}
                    />
                  )}

                  {error && (
                    <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>
                  )}

                  {mailConfigured !== false && (
                    <PrimaryAction
                      label="Send reset link"
                      disabled={disabled}
                      busy={submitting}
                      onPress={handleRequest}
                    />
                  )}

                  <View style={styles.links}>
                    <LinkAction onPress={() => router.navigate('/(auth)/sign-in')}>
                      Back to <Text style={{ color: theme.text.primary }}>Sign in</Text>
                    </LinkAction>
                  </View>
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
