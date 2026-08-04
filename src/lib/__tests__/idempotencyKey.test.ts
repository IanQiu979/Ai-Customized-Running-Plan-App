import { mintIdempotencyKey } from '../idempotencyKey';

describe('mintIdempotencyKey', () => {
  it('returns a non-empty string in the expected shape', () => {
    const key = mintIdempotencyKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    expect(key).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });

  it('never collides across many calls', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      keys.add(mintIdempotencyKey());
    }
    expect(keys.size).toBe(10000);
  });
});
