import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { TabBarIcon, type TabIconName } from '@/components/nav/TabBarIcon';
import { FontFamily, FontSize, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tab group — Home / Glossary / My Plans / Settings. `src/app/plan/[id].tsx` stays a Stack
 * route outside this group by design: the plan view is a full-screen destination, not a tab.
 *
 * Trailhead's bar (`docs/design/trailhead-visual-system.md`): flat `surface.raised`, one top
 * hairline, no shadow, and four thin-stroke line icons — the previous pass rendered
 * `tabBarIcon: () => null` and shipped no icons at all. The active tab draws its icon and label
 * in `text.primary` above an **ink tick**, a short hard rule rather than a filled pill or a
 * coloured dot; inactive tabs use `progress.informative`, a token that exists precisely because
 * this is a meaningful navigational state rather than decoration.
 *
 * **The ember accent never touches this bar.** One accent, one forward-action per screen, and
 * navigation is not that action.
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
          borderTopWidth: Stroke.hairline,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: theme.text.primary,
        tabBarInactiveTintColor: theme.progress.informative,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen name="index" options={tabOptions('Home', 'route')} />
      <Tabs.Screen name="glossary" options={tabOptions('Glossary', 'book')} />
      <Tabs.Screen name="my-plans" options={tabOptions('My Plans', 'cards')} />
      <Tabs.Screen name="settings" options={tabOptions('Settings', 'gear')} />
    </Tabs>
  );
}

/** Every tab is configured identically apart from its title and icon, so the options are built
 * rather than written out four times — the previous version repeated the same nine-line label
 * renderer per screen, which is how three of them drift and the fourth doesn't. */
function tabOptions(title: string, icon: TabIconName) {
  return {
    title,
    tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name={icon} color={color} />,
    tabBarLabel: ({ focused, color, children }: { focused: boolean; color: string; children: string }) => (
      <TabLabel focused={focused} color={color}>
        {children}
      </TabLabel>
    ),
  };
}

/** The active state: a short ink tick beneath the label. Never a filled pill, never a coloured
 * dot, and never ember. */
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
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
    textTransform: 'uppercase',
  },
  tick: {
    width: Spacing.three,
    height: Stroke.mark,
  },
});
