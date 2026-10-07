const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { logSecurityEvent } = require('../services/securityLog');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Endpoints that send an OTP email get the tighter limit: each call costs an
// email (SMTP quota) and can be used to flood someone else's inbox.
const EMAIL_SEND_LIMIT = 5;
// Login and OTP/password submission. The per-OTP attempt cap in otpService.js
// still applies on top of this; this one bounds guessing across many OTPs and
// against the login endpoint, which had no limit at all.
const AUTH_ATTEMPT_LIMIT = 10;

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
// Signed-in routes, counted per account rather than per IP (a campus network
// puts many students behind one address). Normal use is far below this: the
// trip chat polls every 7 s and live location every 30 s.
const API_LIMIT_PER_MINUTE = 300;
// Address lookups all share one Nominatim queue spaced 1.1 s apart, so one
// account flooding it would slow everyone else's lookups.
const GEOCODE_LIMIT_PER_MINUTE = 30;
// The address dropdown asks once per typing pause (the field waits 300 ms), so
// a long address is a handful of requests; Photon asks callers to be fair.
const SUGGEST_LIMIT_PER_MINUTE = 60;
// Each report can trigger the automatic ban ladder and a ban email.
const REPORT_LIMIT_PER_HOUR = 10;

// authFlows.test.js alone makes ~50 auth calls from one IP, so limiting is off
// under Jest unless a test opts in. Read per request (skip runs on every call),
// so a test file can toggle it with process.env without reloading the app.
function skipUnderTests() {
  return process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== '1';
}

// One limiter instance per route (not per tier), so each endpoint keeps its own
// counter — failed logins can't lock someone out of finishing OTP verification.
function createLimiter({ limit, windowMs = FIFTEEN_MINUTES_MS, perUser = false }) {
  return rateLimit({
    windowMs,
    limit,
    ...(perUser && { keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)) }),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: skipUnderTests,
    handler: (req, res, next, options) => {
      logSecurityEvent(req, 'RATE_LIMITED', { limit: options.limit });
      res.status(options.statusCode).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Try again in a few minutes.',
      });
    },
  });
}

const emailSendLimiter = () => createLimiter({ limit: EMAIL_SEND_LIMIT });
const authAttemptLimiter = () => createLimiter({ limit: AUTH_ATTEMPT_LIMIT });
const apiLimiter = () => createLimiter({ limit: API_LIMIT_PER_MINUTE, windowMs: ONE_MINUTE_MS, perUser: true });
const geocodeLimiter = () => createLimiter({ limit: GEOCODE_LIMIT_PER_MINUTE, windowMs: ONE_MINUTE_MS, perUser: true });
const suggestLimiter = () => createLimiter({ limit: SUGGEST_LIMIT_PER_MINUTE, windowMs: ONE_MINUTE_MS, perUser: true });
const reportLimiter = () => createLimiter({ limit: REPORT_LIMIT_PER_HOUR, windowMs: ONE_HOUR_MS, perUser: true });

module.exports = {
  emailSendLimiter,
  authAttemptLimiter,
  apiLimiter,
  geocodeLimiter,
  reportLimiter,
  suggestLimiter,
  EMAIL_SEND_LIMIT,
  AUTH_ATTEMPT_LIMIT,
  API_LIMIT_PER_MINUTE,
  GEOCODE_LIMIT_PER_MINUTE,
  REPORT_LIMIT_PER_HOUR,
  SUGGEST_LIMIT_PER_MINUTE,
};
