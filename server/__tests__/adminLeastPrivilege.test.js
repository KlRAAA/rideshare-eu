require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeSuperAdminUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

// Superadmin spec D6, D7, D8, D11 and A1, A2, A3, A5: regular admins moderate;
// only the superadmin manages admins and sees who a data release was about.

let server;
let base;
let dbUp = false;
const bag = newBag();
let sa;
let admin;
let user;

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
  sa = await makeSuperAdminUser(bag, { fullName: 'Super Admin' });
  admin = await makeAdminUser(bag, { fullName: 'Plain Admin' });
  user = await makeUser(bag, { fullName: 'Some Rider' });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.user.updateMany({ where: { id: { in: bag.userIds } }, data: { isSuperAdmin: false } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[adminLeastPrivilege.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

test('A1: an admin cannot promote or demote; the superadmin can', async () => {
  if (guard()) return;
  const target = await makeUser(bag);
  const refused = await call('POST', `/api/admin/users/${target.id}/promote`, admin.id);
  expect(refused.status).toBe(403);
  expect((await refused.json()).error).toBe('SUPERADMIN_ONLY');
  expect((await call('POST', `/api/admin/users/${target.id}/promote`, sa.id)).status).toBe(200);
  expect((await call('POST', `/api/admin/users/${target.id}/demote`, admin.id)).status).toBe(403);
  expect((await call('POST', `/api/admin/users/${target.id}/demote`, sa.id)).status).toBe(200);
});

test('A2: nobody can ban the superadmin', async () => {
  if (guard()) return;
  const res = await call('POST', `/api/admin/users/${sa.id}/ban`, admin.id, { duration: '24H', reason: 'SPAM' });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('TARGET_IS_SUPERADMIN');
});

test('A3: the admin user page shows open hosted trips only', async () => {
  if (guard()) return;
  const vehicle = await makeVehicle(bag, user.id);
  const open = await makeTrip(bag, user.id, vehicle.id, { status: 'OPEN' });
  const done = await makeTrip(bag, user.id, vehicle.id, { status: 'COMPLETED' });
  const body = await (await call('GET', `/api/admin/users/${user.id}`, admin.id)).json();
  const ids = body.hostedTrips.map((t) => t.id);
  expect(ids).toContain(open.id);
  expect(ids).not.toContain(done.id);
  expect(body).not.toHaveProperty('joinedMatches');
  expect(body.user.isSuperAdmin).toBe(false);
});

test('A5: admins see that a release happened but not who it was about', async () => {
  if (guard()) return;
  await prisma.adminAction.create({
    data: {
      actorId: sa.id,
      action: 'DATA_RELEASED',
      targetUserId: user.id,
      details: { dataRequestId: 'x', agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' },
    },
  });
  const find = async (viewer) =>
    (await (await call('GET', '/api/admin/actions', viewer.id)).json()).actions.find(
      (a) => a.action === 'DATA_RELEASED' && a.actorId === sa.id
    );
  expect(await find(admin)).toMatchObject({
    targetUserId: null,
    targetUserName: null,
    details: { agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' },
  });
  expect((await find(admin)).details).not.toHaveProperty('dataRequestId');
  expect((await find(sa)).targetUserId).toBe(user.id);
  const overview = await (await call('GET', '/api/admin/overview', admin.id)).json();
  expect(JSON.stringify(overview.recentActions)).not.toContain(user.id);
});
