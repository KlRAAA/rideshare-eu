// Security-event log (OWASP A09): one JSON line per failed sign-in, wrong or
// locked code, rate-limit hit, failed password re-check and denied access to
// someone else's data, so an incident (e.g. someone guessing passwords) can be
// reconstructed from the server log.
//
// Only allow-listed fields are written: a password, OTP or token passed in by
// mistake is dropped, and emails are masked (RA 10173 — the log should not
// become a second copy of who has an account).

const EVENTS = new Set([
  'LOGIN_FAILED',
  'OTP_FAILED',
  'OTP_LOCKED',
  'RATE_LIMITED',
  'PASSWORD_RECHECK_FAILED',
  'ACCESS_DENIED',
]);

const ALLOWED_DETAILS = ['userId', 'reason', 'attempts', 'limit'];
const MAX_USER_AGENT_LENGTH = 200;

function maskEmail(email) {
  if (typeof email !== 'string') return null;
  const at = email.indexOf('@');
  if (at < 1) return null;
  return `${email[0]}***${email.slice(at)}`;
}

// Under Jest the default sink stays quiet; tests that care install their own.
function defaultSink(entry) {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(JSON.stringify(entry));
}

let sink = defaultSink;

// Returns the previous sink so a test can put it back.
function setSecurityLogSink(nextSink) {
  const previous = sink;
  sink = nextSink;
  return previous;
}

function logSecurityEvent(req, event, details = {}) {
  if (!EVENTS.has(event)) throw new Error(`Unknown security event: ${event}`);

  const entry = {
    type: 'security',
    event,
    at: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    route: (req.originalUrl || '').split('?')[0],
    userAgent: (req.get?.('user-agent') || '').slice(0, MAX_USER_AGENT_LENGTH),
  };
  const email = maskEmail(details.email);
  if (email) entry.email = email;
  for (const key of ALLOWED_DETAILS) {
    if (details[key] !== undefined) entry[key] = details[key];
  }

  try {
    sink(entry);
  } catch {
    // Logging must never turn a 401 into a 500.
  }
}

module.exports = { logSecurityEvent, setSecurityLogSink, maskEmail };
