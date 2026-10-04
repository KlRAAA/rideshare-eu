require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { buildWatchlist, PASSENGER_CANCEL_MIN } = require('../services/watchlistService');

let server;
let base;
let dbUp = false;
const bag = newBag();
const ORIGINAL_ERRORS_URL = process.env.ADMIN_ERRORS_URL;

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
  if (ORIGINAL_ERRORS_URL === undefined) delete process.env.ADMIN_ERRORS_URL;
  else process.env.ADMIN_ERRORS_URL = ORIGINAL_ERRORS_URL;
  if (dbUp) {
    await prisma.adminAction.deleteMany({ where: { targetTripId: { in: bag.tripIds } } });
    await cleanup(bag);
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const get = (path, userId) => fetch(`${base}${path}`, { headers: bearer(userId) }).then((r) => r.json());
const since30 = () => new Date(Date.now() - 30 * 86400000);
const recent = () => new Date(Date.now() - 2 * 86400000);

// A trip hosted by `host`, open by default.
async function trip(host, over = {}) {
  return makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id, over);
}

describe('watch list', () => {
  test(`a passenger who cancels ${PASSENGER_CANCEL_MIN} approved rides is flagged with the reason`, async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const rider = await makeUser(bag, { fullName: 'Flaky Rider' });
    for (let i = 0; i < PASSENGER_CANCEL_MIN; i++) {
      const t = await trip(host);
      await makeMatch(bag, t.id, rider.id, { status: 'CANCELLED', respondedAt: recent() });
    }
    const flagged = (await buildWatchlist(since30())).find((u) => u.userId === rider.id);
    expect(flagged).toMatchObject({ fullName: 'Flaky Rider' });
    expect(flagged.reasons).toContain(`${PASSENGER_CANCEL_MIN} rides cancelled after approval (as passenger)`);
  });

  test('withdrawing pending requests is not counted', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const rider = await makeUser(bag);
    for (let i = 0; i < PASSENGER_CANCEL_MIN; i++) {
      const t = await trip(host);
      await makeMatch(bag, t.id, rider.id, { status: 'CANCELLED', respondedAt: null });
    }
    expect((await buildWatchlist(since30())).find((u) => u.userId === rider.id)).toBeUndefined();
  });

  test('a host who cancels 2 trips with approved riders is flagged; admin cancellations don’t count', async () => {
    if (guard()) return;
    const rider = await makeUser(bag);
    const host = await makeUser(bag);
    for (let i = 0; i < 2; i++) {
      const t = await trip(host, { status: 'CANCELLED', cancelledAt: recent() });
      await makeMatch(bag, t.id, rider.id, { status: 'CANCELLED', respondedAt: recent() });
    }
    const hostFlag = (await buildWatchlist(since30())).find((u) => u.userId === host.id);
    expect(hostFlag.reasons).toContain('2 trips cancelled after riders were approved');

    const admin = await makeAdminUser(bag);
    const otherHost = await makeUser(bag);
    for (let i = 0; i < 2; i++) {
      const t = await trip(otherHost, { status: 'CANCELLED', cancelledAt: recent() });
      await makeMatch(bag, t.id, rider.id, { status: 'CANCELLED', respondedAt: recent() });
      await prisma.adminAction.create({ data: { actorId: admin.id, action: 'TRIP_CANCELLED', targetTripId: t.id, targetUserId: otherHost.id } });
    }
    expect((await buildWatchlist(since30())).find((u) => u.userId === otherHost.id)).toBeUndefined();
  });

  test('2 reports received flag a user', async () => {
    if (guard()) return;
    const target = await makeUser(bag);
    for (let i = 0; i < 2; i++) {
      const reporter = await makeUser(bag);
      await prisma.report.create({ data: { reporterId: reporter.id, reportedUserId: target.id, category: 'OTHER' } });
    }
    const flag = (await buildWatchlist(since30())).find((u) => u.userId === target.id);
    expect(flag.reasons).toContain('2 reports received');
  });
});

describe('admin overview monitoring', () => {
  test('queues show the oldest open report and ticket; today and security sections exist', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    await fetch(`${base}/api/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(user.id) },
      body: JSON.stringify({ category: 'SAFETY', subject: 'Help', body: 'Something happened.' }),
    });

    const data = await get('/api/admin/overview', admin.id);
    const oldestReport = await prisma.report.findFirst({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' } });
    expect(data.queues.oldestReportAt).toBe(oldestReport ? oldestReport.createdAt.toISOString() : null);
    expect(data.queues.openTickets).toBeGreaterThanOrEqual(1);
    expect(data.queues.safetyTickets).toBeGreaterThanOrEqual(1);
    expect(data.queues.oldestTicketAt).toEqual(expect.any(String));
    expect(data.today).toEqual({ ridesToday: expect.any(Number), newUsers24h: expect.any(Number), activeBans: expect.any(Number) });
    expect(data.security.counts).toHaveProperty('LOGIN_FAILED');
    expect(typeof data.watchlistCount).toBe('number');
  });

  test('accounts with 5 failed sign-ins appear under security, with their name', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag, { fullName: 'Guessed Account' });
    await prisma.securityEvent.createMany({
      data: Array.from({ length: 5 }, () => ({ event: 'LOGIN_FAILED', reason: 'WRONG_PASSWORD', userId: target.id, route: '/api/auth/verify' })),
    });
    const data = await get('/api/admin/overview', admin.id);
    expect(data.security.flaggedAccounts).toEqual(
      expect.arrayContaining([{ userId: target.id, fullName: 'Guessed Account', count: 5 }])
    );
  });

  test('the error-reports link is hidden unless configured', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    delete process.env.ADMIN_ERRORS_URL;
    expect((await get('/api/admin/overview', admin.id)).errorsUrl).toBeNull();
    process.env.ADMIN_ERRORS_URL = 'https://sentry.example/issues';
    expect((await get('/api/admin/overview', admin.id)).errorsUrl).toBe('https://sentry.example/issues');
  });

  test('the watch list route returns flagged users', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { users } = await get('/api/admin/watchlist', admin.id);
    expect(Array.isArray(users)).toBe(true);
  });

  test('user detail includes their support tickets and 30-day security counts', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    await prisma.supportTicket.create({ data: { userId: user.id, category: 'ACCOUNT', subject: 'Locked out' } });
    await prisma.securityEvent.create({ data: { event: 'OTP_LOCKED', userId: user.id, route: '/api/auth/register/verify-otp' } });
    const detail = await get(`/api/admin/users/${user.id}`, admin.id);
    expect(detail.supportTickets).toEqual([expect.objectContaining({ subject: 'Locked out', status: 'OPEN' })]);
    expect(detail.securityCounts30d.OTP_LOCKED).toBe(1);
  });
});
