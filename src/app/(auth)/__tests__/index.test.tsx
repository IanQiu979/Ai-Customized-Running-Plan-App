import AuthIndex from '../index';

describe('AuthIndex', () => {
  it('sends signed-out users to onboarding by default', () => {
    const redirect = AuthIndex();

    expect(redirect.props.href).toBe('/(auth)/onboarding');
  });
});
