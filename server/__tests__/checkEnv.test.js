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

  const PROD = {
    ...GOOD,
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://rideshare.example',
    ORIGIN_SECRET: 's'.repeat(64),
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'RideShareEU <no-reply@rideshare.example>',
  };

  test('a complete production environment passes', () => {
    expect(checkEnv(PROD)).toEqual([]);
  });

  test.each([
    [{ CORS_ORIGIN: undefined }, /CORS_ORIGIN/],
    [{ CORS_ORIGIN: 'http://rideshare.example' }, /CORS_ORIGIN/],
    [{ ORIGIN_SECRET: 'short' }, /ORIGIN_SECRET/],
    [{ RESEND_API_KEY: undefined }, /RESEND_API_KEY or BREVO_API_KEY/],
    [{ EMAIL_FROM: undefined }, /EMAIL_FROM/],
  ])('production with %p is refused', (override, message) => {
    const problems = checkEnv({ ...PROD, ...override });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
  });

  test('Brevo or SMTP also count as a way to send email', () => {
    expect(checkEnv({ ...PROD, RESEND_API_KEY: undefined, BREVO_API_KEY: 'xkeysib-test' })).toEqual([]);
    expect(checkEnv({ ...PROD, RESEND_API_KEY: undefined, SMTP_HOST: 'smtp.example', EMAIL_FROM: undefined, SMTP_FROM: 'a@b.c' })).toEqual([]);
  });
});
