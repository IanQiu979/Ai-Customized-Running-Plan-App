import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import RootLayout from '../_layout';

/**
 * `CLAUDE.md` says screens are not unit-tested; this suite is one of the deliberate exceptions,
 * on the same grounds as the others: the behaviour under test lives in the root layout's own
 * render branch, with no logic layer underneath it. `_layout.tsx` gates the whole tree — and the
 * `SplashScreen.hideAsync()` call — on `useFonts` reporting that the Google-font assets loaded.
 * `expo-font`'s hook returns `[loaded, error]`, and on a failed `loadAsync` it sets `error` and
 * leaves `loaded` at `false` for good (`node_modules/expo-font/build/FontHooks.js`). A layout
 * that reads only `loaded` therefore returns `null` forever and never hides the splash: an
 * interrupted first-launch download, a corrupt cache or a failed web fetch strands the runner on
 * the splash screen with no error and no retry (issue #21). The suite pins that a font failure
 * boots the app on system fonts and hides the splash exactly as a successful load does, and that
 * the gate still holds while the fonts are genuinely in flight.
 */

// What `useFonts` reports on this render. `[true, null]` is a healthy load, `[false, Error]` is
// `loadAsync` rejecting, `[false, null]` is still loading.
let mockFonts: [boolean, Error | null] = [true, null];
jest.mock('expo-font', () => ({ useFonts: () => mockFonts }));

const mockHideAsync = jest.fn(() => Promise.resolve(true));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: () => mockHideAsync(),
}));

let mockSession: { user: { id: string } } | null = null;
let mockAgeAssuranceStatus: 'pending' | 'recorded' | 'grandfathered' | undefined;
jest.mock('@/lib/apiClient', () => ({
  authClient: { useSession: () => ({ data: mockSession, isPending: false }) },
  useSessionUser: () =>
    mockSession
      ? {
          id: mockSession.user.id,
          email: 'runner@example.com',
          emailVerified: true,
          name: 'Runner',
          ageBand: null,
          ageAssuranceStatus: mockAgeAssuranceStatus,
        }
      : null,
}));
// Without native insets `SafeAreaProvider` renders nothing until measured; pass children through
// so the marker below is reachable.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
const mockConsumePostSignupRedirect = jest.fn((_userId: string) => false);
const mockClaimPostSignupRedirect = jest.fn((_userId: string) => false);
const mockClearPostSignupRedirect = jest.fn();
jest.mock('@/lib/postSignupRedirect', () => ({
  claimPostSignupRedirect: (userId: string) => mockClaimPostSignupRedirect(userId),
  clearPostSignupRedirect: () => mockClearPostSignupRedirect(),
  consumePostSignupRedirect: (userId: string) => mockConsumePostSignupRedirect(userId),
}));
jest.mock('@/components/auth/AgeAssuranceGate', () => ({
  AgeAssuranceGate: ({ children }: { children: React.ReactNode }) => children,
}));

// The navigator is not what is under test; a marker view stands in for `<Stack>` so the suite can
// tell "the tree rendered" from "the layout returned `null`".
jest.mock('expo-router', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  const { DefaultTheme, DarkTheme } =
    jest.requireActual<typeof import('expo-router')>('expo-router');
  function Stack() {
    return <MockView testID="root-stack" />;
  }
  Stack.Protected = function Protected() {
    return null;
  };
  Stack.Screen = function Screen() {
    return null;
  };
  return {
    DefaultTheme,
    DarkTheme,
    Stack,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  };
});

function mount(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<RootLayout />);
  });
  return tree;
}

function rendersStack(tree: ReactTestRenderer): boolean {
  return JSON.stringify(tree.toJSON()).includes('"testID":"root-stack"');
}

beforeEach(() => {
  mockHideAsync.mockClear();
  mockSession = null;
  mockAgeAssuranceStatus = undefined;
  mockConsumePostSignupRedirect.mockReset().mockReturnValue(false);
  mockClaimPostSignupRedirect.mockReset().mockReturnValue(false);
  mockClearPostSignupRedirect.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RootLayout font gate', () => {
  it('renders the app and hides the splash once the fonts have loaded', () => {
    mockFonts = [true, null];
    const tree = mount();

    expect(rendersStack(tree)).toBe(true);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('holds the splash while the fonts are still loading', () => {
    mockFonts = [false, null];
    const tree = mount();

    expect(tree.toJSON()).toBeNull();
    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it('boots on system fonts and hides the splash when a font fails to load', () => {
    mockFonts = [false, new Error('Font load failed: BarlowCondensed_700Bold')];
    const tree = mount();

    // The stranded-splash bug: before the fix, a font failure left `loaded` false for good, the
    // layout returned `null` forever and `hideAsync` never ran.
    expect(rendersStack(tree)).toBe(true);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('does not consume the post-signup intake redirect while age assurance is pending', () => {
    mockFonts = [true, null];
    mockSession = { user: { id: 'new-oauth-user' } };
    mockAgeAssuranceStatus = 'pending';

    const tree = mount();
    expect(mockConsumePostSignupRedirect).not.toHaveBeenCalled();
    expect(mockClaimPostSignupRedirect).toHaveBeenCalledWith('new-oauth-user');

    mockAgeAssuranceStatus = 'recorded';
    act(() => {
      tree.update(<RootLayout />);
    });

    expect(mockConsumePostSignupRedirect).toHaveBeenCalledWith('new-oauth-user');
  });

  it('clears the redirect after a settled signed-out session', () => {
    mockFonts = [true, null];
    mount();

    expect(mockClearPostSignupRedirect).toHaveBeenCalledTimes(1);
  });

  it('rechecks ownership when the authenticated account changes', () => {
    mockFonts = [true, null];
    mockSession = { user: { id: 'pending-a' } };
    mockAgeAssuranceStatus = 'pending';
    const tree = mount();

    mockSession = { user: { id: 'pending-b' } };
    act(() => {
      tree.update(<RootLayout />);
    });

    expect(mockClaimPostSignupRedirect).toHaveBeenNthCalledWith(1, 'pending-a');
    expect(mockClaimPostSignupRedirect).toHaveBeenNthCalledWith(2, 'pending-b');
  });
});
