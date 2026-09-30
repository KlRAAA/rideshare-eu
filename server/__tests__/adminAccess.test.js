require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();

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
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const get = (path, userId) => fetch(`${base}${path}`, { headers: userId ? bearer(userId) : {} });

describe('admin guard', () => {
  test('no token → 401', async () => {
    const res = await get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  test('a regular user → 403 ADMIN_ONLY', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await get('/api/admin/overview', user.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('ADMIN_ONLY');
  });

  test('an admin gets the overview counts and recent actions', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await get('/api/admin/overview', admin.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of ['users', 'admins', 'openTrips', 'completedTrips', 'pendingRequests', 'openReports', 'activeBans']) {
      expect(typeof body.counts[key]).toBe('number');
    }
    expect(body.counts.admins).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.recentActions)).toBe(true);
  });

  test('a demoted admin is refused on the very next request', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    expect((await get('/api/admin/overview', admin.id)).status).toBe(200);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: false } });
    expect((await get('/api/admin/overview', admin.id)).status).toBe(403);
  });
});

describe('GET /api/admin/actions', () => {
  test('pages the audit log newest first', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);
    await prisma.adminAction.create({ data: { actorId: admin.id, action: 'UNBAN', targetUserId: target.id } });
    const res = await get('/api/admin/actions', admin.id);
    expect(res.status).toBe(200);
    const { actions, nextCursor } = await res.json();
    expect(actions[0]).toMatchObject({ action: 'UNBAN', targetUserId: target.id });
    expect(actions[0].actorName).toBeTruthy();
    expect(nextCursor === null || typeof nextCursor === 'string').toBe(true);
  });
});

describe('GET /api/users/:id isAdmin visibility', () => {
  test('own record includes isAdmin; someone else’s does not', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const other = await makeUser(bag);
    const own = await (await get(`/api/users/${admin.id}`, admin.id)).json();
    expect(own.user.isAdmin).toBe(true);
    const theirs = await (await get(`/api/users/${admin.id}`, other.id)).json();
    expect(theirs.user).not.toHaveProperty('isAdmin');
  });
});
