import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecondaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  describeError,
  getEmailStatus,
  resendVerificationEmail,
  useSessionUser,
} from '@/lib/apiClient';
import { shouldShowVerifyEmailBanner } from '@/lib/authEmail';

/**
 * The "verify your email" card on Home (issue #94). Self-contained: it reads the session for
 * `user.emailVerified`, reads `GET /api/email-status` once for whether the Worker can send mail
 * at all, and renders nothing unless both say a resend would do something
 * (`shouldShowVerifyEmailBanner`). Home therefore does not need to know it exists.
 *
 * Same calm treatment as `FallbackNotice` — raised surface, hairline border, never
 * `status.error`: an unverified address is a to-do, not a fault. The resend is a
 * `SecondaryAction`, not the primary slab, because the screen's one accent belongs to the plan
 * action below it.
 */
export function VerifyEmailBanner() {
  const theme = useTheme();
  const user = useSessionUser();
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getEmailStatus();
        if (!cancelled) setMailConfigured(status.mailConfigured);
      } catch {
        // A capability read that fails is the same as "cannot send": stay hidden. Home already
        // reports the unreachable backend on its own line; a second copy here would be noise.
        if (!cancelled) setMailConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const email = user?.email;
  if (
    !email ||
    !shouldShowVerifyEmailBanner({
      emailVerified: user?.emailVerified,
      mailConfigured,
    })
  ) {
    return null;
  }

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

  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: theme.surface.raised, borderColor: theme.hairline }]}
    >
      <Text style={[styles.title, { color: theme.text.primary }]}>Verify your email</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        {sent
          ? `Sent. Check ${email} for the link.`
          : `We sent a link to ${email}. Open it to confirm this address.`}
      </Text>
      {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}
      {!sent && (
        <SecondaryAction
          label="Resend link"
          busy={sending}
          disabled={sending}
          onPress={handleResend}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
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
});
