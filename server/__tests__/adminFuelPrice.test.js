require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, cleanup } = require('../test-helpers/seed');
const fs = require('fs');
const path = require('path');
const { setDoeSource, DOE_SOUTH_LUZON_URL } = require('../services/doeFuelService');

let server;
let base;
let dbUp = false;
const bag = newBag();
// Above any real pump price, so a price already in the dev DB can't interfere.
const DIESEL_PRICE = 140;
const REGULAR_PRICE = 149;
const startedAt = new Date();

// A fake DOE: the page lists the given files; every file reads as the real
// Sep 29 – Oct 5 Region IV-A report (Lucena: Regular 91.16, Premium 96.86,
// Diesel 98.13), with a test period so its audit entries can be cleaned up.
const DOE_TEST_PREFIX = `https://doe.test/${Date.now()}/`;
const DOE_TEST_PERIOD = `Test Week ${Date.now()}`;
const REPORT = fs
  .readFileSync(path.join(__dirname, '../test-helpers/fixtures/doe-region-iv-a-2026-09-29.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => (line.includes('PERIOD OF') ? ['(FOR THE PERIOD OF', `${DOE_TEST_PERIOD})`] : line.split(' | ')));
let fileNumber = 0;
function useFakeDoe({ lines = REPORT, down = false } = {}) {
  const url = `${DOE_TEST_PREFIX}${++fileNumber}.pdf`;
  const page = `<p>2026</p><ul><li>October 6 to 12</li><li><a href="${url}">Region IV - A Calabarzon</a></li></ul>`;
  setDoeSource({
    fetch: async (u) => {
      if (down) throw new Error('getaddrinfo ENOTFOUND');
      return new Response(u === DOE_SOUTH_LUZON_URL ? page : 'pdf bytes');
    },
    readPdf: async () => lines,
  });
  return url;
}

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
    // DOE files read by the tests below, the prices and audit entries they made,
    // and the notifications they sent every admin.
    const imports = await prisma.doeFuelImport.findMany({ where: { key: { startsWith: DOE_TEST_PREFIX } }, select: { id: true } });
    await prisma.fuelPrice.deleteMany({ where: { importId: { in: imports.map((i) => i.id) } } });
    await prisma.doeFuelImport.deleteMany({ where: { key: { startsWith: DOE_TEST_PREFIX } } });
    await prisma.adminAction.deleteMany({ where: { details: { path: ['period'], equals: DOE_TEST_PERIOD } } });
    await prisma.notification.deleteMany({ where: { type: 'FUEL_PRICE_CHECK', createdAt: { gte: startedAt } } });
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

// Official prices from the DOE's weekly Region IV-A file (Lucena's highest price).
describe('automatic DOE fuel prices', () => {
  const setPrices = async (adminId, regular, premium, diesel) => {
    for (const [fuelType, pricePerLiter] of [['REGULAR', regular], ['PREMIUM', premium], ['DIESEL', diesel]]) {
      expect((await call('PUT', '/api/admin/fuel-price', adminId, { fuelType, pricePerLiter })).status).toBe(200);
    }
  };
  const official = async (userId) => (await (await call('GET', '/api/fuel-price', userId)).json()).prices;
  const checkNow = (adminId) => call('POST', '/api/admin/fuel-price/doe/check', adminId);

  test('changes of 15% or less apply on their own, once per file, with the file in history and the audit log', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    await setPrices(admin.id, 90, 95, 97);
    const url = useFakeDoe();

    const res = await checkNow(admin.id);
    expect(res.status).toBe(200);
    const { import: row, alreadyHandled } = await res.json();
    expect(alreadyHandled).toBe(false);
    expect(row).toMatchObject({ sourceUrl: url, period: DOE_TEST_PERIOD, status: 'APPLIED', regular: 91.16, premium: 96.86, diesel: 98.13 });

    const prices = await official(admin.id);
    expect([prices.REGULAR.pricePerLiter, prices.PREMIUM.pricePerLiter, prices.DIESEL.pricePerLiter]).toEqual([91.16, 96.86, 98.13]);
    const { history } = await (await call('GET', '/api/admin/fuel-price/history', admin.id)).json();
    expect(history[0]).toMatchObject({ setBy: null, doe: { period: DOE_TEST_PERIOD, sourceUrl: url } });
    const audit = await prisma.adminAction.findMany({ where: { details: { path: ['period'], equals: DOE_TEST_PERIOD } } });
    expect(audit).toHaveLength(3);
    expect(audit.every((a) => a.actorId === null && a.details.source === 'DOE')).toBe(true);

    const again = await (await checkNow(admin.id)).json();
    expect(again).toMatchObject({ alreadyHandled: true, import: { id: row.id } });
    expect(await prisma.fuelPrice.count({ where: { importId: row.id } })).toBe(3);

    const { imports } = await (await call('GET', '/api/admin/fuel-price/doe', admin.id)).json();
    expect(imports[0]).toMatchObject({ id: row.id, status: 'APPLIED' });
  });

  test('a bigger change waits for an admin, who applies it', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    // 91.16 is 17% below 110.
    await setPrices(admin.id, 110, 95, 97);
    useFakeDoe();

    const { import: row } = await (await checkNow(admin.id)).json();
    expect(row).toMatchObject({ status: 'HELD', reason: 'Regular changed by more than 15% (₱110.00 to ₱91.16).' });
    expect((await official(admin.id)).REGULAR.pricePerLiter).toBe(110);
    const note = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'FUEL_PRICE_CHECK' } });
    expect(note.message).toContain('wait for you');

    const apply = await call('POST', `/api/admin/fuel-price/doe/${row.id}/apply`, admin.id);
    expect(apply.status).toBe(200);
    expect((await apply.json()).import).toMatchObject({ status: 'APPLIED', decidedById: admin.id });
    expect((await official(admin.id)).REGULAR.pricePerLiter).toBe(91.16);
    const { history } = await (await call('GET', '/api/admin/fuel-price/history', admin.id)).json();
    expect(history[0]).toMatchObject({ setBy: { id: admin.id }, doe: { period: DOE_TEST_PERIOD } });

    const twice = await call('POST', `/api/admin/fuel-price/doe/${row.id}/apply`, admin.id);
    expect(twice.status).toBe(409);
    expect(await twice.json()).toEqual({ error: 'NOT_HELD' });
  });

  test('an admin can keep the current prices instead', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    await setPrices(admin.id, 110, 95, 97);
    useFakeDoe();
    const { import: row } = await (await checkNow(admin.id)).json();

    const keep = await call('POST', `/api/admin/fuel-price/doe/${row.id}/dismiss`, admin.id);
    expect(keep.status).toBe(200);
    expect((await keep.json()).import.status).toBe('DISMISSED');
    expect((await official(admin.id)).REGULAR.pricePerLiter).toBe(110);
    expect(await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'DOE_PRICES_DISMISSED' } })).not.toBeNull();
    expect((await call('POST', `/api/admin/fuel-price/doe/${row.id}/apply`, admin.id)).status).toBe(409);
  });

  test('a file without Lucena is recorded once and the admins are told to set prices by hand', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    useFakeDoe({ lines: REPORT.filter((cells) => cells[0] !== 'Lucena') });

    const { import: row } = await (await checkNow(admin.id)).json();
    expect(row).toMatchObject({ status: 'FAILED', reason: 'Lucena isn’t in this file.' });
    expect(await checkNow(admin.id).then((r) => r.json())).toMatchObject({ alreadyHandled: true });
    const notes = await prisma.notification.findMany({ where: { userId: admin.id, type: 'FUEL_PRICE_CHECK' } });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain('Set the official prices by hand');
  });

  test('when the DOE site is down nothing is recorded, so the next run tries again', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const url = useFakeDoe({ down: true });
    const res = await checkNow(admin.id);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'DOE_UNREACHABLE' });
    expect(await prisma.doeFuelImport.findUnique({ where: { key: url } })).toBeNull();
  });

  test('only admins can see or run it, and unknown files are 404', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const admin = await makeAdminUser(bag);
    expect((await call('GET', '/api/admin/fuel-price/doe', user.id)).status).toBe(403);
    expect((await checkNow(user.id)).status).toBe(403);
    expect((await call('POST', '/api/admin/fuel-price/doe/nope/apply', admin.id)).status).toBe(404);
    expect((await call('POST', '/api/admin/fuel-price/doe/nope/dismiss', admin.id)).status).toBe(404);
  });
});
