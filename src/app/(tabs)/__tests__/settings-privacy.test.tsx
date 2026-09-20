import type { ReactElement } from 'react';
import { Linking, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { PRIVACY_POLICY_URL } from '@/constants/legal';

import SettingsScreen from '../settings';

const mockPush = jest.fn();
const mockOpenBrowserAsync = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
}));

jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  accountHasPassword: jest.fn().mockResolvedValue(true),
  authClient: { signOut: jest.fn() },
  deleteAccount: jest.fn(),
  describeError: (_error: unknown, fallback: string) => fallback,
  getQuotaStatus: jest.fn(),
}));

jest.mock('@/lib/confirmDestructive', () => ({
  confirmDestructive: jest.fn(),
}));

const mountedTrees: ReactTestRenderer[] = [];
const originalPlatformOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setPlatformOS(os: 'ios' | 'web'): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function setBrowserWindow(assign: jest.Mock): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { assign } },
  });
}

function renderScreen(element: ReactElement = <SettingsScreen />): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        {element}
      </SafeAreaProvider>
    );
  });
  mountedTrees.push(tree);
  return tree;
}

function flatten(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children && typeof children === 'object') {
    const node = children as { children?: unknown; props?: { children?: unknown } };
    return flatten(node.children ?? node.props?.children);
  }
  return '';
}

function privacyPolicyLink(tree: ReactTestRenderer): ReactTestInstance {
  const links = tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === 'link' &&
      typeof node.props.onPress === 'function'
  );
  expect(links.length).toBeGreaterThan(0);
  return links[links.length - 1];
}

async function press(control: ReactTestInstance): Promise<void> {
  await act(async () => {
    await (control.props.onPress as () => Promise<void>)();
  });
}

describe('Settings privacy-policy link', () => {
  let openURL: jest.SpiedFunction<typeof Linking.openURL>;

  beforeEach(() => {
    setPlatformOS('ios');
    mockPush.mockClear();
    mockOpenBrowserAsync.mockReset().mockResolvedValue({ type: 'opened' });
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    openURL.mockRestore();
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });

    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  afterAll(() => {
    if (originalPlatformOS) Object.defineProperty(Platform, 'OS', originalPlatformOS);
  });

  it('exposes the privacy row as a link with a browser hint', () => {
    const link = privacyPolicyLink(renderScreen());

    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityHint).toBe('Opens the Pace Blueprint privacy policy');
  });

  it('navigates in the same browser tab on web', async () => {
    const assign = jest.fn();
    setPlatformOS('web');
    setBrowserWindow(assign);

    await press(privacyPolicyLink(renderScreen()));

    expect(assign).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the policy in the native in-app browser', async () => {
    await press(privacyPolicyLink(renderScreen()));

    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('falls back to the native URL handler when the in-app browser fails', async () => {
    mockOpenBrowserAsync.mockRejectedValue(new Error('browser unavailable'));

    await press(privacyPolicyLink(renderScreen()));

    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('shows an assertive visible error when no native browser can open the policy', async () => {
    mockOpenBrowserAsync.mockRejectedValue(new Error('browser unavailable'));
    openURL.mockRejectedValue(new Error('URL handler unavailable'));
    const tree = renderScreen();

    await press(privacyPolicyLink(tree));

    const message = 'Could not open the privacy policy. Check your connection and try again.';
    expect(flatten(tree.root)).toContain(message);
    const alerts = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'alert' &&
        flatten(node.props.children) === message
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props.accessibilityLiveRegion).toBe('assertive');
  });
});
