import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGoalRealismNoticeCopy } from '@/lib/goalRealismDisclosure';
import type { GoalRealismAssessment } from '@/lib/planTypes';

interface GoalRealismNoticeProps {
  assessment: GoalRealismAssessment;
}

/**
 * The calm, neutral card explaining a goal that isn't `'realistic'` — same raised-surface,
 * hairline-border treatment as `FallbackNotice`, never `status.error`: this is a coaching judgment
 * call, not a failure. `'implausible'` (a capped race-pace anchor, `cappedTimeSec` set) gets the
 * "was adjusted" copy; `'ambitious'` still anchors race-pace reps at the declared goal, so it gets
 * a softer heads-up instead — callers must not claim an adjustment that didn't happen.
 */
export function GoalRealismNotice({ assessment }: GoalRealismNoticeProps) {
  const theme = useTheme();
  const copy = getGoalRealismNoticeCopy(assessment);

  if (!copy) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface.raised, borderColor: theme.hairline }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.md,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
