// Refuse to start with a missing or placeholder secret, instead of failing on
// the first sign-in (JWT_SECRET) or the first encrypted read (PII key), or
// worse, running in production with the example value from .env.example.
const MIN_JWT_SECRET_LENGTH = 32;
const HEX_64 = /^[0-9a-f]{64}$/i;

// Returns a list of problems; empty means the environment is usable.
function checkEnv(env = process.env) {
  const problems = [];
  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH || /change-me/i.test(jwtSecret)) {
    problems.push(`JWT_SECRET must be a random string of at least ${MIN_JWT_SECRET_LENGTH} characters (openssl rand -base64 33)`);
  }
  if (!HEX_64.test(env.PII_ENCRYPTION_KEY || '')) {
    problems.push('PII_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)');
  }
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  if (env.NODE_ENV === 'production') {
    const origins = (env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0 || origins.some((o) => !o.startsWith('https://'))) {
      problems.push('CORS_ORIGIN must list the site\'s https:// origin(s) in production');
    }
    if ((env.ORIGIN_SECRET || '').length < MIN_JWT_SECRET_LENGTH) {
      problems.push(`ORIGIN_SECRET must be a random string of at least ${MIN_JWT_SECRET_LENGTH} characters, the same value as on the website`);
    }
    if (!env.RESEND_API_KEY && !env.BREVO_API_KEY && !env.SMTP_HOST) {
      problems.push('Set RESEND_API_KEY or BREVO_API_KEY (Railway Hobby blocks SMTP) so sign-up codes can be emailed');
    }
    if (!env.EMAIL_FROM && !env.SMTP_FROM) problems.push('EMAIL_FROM is not set');
  }
  return problems;
}

module.exports = { checkEnv, MIN_JWT_SECRET_LENGTH };
