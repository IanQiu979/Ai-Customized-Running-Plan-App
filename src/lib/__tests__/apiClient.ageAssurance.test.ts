const mockGetSession = jest.fn();
const mockNotify = jest.fn();
const mockSignInSocial = jest.fn();

jest.mock('@better-auth/expo/client', () => ({ expoClient: () => ({}) }));
jest.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    $store: { notify: (...args: unknown[]) => mockNotify(...args) },
    getCookie: () => '',
    getSession: (...args: unknown[]) => mockGetSession(...args),
    signIn: { social: (...args: unknown[]) => mockSignInSocial(...args) },
    signUp: { email: jest.fn() },
    signOut: jest.fn(),
    useSession: jest.fn(),
  }),
}));
jest.mock('expo-secure-store', () => ({ getItem: jest.fn(() => null), setItem: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { recordAgeAssurance, signInWithGoogle } = require('../apiClient') as typeof import('../apiClient');

function successfulRoute(ageBand: '18_plus' | '13_17' = '18_plus') {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ageBand, guardianConsentRecorded: ageBand === '13_17' }),
  } as Response);
}

describe('recordAgeAssurance', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockGetSession.mockReset();
    mockNotify.mockReset();
  });

  it('notifies only after an uncached refresh confirms the recorded matching band', async () => {
    successfulRoute();
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'user-1', ageBand: '18_plus', ageAssuranceStatus: 'recorded' } },
      error: null,
    });

    await expect(
      recordAgeAssurance({ ageBand: '18_plus', guardianConsent: false }, 'user-1')
    ).resolves.toEqual({ ageBand: '18_plus', guardianConsentRecorded: false });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      ageBand: '18_plus',
      guardianConsent: false,
      expectedUserId: 'user-1',
    });
    expect(mockGetSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(mockNotify).toHaveBeenCalledWith('$sessionSignal');
  });

  it.each([
    ['missing user', { data: null, error: null }],
    [
      'stale pending status',
      {
        data: { user: { id: 'user-1', ageBand: null, ageAssuranceStatus: 'pending' } },
        error: null,
      },
    ],
    [
      'different account',
      {
        data: { user: { id: 'user-2', ageBand: '18_plus', ageAssuranceStatus: 'recorded' } },
        error: null,
      },
    ],
    [
      'mismatched band',
      {
        data: { user: { id: 'user-1', ageBand: '13_17', ageAssuranceStatus: 'recorded' } },
        error: null,
      },
    ],
  ])('rejects a %s refresh without notifying the session store', async (_label, refresh) => {
    successfulRoute();
    mockGetSession.mockResolvedValue(refresh);

    await expect(
      recordAgeAssurance({ ageBand: '18_plus', guardianConsent: false }, 'user-1')
    ).rejects.toThrow('updated session');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('fails closed when the uncached refresh resolves with an auth error', async () => {
    successfulRoute();
    const refreshError = { message: 'Session refresh was refused.' };
    mockGetSession.mockResolvedValue({ data: null, error: refreshError });

    await expect(
      recordAgeAssurance({ ageBand: '18_plus', guardianConsent: false }, 'user-1')
    ).rejects.toEqual(refreshError);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('fails closed when the uncached refresh rejects', async () => {
    successfulRoute();
    mockGetSession.mockRejectedValue(new Error('Session refresh did not answer.'));

    await expect(
      recordAgeAssurance({ ageBand: '18_plus', guardianConsent: false }, 'user-1')
    ).rejects.toThrow('Session refresh did not answer.');
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle on web', () => {
  it('marks the redirect before social auth can navigate away', async () => {
    const beforeNavigate = jest.fn();
    mockSignInSocial.mockImplementation(async () => {
      expect(beforeNavigate).toHaveBeenCalledTimes(1);
      return { data: { url: 'https://accounts.google.test' }, error: null };
    });
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      await expect(
        signInWithGoogle({ onBeforeSessionNotify: beforeNavigate })
      ).resolves.toEqual({ ok: true });
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });
});
