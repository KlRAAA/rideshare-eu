require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const jwt = require('jsonwebtoken');
const { authenticate, extractToken, SESSION_COOKIE } = require('../middleware/authenticate');
const { bearer, expiredBearer } = require('../test-helpers/auth');
const app = require('../app');

const SECRET = process.env.JWT_SECRET;

function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

function run(headers) {
  // Node lowercases all incoming header names; mirror that for the mock so a
  // helper returning `{ Authorization: ... }` is read the same as over the wire.
  const normalized = {};
  for (const [k, v] of Object.entries(headers || {})) normalized[k.toLowerCase()] = v;
  const req = { headers: normalized };
  const res = mockRes();
  let nexted = false;
  authenticate(req, res, () => {
    nexted = true;
  });
  return { req, res, nexted };
}

describe('authenticate middleware — unit', () => {
  test('valid Bearer token: calls next() and sets req.user.id', () => {
    const { req, res, nexted } = run(bearer('user-123'));
    expect(nexted).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(req.user).toEqual({ id: 'user-123' });
  });

  test('valid token in the rsu_session cookie also works', () => {
    const token = jwt.sign({ userId: 'cookie-user' }, SECRET, { expiresIn: '7d' });
    const { req, nexted } = run({ cookie: `foo=bar; ${SESSION_COOKIE}=${token}; baz=qux` });
    expect(nexted).toBe(true);
    expect(req.user).toEqual({ id: 'cookie-user' });
  });

  test('no token → 401 UNAUTHENTICATED, next() not called', () => {
    const { res, nexted } = run({});
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'UNAUTHENTICATED' });
  });

  test('expired token → 401', () => {
    const { res, nexted } = run(expiredBearer('user-123'));
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('tampered token (payload edited, signature no longer matches) → 401', () => {
    const good = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });
    const [h, p, s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ userId: 'attacker', iat: 0 })).toString('base64url');
    const { res, nexted } = run({ authorization: `Bearer ${h}.${forgedPayload}.${s}` });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('token signed with a different secret → 401', () => {
    const wrong = jwt.sign({ userId: 'user-123' }, 'not-the-real-secret', { expiresIn: '7d' });
    const { res, nexted } = run({ authorization: `Bearer ${wrong}` });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('malformed / non-JWT token → 401', () => {
    const { res, nexted } = run({ authorization: 'Bearer not-a-jwt-at-all' });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('valid signature but no userId in payload → 401', () => {
    const token = jwt.sign({ role: 'STUDENT' }, SECRET, { expiresIn: '7d' });
    const { res, nexted } = run({ authorization: `Bearer ${token}` });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('extractToken prefers the Authorization header over the cookie', () => {
    const headerToken = jwt.sign({ userId: 'from-header' }, SECRET);
    const cookieToken = jwt.sign({ userId: 'from-cookie' }, SECRET);
    const token = extractToken({
      headers: { authorization: `Bearer ${headerToken}`, cookie: `${SESSION_COOKIE}=${cookieToken}` },
    });
    expect(token).toBe(headerToken);
  });
});

describe('authenticate middleware — wired into the app', () => {
  let server;
  let base;
  let dbUp = false;

  beforeAll(async () => {
    const prisma = require('../config/db');
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbUp = true;
    } catch {
      /* dbUp stays false */
    }
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise((r) => server.close(r));
    await require('../config/db').$disconnect().catch(() => {});
  });

  test('public route (/api/auth/*) is reachable with no token', async () => {
    const res = await fetch(`${base}/api/auth/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'someone@not-a-school-domain.com' }),
    });
    expect(res.status).not.toBe(401); // 400 INVALID_DOMAIN — the point is it got past auth to the controller
    expect(res.status).toBe(400);
  });

  test('protected route with no token → 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${base}/api/trips/mine?userId=whoever`);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('UNAUTHENTICATED');
  });

  test('protected route with an expired token → 401', async () => {
    const res = await fetch(`${base}/api/trips/mine?userId=whoever`, { headers: expiredBearer() });
    expect(res.status).toBe(401);
  });

  test('protected route with a valid token → not 401 (reaches the controller)', async () => {
    if (!dbUp) {
      console.warn('[authenticate.test] DB unavailable — 200 assertion not exercised this run');
      return;
    }
    const res = await fetch(`${base}/api/trips/mine?userId=whoever`, { headers: bearer('whoever') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('hosted');
    expect(body).toHaveProperty('joined');
  });

  test('/api/geocode is now protected too', async () => {
    const res = await fetch(`${base}/api/geocode?q=Lucena`);
    expect(res.status).toBe(401);
  });
});
