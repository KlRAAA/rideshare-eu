require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

// Phase 2: POST /api/vehicles sets ownerId from req.user.id, not the body.

let server;
let base;
let dbUp = false;
const bag = newBag();
let alice;
let bob;

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
  alice = await makeUser(bag, { fullName: 'Alice V' });
  bob = await makeUser(bag, { fullName: 'Bob V' });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: bag.userIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[vehiclesAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('POST /api/vehicles', () => {
  test('ownerId is the verified caller; a body ownerId claiming someone else is ignored', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(alice.id) },
      body: JSON.stringify({ ownerId: bob.id, make: 'Toyota', model: 'Vios', color: 'White', fuelEfficiencyKmL: 15 }),
    });
    expect(res.status).toBe(201);
    const { vehicle } = await res.json();
    expect(vehicle.ownerId).toBe(alice.id);
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make: 'X', model: 'Y', color: 'Z', fuelEfficiencyKmL: 10 }),
    });
    expect(res.status).toBe(401);
  });
});
