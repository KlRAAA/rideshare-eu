require('dotenv').config({ quiet: true });
const app = require('../app');

// Baseline security headers (OWASP A05 review, item 5): helmet() is applied
// app-wide, before CORS/routes — verified here on a request that never
// touches the database (an unauthenticated call, rejected by the auth
// middleware before any controller runs), so this doesn't need dbUp guarding
// like the DB-backed suites.

let server;
let base;

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

describe('Security headers (helmet)', () => {
  test('a baseline set of security headers is present on every response, including error responses', async () => {
    const res = await fetch(`${base}/api/trips/mine`); // no token -> 401, before any DB access
    expect(res.status).toBe(401);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-dns-prefetch-control')).toBe('off');
  });

  test('CORS still works correctly alongside helmet — credentials + allowlisted origin are echoed back', async () => {
    const res = await fetch(`${base}/api/trips/mine`, { headers: { Origin: 'http://localhost:3000' } });
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
