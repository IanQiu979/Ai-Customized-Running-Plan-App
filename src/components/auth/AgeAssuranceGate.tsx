import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as NativeView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AgeBandChoice } from '@/components/auth/AgeBandChoice';
import { PrimaryAction, SecondaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  authClient,
  describeError,
  recordAgeAssurance,
  useSessionUser,
} from '@/lib/apiClient';
import { selectionOf, type AgeAssuranceStatus, type AgeBand } from '@/lib/ageAssurance';
import { clearPostSignupRedirect } from '@/lib/postSignupRedirect';

export const AgeAssuranceStatusContext = createContext<AgeAssuranceStatus | undefined>(undefined);
const AGE_CONFIRMED_MESSAGE = 'Age confirmed. Continuing to Pace Blueprint.';
const LIVE_REGION_CLEAR_MS = 1000;

/** RN Web's host ref is a DOM element even though the shared RN type exposes only native methods. */
function setWebLiveRegionText(node: NativeView | null, message: string) {
  if (!node) return;
  (node as NativeView & { textContent: string }).textContent = message;
}

/** Undefined is intentional: an old session with no assurance metadata follows the legacy path. */
export function useAgeAssuranceStatus(): AgeAssuranceStatus | undefined {
  return useContext(AgeAssuranceStatusContext);
}

export function AgeAssuranceGate({ children }: { children: ReactNode }) {
  const user = useSessionUser();
  const gateUp = user?.ageAssuranceStatus === 'pending';
  const contentRef = useRef<NativeView>(null);
  const liveRegionRef = useRef<NativeView>(null);
  const liveRegionClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSession = useRef({ id: user?.id, status: user?.ageAssuranceStatus });

  useEffect(() => {
    const previous = previousSession.current;
    if (Platform.OS === 'web' && previous.id !== user?.id) {
      if (liveRegionClearTimer.current) clearTimeout(liveRegionClearTimer.current);
      liveRegionClearTimer.current = null;
      setWebLiveRegionText(liveRegionRef.current, '');
    }
    if (
      previous.id === user?.id &&
      previous.status === 'pending' &&
      user?.ageAssuranceStatus === 'recorded'
    ) {
      if (Platform.OS === 'web') {
        contentRef.current?.focus();
        // The target is focused first, then the live region changes in the destination context.
        setWebLiveRegionText(liveRegionRef.current, AGE_CONFIRMED_MESSAGE);
        if (liveRegionClearTimer.current) clearTimeout(liveRegionClearTimer.current);
        liveRegionClearTimer.current = setTimeout(() => {
          setWebLiveRegionText(liveRegionRef.current, '');
          liveRegionClearTimer.current = null;
        }, LIVE_REGION_CLEAR_MS);
      } else {
        AccessibilityInfo.announceForAccessibility(AGE_CONFIRMED_MESSAGE);
      }
    }
    previousSession.current = { id: user?.id, status: user?.ageAssuranceStatus };
  }, [user?.ageAssuranceStatus, user?.id]);

  useEffect(
    () => () => {
      if (liveRegionClearTimer.current) clearTimeout(liveRegionClearTimer.current);
    },
    []
  );

  return (
    <AgeAssuranceStatusContext.Provider value={user?.ageAssuranceStatus}>
      <View
        ref={liveRegionRef}
        testID="age-assurance-live-region"
        role={Platform.OS === 'web' ? 'status' : undefined}
        aria-live={Platform.OS === 'web' ? 'polite' : 'off'}
        aria-atomic={Platform.OS === 'web' ? true : undefined}
        pointerEvents="none"
        style={styles.visuallyHidden}
      />
      {gateUp && user ? (
        <PendingAgeAssuranceGate key={user.id} userId={user.id} />
      ) : (
        <View
          ref={contentRef}
          style={styles.host}
          testID="age-assurance-content"
          role="main"
          tabIndex={-1}
          importantForAccessibility="auto"
        >
          {children}
        </View>
      )}
    </AgeAssuranceStatusContext.Provider>
  );
}

/** Mounted only for one pending identity, so no form state can cross a sign-out/account switch. */
function PendingAgeAssuranceGate({ userId }: { userId: string }) {
  const theme = useTheme();
  const headingRef = useRef<NativeView>(null);
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [activeAction, setActiveAction] = useState<'continue' | 'sign-out' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selection = selectionOf(ageBand, guardianConsent);
  const submitting = activeAction !== null;

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    if (Platform.OS === 'web') {
      heading.focus();
    } else {
      AccessibilityInfo.sendAccessibilityEvent(heading, 'focus');
    }
  }, []);

  async function handleContinue() {
    if (!selection || submitting) return;
    setActiveAction('continue');
    setError(null);
    try {
      await recordAgeAssurance(selection, userId);
    } catch (saveError) {
      setError(
        describeError(
          saveError,
          'Your age choice could not be saved. Check your connection and try again.',
          API_BASE_URL
        )
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSignOut() {
    if (submitting) return;
    setActiveAction('sign-out');
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message ?? 'Could not sign out. Check your connection and try again.');
        setActiveAction(null);
        return;
      }
      clearPostSignupRedirect();
      // Success invalidates the session store and unmounts this keyed child. Keep it busy until
      // that happens so a slow reactive update cannot issue a second sign-out request.
    } catch {
      setError('Could not sign out. Check your connection and try again.');
      setActiveAction(null);
    }
  }

  return (
    <View
      testID="age-assurance-gate"
      role="dialog"
      aria-modal={true}
      accessibilityViewIsModal
      accessibilityLabelledBy="age-assurance-heading"
      style={[styles.host, { backgroundColor: theme.surface.base }]}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>ONE MORE STEP</Text>
            <View
              ref={headingRef}
              testID="age-assurance-heading"
              nativeID="age-assurance-heading"
              accessible
              accessibilityRole="header"
              tabIndex={-1}
            >
              <Text style={[styles.title, { color: theme.text.primary }]}>Confirm your age</Text>
            </View>
            <Text style={[styles.body, { color: theme.text.secondary }]}>
              Select your age range to continue. This is recorded once, with your account.
            </Text>
          </View>

          <AgeBandChoice
            value={ageBand}
            onChange={(band) => {
              setAgeBand(band);
              setError(null);
            }}
            guardianConsent={guardianConsent}
            onToggleGuardianConsent={() => setGuardianConsent((checked) => !checked)}
            disabled={submitting}
            testIDPrefix="age-gate"
          />

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

          <View style={styles.actions}>
            <PrimaryAction
              label="Continue"
              disabled={submitting || selection === null}
              busy={activeAction === 'continue'}
              onPress={handleContinue}
              style={styles.action}
            />
            <View testID="age-gate-sign-out">
              <SecondaryAction
                label="Sign out"
                disabled={submitting}
                busy={activeAction === 'sign-out'}
                onPress={handleSignOut}
                style={styles.action}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  header: { gap: Spacing.one },
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
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  actions: { gap: Spacing.two },
  action: { width: '100%' },
});
