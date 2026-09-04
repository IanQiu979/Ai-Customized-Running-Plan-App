import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { PulseTraceSlot } from '@/components/onboarding/PulseTraceSlot';
import {
  ActionDivider,
  LinkAction,
  PrimaryAction,
  SecondaryAction,
} from '@/components/ui/ActionButton';
import {
  Accent,
  FontFamily,
  FontSize,
  MaxContentWidth,
  Spacing,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, describeError, signInWithGoogle } from '@/lib/apiClient';
import { markPostSignupRedirect } from '@/lib/postSignupRedirect';

/** Sign-up. Peer of `sign-in.tsx` — same pulse-trace band, same page form, same single signal
 * action, same link back to onboarding. See that file's header for the shared rationale. */
export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // See `sign-in.tsx` for why every `authClient` call needs a try/catch and not just an `error`
  // check — an unreachable backend rejects rather than resolving to `{ error }`.
  async function handleSignUp() {
    setError(null);
    setSubmitting(true);
    try {
      // `minPasswordLength: 8` (workers/src/auth.ts) is enforced server-side; this is not
      // duplicated here so the server's message stays the one source of truth for the copy.
      const { error: signUpError } = await authClient.signUp.email({ name, email, password });
      if (signUpError) {
        setError(signUpError.message ?? 'Sign-up failed. Try a different email or a longer password.');
        return;
      }
      // A brand-new account has no intake yet, so send it straight there instead of leaving Home's
      // "complete your intake" prompt for the runner to notice and tap themselves. This screen
      // cannot reliably do that navigation itself — see `postSignupRedirect.ts`'s header — so it
      // only sets the flag; `_layout.tsx` performs the actual `router.replace` once `session` (and
      // therefore the `intake` route) exists.
      markPostSignupRedirect();
    } catch (signUpError) {
      setError(describeError(signUpError, 'Sign-up failed. Try again.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      // Social auth is also account creation on this screen. Mark the one-shot redirect immediately
      // before the auth client notifies the session atom; doing it after success can lose the same
      // unmount race already fixed for email sign-up.
      const outcome = await signInWithGoogle({ onBeforeSessionNotify: markPostSignupRedirect });
      if (!outcome.ok) {
        setError(outcome.message);
      }
    } catch (socialError) {
      setError(describeError(socialError, 'Google sign-in failed.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !name || !email || !password;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Same scroll/keyboard rationale as `sign-in.tsx`, with one more field to overflow. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <PulseTraceSlot size="band">
              <Text style={[styles.eyebrow, { color: Accent.onFieldMuted }]}>PACE BLUEPRINT</Text>
            </PulseTraceSlot>

            <View style={styles.form}>
              <View style={styles.formHeader}>
                <Text style={[styles.title, { color: theme.text.primary }]}>Create account</Text>
                <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                  Ten questions, then your first plan.
                </Text>
              </View>

              <AuthField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="name"
              />
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                autoCapitalize="none"
                autoComplete="password-new"
                secureTextEntry
              />

              {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

              <PrimaryAction
                label="Sign up"
                disabled={disabled}
                busy={submitting}
                onPress={handleSignUp}
              />

              <ActionDivider />

              <SecondaryAction
                label="Continue with Google"
                disabled={submitting}
                onPress={handleGoogleSignIn}
              />

              <View style={styles.links}>
                <LinkAction onPress={() => router.navigate('/(auth)/sign-in')}>
                  Already have an account?{' '}
                  <Text style={{ color: theme.text.primary }}>Sign in</Text>
                </LinkAction>
                {/* Quieter than the sign-in/sign-up swap above it: this is the escape hatch back
                    to the only pre-auth screen, not the thing most people came here to do. */}
                <LinkAction onPress={() => router.navigate('/(auth)/onboarding')}>
                  Back to the start
                </LinkAction>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Identical to `sign-in.tsx`'s sheet, deliberately: these two screens are peers, and a shared
// stylesheet module would be one more place to look when only one of them is wrong.
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
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
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
