require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { AUTH_ATTEMPT_LIMIT, EMAIL_SEND_LIMIT } = require('../middleware/rateLimit');

// The limiter is skipped under Jest by default (authFlows.test.js makes ~50
// auth calls from one IP). This file opts in with RATE_LIMIT_IN_TESTS, and
// must restore it in afterAll: Jest reuses one process per worker across
// files, so a leaked flag would switch limiting on for the next file.
// Jest gives each test file its own module registry, so the limiter
// counters here start fresh and never touch another file's app instance.

let server;
let base;
let dbUp = false;
const ORIGINAL_FLAG = process.env.RATE_LIMIT_IN_TESTS;

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Addresses that can never exist, so login and forgot-password take their
// "unknown account" paths: no user is touched and no email is ever sent.
const unknownEmail = () => `rate-limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@student.mseuf.edu.ph`;

beforeAll(async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
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
  if (ORIGINAL_FLAG === undefined) delete process.env.RATE_LIMIT_IN_TESTS;
  else process.env.RATE_LIMIT_IN_TESTS = ORIGINAL_FLAG;
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

const guard = () => {
  if (!dbUp) console.warn('[rateLimit.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('auth rate limiting', () => {
  test(`login allows ${AUTH_ATTEMPT_LIMIT} attempts, then returns 429 TOO_MANY_REQUESTS`, async () => {
    if (guard()) return;
    const body = { email: unknownEmail(), password: 'wrong-password' };

    for (let i = 0; i < AUTH_ATTEMPT_LIMIT; i++) {
      const res = await post('/api/auth/verify', body);
      expect(res.status).toBe(401);
    }

    const blocked = await post('/api/auth/verify', body);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Try again in a few minutes.',
    });
    // draft-8 standard headers: a combined RateLimit header plus the policy.
    expect(blocked.headers.get('ratelimit')).toBeTruthy();
    expect(blocked.headers.get('ratelimit-policy')).toContain(`q=${AUTH_ATTEMPT_LIMIT}`);
  });

  test(`forgot-password allows ${EMAIL_SEND_LIMIT} requests, then returns 429`, async () => {
    if (guard()) return;

    for (let i = 0; i < EMAIL_SEND_LIMIT; i++) {
      const res = await post('/api/auth/forgot-password', { email: unknownEmail() });
      expect(res.status).toBe(200);
    }

    const blocked = await post('/api/auth/forgot-password', { email: unknownEmail() });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('TOO_MANY_REQUESTS');
  });

  test('each route keeps its own counter — a blocked login does not block OTP verification', async () => {
    if (guard()) return;
    // /verify was driven over its limit above; this route has a separate one.
    const res = await post('/api/auth/register/verify-otp', { email: unknownEmail(), otp: '000000' });
    expect(res.status).not.toBe(429);
  });

  test('limiting is skipped under Jest when the opt-in flag is off', async () => {
    if (guard()) return;
    delete process.env.RATE_LIMIT_IN_TESTS;
    try {
      // Same over-limit route as the first test: without the flag, it's let through.
      const res = await post('/api/auth/verify', { email: unknownEmail(), password: 'wrong-password' });
      expect(res.status).toBe(401);
    } finally {
      process.env.RATE_LIMIT_IN_TESTS = '1';
    }
  });
});
