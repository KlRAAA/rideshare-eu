require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const TEST_PRICE = 149;

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
  if (dbUp) {
    const created = await prisma.trip.findMany({ where: { hostId: { in: bag.userIds } }, select: { id: true } });
    bag.tripIds.push(...created.map((t) => t.id));
    await cleanup(bag);
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

function tripBody(vehicleId, fuelPricePerLiter) {
  return {
    vehicleId,
    originAddress: 'Sariaya, Quezon',
    originLat: 13.9629837,
    originLng: 121.5243402,
    destinationAddress: 'MSEUF',
    destinationLat: 13.9490188,
    destinationLng: 121.6202904,
    departureTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    recurrenceType: 'ONE_TIME',
    customDays: [],
    totalSeats: 3,
    genderPreference: 'ANY',
    flexibleDeparture: false,
    flexWindowMinutes: 15,
    familiarRidersOnly: false,
    distanceMeters: 12500,
    durationSeconds: 1200,
    fuelPricePerLiter,
  };
}

describe('official fuel price', () => {
  test('a regular user can read it but not set it', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const read = await call('GET', '/api/fuel-price', user.id);
    expect(read.status).toBe(200);
    expect(await read.json()).toHaveProperty('official');
    const write = await call('PUT', '/api/admin/fuel-price', user.id, { pricePerLiter: 60 });
    expect(write.status).toBe(403);
  });

  test.each([[19.99], [150.01], ['abc'], [undefined]])('rejects %p with 400 INVALID_FUEL_PRICE', async (price) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PUT', '/api/admin/fuel-price', admin.id, { pricePerLiter: price });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_FUEL_PRICE');
  });

  test('an admin sets it; it becomes current, appears in history and the audit log, and caps new trips', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag, { fullName: 'Price Admin' });
    const host = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);

    const set = await call('PUT', '/api/admin/fuel-price', admin.id, { pricePerLiter: TEST_PRICE });
    expect(set.status).toBe(200);
    expect((await set.json()).official).toBe(TEST_PRICE);

    expect((await (await call('GET', '/api/fuel-price', host.id)).json()).official).toBe(TEST_PRICE);

    const { history } = await (await call('GET', '/api/admin/fuel-price/history', admin.id)).json();
    expect(history[0]).toMatchObject({ pricePerLiter: TEST_PRICE, setBy: { id: admin.id, fullName: 'Price Admin' } });

    const audit = await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'FUEL_PRICE_SET' } });
    expect(audit.details.to).toBe(TEST_PRICE);

    const above = await call('POST', '/api/trips', host.id, tripBody(vehicle.id, TEST_PRICE + 0.5));
    expect(above.status).toBe(400);
    expect(await above.json()).toEqual({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: TEST_PRICE });

    expect((await call('POST', '/api/trips', host.id, tripBody(vehicle.id, TEST_PRICE))).status).toBe(201);
    expect((await call('POST', '/api/trips', host.id, tripBody(vehicle.id, 100))).status).toBe(201);
  });
});
