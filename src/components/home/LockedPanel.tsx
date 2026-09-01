import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FontFamily,
  FontSize,
  LockedOpacity,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A surface the runner can see but cannot use — the Free tier's locked Notes field and the
 * Pro/Elite content teaser on Home.
 *
 * **This component displays a tier decision; it does not make one.** The caller passes `locked`,
 * and the only place that value may come from is the server's `getQuotaStatus()`. There is no
 * tier arithmetic here, and there must never be: `AGENTS.md` — the client may display tier state
 * but is never the authority for it. Locking the Notes field in particular is a UI *correction*,
 * not new enforcement — Free tier is template-only and never reaches the model, so the notes a
 * Free runner could previously type were silently discarded server-side.
 *
 * When unlocked it renders its children and nothing else, so a caller never needs two branches.
 *
 * On the dim rather than a blur: React Native has no cross-platform blur primitive (Android's is
 * unreliable and `expo-blur` would be a new dependency for one decorative effect). `LockedOpacity`
 * plus the dashed frame reads as "held back", which is the message; it is deliberately shallow so
 * the teaser still looks like real content worth paying for rather than a rendering failure.
 */
export function LockedPanel({
  locked,
  label,
  onUnlock,
  children,
}: {
  locked: boolean;
  /** What is being withheld, e.g. "Notes". Announced to screen readers with the lock state, so
   * the dim is never the only channel carrying it. */
  label: string;
  onUnlock: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();

  if (!locked) return <>{children}</>;

  return (
    <View
      style={[styles.panel, { borderColor: theme.progress.informative }]}
      accessible
      accessibilityLabel={`${label} — locked. Available on Pro and Elite.`}
    >
      {/* `pointerEvents="none"` is what actually makes this inert. The dim is only the signal. */}
      <View style={styles.content} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        {children}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Upgrade to unlock ${label}`}
        onPress={onUnlock}
        style={({ pressed }) => [styles.unlockRow, pressed && styles.pressed]}
      >
        <Text style={[styles.unlockText, { color: theme.text.primary }]}>UPGRADE TO UNLOCK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: Stroke.mark,
    borderStyle: 'dashed',
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  content: {
    opacity: LockedOpacity,
  },
  unlockRow: {
    alignSelf: 'flex-start',
    minHeight: Spacing.four,
    justifyContent: 'center',
  },
  unlockText: {
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
