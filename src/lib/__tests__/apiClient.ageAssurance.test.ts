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
const { recordAgeAssurance, signInWithGoogle, transitionToAdult } = require('../apiClient') as typeof import('../apiClient');

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

describe('transitionToAdult', () => {
  const ARCHIVED_AT = '2026-10-01T12:00:00.000Z';

  function transitionRoute() {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ageBand: '18_plus', guardianConsentArchivedAt: ARCHIVED_AT }),
    } as Response);
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    mockGetSession.mockReset();
    mockNotify.mockReset();
  });

  it('posts the declared date for the rendered account and notifies after an uncached adult refresh', async () => {
    transitionRoute();
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'user-1', ageBand: '18_plus', ageAssuranceStatus: 'recorded' } },
      error: null,
    });

    await expect(transitionToAdult('2008-01-15', 'user-1')).resolves.toEqual({
      ageBand: '18_plus',
      guardianConsentArchivedAt: ARCHIVED_AT,
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/age-transition');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      birthDate: '2008-01-15',
      expectedUserId: 'user-1',
    });
    expect(mockGetSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(mockNotify).toHaveBeenCalledWith('$sessionSignal');
  });

  it.each([
    ['missing user', { data: null, error: null }],
    [
      'still-minor band',
      {
        data: { user: { id: 'user-1', ageBand: '13_17', ageAssuranceStatus: 'recorded' } },
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
  ])('rejects a %s refresh without notifying the session store', async (_label, refresh) => {
    transitionRoute();
    mockGetSession.mockResolvedValue(refresh);

    await expect(transitionToAdult('2008-01-15', 'user-1')).rejects.toThrow('updated session');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('surfaces a server refusal and never refreshes the session', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: 'age_transition_too_young',
        error: 'That date of birth is under 18, so this account stays 13 to 17.',
      }),
    } as Response);

    await expect(transitionToAdult('2015-01-15', 'user-1')).rejects.toMatchObject({
      status: 400,
      body: { code: 'age_transition_too_young' },
    });
    expect(mockGetSession).not.toHaveBeenCalled();
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
