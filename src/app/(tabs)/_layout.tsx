import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarIcon, type TabIconName } from '@/components/nav/TabBarIcon';
import { Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tab group — Home / Glossary / My Plans / Settings. `src/app/plan/[id].tsx` stays a Stack
 * route outside this group by design: the plan view is a full-screen destination, not a tab.
 *
 * The bar (`docs/design/instrument-visual-system.md`): flat `surface.raised`, one top
 * hairline, no shadow, and four thin-stroke line icons. The active tab draws its icon above an
 * **ink tick**, a short hard rule rather than a filled pill or a coloured dot; inactive tabs use
 * `progress.informative`, a token that exists precisely because this is a meaningful navigational
 * state rather than decoration. Visible labels are intentionally omitted; each tab keeps an
 * explicit screen-reader label.
 *
 * **The signal colour never touches this bar.** One accent, one forward-action per screen, and
 * navigation is not that action.
 */
/**
 * The icon-only bar uses the system's 48pt control field. Its `Spacing.four` icon and active tick
 * fit inside that field with the tokenized item padding and gap; the removed caption no longer
 * needs the previous 72pt allowance.
 *
 * The safe-area inset is added on top (and repeated as padding) because overriding `height` opts
 * out of the height React Navigation would otherwise compute *including* that inset — without it
 * the icon controls would sit under the home indicator on a notched phone.
 */
const TabBarContentHeight = Spacing.six;

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
    tabBarShowLabel: false,
    tabBarAccessibilityLabel: title,
    // React Navigation's bottom-tabs types this callback's `color` as `ColorValue`, which also
    // covers platform-color objects; this app's theme tokens (`theme.text.primary`,
    // `theme.progress.informative`) are always plain hex strings, never `PlatformColor()`, so the
    // cast down to `string` for `TabBarIcon`'s SVG stroke is safe.
    tabBarIcon: ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <TabIcon focused={focused} color={color as string} name={icon} />
    ),
  };
}

/** The active state: a short ink tick beneath the icon. Never a filled pill, never a coloured
 * dot, and never the signal colour. */
function TabIcon({
  focused,
  color,
  name,
}: {
  focused: boolean;
  color: string;
  name: TabIconName;
}) {
  const theme = useTheme();
  return (
    <View
      style={styles.iconWrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <TabBarIcon name={name} color={color} />
      <View
        style={[
          styles.tick,
          { backgroundColor: theme.text.primary, opacity: focused ? 1 : 0 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingTop: Spacing.two,
  },
  iconWrap: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  tick: {
    width: Spacing.three,
    height: Stroke.mark,
  },
});
