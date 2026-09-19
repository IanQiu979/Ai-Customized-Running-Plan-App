import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { PRIVACY_POLICY_URL } from '@/constants/legal';

/**
 * The one way the app opens its published privacy policy (`PRIVACY_POLICY_URL`, issue #89).
 *
 * WHY THIS EXISTS: the policy is a legally required link in two places — Settings' "Legal" row
 * and the intake screen's 13–17 guardian-consent affirmation — and a link that fails silently is
 * #96's failure mode again (`Linking.openURL` rejects when no handler exists, and an uncaught
 * rejection shows the runner nothing). Both screens share this one chain so neither can regress
 * on its own.
 *
 * WHAT IT DOES: web stays in the current tab (popup blockers must not make the link inert);
 * native prefers the in-app browser sheet (`SFSafariViewController` / Custom Tabs), then the OS
 * URL handler. Every failure resolves to a message for the screen to show instead of throwing.
 *
 * WHY THE `runtime` PARAMETER: the same injectable seam as `confirmDestructive` — the platform
 * and the three openers are read through it so `__tests__/openPrivacyPolicy.test.ts` can drive
 * every branch under the one jest-expo preset. Screens never pass it.
 */

export const PRIVACY_POLICY_OPEN_ERROR =
  'Could not open the privacy policy. Check your connection and try again.';

export interface OpenPolicyRuntime {
  platform: string;
  /** `window.location.assign`, bound; `undefined` when there is no browser window. */
  navigateInTab: ((url: string) => void) | undefined;
  openInAppBrowser: (url: string) => Promise<unknown>;
  openWithOs: (url: string) => Promise<unknown>;
}

export function defaultOpenPolicyRuntime(): OpenPolicyRuntime {
  const location = (globalThis as { window?: { location?: { assign?: (url: string) => void } } })
    .window?.location;
  return {
    platform: Platform.OS,
    navigateInTab:
      typeof location?.assign === 'function' ? (url) => location.assign!.call(location, url) : undefined,
    openInAppBrowser: (url) => WebBrowser.openBrowserAsync(url),
    openWithOs: (url) => Linking.openURL(url),
  };
}

/** Resolves `null` when the policy opened, or the message the screen should show when it did not. */
export async function openPrivacyPolicy(
  runtime: OpenPolicyRuntime = defaultOpenPolicyRuntime()
): Promise<string | null> {
  if (runtime.platform === 'web') {
    try {
      if (!runtime.navigateInTab) throw new Error('no browser window');
      runtime.navigateInTab(PRIVACY_POLICY_URL);
      return null;
    } catch {
      return PRIVACY_POLICY_OPEN_ERROR;
    }
  }

  try {
    await runtime.openInAppBrowser(PRIVACY_POLICY_URL);
    return null;
  } catch {
    try {
      await runtime.openWithOs(PRIVACY_POLICY_URL);
      return null;
    } catch {
      return PRIVACY_POLICY_OPEN_ERROR;
    }
  }
}
