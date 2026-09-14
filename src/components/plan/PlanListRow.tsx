import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MiniWeekStrip } from '@/components/build/MiniWeekStrip';
import { FontFamily, FontSize, PressedOpacity, Radius, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StripWeek } from '@/lib/weekStrip';

/**
 * One plan in the My Plans list (V22-05's "ALL PLANS" rows): a raised card carrying a
 * miniature of the plan's first week, its title, a mono metadata line, and an arrow. A row is a
 * destination, not a call to action — no accent here; the screen's one `PrimaryAction` is the
 * hero's "Open plan".
 *
 * The miniature is whatever week the caller has: the real first week once the plan's details
 * have loaded, the empty strip until then. Loading a plan's detail never blocks the row.
 */
export function PlanListRow({
  planId,
  title,
  meta,
  week,
  accessibilityLabel,
}: {
  planId: string;
  title: string;
  /** Already-formatted, already-uppercased. */
  meta: string;
  week: StripWeek;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  // A plain `Pressable` with `router.push`, not `<Link asChild>`: on web the link wrapper drops a
  // Pressable's function-form `style`, which flattened every row into a column (2026-09-14
  // visual pass). Home's own nav row uses the same shape.
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? `${title}, ${meta.toLowerCase()}`}
      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: planId } })}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
        pressed && styles.pressed,
      ]}
    >
      <MiniWeekStrip week={week} width={60} height={28} gap={3} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: theme.text.secondary }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[styles.arrow, { color: theme.text.secondary }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: Stroke.thin,
    borderRadius: Radius.button,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: 14,
  },
  meta: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 1,
  },
  arrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 14,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
