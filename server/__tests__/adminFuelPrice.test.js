require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
// Above any real pump price, so a price already in the dev DB can't interfere.
const DIESEL_PRICE = 140;
const REGULAR_PRICE = 149;

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

describe('official fuel prices, one per fuel type', () => {
  test('a regular user can read all three but not set any', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const read = await call('GET', '/api/fuel-price', user.id);
    expect(read.status).toBe(200);
    expect(Object.keys((await read.json()).prices).sort()).toEqual(['DIESEL', 'PREMIUM', 'REGULAR']);
    const write = await call('PUT', '/api/admin/fuel-price', user.id, { fuelType: 'DIESEL', pricePerLiter: 60 });
    expect(write.status).toBe(403);
  });

  test.each([[undefined], ['KEROSENE'], ['diesel']])('rejects fuel type %p with 400 INVALID_FUEL_TYPE', async (fuelType) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PUT', '/api/admin/fuel-price', admin.id, { fuelType, pricePerLiter: 60 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_FUEL_TYPE');
  });

  test.each([[19.99], [150.01], [undefined]])('rejects price %p with 400 INVALID_FUEL_PRICE', async (price) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PUT', '/api/admin/fuel-price', admin.id, { fuelType: 'REGULAR', pricePerLiter: price });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_FUEL_PRICE');
  });

  // A value of the wrong type never reaches the controller: the body schema stops it.
  test.each([[{ fuelType: 3, pricePerLiter: 60 }, 'fuelType'], [{ fuelType: 'REGULAR', pricePerLiter: 'abc' }, 'pricePerLiter']])(
    'rejects %p with 400 INVALID_FIELD_TYPE',
    async (body, field) => {
      if (guard()) return;
      const admin = await makeAdminUser(bag);
      const res = await call('PUT', '/api/admin/fuel-price', admin.id, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'INVALID_FIELD_TYPE', field });
    }
  );

  test('setting one type changes only that type, and shows in history and the audit log', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag, { fullName: 'Price Admin' });
    const before = (await (await call('GET', '/api/fuel-price', admin.id)).json()).prices;

    const set = await call('PUT', '/api/admin/fuel-price', admin.id, { fuelType: 'DIESEL', pricePerLiter: DIESEL_PRICE });
    expect(set.status).toBe(200);
    expect(await set.json()).toMatchObject({ fuelType: 'DIESEL', official: DIESEL_PRICE });

    const after = (await (await call('GET', '/api/fuel-price', admin.id)).json()).prices;
    expect(after.DIESEL.pricePerLiter).toBe(DIESEL_PRICE);
    expect(after.DIESEL.updatedAt).toEqual(expect.any(String));
    expect(after.REGULAR).toEqual(before.REGULAR);
    expect(after.PREMIUM).toEqual(before.PREMIUM);

    const { history } = await (await call('GET', '/api/admin/fuel-price/history', admin.id)).json();
    expect(history[0]).toMatchObject({ fuelType: 'DIESEL', pricePerLiter: DIESEL_PRICE, setBy: { id: admin.id, fullName: 'Price Admin' } });

    const audit = await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'FUEL_PRICE_SET' } });
    expect(audit.details).toMatchObject({ fuelType: 'DIESEL', to: DIESEL_PRICE });
  });

  test('a trip is capped by the official price for its car’s fuel type', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const host = await makeUser(bag);
    const dieselCar = await makeVehicle(bag, host.id, { fuelType: 'DIESEL' });
    const regularCar = await makeVehicle(bag, host.id, { fuelType: 'REGULAR' });
    await call('PUT', '/api/admin/fuel-price', admin.id, { fuelType: 'DIESEL', pricePerLiter: DIESEL_PRICE });
    await call('PUT', '/api/admin/fuel-price', admin.id, { fuelType: 'REGULAR', pricePerLiter: REGULAR_PRICE });

    const between = (DIESEL_PRICE + REGULAR_PRICE) / 2;
    const dieselAbove = await call('POST', '/api/trips', host.id, tripBody(dieselCar.id, between));
    expect(dieselAbove.status).toBe(400);
    expect(await dieselAbove.json()).toEqual({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: DIESEL_PRICE, fuelType: 'DIESEL' });

    expect((await call('POST', '/api/trips', host.id, tripBody(regularCar.id, between))).status).toBe(201);
    expect((await call('POST', '/api/trips', host.id, tripBody(dieselCar.id, DIESEL_PRICE))).status).toBe(201);

    const regularAbove = await call('POST', '/api/trips', host.id, tripBody(regularCar.id, REGULAR_PRICE + 0.5));
    expect(await regularAbove.json()).toEqual({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: REGULAR_PRICE, fuelType: 'REGULAR' });
  });
});

describe('car fuel type', () => {
  test('a car keeps the fuel type it was saved with', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const car = { make: 'Toyota', model: 'Hilux', color: 'White', fuelEfficiencyKmL: 10, fuelType: 'DIESEL' };
    const res = await call('POST', '/api/vehicles', host.id, car);
    expect(res.status).toBe(201);
    const { vehicle } = await res.json();
    bag.vehicleIds.push(vehicle.id);
    expect(vehicle.fuelType).toBe('DIESEL');

    const saved = await call('POST', '/api/saved-vehicles', host.id, { ...car, fuelType: 'PREMIUM' });
    expect((await saved.json()).vehicle.fuelType).toBe('PREMIUM');
  });

  test('a car sent without a fuel type counts as Regular, so older clients keep working', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const res = await call('POST', '/api/vehicles', host.id, { make: 'Honda', model: 'City', color: 'Red', fuelEfficiencyKmL: 14 });
    const { vehicle } = await res.json();
    bag.vehicleIds.push(vehicle.id);
    expect(vehicle.fuelType).toBe('REGULAR');
  });

  test('an unknown fuel type is rejected with the field name', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const res = await call('POST', '/api/vehicles', host.id, { make: 'Honda', model: 'City', color: 'Red', fuelEfficiencyKmL: 14, fuelType: 'LPG' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_VEHICLE', field: 'fuelType' });
  });
});
