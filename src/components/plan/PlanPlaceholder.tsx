import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PlanTopBar } from './PlanTopBar';

/**
 * What a plan-detail screen shows while its plan is loading or when it has nothing to show —
 * a failed fetch, a deleted id, a bad deep link. The native header is hidden on these screens
 * (`PlanTopBar`), so the bar is rendered here too: the runner always has a way back that is
 * not the OS gesture.
 *
 * No `message` is the loading state; a `message` is the error, under "Nothing to show".
 */
export function PlanPlaceholder({ label, message }: { label: string; message?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.bar}>
          <PlanTopBar label={label} />
        </View>
        <View style={styles.centered}>
          {message === undefined ? (
            <ActivityIndicator color={theme.text.primary} />
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text.primary }]}>Nothing to show</Text>
              <Text style={[styles.message, { color: theme.status.error }]}>{message}</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.xl,
  },
  message: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
