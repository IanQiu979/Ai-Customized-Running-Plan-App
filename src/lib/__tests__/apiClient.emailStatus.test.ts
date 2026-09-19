jest.mock('@better-auth/expo/client', () => ({ expoClient: () => ({}) }));
jest.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    getCookie: () => '',
    signIn: {},
    signUp: {},
    signOut: jest.fn(),
    useSession: jest.fn(),
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';

const { getEmailStatus } = require('../apiClient') as typeof import('../apiClient');

describe('getEmailStatus', () => {
  it('reads the public capability endpoint without using a cached answer', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mailConfigured: true, verificationRequired: false }),
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    await expect(getEmailStatus()).resolves.toEqual({
      mailConfigured: true,
      verificationRequired: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/email-status$/),
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
