require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { hashOtp, otpExpiryDate, MAX_ATTEMPTS } = require('../services/otpService');
const { setSecurityLogSink } = require('../services/securityLog');
const { AUTH_ATTEMPT_LIMIT } = require('../middleware/rateLimit');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

// Failed sign-ins, wrong codes, code lockouts, rate-limit hits and a failed
// password re-check must each leave one security log entry — and the HTTP
// response must stay exactly what it was before logging existed.

let server;
let base;
let dbUp = false;
let events;
let restoreSink;
const bag = newBag();
const otpEmails = [];
const PASSWORD = 'Correct-Horse-2026';

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const unknownEmail = () => `seclog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@student.mseuf.edu.ph`;

async function userWithPassword() {
  const user = await makeUser(bag);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4) } });
  return user;
}

async function pendingOtp(email, { attempts = 0 } = {}) {
  otpEmails.push(email);
  await prisma.emailVerification.create({
    data: { email, otpHash: await hashOtp('111111'), expiresAt: otpExpiryDate(), attempts },
  });
}

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

beforeEach(() => {
  events = [];
  restoreSink = setSecurityLogSink((entry) => events.push(entry));
});

afterEach(() => setSecurityLogSink(restoreSink));

afterAll(async () => {
  if (dbUp) {
    await prisma.emailVerification.deleteMany({ where: { email: { in: otpEmails } } });
    await cleanup(bag);
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;

describe('failed sign-in logging', () => {
  test('a wrong password logs LOGIN_FAILED with the account id; the response is unchanged', async () => {
    if (guard()) return;
    const user = await userWithPassword();

    const res = await post('/api/auth/verify', { email: user.email, password: 'not-it' }, { 'User-Agent': 'seclog-test' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_CREDENTIALS' });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'LOGIN_FAILED',
      reason: 'WRONG_PASSWORD',
      userId: user.id,
      route: '/api/auth/verify',
      userAgent: 'seclog-test',
    });
    expect(events[0].email).toMatch(/^a\*\*\*@test\.local$/);
    expect(JSON.stringify(events[0])).not.toContain('not-it');
  });

  test('an unknown email logs LOGIN_FAILED without an account id', async () => {
    if (guard()) return;
    const email = unknownEmail();

    const res = await post('/api/auth/verify', { email, password: 'whatever-123' });

    expect(res.status).toBe(401);
    expect(events).toEqual([expect.objectContaining({ event: 'LOGIN_FAILED', reason: 'UNKNOWN_ACCOUNT', email: 's***@student.mseuf.edu.ph' })]);
    expect(events[0].userId).toBeUndefined();
  });

  test('a successful sign-in logs nothing', async () => {
    if (guard()) return;
    const user = await userWithPassword();
    const res = await post('/api/auth/verify', { email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(events).toEqual([]);
  });
});

describe('code (OTP) failure logging', () => {
  test('a wrong registration code logs OTP_FAILED with the attempt count', async () => {
    if (guard()) return;
    const email = unknownEmail();
    await pendingOtp(email);

    const res = await post('/api/auth/register/verify-otp', { email, otp: '999999' });

    expect(res.status).toBe(401);
    expect(events).toEqual([expect.objectContaining({ event: 'OTP_FAILED', reason: 'REGISTRATION', attempts: 1 })]);
  });

  test('the wrong guess that uses up the last attempt also logs OTP_LOCKED', async () => {
    if (guard()) return;
    const email = unknownEmail();
    await pendingOtp(email, { attempts: MAX_ATTEMPTS - 1 });

    await post('/api/auth/verify-reset-otp', { email, otp: '999999' });

    expect(events.map((e) => e.event)).toEqual(['OTP_FAILED', 'OTP_LOCKED']);
    expect(events[1]).toMatchObject({ reason: 'PASSWORD_RESET', attempts: MAX_ATTEMPTS });
  });

  test('trying again on a locked code logs OTP_LOCKED; the response is unchanged', async () => {
    if (guard()) return;
    const email = unknownEmail();
    await pendingOtp(email, { attempts: MAX_ATTEMPTS });

    const res = await post('/api/auth/register/verify-otp', { email, otp: '111111' });

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'TOO_MANY_ATTEMPTS' });
    expect(events).toEqual([expect.objectContaining({ event: 'OTP_LOCKED', reason: 'REGISTRATION', attempts: MAX_ATTEMPTS })]);
  });
});

describe('password re-check logging', () => {
  test('a wrong password on account deletion logs PASSWORD_RECHECK_FAILED', async () => {
    if (guard()) return;
    const user = await userWithPassword();

    const res = await fetch(`${base}/api/users/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...bearer(user.id) },
      body: JSON.stringify({ password: 'wrong' }),
    });

    expect(res.status).toBe(403);
    expect(events).toEqual([expect.objectContaining({ event: 'PASSWORD_RECHECK_FAILED', reason: 'DELETE_ACCOUNT', userId: user.id })]);
  });
});

describe('rate-limit logging', () => {
  const ORIGINAL_FLAG = process.env.RATE_LIMIT_IN_TESTS;
  afterAll(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.RATE_LIMIT_IN_TESTS;
    else process.env.RATE_LIMIT_IN_TESTS = ORIGINAL_FLAG;
  });

  test('a request blocked by the limiter logs RATE_LIMITED with the route and limit', async () => {
    if (guard()) return;
    process.env.RATE_LIMIT_IN_TESTS = '1';
    const body = { email: unknownEmail(), password: 'wrong-password' };
    // Skipped requests (flag off, earlier tests) don't count toward the limit,
    // so the limiter answers on attempt AUTH_ATTEMPT_LIMIT + 1.
    let blocked;
    for (let i = 0; i <= AUTH_ATTEMPT_LIMIT && !blocked; i++) {
      const res = await post('/api/auth/verify', body);
      if (res.status === 429) blocked = res;
    }

    expect(blocked).toBeDefined();
    const limited = events.filter((e) => e.event === 'RATE_LIMITED');
    expect(limited).toEqual([expect.objectContaining({ route: '/api/auth/verify', limit: AUTH_ATTEMPT_LIMIT })]);
  });
});

describe('access-denied logging', () => {
  test('reading someone else’s preferences logs ACCESS_DENIED with the caller and the code', async () => {
    if (guard()) return;
    const caller = await makeUser(bag);
    const other = await makeUser(bag);

    const res = await fetch(`${base}/api/preferences/${other.id}`, { headers: bearer(caller.id) });

    expect(res.status).toBe(403);
    expect(events).toEqual([
      expect.objectContaining({
        event: 'ACCESS_DENIED',
        reason: 'NOT_AUTHORIZED',
        userId: caller.id,
        method: 'GET',
        route: `/api/preferences/${other.id}`,
      }),
    ]);
  });

  test('a non-admin calling an admin route logs ACCESS_DENIED / ADMIN_ONLY', async () => {
    if (guard()) return;
    const caller = await makeUser(bag);

    const res = await fetch(`${base}/api/admin/users`, { headers: bearer(caller.id) });

    expect(res.status).toBe(403);
    expect(events).toEqual([expect.objectContaining({ event: 'ACCESS_DENIED', reason: 'ADMIN_ONLY', userId: caller.id })]);
  });

  test('allowed requests and other 4xx responses log nothing', async () => {
    if (guard()) return;
    const caller = await makeUser(bag);

    await fetch(`${base}/api/preferences/${caller.id}`, { headers: bearer(caller.id) });
    await fetch(`${base}/api/trips/00000000-0000-0000-0000-000000000000`, { headers: bearer(caller.id) });

    expect(events).toEqual([]);
  });
});
