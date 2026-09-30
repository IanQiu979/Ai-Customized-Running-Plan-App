import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Platform, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgeAssuranceGate } from '../AgeAssuranceGate';
import type { AgeAssuranceStatus } from '@/lib/ageAssurance';

const mockRecordAgeAssurance = jest.fn();
const mockSignOut = jest.fn();
let mockStatus: AgeAssuranceStatus | undefined = 'pending';
let mockUserId: string | null = 'user-1';

const mockClearPostSignupRedirect = jest.fn();
jest.mock('@/lib/postSignupRedirect', () => ({
  clearPostSignupRedirect: () => mockClearPostSignupRedirect(),
}));

jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  authClient: { signOut: (...args: unknown[]) => mockSignOut(...args) },
  describeError: (_error: unknown, fallback: string) => fallback,
  recordAgeAssurance: (...args: unknown[]) => mockRecordAgeAssurance(...args),
  useSessionUser: () =>
    mockUserId
      ? {
          id: mockUserId,
          email: 'runner@example.com',
          emailVerified: true,
          name: 'Runner',
          ageBand: null,
          ageAssuranceStatus: mockStatus,
        }
      : null,
}));

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <AgeAssuranceGate>
          <Text accessibilityLabel="Authenticated app">App</Text>
        </AgeAssuranceGate>
      </SafeAreaProvider>
    );
  });
  return tree;
}

