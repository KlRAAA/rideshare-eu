const crypto = require('crypto');

// In production the browser reaches the API only through the website, which
// adds an `x-origin-secret` header to every forwarded request (src/proxy.ts and
// src/lib/api.ts). Requests that skip the website and hit the API's own address
// are refused: they could also fake X-Forwarded-For and dodge the sign-in rate
// limits. Off when ORIGIN_SECRET isn't set (local development).
function requireOriginSecret(secret = process.env.ORIGIN_SECRET) {
  if (!secret) return (req, res, next) => next();
  const expected = Buffer.from(secret);
  return (req, res, next) => {
    const given = Buffer.from(String(req.headers['x-origin-secret'] ?? ''));
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next();
    return res.status(403).json({ error: 'FORBIDDEN' });
  };
}

module.exports = { requireOriginSecret };
