require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { averageRidesPerDay } = require('../controllers/admin/overviewController');
const { newBag, makeAdminUser, makeSuperAdminUser, cleanup } = require('../test-helpers/seed');

// The redesigned admin console: sidebar badge counts and the overview's
// urgent-report count and 7-day ride average. Counts are global in the shared
// test database, so these check shape and permissions, not exact totals.

let server;
let base;
let dbUp = false;
const bag = newBag();
let admin;
let sa;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (!dbUp) return;
  admin = await makeAdminUser(bag);
  sa = await makeSuperAdminUser(bag);
});

afterAll(async () => {
  if (dbUp) {
    await prisma.user.updateMany({ where: { id: { in: bag.userIds } }, data: { isSuperAdmin: false } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const get = (path, userId) => fetch(`${base}${path}`, { headers: bearer(userId) });

describe('averageRidesPerDay', () => {
  const day = (d) => `2026-10-0${d}`;
  test('averages rides over the given days, rounded to one decimal', () => {
    const trips = [
      { departureTime: new Date('2026-10-01T23:00:00Z'), recurrenceType: 'ONE_TIME', customDays: [] }, // Oct 2 PH
      { departureTime: new Date('2026-09-01T23:00:00Z'), recurrenceType: 'DAILY', customDays: [] }, // every day
    ];
    // Oct 1..7: the daily trip runs 7 times, the one-time trip once → 8 rides / 7 days.
    expect(averageRidesPerDay(trips, [1, 2, 3, 4, 5, 6, 7].map(day))).toBe(1.1);
  });

  test('no days → 0', () => {
    expect(averageRidesPerDay([], [])).toBe(0);
  });
});

describe('GET /api/admin/nav-counts', () => {
  test('admins get the queue counts; only the superadmin gets overdue paperwork', async () => {
    if (guard()) return;
    const forAdmin = await (await get('/api/admin/nav-counts', admin.id)).json();
    expect(forAdmin).toEqual({
      openReports: expect.any(Number),
      openTickets: expect.any(Number),
      pendingLicenses: expect.any(Number),
      overdueDataPaperwork: null,
    });
    const forSa = await (await get('/api/admin/nav-counts', sa.id)).json();
    expect(forSa.overdueDataPaperwork).toEqual(expect.any(Number));
  });

  test('non-admins are refused', async () => {
    if (guard()) return;
    expect((await get('/api/admin/nav-counts', 'not-an-admin')).status).toBe(403);
  });
});

describe('GET /api/admin/overview additions', () => {
  test('includes urgent reports and the 7-day ride average', async () => {
    if (guard()) return;
    const body = await (await get('/api/admin/overview', admin.id)).json();
    expect(body.queues.highAlertReports).toEqual(expect.any(Number));
    expect(body.queues.highAlertReports).toBeLessThanOrEqual(body.queues.openReports);
    expect(body.today.ridesAvg7d).toEqual(expect.any(Number));
  });
});
