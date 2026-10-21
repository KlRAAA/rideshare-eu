require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

// GET /api/admin/search?q= — the admin console's search box.

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
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

describe('admin search', () => {
  test('only admins can search, with at least 2 letters', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    expect((await get('/api/admin/search?q=ab', user.id)).status).toBe(403);
    const admin = await makeAdminUser(bag);
    const short = await get('/api/admin/search?q=a', admin.id);
    expect(short.status).toBe(400);
    expect((await short.json()).error).toBe('QUERY_TOO_SHORT');
  });

  test('finds a user by name and an open trip by place, never a finished trip', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const driver = await makeUser(bag, { fullName: 'Zebulon Quintero' });
    const vehicle = await makeVehicle(bag, driver.id);
    const open = await makeTrip(bag, driver.id, vehicle.id, { destinationAddress: 'Xylophone Street, Lucena' });
    const done = await makeTrip(bag, driver.id, vehicle.id, { destinationAddress: 'Xylophone Street, Lucena', status: 'COMPLETED' });

    const byName = await (await get('/api/admin/search?q=zebulon', admin.id)).json();
    expect(byName.users.map((u) => u.id)).toContain(driver.id);
    expect(byName.trips.map((t) => t.id)).toContain(open.id); // the host's name matches too

    const byPlace = await (await get('/api/admin/search?q=xylophone', admin.id)).json();
    const ids = byPlace.trips.map((t) => t.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(done.id);
    expect(byPlace.trips[0]).not.toHaveProperty('matches');
  });
});
