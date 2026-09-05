import { Tabs } from 'expo-router';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarIcon, type TabIconName } from '@/components/nav/TabBarIcon';
import { FontFamily, FontSize, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tab group — Home / Glossary / My Plans / Settings. `src/app/plan/[id].tsx` stays a Stack
 * route outside this group by design: the plan view is a full-screen destination, not a tab.
 *
 * The bar (`docs/design/instrument-visual-system.md`): flat `surface.raised`, one top
 * hairline, no shadow, and four thin-stroke line icons — the previous pass rendered
 * `tabBarIcon: () => null` and shipped no icons at all. The active tab draws its icon and label
 * in `text.primary` above an **ink tick**, a short hard rule rather than a filled pill or a
 * coloured dot; inactive tabs use `progress.informative`, a token that exists precisely because
 * this is a meaningful navigational state rather than decoration.
 *
 * **The signal colour never touches this bar.** One accent, one forward-action per screen, and
 * navigation is not that action.
 */
/**
 * The bar has to be told how tall it is. React Navigation sizes it for a stock item — a compact
 * icon over a caption — and this system's item is taller than that: `Spacing.two` of top padding, a
 * `Spacing.four` icon, the mono label, and the active tick beneath it. Left at the default the
 * extra ran off the bottom of the bar and the labels were sheared in half; measured in the web
 * build 2026-09-01, the item's content ended 19pt below the bar's own bottom edge.
 *
 * This is the smallest height that fits the item *inside its own padding box* rather than merely
 * inside the bar: `Spacing.seven + Spacing.one` stops the shearing but leaves the tick sitting
 * exactly on the bar's bottom edge, which reads as clipped on a device with no home indicator.
 *
 * The safe-area inset is added on top (and repeated as padding) because overriding `height` opts
 * out of the height React Navigation would otherwise compute *including* that inset — without it
 * the labels would sit under the home indicator on a notched phone.
 */
const TabBarContentHeight = Spacing.seven + Spacing.two;

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface.raised,
          borderTopColor: theme.hairline,
          borderTopWidth: Stroke.hairline,
          height: TabBarContentHeight + insets.bottom,
          paddingBottom: insets.bottom,
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
    // React Navigation's bottom-tabs types this callback's `color` as `ColorValue`, which also
    // covers platform-color objects; this app's theme tokens (`theme.text.primary`,
    // `theme.progress.informative`) are always plain hex strings, never `PlatformColor()`, so the
    // cast down to `string` for `TabBarIcon`'s SVG stroke is safe.
    tabBarIcon: ({ color }: { color: ColorValue }) => <TabBarIcon name={icon} color={color as string} />,
    tabBarLabel: ({
      focused,
      color,
      children,
    }: {
      focused: boolean;
      color: ColorValue;
      children: string;
    }) => (
      <TabLabel focused={focused} color={color as string}>
        {children}
      </TabLabel>
    ),
  };
}

/** The active state: a short ink tick beneath the label. Never a filled pill, never a coloured
 * dot, and never the signal colour. */
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