function update(tree: ReactTestRenderer) {
  act(() => {
    tree.update(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <AgeAssuranceGate>
          <Text accessibilityLabel="Authenticated app">App</Text>
        </AgeAssuranceGate>
      </SafeAreaProvider>
    );
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function press(tree: ReactTestRenderer, testID: string) {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

function control(tree: ReactTestRenderer, testID: string) {
  return tree.root.find(
    (node) => node.props.testID === testID && typeof node.props.accessibilityRole === 'string'
  );
}

function liveRegionText(tree: ReactTestRenderer): string {
  const instance = tree.root.findByProps({ testID: 'age-assurance-live-region' }).instance as {
    textContent?: string;
  };
  return instance.textContent ?? '';
}

describe('AgeAssuranceGate', () => {
  let focusSpy: jest.SpyInstance;
  let announceSpy: jest.SpyInstance;
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockStatus = 'pending';
    mockUserId = 'user-1';
    mockRecordAgeAssurance.mockReset();
    mockSignOut.mockReset().mockResolvedValue({ data: {}, error: null });
    mockClearPostSignupRedirect.mockReset();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    focusSpy = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => undefined);
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    focusSpy.mockRestore();
    announceSpy.mockRestore();
  });

  it('unmounts the protected stack and exposes the pending gate as a modal dialog', () => {
    const tree = render();

    expect(tree.root.findAllByProps({ testID: 'age-assurance-content' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Authenticated app' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'age-assurance-gate' }).props).toMatchObject({
      role: 'dialog',
      'aria-modal': true,
      accessibilityViewIsModal: true,
    });
    expect(tree.root.findByProps({ testID: 'age-gate-18-plus' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'age-gate-13-17' })).toBeTruthy();
  });

  it('moves accessibility focus to the gate heading when the mandatory dialog appears', () => {
    render();

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy.mock.calls[0]?.[0]).toBeTruthy();
    expect(focusSpy.mock.calls[0]?.[1]).toBe('focus');
  });

  it.each<AgeAssuranceStatus>(['recorded', 'grandfathered'])(
    'renders the app immediately for a %s session',
    (status) => {
      mockStatus = status;
      const tree = render();

      expect(tree.root.findAllByProps({ testID: 'age-assurance-gate' })).toHaveLength(0);
      expect(tree.root.findByProps({ testID: 'age-assurance-content' }).props).toMatchObject({
        importantForAccessibility: 'auto',
      });
    }
  );

  it('announces the transition back to the app after assurance succeeds', () => {
    const tree = render();
    announceSpy.mockClear();
    mockStatus = 'recorded';

    update(tree);

    expect(announceSpy).toHaveBeenCalledWith('Age confirmed. Continuing to Pace Blueprint.');
    expect(tree.root.findByProps({ accessibilityLabel: 'Authenticated app' })).toBeTruthy();
  });

  it('focuses the remounted main content and updates an always-mounted live region on web', () => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockStatus = 'recorded';
    const tree = render();
    const initialContent = tree.root.findByProps({ testID: 'age-assurance-content' });
    const viewPrototype = Object.getPrototypeOf(initialContent.instance) as {
      focus?: () => void;
    };
    const originalFocus = viewPrototype.focus;
    const webFocus = jest.fn();
    viewPrototype.focus = webFocus;

    try {
      mockStatus = 'pending';
      update(tree);
      const liveRegionBefore = tree.root.findByProps({ testID: 'age-assurance-live-region' });

      expect(liveRegionBefore.props).toMatchObject({
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
      });
      expect(liveRegionText(tree)).toBe('');
      expect(webFocus).toHaveBeenCalledTimes(1);
      expect(focusSpy).not.toHaveBeenCalled();
      webFocus.mockClear();

      mockStatus = 'recorded';
      update(tree);

      const content = tree.root.findByProps({ testID: 'age-assurance-content' });
      expect(content.props).toMatchObject({ role: 'main', tabIndex: -1 });
      expect(webFocus).toHaveBeenCalledTimes(1);
      expect(liveRegionText(tree)).toBe('Age confirmed. Continuing to Pace Blueprint.');
      expect(announceSpy).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(liveRegionText(tree)).toBe('');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      if (originalFocus) viewPrototype.focus = originalFocus;
      else delete viewPrototype.focus;
    }
  });

  it('does not replay confirmation when the same recorded identity signs back in', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockStatus = 'recorded';
    const tree = render();
    const initialContent = tree.root.findByProps({ testID: 'age-assurance-content' });
    const viewPrototype = Object.getPrototypeOf(initialContent.instance) as {
      focus?: () => void;
    };
    const originalFocus = viewPrototype.focus;
    const webFocus = jest.fn();
    viewPrototype.focus = webFocus;

    try {
      mockStatus = 'pending';
      update(tree);
      webFocus.mockClear();
      mockStatus = 'recorded';
      update(tree);
      expect(liveRegionText(tree)).toBe('Age confirmed. Continuing to Pace Blueprint.');

      mockUserId = null;
      update(tree);
      mockUserId = 'user-1';
      update(tree);

      expect(liveRegionText(tree)).toBe('');
      expect(webFocus).toHaveBeenCalledTimes(1);
      expect(announceSpy).not.toHaveBeenCalled();
    } finally {
      if (originalFocus) viewPrototype.focus = originalFocus;
      else delete viewPrototype.focus;
    }
  });

  it('marks only Continue busy while an age record is being saved', async () => {
    const request = deferred<{ ageBand: '18_plus'; guardianConsentRecorded: false }>();
    mockRecordAgeAssurance.mockReturnValue(request.promise);
    const tree = render();
    press(tree, 'age-gate-18-plus');

    act(() => {
      void tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.accessibilityState).toEqual({
      disabled: true,
    });

    await act(async () => {
      request.resolve({ ageBand: '18_plus', guardianConsentRecorded: false });
      await request.promise;
    });
  });

  it('retains the choice after a failed save and lets the runner retry', async () => {
    mockRecordAgeAssurance
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => {
        mockStatus = 'recorded';
        return { ageBand: '18_plus', guardianConsentRecorded: false };
      });
    const tree = render();
    press(tree, 'age-gate-18-plus');

    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.onPress();
    });
    expect(control(tree, 'age-gate-18-plus').props.accessibilityState.checked).toBe(
      true
    );
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
      'Your age choice could not be saved. Check your connection and try again.'
    );

    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.onPress();
    });
    act(() => {
      tree.update(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 430, height: 932 },
            insets: { top: 59, left: 0, right: 0, bottom: 34 },
          }}
        >
          <AgeAssuranceGate>
            <Text accessibilityLabel="Authenticated app">App</Text>
          </AgeAssuranceGate>
        </SafeAreaProvider>
      );
    });
    expect(mockRecordAgeAssurance).toHaveBeenCalledTimes(2);
    // The gate names the account it was rendered for, so the Worker can refuse a stale tab.
    expect(mockRecordAgeAssurance).toHaveBeenLastCalledWith(
      { ageBand: '18_plus', guardianConsent: false },
      mockUserId
    );
    expect(tree.root.findAllByProps({ testID: 'age-assurance-gate' })).toHaveLength(0);
  });

  it('does not lift when the save or uncached session refresh rejects', async () => {
    mockRecordAgeAssurance.mockRejectedValue(new Error('session refresh failed'));
    const tree = render();
    press(tree, 'age-gate-18-plus');

    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'age-assurance-gate' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.accessibilityState.disabled).toBe(
      false
    );
  });

  it('always offers sign out as an escape', async () => {
    const tree = render();

    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearPostSignupRedirect).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.accessibilityState.disabled).toBe(
      true
    );
    expect(tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.accessibilityState.busy).toBe(
      true
    );
    expect(tree.root.findByProps({ accessibilityLabel: 'Continue' }).props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('shows a resolved sign-out error and allows another attempt', async () => {
    mockSignOut.mockResolvedValue({ data: null, error: { message: 'Session could not be ended.' } });
    const tree = render();

    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
      'Session could not be ended.'
    );
    expect(mockClearPostSignupRedirect).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityLabel: 'Sign out' }).props.accessibilityState.disabled).toBe(
      false
    );
  });

  it('starts with a blank choice when a different pending account directly replaces the first', () => {
    const tree = render();
    press(tree, 'age-gate-13-17');
    press(tree, 'age-gate-guardian-consent');
    expect(control(tree, 'age-gate-13-17').props.accessibilityState.checked).toBe(true);
    expect(control(tree, 'age-gate-guardian-consent').props.accessibilityState.checked).toBe(true);

    mockUserId = 'user-2';
    update(tree);

    expect(control(tree, 'age-gate-18-plus').props.accessibilityState.checked).toBe(false);
    expect(control(tree, 'age-gate-13-17').props.accessibilityState.checked).toBe(false);
    expect(tree.root.findAllByProps({ testID: 'age-gate-guardian-consent' })).toHaveLength(0);
  });
});
