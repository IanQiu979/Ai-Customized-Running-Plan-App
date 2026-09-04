import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReactElement } from 'react';

import SignInScreen from '../sign-in';
import SignUpScreen from '../sign-up';

/**
 * `CLAUDE.md` says screens are not unit-tested; this is the second deliberate exception, for the
 * same reason as `onboarding.test.tsx`. "Back to the start" is a link the captain asked for, and
 * the navigation *action* it dispatches is the whole of its behaviour: `push` stacks a second
 * onboarding entry on every round trip (sign-in → onboarding → sign-in → …), so the runner's back
 * stack grows without bound and each return is a fresh, scroll-reset screen. `navigate` targets the
 * existing route instead. Nothing else on the screen distinguishes the two, so the dispatched action
 * is what has to be asserted.
 */

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));

// The auth screens import `apiClient`, which throws at import time without EXPO_PUBLIC_API_BASE_URL.
// The back link makes no network call, so the module is stubbed rather than configured.
jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  authClient: { signIn: { email: jest.fn() }, signUp: { email: jest.fn() } },
  describeError: () => 'error',
  signInWithGoogle: jest.fn(),
}));

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

/** Every string in a rendered element tree, concatenated. */
function flatten(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children && typeof children === 'object') {
    return flatten((children as { props?: { children?: unknown } }).props?.children);
  }
  return '';
}

/** Press the link a runner would tap, found by the text it renders. */
function pressLink(tree: ReactTestRenderer, text: string) {
  const control = tree.root.find(
    (node) =>
      (node.props as { accessibilityRole?: string }).accessibilityRole === 'link' &&
      typeof (node.props as { onPress?: unknown }).onPress === 'function' &&
      flatten(node.props.children).includes(text)
  );
  act(() => {
    (control.props as { onPress: () => void }).onPress();
  });
}

describe('the pre-auth back link', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockNavigate.mockClear();
  });

  it.each([
    ['sign-in', <SignInScreen key="in" />],
    ['sign-up', <SignUpScreen key="up" />],
  ])('returns to onboarding from %s without stacking a new entry', (_name, screen) => {
    const tree = render(screen);

    pressLink(tree, 'Back to the start');

    expect(mockNavigate).toHaveBeenCalledWith('/(auth)/onboarding');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
