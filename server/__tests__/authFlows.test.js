require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const app = require('../app');
const prisma = require('../config/db');
const { MAX_ATTEMPTS } = require('../services/otpService');

// authController.js (registration, login, forgot/reset-password) is the most
// security-sensitive surface in the app and had zero test coverage before this
// file. Two things make it harder to test than the other *Auth.test.js files
// in this directory:
//
//   1. emailService.sendOtpEmail genuinely attempts a real SMTP send whenever
//      SMTP_HOST is configured — and .env has a real Gmail SMTP_HOST that
//      every test file loads via dotenv. Deleting process.env.SMTP_HOST for
//      the duration of this file forces emailService's own dev-only fallback
//      (`console.log('[dev-only] OTP for <email>: <otp>')`, already in the
//      source for exactly this "testable before SMTP creds exist" reason)
//      instead of a real send. Jest does not spawn a fresh OS process per test
//      file — only per worker, and a worker runs multiple files sequentially
//      in the same process — so process.env is a real shared global that
//      would leak into whatever file that worker runs next if not restored.
//      Restored (to its original value, which may be undefined) in afterAll.
//   2. The plaintext OTP is never stored or returned anywhere — only its
//      bcrypt hash is persisted (otpService.hashOtp). The only place the
//      plaintext exists is the argument to sendOtpEmail. With (1) forcing
//      that through console.log, spying on console.log (not on any
//      application module — no jest.mock precedent broken here) and parsing
//      the dev-only line is the only way to learn it without adding a
//      backdoor.

let server;
let base;
let dbUp = false;
const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;
let consoleSpy;

const createdEmails = [];
const createdUserIds = [];

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function studentEmail() {
  const email = `auth-flow-${uniqueSuffix()}@student.mseuf.edu.ph`;
  createdEmails.push(email);
  return email;
}

function staffEmail() {
  const email = `auth-flow-${uniqueSuffix()}@mseuf.edu.ph`;
  createdEmails.push(email);
  return email;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Scans the console.log spy for this file's own dev-only OTP fallback line
// (see the file-level comment above). Searches from the most recent call so a
// second OTP issued for the same email always yields the current one.
function latestOtpFor(email) {
  const re = new RegExp(`\\[dev-only\\] OTP for ${escapeRegExp(email)}: (\\d{6})`);
  for (let i = consoleSpy.mock.calls.length - 1; i >= 0; i--) {
    const [line] = consoleSpy.mock.calls[i];
    const match = typeof line === 'string' && line.match(re);
    if (match) return match[1];
  }
  return null;
}

function wrongOtpFor(otp) {
  return otp === '000000' ? '111111' : '000000';
}

async function expireOtpFor(email) {
  const record = await prisma.emailVerification.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
  await prisma.emailVerification.update({ where: { id: record.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
}

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function startRegistrationAndGetOtp(email) {
  const res = await post('/api/auth/register/start', { email });
  return { res, otp: latestOtpFor(email) };
}

async function startResetAndGetOtp(email) {
  const res = await post('/api/auth/forgot-password', { email });
  return { res, otp: latestOtpFor(email) };
}

async function createVerifiedUser({ email, password = 'OriginalPass123!', role = 'STUDENT' } = {}) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: 'Existing User',
      universityId: `AUTHFLOW-${uniqueSuffix()}`,
      role,
      gender: 'UNSPECIFIED',
      verified: true,
    },
  });
  createdUserIds.push(user.id);
  return { user, password };
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

  delete process.env.SMTP_HOST;
  consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  if (dbUp) {
    await prisma.emailVerification.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});

  consoleSpy.mockRestore();
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;

  // Self-check, not just a statement of intent: Jest doesn't spawn a fresh OS
  // process per test file (only per worker, and a worker runs many files
  // sequentially in-process), so process.env is a real shared global — if this
  // assertion ever fails, the SMTP_HOST deletion above would silently leak
  // into whichever test file that worker runs next.
  expect(process.env.SMTP_HOST).toBe(ORIGINAL_SMTP_HOST);
});

const guard = () => {
  if (!dbUp) console.warn('[authFlows.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('POST /api/auth/register/start', () => {
  test('non-whitelisted domain → 400 INVALID_DOMAIN', async () => {
    if (guard()) return;
    const res = await post('/api/auth/register/start', { email: 'someone@gmail.com' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_DOMAIN');
  });

  test('already-registered email → 409 ACCOUNT_EXISTS', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const res = await post('/api/auth/register/start', { email });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('ACCOUNT_EXISTS');
  });

  test('valid student-domain email → 200 OTP_SENT and creates an EmailVerification record', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { res } = await startRegistrationAndGetOtp(email);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('OTP_SENT');
    const record = await prisma.emailVerification.findFirst({ where: { email } });
    expect(record).not.toBeNull();
  });
});

