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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgeBandChoice } from '@/components/auth/AgeBandChoice';
import { AuthField } from '@/components/auth/AuthField';
import {
  ActionDivider,
  LinkAction,
  PrimaryAction,
  SecondaryAction,
} from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  describeError,
  signInWithGoogle,
  signUpWithAgeAssurance,
} from '@/lib/apiClient';
import { selectionOf, type AgeBand } from '@/lib/ageAssurance';
import { createVerifyEmailURL, isVerificationPendingSignUp } from '@/lib/authEmail';
import { clearPostSignupRedirect, markPostSignupRedirect } from '@/lib/postSignupRedirect';

/** Sign-up. Peer of `sign-in.tsx` — same wordmark, same page form, same single ink-filled
 * action, same link back to onboarding. See that file's header for the shared rationale. */
/** The wordmark's size on the V22 pages (`v22-0N-scene.jsx`: 21pt Barlow Condensed 600). */

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [guardianConsent, setGuardianConsent] = useState(false);
  // The empty form shows only the credentials and the actions (captain, 2026-10-05); the age
  // choice joins it the first time the runner engages with a credential field — focus, or text
  // arriving without one (autofill) — and then stays. It hides nothing from the rules: "Sign up"
  // is disabled until every credential is filled, and filling one reveals this.
  const [showAgeChoice, setShowAgeChoice] = useState(false);
  const revealAgeChoice = () => setShowAgeChoice(true);
  const onCredentialChange = (set: (value: string) => void) => (value: string) => {
    set(value);
    revealAgeChoice();
  };
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'email' | 'google' | null>(null);
  // Set when the Worker created the account but withheld the session because the deployment
  // requires email verification first (issue #94). `Stack.Protected` will not move a runner
  // without a session, so this screen has to tell them what happens next.
  const [pendingVerificationFor, setPendingVerificationFor] = useState<string | null>(null);

  // See `sign-in.tsx` for why every `authClient` call needs a try/catch and not just an `error`
  // check — an unreachable backend rejects rather than resolving to `{ error }`.
  async function handleSignUp() {
    if (activeAction) return;
    setError(null);
    const ageChoice = selectionOf(ageBand, guardianConsent);
    if (!ageChoice) {
      setError(
        ageBand === '13_17'
          ? 'A parent or guardian must agree before you create this account.'
          : 'Select your age range before you create this account.'
      );
      return;
    }
    setActiveAction('email');
    try {
      // `minPasswordLength: 8` (workers/src/auth.ts) is enforced server-side; this is not
      // duplicated here so the server's message stays the one source of truth for the copy.
      // `callbackURL` is where the verification mail's link sends the runner once the Worker has
      // consumed the token — the app's own `/verify-email` route. Safe on web, unlike sign-in: the
      // sign-up response carries no `redirect`, so the client's redirect plugin ignores it.
      const { data, error: signUpError } = await signUpWithAgeAssurance({
        name,
        email,
        password,
        callbackURL: createVerifyEmailURL(),
        ...ageChoice,
      });
      if (signUpError) {
        setError(signUpError.message ?? 'Sign-up failed. Try a different email or a longer password.');
        return;
      }
      if (isVerificationPendingSignUp(data)) {
        setPendingVerificationFor(email);
        // Still marked: the flag survives until a session appears, which for this runner is
        // their first sign-in after verifying — and a brand-new account still has no intake.
        markPostSignupRedirect();
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
      setActiveAction(null);
    }
  }

  async function handleGoogleSignIn() {
    if (activeAction) return;
    setError(null);
    setActiveAction('google');
    try {
      // Social auth is also account creation on this screen. Mark the one-shot redirect immediately
      // before the auth client notifies the session atom; doing it after success can lose the same
      // unmount race already fixed for email sign-up.
      const outcome = await signInWithGoogle({ onBeforeSessionNotify: markPostSignupRedirect });
      if (!outcome.ok) {
        clearPostSignupRedirect();
        setError(outcome.message);
      }
    } catch (socialError) {
      clearPostSignupRedirect();
      setError(describeError(socialError, 'Google sign-in failed.', API_BASE_URL));
    } finally {
      setActiveAction(null);
    }
  }

  const ageChoice = selectionOf(ageBand, guardianConsent);
  const submitting = activeAction !== null;
  const disabled = submitting || !name || !email || !password || ageChoice === null;

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
            {/* The wordmark sits on the page itself: the SafeAreaView excludes the top edge (the
                old field bled into it), so the inset is added here. */}
            <Text
              style={[
                styles.wordmark,
                { color: theme.text.primary, paddingTop: insets.top + Spacing.four },
              ]}
            >
              Pace Blueprint
            </Text>

            {pendingVerificationFor ? (
              <View style={styles.form}>
                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: theme.text.primary }]}>Check your inbox</Text>
                  <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    We sent a verification link to {pendingVerificationFor}. Open it to finish
                    creating your account, then sign in.
                  </Text>
                </View>
                <View style={styles.links}>
                  <LinkAction onPress={() => router.navigate('/(auth)/sign-in')}>
                    Go to <Text style={{ color: theme.text.primary }}>Sign in</Text>
                  </LinkAction>
                </View>
              </View>
            ) : (
              <View style={styles.form}>
                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: theme.text.primary }]}>Create account</Text>
                  <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    A short running intake comes next.
                  </Text>
                </View>

                <AuthField
                  label="Name"
                  value={name}
                  onChangeText={onCredentialChange(setName)}
                  onFocus={revealAgeChoice}
                  placeholder="Your name"
                  autoCapitalize="words"
                  autoComplete="name"
                />
                <AuthField
                  label="Email"
                  value={email}
                  onChangeText={onCredentialChange(setEmail)}
                  onFocus={revealAgeChoice}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
                <AuthField
                  label="Password"
                  value={password}
                  onChangeText={onCredentialChange(setPassword)}
                  onFocus={revealAgeChoice}
                  placeholder="At least 8 characters"
                  autoCapitalize="none"
                  autoComplete="password-new"
                  secureTextEntry
                />

                {showAgeChoice ? (
                  <AgeBandChoice
                    value={ageBand}
                    onChange={setAgeBand}
                    guardianConsent={guardianConsent}
                    onToggleGuardianConsent={() => setGuardianConsent((checked) => !checked)}
                    disabled={submitting}
                    testIDPrefix="signup-age"
                  />
                ) : null}

                {error ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    selectable
                    style={[styles.error, { color: theme.status.error }]}
                  >
                    {error}
                  </Text>
                ) : null}

                <PrimaryAction
                  label="Sign up"
                  disabled={disabled}
                  busy={activeAction === 'email'}
                  onPress={handleSignUp}
                />

                <ActionDivider />

                <SecondaryAction
                  label="Continue with Google"
                  disabled={submitting}
                  busy={activeAction === 'google'}
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
            )}
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
  wordmark: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.title,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingBottom: Spacing.four,
  },
  formHeader: {
    gap: Spacing.one,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.display,
    letterSpacing: Tracking.display,
  },
  subtitle: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.body,
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.label,
  },
  links: {
    gap: Spacing.half,
  },
});
