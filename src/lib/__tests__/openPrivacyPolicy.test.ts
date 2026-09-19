import { PRIVACY_POLICY_URL } from '@/constants/legal';

import {
  PRIVACY_POLICY_OPEN_ERROR,
  openPrivacyPolicy,
  type OpenPolicyRuntime,
} from '../openPrivacyPolicy';

/**
 * The privacy policy is a required link on two screens (Settings, and the intake screen's
 * guardian-consent affirmation). Issue #96's lesson is that a tap must never fail silently, so
 * this pins the opener's whole fallback chain: same-tab on web, in-app browser then OS handler on
 * native, and a message — never a rejection — when every opener fails.
 */

type MockRuntime = OpenPolicyRuntime & { openInAppBrowser: jest.Mock; openWithOs: jest.Mock };

function runtimeFor(platform: string, overrides: Partial<MockRuntime> = {}): MockRuntime {
  return {
    platform,
    navigateInTab: undefined,
    openInAppBrowser: jest.fn().mockResolvedValue({ type: 'opened' }),
    openWithOs: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('openPrivacyPolicy', () => {
  it('navigates the current tab on web and touches no native opener', async () => {
    const navigateInTab = jest.fn();
    const runtime = runtimeFor('web', { navigateInTab });

    await expect(openPrivacyPolicy(runtime)).resolves.toBeNull();

    expect(navigateInTab).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(runtime.openInAppBrowser).not.toHaveBeenCalled();
    expect(runtime.openWithOs).not.toHaveBeenCalled();
  });

  it('reports a message on web when there is no browser window to navigate', async () => {
    await expect(openPrivacyPolicy(runtimeFor('web'))).resolves.toBe(PRIVACY_POLICY_OPEN_ERROR);
  });

  it('reports a message on web when navigation throws', async () => {
    const navigateInTab = jest.fn(() => {
      throw new Error('blocked');
    });

    await expect(openPrivacyPolicy(runtimeFor('web', { navigateInTab }))).resolves.toBe(
      PRIVACY_POLICY_OPEN_ERROR
    );
  });

  it('opens the in-app browser on native and stops there when it succeeds', async () => {
    const runtime = runtimeFor('ios');

    await expect(openPrivacyPolicy(runtime)).resolves.toBeNull();

    expect(runtime.openInAppBrowser).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(runtime.openWithOs).not.toHaveBeenCalled();
  });

  it('falls back to the OS URL handler when the in-app browser fails', async () => {
    const runtime = runtimeFor('android', {
      openInAppBrowser: jest.fn().mockRejectedValue(new Error('browser unavailable')),
    });

    await expect(openPrivacyPolicy(runtime)).resolves.toBeNull();

    expect(runtime.openWithOs).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('resolves to a message, never rejects, when no native opener can open the policy', async () => {
    const runtime = runtimeFor('ios', {
      openInAppBrowser: jest.fn().mockRejectedValue(new Error('browser unavailable')),
      openWithOs: jest.fn().mockRejectedValue(new Error('URL handler unavailable')),
    });

    await expect(openPrivacyPolicy(runtime)).resolves.toBe(PRIVACY_POLICY_OPEN_ERROR);
  });
});
