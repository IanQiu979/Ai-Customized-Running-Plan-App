import { consumePostSignupRedirect, markPostSignupRedirect } from '../postSignupRedirect';

describe('postSignupRedirect', () => {
  it('is false until marked', () => {
    expect(consumePostSignupRedirect()).toBe(false);
  });

  it('reports true exactly once after being marked', () => {
    markPostSignupRedirect();

    expect(consumePostSignupRedirect()).toBe(true);
    expect(consumePostSignupRedirect()).toBe(false);
  });
});
