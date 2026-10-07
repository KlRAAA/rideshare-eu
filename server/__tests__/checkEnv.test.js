const { checkEnv } = require('../config/checkEnv');

const GOOD = {
  JWT_SECRET: 'q'.repeat(44),
  PII_ENCRYPTION_KEY: 'a1'.repeat(32),
  DATABASE_URL: 'postgres://localhost/x',
};

describe('checkEnv', () => {
  test('a complete local environment passes', () => {
    expect(checkEnv(GOOD)).toEqual([]);
  });

  test.each([
    [{ JWT_SECRET: undefined }, /JWT_SECRET/],
    [{ JWT_SECRET: 'short' }, /JWT_SECRET/],
    [{ JWT_SECRET: 'change-me-to-a-long-random-string-xxxxxxxxx' }, /JWT_SECRET/],
    [{ PII_ENCRYPTION_KEY: 'change-me-to-a-64-char-hex-string' }, /PII_ENCRYPTION_KEY/],
    [{ PII_ENCRYPTION_KEY: 'zz'.repeat(32) }, /PII_ENCRYPTION_KEY/],
    [{ DATABASE_URL: '' }, /DATABASE_URL/],
  ])('%p is refused', (override, message) => {
    const problems = checkEnv({ ...GOOD, ...override });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
  });

  test('production needs https CORS origins', () => {
    expect(checkEnv({ ...GOOD, NODE_ENV: 'production' })).toEqual([expect.stringMatching(/CORS_ORIGIN/)]);
    expect(checkEnv({ ...GOOD, NODE_ENV: 'production', CORS_ORIGIN: 'http://rideshare.example' })).toHaveLength(1);
    expect(checkEnv({ ...GOOD, NODE_ENV: 'production', CORS_ORIGIN: 'https://rideshare.example' })).toEqual([]);
  });
});
