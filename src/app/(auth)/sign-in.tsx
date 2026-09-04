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

/**
 * Sign-in. Same visual treatment as onboarding — the near-black pulse-trace field at the top, the
 * form on the page below it, one signal-marked action — but the field is the short `band` variant
 * and it does not gate anything. That is the deliberate difference: onboarding is a cover a runner
 * is invited to read, this is a form they came here to fill in, so the bold moment is present as
 * identity and never in the way. Nothing on this screen waits for an animation.
 *
 * The back link to onboarding is a peer of the sign-up link at the bottom. `(auth)/onboarding` is
 * the only pre-auth screen there is — it IS home for a signed-out runner — and before this screen
 * had a link there, a runner who tapped through from onboarding had no way back to it except the
 * OS back gesture.
 *
 * `Stack.Protected` in the root layout does the actual navigation once a session exists; this
 * screen only needs to make the sign-in call.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Every `authClient` call needs its own try/catch, not just an `error` check: better-auth's
  // `{ data, error }` contract only covers responses it received. A request that never reached the
  // Worker — the everyday case when the backend isn't running, or when EXPO_PUBLIC_API_BASE_URL
  // points at localhost and the app is on a real phone — rejects instead. Uncaught in a `Pressable`
  // handler that means an unhandled promise rejection *and* a `submitting` flag that never clears,
  // so the button spins forever and sign-in is unreachable. See `apiErrors.ts`.
  async function handleSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? 'Sign-in failed. Check your email and password.');
      }
    } catch (signInError) {
      setError(describeError(signInError, 'Sign-in failed. Try again.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await signInWithGoogle();
      if (!outcome.ok) setError(outcome.message);
    } catch (socialError) {
      setError(describeError(socialError, 'Google sign-in failed.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !email || !password;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/*
          The form scrolls. Without a scroll container the title, or the Sign in button, becomes
          unreachable once the container is shorter than the content — which is exactly what a
          keyboard does (Android resizes the window, iOS covers the bottom), and an error message
          only makes the content taller.
        */}
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
              <Text style={[styles.fieldTitle, { color: Accent.onField }]}>Sign in</Text>
            </PulseTraceSlot>

            <View style={styles.form}>
              <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                Pick up where you left off.
              </Text>

              {/* Social first, then the divider, then email. */}
              <SecondaryAction
                label="Sign in with Google"
                disabled={submitting}
                onPress={handleGoogleSignIn}
              />

              <ActionDivider />

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
                placeholder="Your password"
                autoCapitalize="none"
                autoComplete="password"
                secureTextEntry
              />

              {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

              <PrimaryAction
                label="Sign in"
                disabled={disabled}
                busy={submitting}
                onPress={handleSignIn}
              />

              <View style={styles.links}>
                <LinkAction onPress={() => router.push('/(auth)/sign-up')}>
                  No account? <Text style={{ color: theme.text.primary }}>Sign up</Text>
                </LinkAction>
                <LinkAction onPress={() => router.push('/(auth)/onboarding')}>
                  <Text style={{ color: theme.text.primary }}>Back to the start</Text>
                </LinkAction>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

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
  fieldTitle: {
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
