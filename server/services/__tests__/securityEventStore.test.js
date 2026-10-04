require('dotenv').config({ quiet: true });
const prisma = require('../../config/db');
const { storeSecurityEvent, purgeOldSecurityEvents, securityCounts, accountsWithFailedLogins } = require('../securityEventStore');

// userId has no foreign key on SecurityEvent, so any unique string works here.
const userId = `sec-test-${Date.now()}`;
let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});

afterAll(async () => {
  if (dbUp) await prisma.securityEvent.deleteMany({ where: { userId } });
  await prisma.$disconnect();
});

const entry = (over = {}) => ({
  type: 'security',
  event: 'LOGIN_FAILED',
  at: new Date().toISOString(),
  ip: '203.0.113.9',
  email: 'm***@student.mseuf.edu.ph',
  userAgent: 'test-agent',
  route: '/api/auth/verify',
  userId,
  reason: 'WRONG_PASSWORD',
  ...over,
});

test('stores only the event, reason, account and route, never the IP or email', async () => {
  if (!dbUp) return;
  await storeSecurityEvent(entry());
  const row = await prisma.securityEvent.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  expect(row).toMatchObject({ event: 'LOGIN_FAILED', reason: 'WRONG_PASSWORD', route: '/api/auth/verify', userId });
  const serialized = JSON.stringify(row);
  expect(serialized).not.toContain('203.0.113.9');
  expect(serialized).not.toContain('mseuf');
  expect(serialized).not.toContain('test-agent');
});

test('counts the last 24 hours by event and flags accounts with 5 or more failed sign-ins', async () => {
  if (!dbUp) return;
  for (let i = 0; i < 5; i++) await storeSecurityEvent(entry());
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const counts = await securityCounts(since);
  expect(counts.LOGIN_FAILED).toBeGreaterThanOrEqual(5);
  expect(Object.keys(counts)).toEqual(
    expect.arrayContaining(['LOGIN_FAILED', 'OTP_FAILED', 'OTP_LOCKED', 'RATE_LIMITED', 'PASSWORD_RECHECK_FAILED', 'ACCESS_DENIED'])
  );
  const flagged = await accountsWithFailedLogins(since);
  expect(flagged.find((f) => f.userId === userId).count).toBeGreaterThanOrEqual(5);
});

test('an account under the threshold is not flagged', async () => {
  if (!dbUp) return;
  const quiet = `${userId}-quiet`;
  await storeSecurityEvent(entry({ userId: quiet }));
  const flagged = await accountsWithFailedLogins(new Date(Date.now() - 24 * 3600 * 1000));
  expect(flagged.find((f) => f.userId === quiet)).toBeUndefined();
  await prisma.securityEvent.deleteMany({ where: { userId: quiet } });
});

test('purges rows older than 30 days and keeps recent ones', async () => {
  if (!dbUp) return;
  const old = await prisma.securityEvent.create({
    data: { event: 'RATE_LIMITED', route: '/x', userId, createdAt: new Date(Date.now() - 31 * 86400000) },
  });
  const recent = await prisma.securityEvent.create({ data: { event: 'RATE_LIMITED', route: '/x', userId } });
  await purgeOldSecurityEvents();
  expect(await prisma.securityEvent.findUnique({ where: { id: old.id } })).toBeNull();
  expect(await prisma.securityEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();
});

test('a failed write never throws out of storeSecurityEvent', async () => {
  await expect(storeSecurityEvent({ event: null })).resolves.toBeUndefined();
});
