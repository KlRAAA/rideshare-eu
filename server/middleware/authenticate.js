const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'rsu_session';

// Pull the session JWT off the request. The Next.js frontend stores it in the
// httpOnly `rsu_session` cookie (src/app/api/session/route.ts); apiFetch
// forwards it two ways — the raw Cookie header on browser calls, an
// `Authorization: Bearer` header on server-rendered (RSC) calls. Accept both.
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(trimmed.slice(SESSION_COOKIE.length + 1));
    }
  }
  return null;
}

// Phase 1 of the API-auth work: verify the session token's signature + expiry
// and attach the caller's id as `req.user.id`. It does NOT yet change any
// controller — they still read the client-supplied userId/passengerId/etc.
// Swapping those for `req.user.id` is a deliberate phase 2.
//
// This middleware does no database lookup on purpose: a valid signature from
// our own JWT_SECRET is enough to say "this is a real session we issued", and
// keeping it DB-free makes it fast and unit-testable without a database.
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    req.user = { id: payload.userId };
    return next();
  } catch {
    // TokenExpiredError, JsonWebTokenError (bad signature / malformed), etc.
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
}

module.exports = { authenticate, extractToken, SESSION_COOKIE };
