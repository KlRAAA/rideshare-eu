require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const jwt = require('jsonwebtoken');
const { authenticate, extractToken, SESSION_COOKIE } = require('../middleware/authenticate');
const { bearer, expiredBearer } = require('../test-helpers/auth');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');
const prisma = require('../config/db');
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

// authenticate() is async (it now does one DB lookup for the ban check — see
// its own comment), so every caller here awaits it before asserting.
async function run(headers) {
  // Node lowercases all incoming header names; mirror that for the mock so a
  // helper returning `{ Authorization: ... }` is read the same as over the wire.
  const normalized = {};
  for (const [k, v] of Object.entries(headers || {})) normalized[k.toLowerCase()] = v;
  const req = { headers: normalized };
  const res = mockRes();
  let nexted = false;
  await authenticate(req, res, () => {
    nexted = true;
  });
  return { req, res, nexted };
}

describe('authenticate middleware — signature/expiry checks (no DB needed)', () => {
  // These never reach the ban-check DB lookup — every one of them returns
  // before it in authenticate.js, so they hold regardless of DB availability.
  test('no token → 401 UNAUTHENTICATED, next() not called', async () => {
    const { res, nexted } = await run({});
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'UNAUTHENTICATED' });
  });

  test('expired token → 401', async () => {
    const { res, nexted } = await run(expiredBearer('user-123'));
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('tampered token (payload edited, signature no longer matches) → 401', async () => {
    const good = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });
    const [h, p, s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ userId: 'attacker', iat: 0 })).toString('base64url');
    const { res, nexted } = await run({ authorization: `Bearer ${h}.${forgedPayload}.${s}` });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('token signed with a different secret → 401', async () => {
    const wrong = jwt.sign({ userId: 'user-123' }, 'not-the-real-secret', { expiresIn: '7d' });
    const { res, nexted } = await run({ authorization: `Bearer ${wrong}` });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('malformed / non-JWT token → 401', async () => {
    const { res, nexted } = await run({ authorization: 'Bearer not-a-jwt-at-all' });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('valid signature but no userId in payload → 401', async () => {
    const token = jwt.sign({ role: 'STUDENT' }, SECRET, { expiresIn: '7d' });
    const { res, nexted } = await run({ authorization: `Bearer ${token}` });
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

describe('authenticate middleware — DB-backed ban check', () => {
  let dbUp = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbUp = true;
    } catch {
      /* dbUp stays false */
    }
  });

  test('valid token for a row that does not exist → treated as not-banned, next() called', async () => {
    if (!dbUp) return;
    // Mirrors the whole rest of the test suite's convention of using
    // arbitrary ids (e.g. bearer('whoever')) that were never meant to
    // resolve to a real row — a missing row has nothing to enforce, so this
    // must fall through exactly like a real, unbanned user would.
    const { req, nexted } = await run(bearer('this-id-does-not-exist'));
    expect(nexted).toBe(true);
    expect(req.user).toEqual({ id: 'this-id-does-not-exist' });
  });

  test('valid token for a real, unbanned user → next() called, req.user.id set', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const user = await makeUser(bag);
    try {
      const { req, nexted } = await run(bearer(user.id));
      expect(nexted).toBe(true);
      expect(req.user).toEqual({ id: user.id });
    } finally {
      await cleanup(bag);
    }
  });

  test('valid token for a user with an active temporary ban → 403 ACCOUNT_SUSPENDED, next() not called', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const user = await makeUser(bag);
    const bannedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
    await prisma.user.update({
      where: { id: user.id },
      data: { bannedUntil, banReason: 'INAPPROPRIATE_BEHAVIOR', banSeverity: 'STANDARD' },
    });
    try {
      const { res, nexted } = await run(bearer(user.id));
      expect(nexted).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.banReason).toBe('INAPPROPRIATE_BEHAVIOR');
      expect(res.body.banSeverity).toBe('STANDARD');
      expect(res.body.permanent).toBe(false);
      expect(new Date(res.body.bannedUntil).getTime()).toBe(bannedUntil.getTime());
    } finally {
      await cleanup(bag);
    }
  });

  test('a ban whose bannedUntil has already passed self-clears — next() called', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const user = await makeUser(bag);
    await prisma.user.update({
      where: { id: user.id },
      data: { bannedUntil: new Date(Date.now() - 1000), banReason: 'SPAM', banSeverity: 'STANDARD' },
    });
    try {
      const { nexted } = await run(bearer(user.id));
      expect(nexted).toBe(true);
    } finally {
      await cleanup(bag);
    }
  });

  test('a permanent ban (far-future bannedUntil) → 403 with permanent: true', async () => {
    if (!dbUp) return;
    const bag = newBag();
    const user = await makeUser(bag);
    await prisma.user.update({
      where: { id: user.id },
      data: { bannedUntil: new Date('9999-12-31T23:59:59.999Z'), banReason: 'HARASSMENT', banSeverity: 'HIGH_ALERT' },
    });
    try {
      const { res, nexted } = await run(bearer(user.id));
      expect(nexted).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.permanent).toBe(true);
    } finally {
      await cleanup(bag);
    }
  });
});

describe('authenticate middleware — wired into the app', () => {
  let server;
  let base;
  let dbUp = false;

  beforeAll(async () => {
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
    await prisma.$disconnect().catch(() => {});
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

  test('a suspended user hitting any protected route gets 403 ACCOUNT_SUSPENDED', async () => {
    if (!dbUp) {
      console.warn('[authenticate.test] DB unavailable — suspension assertion not exercised this run');
      return;
    }
    const bag = newBag();
    const user = await makeUser(bag);
    await prisma.user.update({
      where: { id: user.id },
      data: { bannedUntil: new Date(Date.now() + 60 * 60 * 1000), banReason: 'SAFETY', banSeverity: 'HIGH_ALERT' },
    });
    try {
      const res = await fetch(`${base}/api/trips/mine?userId=${user.id}`, { headers: bearer(user.id) });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('ACCOUNT_SUSPENDED');
      expect(body.banReason).toBe('SAFETY');
    } finally {
      await cleanup(bag);
    }
  });
});
