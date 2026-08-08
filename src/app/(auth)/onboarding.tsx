import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeroRibbon } from '@/components/onboarding/HeroRibbon';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The signed-out landing screen: the ribbon motif at hero scale, one line of promise, and the
 * two ways forward. No form — `sign-up.tsx` and `sign-in.tsx` own the actual auth — but it does
 * scroll: the layout centres its content between two flex spacers, and at large Dynamic Type
 * sizes `styles.supporting` alone can grow tall enough on a short device to push the CTA and the
 * sign-in link off screen with no way to reach them. `flexGrow: 1` on the `ScrollView`'s content
 * container keeps today's centred look on a normal viewport and lets the content scroll instead
 * of overflow when it doesn't fit. Same pattern as `sign-up.tsx`, minus the
 * `KeyboardAvoidingView` — there is no text input here, so no keyboard to avoid.
 *
 * `(auth)/index.tsx` redirects here, and that route is the anchor for EVERY signed-out session,
 * not just a first install — a returning signed-out user lands here too. That is why the sign-in
 * link is a peer of the CTA rather than fine print: it is the skip.
 *
 * Copy is final (`ux-copywriter` pass, 2026-08-08). A proposed line attributing the training to
 * a "McMillan-certified coach" was reviewed and deliberately dropped by captain's ruling on
 * 2026-08-08, leaving only claims grounded in `planning/02-product-requirements.md`.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();

  /**
   * The captain's constraint: the ribbon must already be settled, not mid-build, by the time the
   * CTA is interactive. `HeroRibbon` raises this from the cascade's own completion callback, with
   * its own token-derived ceiling behind it, so this can never strand the user on a disabled
   * button. Under reduced motion the build is one `standard` window, so it lands almost at once.
   */
  const [ribbonSettled, setRibbonSettled] = useState(false);
  const handleSettled = useCallback(() => setRibbonSettled(true), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Only the two spacers absorb a short viewport, and — now that they're inside a
              scrolling container — a viewport too short even once they've collapsed to nothing.
              The hero's geometry is fixed in absolute tokens, so the ribbon is never what
              shrinks. */}
          <View style={styles.topSpacer} />

          <HeroRibbon onSettled={handleSettled} />

          {/* The stage/bench divider: one hard, full-width rule under the illustration. */}
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.copy}>
            <Text style={[styles.heading, { color: theme.text.primary }]}>
              Your training plan, built around you.
            </Text>
            <Text style={[styles.supporting, { color: theme.text.secondary }]}>
              No monthly coaching fees, no bloated app — just your plan, week by week.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={
                ribbonSettled ? undefined : 'Available once the illustration finishes animating.'
              }
              disabled={!ribbonSettled}
              onPress={() => router.push('/(auth)/sign-up')}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: ribbonSettled ? theme.accent.hivis : theme.progress.disabled,
                },
                pressed && ribbonSettled && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: ribbonSettled ? theme.accent.onAccent : theme.text.primary },
                ]}
              >
                Get started
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/sign-in')}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: theme.text.secondary }]}>
                Already have an account? <Text style={{ color: theme.text.primary }}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  topSpacer: {
    flex: 1,
    minHeight: Spacing.six,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  copy: {
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  heading: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
  },
  supporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: Spacing.five,
  },
  actions: {
    paddingHorizontal: Spacing.four,
  },
  // primaryButton / primaryButtonText / linkButton / linkText / pressed are `sign-up.tsx`'s
  // shapes verbatim — this screen is a peer of that one, not a new visual language.
  primaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.two,
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
