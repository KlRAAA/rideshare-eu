const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Endpoints that send an OTP email get the tighter limit: each call costs an
// email (SMTP quota) and can be used to flood someone else's inbox.
const EMAIL_SEND_LIMIT = 5;
// Login and OTP/password submission. The per-OTP attempt cap in otpService.js
// still applies on top of this; this one bounds guessing across many OTPs and
// against the login endpoint, which had no limit at all.
const AUTH_ATTEMPT_LIMIT = 10;

// authFlows.test.js alone makes ~50 auth calls from one IP, so limiting is off
// under Jest unless a test opts in. Read per request (skip runs on every call),
// so a test file can toggle it with process.env without reloading the app.
function skipUnderTests() {
  return process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== '1';
}

// One limiter instance per route (not per tier), so each endpoint keeps its own
// counter — failed logins can't lock someone out of finishing OTP verification.
function createLimiter({ limit, windowMs = FIFTEEN_MINUTES_MS }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: skipUnderTests,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Try again in a few minutes.',
      });
    },
  });
}

const emailSendLimiter = () => createLimiter({ limit: EMAIL_SEND_LIMIT });
const authAttemptLimiter = () => createLimiter({ limit: AUTH_ATTEMPT_LIMIT });

module.exports = { emailSendLimiter, authAttemptLimiter, EMAIL_SEND_LIMIT, AUTH_ATTEMPT_LIMIT };
