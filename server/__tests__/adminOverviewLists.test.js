require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeSuperAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// GET /api/admin/overview/:kind — the lists behind the "Platform today" tiles.

let server;
let base;
let dbUp = false;
const bag = newBag();
const get = (path, userId) => fetch(`${base}${path}`, { headers: bearer(userId) });

beforeAll(async () => {
  try { await prisma.$queryRawUnsafe('SELECT 1'); dbUp = true; } catch { /* stays false */ }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  if (dbUp) {
    await prisma.adminAction.deleteMany({ where: { actorId: { in: bag.userIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

async function tripWithRider() {
  const driver = await makeUser(bag, { fullName: 'List Driver' });
  const rider = await makeUser(bag, { fullName: 'List Rider' });
  const vehicle = await makeVehicle(bag, driver.id);
  const trip = await makeTrip(bag, driver.id, vehicle.id, { filledSeats: 1 });
  await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  return { driver, rider, trip };
}

describe('overview lists', () => {
  test('an unknown list is 404; a regular user is refused', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    expect((await get('/api/admin/overview/everything', admin.id)).status).toBe(404);
    const user = await makeUser(bag);
    expect((await get('/api/admin/overview/open-trips', user.id)).status).toBe(403);
  });

  // Totals aren't compared with a separate /overview call: other test files add
  // and remove trips in parallel. The lists use the same filters as the counts.
  test('open trips: a regular admin sees host and seats, not riders', async () => {
    if (guard()) return;
    const { driver, trip } = await tripWithRider();
    const admin = await makeAdminUser(bag);
    const list = await (await get('/api/admin/overview/open-trips', admin.id)).json();
    expect(list.total).toBeGreaterThanOrEqual(list.trips.length);
    expect(list.ridersShown).toBe(false);
    const row = list.trips.find((t) => t.id === trip.id);
    expect(row).toMatchObject({ hostId: driver.id, hostName: 'List Driver', filledSeats: 1, totalSeats: 3 });
    expect(row).not.toHaveProperty('riders');
  });

  test('the superadmin sees who rides, and that look is in the audit log', async () => {
    if (guard()) return;
    const { rider, trip } = await tripWithRider();
    const superadmin = await makeSuperAdminUser(bag);
    const list = await (await get('/api/admin/overview/open-trips', superadmin.id)).json();
    expect(list.trips.find((t) => t.id === trip.id).riders).toEqual([{ id: rider.id, fullName: 'List Rider' }]);
    const logged = await prisma.adminAction.findFirst({ where: { actorId: superadmin.id, action: 'DATA_RELEASE_VIEWED' } });
    expect(logged.details).toMatchObject({ source: 'overview', list: 'open-trips' });
  });

  test('sign-ups and bans list people', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const banned = await makeUser(bag, { fullName: 'Banned Person' });
    await prisma.user.update({ where: { id: banned.id }, data: { bannedUntil: new Date(Date.now() + 86400000), banReason: 'OTHER' } });
    const bans = await (await get('/api/admin/overview/active-bans', admin.id)).json();
    expect(bans.users.map((u) => u.id)).toContain(banned.id);
    expect(bans.users.map((u) => u.id)).not.toContain(admin.id);
    const signups = await (await get('/api/admin/overview/signups', admin.id)).json();
    expect(signups.users.map((u) => u.id)).toContain(banned.id);
  });
});
