import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DisclosureArrow } from '@/components/ui/DisclosureArrow';
import { FontFamily, FontSize, PressedOpacity, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The one line the footer folds to. Names what is inside without restating any of it. */
export const DISCLAIMER_SUMMARY = 'Disclaimers & safety notes';

/**
 * Rule 10 (`load-rules.md`) — legally required, static, never dismissed. Renders at the bottom
 * of every plan view, every tier, every time. `frontend-design-brief.md` Part 5, "Plan view".
 *
 * Folded by default since 2026-10-05 (captain: the full stack at the foot of every plan was "too
 * much and messy"): one short line with a chevron, tap to show every disclaimer, tap again to
 * fold. Folding is not dismissing — the line is on every plan, it cannot be hidden, and the
 * wording of each disclaimer is untouched; only how much of it stands open by default changed.
 * The expanded/collapsed state is announced on the line itself (`accessibilityState.expanded`).
 */
export function DisclaimerFooter({ disclaimers }: { disclaimers: readonly string[] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (disclaimers.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderTopColor: theme.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${DISCLAIMER_SUMMARY}, ${disclaimers.length}`}
        accessibilityHint={expanded ? 'Hides the disclaimers' : 'Shows the disclaimers'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={[styles.summary, { color: theme.text.secondary }]}>
          {DISCLAIMER_SUMMARY} · {disclaimers.length}
        </Text>
        <DisclosureArrow expanded={expanded} color={theme.text.secondary} />
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          {disclaimers.map((text) => (
            <Text key={text} style={[styles.text, { color: theme.text.secondary }]}>
              {text}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: Stroke.hairline,
    paddingTop: Spacing.two,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: Spacing.six,
  },
  summary: {
    flexShrink: 1,
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  body: {
    paddingTop: Spacing.one,
    gap: Spacing.two,
  },
  text: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
