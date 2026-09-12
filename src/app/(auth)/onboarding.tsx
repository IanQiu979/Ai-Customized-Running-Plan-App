import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseTraceSlot } from '@/components/onboarding/PulseTraceSlot';
import { LinkAction, PrimaryAction } from '@/components/ui/ActionButton';
import {
  Accent,
  FontFamily,
  FontSize,
  MaxContentWidth,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The signed-out landing screen, and Instrument's ONE deliberate bold exception: a near-black
 * pulse-trace cover at the top, then a scroll-down walk through what the app actually does, then
 * the single signal-marked call to action at the bottom.
 *
 * **The mechanic is the scroll, not a carousel.** Three numbered sections stack vertically under
 * the cover, each one a screenful-ish beat separated by a hairline and a mono index. The runner
 * reads by scrolling — there is nothing to swipe, no dots, no "next" button, and no state to
 * restore if they leave halfway. That is deliberate: this screen is the anchor for EVERY
 * signed-out session, not just a first install (`(auth)/index.tsx` redirects here), so a
 * returning user must be able to reach the actions without being walked through a tour. The
 * sign-in link is a peer of the CTA at the bottom rather than fine print under it, for exactly
 * that reason — it is the skip.
 *
 * The animated pulse trace mounts as `<PulseTraceSlot>`; see that file's header for the one-line
 * swap to the real `<PulseTraceHero>` once its branch lands. Everything about this screen's
 * layout is already sized against the real component's geometry.
 *
 * Copy is grounded in what the product does and nothing more — ten intake questions
 * (`planning/02-product-requirements.md`), unnamed Day 1–7 slots (`CLAUDE.md`'s coaching-domain
 * rules), one free plan (`lib/tierLimits.ts`). It makes no coaching claim: the "McMillan-certified
 * coach" line was reviewed and deliberately dropped by captain's ruling on 2026-08-08 and has not
 * come back.
 */

/** The three beats of the scroll. Index, label and copy travel together so a reorder cannot skew
 * the numbering — the mono index is derived from the array position, never hand-written. */
const SECTIONS = [
  {
    label: 'THE INTAKE',
    heading: 'Tell us about your running.',
    body: 'Share your goal, age, running experience, weekly training, race target, recent performance, and injuries.',
  },
  {
    label: 'THE PLAN',
    heading: 'See every week.',
    body: 'Your plan shows each week’s runs and rest days; you choose the calendar days.',
  },
  {
    label: 'THE PRICE',
    heading: 'One plan is free.',
    body: 'Pro and Elite add more plans and coaching notes, plus paces when you share a recent time.',
  },
] as const;

/**
 * The ceiling on waiting for the hero to settle. `<PulseTraceHero>` settles at roughly lead 400ms
 * + draw 2200ms + slack 400ms = 3000ms, so 4s sits comfortably past a healthy draw and only ever
 * fires when something has actually gone wrong.
 */
const HERO_SETTLE_CEILING_MS = 4000;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { height: viewportHeight } = useWindowDimensions();

  /**
   * The captain's constraint, carried over from the previous system: the hero must already be
   * settled, not mid-draw, by the time the CTA is interactive. The trace component raises that
   * from its own draw-completion callback — and the CTA is below the fold anyway, so on a real
   * device the draw has finished long before the button is on screen.
   *
   * The constraint stands; the ceiling below is only so it cannot hang forever. This screen owns
   * that ceiling itself rather than trusting the trace component to have one, because "Get
   * started" is the ONLY forward action out of the signed-out landing screen: a callback that
   * never arrives — an interrupted draw, an unmount mid-draw, a reduced-motion branch that misses
   * — is a silent, total dead end, and that failure must not depend on another component's
   * internals.
   */
  const [heroSettled, setHeroSettled] = useState(false);
  const handleSettled = useCallback(() => setHeroSettled(true), []);

  useEffect(() => {
    if (heroSettled) return;
    const ceiling = setTimeout(() => setHeroSettled(true), HERO_SETTLE_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [heroSettled]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      {/* The cover bleeds into the top inset — a cover has no margin. The scroll below takes the
          side and bottom insets. */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
          {/* The field carries the wordmark and nothing else. The headline sits on the page below
              it, not over it: at large Dynamic Type sizes a 44pt condensed headline is taller than
              the hero's own height, and `<PulseTraceHero>` is a fixed-height component — copy that
              tall inside it would clip rather than push. It is also the better composition, since
              the dark field is then a graphic and the page carries the words. */}
          <PulseTraceSlot onSettled={handleSettled}>
            <Text style={[styles.eyebrow, { color: Accent.onFieldMuted }]}>PACE BLUEPRINT</Text>
          </PulseTraceSlot>

          <View style={styles.cover}>
            <Text style={[styles.coverHeading, { color: theme.text.primary }]}>
              Your training plan, built around you.
            </Text>
            <Text style={[styles.coverSupporting, { color: theme.text.secondary }]}>
              Answer a short intake, then get a week-by-week running plan.
            </Text>

            {/* The scroll cue. A mono label and a hairline, not a bouncing chevron: this system
                does not animate to ask for attention. */}
            <View style={styles.cue}>
              <Text style={[styles.cueLabel, { color: theme.text.secondary }]}>SCROLL</Text>
              <View style={[styles.cueRule, { backgroundColor: theme.hairline }]} />
            </View>
          </View>

          <View style={styles.sections}>
            {SECTIONS.map((section, index) => (
              <View
                key={section.label}
                style={[
                  styles.section,
                  { borderTopColor: theme.hairline },
                  // Each beat is sized against the viewport rather than its own copy so the scroll
                  // has real rhythm on a tall phone and still collapses to its content on a short
                  // one. `minHeight`, never `height` — copy at large Dynamic Type sizes must be
                  // allowed to make a section taller, never be clipped by it.
                  { minHeight: Math.max(Spacing.seven * 3, viewportHeight * 0.42) },
                ]}
              >
                <View style={styles.sectionIndex}>
                  <Text style={[styles.indexNumber, { color: theme.text.primary }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.indexLabel, { color: theme.text.secondary }]}>
                    {section.label}
                  </Text>
                </View>
                <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>
                  {section.heading}
                </Text>
                <Text style={[styles.sectionBody, { color: theme.text.secondary }]}>
                  {section.body}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.actions, { borderTopColor: theme.hairline }]}>
            <PrimaryAction
              label="Get started"
              disabled={!heroSettled}
              accessibilityHint={
                heroSettled ? undefined : 'Available once the illustration finishes animating.'
              }
              onPress={() => router.push('/(auth)/sign-up')}
            />
            <LinkAction onPress={() => router.push('/(auth)/sign-in')}>
              Already have an account?{' '}
              <Text style={{ color: theme.text.primary }}>Sign in</Text>
            </LinkAction>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
  coverHeading: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  coverSupporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  cover: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  cue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  cueLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  cueRule: {
    flex: 1,
    height: Stroke.hairline,
  },
  sections: {
    paddingTop: Spacing.four,
  },
  section: {
    borderTopWidth: Stroke.hairline,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    justifyContent: 'center',
  },
  sectionIndex: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  indexNumber: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
    letterSpacing: Tracking.display,
  },
  indexLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  sectionHeading: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
  },
  sectionBody: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.5,
  },
  actions: {
    borderTopWidth: Stroke.hairline,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
});
