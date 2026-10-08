const crypto = require('crypto');
const net = require('net');

// In production the browser reaches the API only through the website, which
// adds an `x-origin-secret` header to every forwarded request (src/proxy.ts and
// src/lib/api.ts). Requests that skip the website and hit the API's own address
// are refused: they could also fake X-Forwarded-For and dodge the sign-in rate
// limits. Off when ORIGIN_SECRET isn't set (local development).
//
// The website's server is what connects to the API, so req.ip would be
// Vercel's address for every visitor and all of them would share one sign-in
// limit. The website sends the visitor's address as x-client-ip; it is trusted
// only on requests that carry the secret, so it can't be faked from outside.
function requireOriginSecret(secret = process.env.ORIGIN_SECRET) {
  if (!secret) return (req, res, next) => next();
  const expected = Buffer.from(secret);
  return (req, res, next) => {
    const given = Buffer.from(String(req.headers['x-origin-secret'] ?? ''));
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const clientIp = String(req.headers['x-client-ip'] ?? '');
    if (net.isIP(clientIp)) Object.defineProperty(req, 'ip', { value: clientIp, configurable: true });
    return next();
  };
}

module.exports = { requireOriginSecret };