describe('Full registration flow: start → verify-otp → complete', () => {
  test('happy path with a student-domain email issues a session token with STUDENT role', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);

    const verifyRes = await post('/api/auth/register/verify-otp', { email, otp });
    expect(verifyRes.status).toBe(200);
    const { verificationTicket } = await verifyRes.json();
    expect(verificationTicket).toEqual(expect.any(String));

    const completeRes = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'NewPass123!',
      fullName: 'Student Person',
      universityId: `SID-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(completeRes.status).toBe(201);
    const body = await completeRes.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.role).toBe('STUDENT');
    createdUserIds.push(body.user.id);
  });

  test('happy path with a staff-domain email infers FACULTY role', async () => {
    if (guard()) return;
    const email = staffEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const completeRes = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'NewPass123!',
      fullName: 'Staff Person',
      universityId: `FID-${uniqueSuffix()}`,
      gender: 'FEMALE',
    });
    expect(completeRes.status).toBe(201);
    const body = await completeRes.json();
    expect(body.user.role).toBe('FACULTY');
    createdUserIds.push(body.user.id);
  });

  test('wrong OTP → 401 INVALID_OTP and increments the attempt counter', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const res = await post('/api/auth/register/verify-otp', { email, otp: wrongOtpFor(otp) });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_OTP');
    const record = await prisma.emailVerification.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
    expect(record.attempts).toBe(1);
  });

  test(`${MAX_ATTEMPTS} wrong attempts exhaust the cap; the next attempt is 429 regardless of correctness`, async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = await post('/api/auth/register/verify-otp', { email, otp: wrongOtpFor(otp) });
      expect(res.status).toBe(401);
    }
    const capped = await post('/api/auth/register/verify-otp', { email, otp });
    expect(capped.status).toBe(429);
    expect((await capped.json()).error).toBe('TOO_MANY_ATTEMPTS');
  });

  test('expired OTP → 400 OTP_EXPIRED even with the correct code', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    await expireOtpFor(email);
    const res = await post('/api/auth/register/verify-otp', { email, otp });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('OTP_EXPIRED');
  });

  test('verify-otp for an email with no pending OTP → 400 NO_PENDING_OTP', async () => {
    if (guard()) return;
    const res = await post('/api/auth/register/verify-otp', { email: studentEmail(), otp: '123456' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('NO_PENDING_OTP');
  });

  test('complete with a garbage ticket → 401 INVALID_OR_EXPIRED_TICKET', async () => {
    if (guard()) return;
    const res = await post('/api/auth/register/complete', {
      verificationTicket: 'not-a-real-token',
      password: 'NewPass123!',
      fullName: 'Nobody',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_OR_EXPIRED_TICKET');
  });

  test('complete rejects a reset-password-scoped ticket (ticket purpose scoping)', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const { otp } = await startResetAndGetOtp(email);
    const { resetTicket } = await (await post('/api/auth/verify-reset-otp', { email, otp })).json();

    const res = await post('/api/auth/register/complete', {
      verificationTicket: resetTicket,
      password: 'NewPass123!',
      fullName: 'Confused Person',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_OR_EXPIRED_TICKET');
  });

  test('complete validation: empty full name → 400 EMPTY_FULL_NAME', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const res = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'NewPass123!',
      fullName: '   ',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('EMPTY_FULL_NAME');
  });

  test('complete validation: full name shorter than 3 characters → 400 FULL_NAME_TOO_SHORT', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const res = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'NewPass123!',
      fullName: 'Al',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('FULL_NAME_TOO_SHORT');
  });

  test('complete validation: full name matching university ID → 400 FULL_NAME_MATCHES_ID', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const sameValue = `Same-${uniqueSuffix()}`;
    const res = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'NewPass123!',
      fullName: sameValue,
      universityId: sameValue,
      gender: 'MALE',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('FULL_NAME_MATCHES_ID');
  });

  test('complete validation: password shorter than 8 characters → 400 PASSWORD_TOO_SHORT', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const res = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'short1',
      fullName: 'Short Password Person',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_TOO_SHORT');
  });

  test('complete validation: an 8-character password is accepted (the boundary, not rejected)', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();
    const res = await post('/api/auth/register/complete', {
      verificationTicket,
      password: 'exactly8',
      fullName: 'Boundary Password Person',
      universityId: `X-${uniqueSuffix()}`,
      gender: 'MALE',
    });
    expect(res.status).toBe(201);
    createdUserIds.push((await res.json()).user.id);
  });
});

describe('POST /api/auth/verify (login)', () => {
  test('correct credentials → 200 with a session token', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { password } = await createVerifiedUser({ email });
    const res = await post('/api/auth/verify', { email, password });
    expect(res.status).toBe(200);
    expect((await res.json()).token).toEqual(expect.any(String));
  });

  test('wrong password → 401 INVALID_CREDENTIALS', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email, password: 'CorrectPass123!' });
    const res = await post('/api/auth/verify', { email, password: 'WrongPass999!' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_CREDENTIALS');
  });

  test('unknown email → 401 INVALID_CREDENTIALS, the same response as a wrong password', async () => {
    if (guard()) return;
    // Previously 404 ACCOUNT_NOT_FOUND — a status-code oracle for account
    // existence, inconsistent with requestPasswordReset's deliberately
    // generic response a few functions away. Fixed to match.
    const res = await post('/api/auth/verify', { email: studentEmail(), password: 'whatever' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_CREDENTIALS');
  });

  test('an unknown email and a wrong password are indistinguishable: identical status and body', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email, password: 'CorrectPass123!' });

    const wrongPassword = await post('/api/auth/verify', { email, password: 'WrongPass999!' });
    const unknownEmail = await post('/api/auth/verify', { email: studentEmail(), password: 'WrongPass999!' });

    expect(wrongPassword.status).toBe(unknownEmail.status);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });
});

describe('Forgot/reset password flow', () => {
  test('happy path: reset changes the password — new one works, old one no longer does', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { password: oldPassword } = await createVerifiedUser({ email, password: 'OldPass123!' });

    const { otp } = await startResetAndGetOtp(email);
    const verifyRes = await post('/api/auth/verify-reset-otp', { email, otp });
    expect(verifyRes.status).toBe(200);
    const { resetTicket } = await verifyRes.json();

    const newPassword = 'BrandNewPass456!';
    const resetRes = await post('/api/auth/reset-password', { resetTicket, password: newPassword });
    expect(resetRes.status).toBe(200);
    expect((await resetRes.json()).status).toBe('PASSWORD_RESET');

    const loginNew = await post('/api/auth/verify', { email, password: newPassword });
    expect(loginNew.status).toBe(200);
    const loginOld = await post('/api/auth/verify', { email, password: oldPassword });
    expect(loginOld.status).toBe(401);
  });

  test('unknown email → generic 200 response, no EmailVerification row created', async () => {
    if (guard()) return;
    const email = studentEmail();
    const res = await post('/api/auth/forgot-password', { email });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('OTP_SENT_IF_ACCOUNT_EXISTS');
    const record = await prisma.emailVerification.findFirst({ where: { email } });
    expect(record).toBeNull();
  });

  test('wrong reset OTP → 401 INVALID_OTP and increments the attempt counter', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const { otp } = await startResetAndGetOtp(email);
    const res = await post('/api/auth/verify-reset-otp', { email, otp: wrongOtpFor(otp) });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_OTP');
    const record = await prisma.emailVerification.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
    expect(record.attempts).toBe(1);
  });

  test(`${MAX_ATTEMPTS} wrong reset-OTP attempts exhaust the cap; the next attempt is 429`, async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const { otp } = await startResetAndGetOtp(email);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = await post('/api/auth/verify-reset-otp', { email, otp: wrongOtpFor(otp) });
      expect(res.status).toBe(401);
    }
    const capped = await post('/api/auth/verify-reset-otp', { email, otp });
    expect(capped.status).toBe(429);
    expect((await capped.json()).error).toBe('TOO_MANY_ATTEMPTS');
  });

  test('expired reset OTP → 400 OTP_EXPIRED even with the correct code', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const { otp } = await startResetAndGetOtp(email);
    await expireOtpFor(email);
    const res = await post('/api/auth/verify-reset-otp', { email, otp });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('OTP_EXPIRED');
  });

  test('reset-password rejects a password shorter than 8 characters', async () => {
    if (guard()) return;
    const email = studentEmail();
    await createVerifiedUser({ email });
    const { otp } = await startResetAndGetOtp(email);
    const { resetTicket } = await (await post('/api/auth/verify-reset-otp', { email, otp })).json();
    const res = await post('/api/auth/reset-password', { resetTicket, password: 'short' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_TOO_SHORT');
  });

  test('reset-password rejects a complete-registration-scoped ticket (ticket purpose scoping)', async () => {
    if (guard()) return;
    const email = studentEmail();
    const { otp } = await startRegistrationAndGetOtp(email);
    const { verificationTicket } = await (await post('/api/auth/register/verify-otp', { email, otp })).json();

    const res = await post('/api/auth/reset-password', { resetTicket: verificationTicket, password: 'WhateverPass123!' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('INVALID_OR_EXPIRED_TICKET');
  });
});
