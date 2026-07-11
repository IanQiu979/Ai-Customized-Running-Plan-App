import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tab group. Phase 1 ships two of the eventual three tabs (`docs/design/mvp-blueprint.md`
 * Part 8 — Home / My Plans / Settings-lite): Home and the new Glossary tab from Ian's
 * 2026-07-11 notation ruling. My Plans and Settings-lite land with the backend that gives them
 * something to show. `src/app/plan/[id].tsx` stays a Stack route outside this group by design —
 * the plan view is a full-screen destination, not a tab.
 *
 * Flat `surface.raised`, one top hairline, no shadow — `mvp-blueprint.md` Part 8. The active
 * tab renders in `text.primary` with a hairline tick beneath the label (a caliper mark, not a
 * filled pill); inactive tabs render in `progress.informative` — that token exists specifically
 * because it's a meaningful navigational state, not decoration (Ruling 13, 2026-07-10). Hivis
 * never touches the tab bar's active state (`frontend-design-brief.md` Part 2, "The accent").
 */
export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface.raised,
          borderTopColor: theme.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: theme.text.primary,
        tabBarInactiveTintColor: theme.progress.informative,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>
              {children}
            </TabLabel>
          ),
        }}
      />
      <Tabs.Screen
        name="glossary"
        options={{
          title: 'Glossary',
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>
              {children}
            </TabLabel>
          ),
        }}
      />
    </Tabs>
  );
}

/** The active state's "caliper mark" — a short hairline tick beneath the label, never a filled
 * pill or a coloured dot (`mvp-blueprint.md` Part 8). */
function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.labelWrap}>
      <Text style={[styles.label, { color }]}>{children}</Text>
      <View style={[styles.tick, { backgroundColor: focused ? theme.text.primary : 'transparent' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingTop: Spacing.two,
  },
  labelWrap: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  label: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  tick: {
    width: Spacing.three,
    height: StyleSheet.hairlineWidth * 2,
  },
});
