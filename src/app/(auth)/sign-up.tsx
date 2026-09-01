import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { DuskHero } from '@/components/brand/DuskHero';
import {
  DuskGradient,
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, describeError, signInWithGoogle } from '@/lib/apiClient';
import { markPostSignupRedirect } from '@/lib/postSignupRedirect';

/** Sign-up. Peer of `sign-in.tsx` — same dusk band, same paper form, same single ember action. */
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
            <DuskHero size="band">
              <Text style={[styles.eyebrow, { color: DuskGradient.onDuskMuted }]}>
                PACE BLUEPRINT
              </Text>
              <Text style={[styles.title, { color: DuskGradient.onDusk }]}>Create account</Text>
            </DuskHero>

            <View style={styles.form}>
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

              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={handleSignUp}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: disabled ? theme.progress.disabled : theme.accent.ember },
                  pressed && !disabled && styles.pressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.accent.onEmber} />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: disabled ? theme.text.primary : theme.accent.onEmber },
                    ]}
                  >
                    Sign up
                  </Text>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
                <Text style={[styles.dividerLabel, { color: theme.text.secondary }]}>OR</Text>
                <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleGoogleSignIn}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.text.primary },
                  (pressed || submitting) && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text.primary }]}>
                  Continue with Google
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(auth)/sign-in')}
                style={styles.linkButton}
              >
                <Text style={[styles.linkText, { color: theme.text.secondary }]}>
                  Already have an account?{' '}
                  <Text style={{ color: theme.text.primary }}>Sign in</Text>
                </Text>
              </Pressable>
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
  scrollContent: { flexGrow: 1 },
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
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
  primaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerRule: {
    flex: 1,
    height: Stroke.hairline,
  },
  dividerLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  secondaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    borderWidth: Stroke.mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  linkButton: {
    alignItems: 'center',
    minHeight: Spacing.six,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
