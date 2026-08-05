import AuthIndex from '../index';

describe('AuthIndex', () => {
  it('sends signed-out users to sign-up by default', () => {
    const redirect = AuthIndex();

    expect(redirect.props.href).toBe('/(auth)/sign-up');
  });
});
