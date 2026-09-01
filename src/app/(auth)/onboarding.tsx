import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DuskHero } from '@/components/brand/DuskHero';
import {
  DuskGradient,
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The signed-out landing screen. Trailhead's ONE deliberate bold exception: a dusk-gradient hero
 * with the route line drawing itself across it, then a paper-and-ink bench below carrying the two
 * ways forward. No form — `sign-up.tsx` and `sign-in.tsx` own the actual auth.
 *
 * It scrolls: the layout leans on a flex spacer between the hero and the actions, and at large
 * Dynamic Type sizes the copy alone can grow tall enough on a short device to push the CTA and
 * the sign-in link off screen with no way to reach them. `flexGrow: 1` on the `ScrollView`'s
 * content container keeps the intended layout on a normal viewport and lets the content scroll
 * instead of overflow when it doesn't fit.
 *
 * `(auth)/index.tsx` redirects here, and that route is the anchor for EVERY signed-out session,
 * not just a first install — a returning signed-out user lands here too. That is why the sign-in
 * link is a peer of the CTA rather than fine print: it is the skip.
 *
 * Copy is final (`ux-copywriter` pass, 2026-08-08). A proposed line attributing the training to a
 * "McMillan-certified coach" was reviewed and deliberately dropped by captain's ruling on
 * 2026-08-08, leaving only claims grounded in `planning/02-product-requirements.md`.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();

  /**
   * The captain's constraint: the hero must already be settled, not mid-draw, by the time the CTA
   * is interactive. `DuskHero` raises this from the stroke-draw's own completion callback, with
   * its own token-derived ceiling behind it, so this can never strand the user on a disabled
   * button. Under reduced motion there is no draw at all, so it lands immediately.
   */
  const [heroSettled, setHeroSettled] = useState(false);
  const handleSettled = useCallback(() => setHeroSettled(true), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      {/* The hero bleeds into the top inset — a cover has no margin. The bench below takes the
          side and bottom insets. */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <DuskHero onSettled={handleSettled}>
            <Text style={[styles.eyebrow, { color: DuskGradient.onDuskMuted }]}>PACE BLUEPRINT</Text>
            <Text style={[styles.heading, { color: DuskGradient.onDusk }]}>
              Your training plan, built around you.
            </Text>
            <Text style={[styles.supporting, { color: DuskGradient.onDuskMuted }]}>
              No monthly coaching fees, no bloated app — just your plan, week by week.
            </Text>
          </DuskHero>

          {/* Only this spacer absorbs a short viewport — and, now that it is inside a scrolling
              container, a viewport too short even once it has collapsed to nothing. The hero's
              geometry is fixed in absolute tokens, so it is never what shrinks. */}
          <View style={styles.spacer} />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={
                heroSettled ? undefined : 'Available once the illustration finishes animating.'
              }
              disabled={!heroSettled}
              onPress={() => router.push('/(auth)/sign-up')}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: heroSettled ? theme.accent.ember : theme.progress.disabled,
                },
                pressed && heroSettled && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: heroSettled ? theme.accent.onEmber : theme.text.primary },
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
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  heading: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  supporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.five,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
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
