require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');
const { importSavedVehicles } = require('../scripts/importSavedVehicles');

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
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const CAR = { make: 'Toyota', model: 'Vios', color: 'White', plate: 'ABC 1234', fuelEfficiencyKmL: 14 };

describe('saved vehicles', () => {
  test('the first car becomes the default; the list puts the default first', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    expect((await (await call('GET', '/api/saved-vehicles', user.id)).json()).vehicles).toEqual([]);

    const first = await call('POST', '/api/saved-vehicles', user.id, CAR);
    expect(first.status).toBe(201);
    expect((await first.json()).vehicle).toMatchObject({ ...CAR, isDefault: true, ownerId: user.id });

    const second = await (await call('POST', '/api/saved-vehicles', user.id, { ...CAR, model: 'Wigo', plate: '' })).json();
    expect(second.vehicle).toMatchObject({ model: 'Wigo', plate: null, isDefault: false });

    const { vehicles } = await (await call('GET', '/api/saved-vehicles', user.id)).json();
    expect(vehicles.map((v) => v.model)).toEqual(['Vios', 'Wigo']);
  });

  test.each([
    [{ ...CAR, make: '' }, 'make'],
    [{ ...CAR, color: undefined }, 'color'],
    [{ ...CAR, model: 'x'.repeat(41) }, 'model'],
    [{ ...CAR, fuelEfficiencyKmL: 2.9 }, 'fuelEfficiencyKmL'],
    [{ ...CAR, fuelEfficiencyKmL: 50.1 }, 'fuelEfficiencyKmL'],
    [{ ...CAR, plate: 'x'.repeat(16) }, 'plate'],
  ])('rejects %p → 400 INVALID_VEHICLE on %s', async (body, field) => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('POST', '/api/saved-vehicles', user.id, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_VEHICLE', field });
  });

  test('a non-numeric fuel efficiency is stopped by the body schema → 400 INVALID_FIELD_TYPE', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('POST', '/api/saved-vehicles', user.id, { ...CAR, fuelEfficiencyKmL: 'abc' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_FIELD_TYPE', field: 'fuelEfficiencyKmL' });
  });

  test('allows at most 5 saved cars', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    for (let i = 0; i < 5; i++) {
      expect((await call('POST', '/api/saved-vehicles', user.id, { ...CAR, model: `M${i}` })).status).toBe(201);
    }
    const sixth = await call('POST', '/api/saved-vehicles', user.id, CAR);
    expect(sixth.status).toBe(409);
    expect((await sixth.json()).error).toBe('SAVED_VEHICLE_LIMIT');
  });

  test('edit, set default and delete are owner-only', async () => {
    if (guard()) return;
    const owner = await makeUser(bag);
    const other = await makeUser(bag);
    const { vehicle } = await (await call('POST', '/api/saved-vehicles', owner.id, CAR)).json();

    for (const [method, path, body] of [
      ['PATCH', `/api/saved-vehicles/${vehicle.id}`, { color: 'Red' }],
      ['POST', `/api/saved-vehicles/${vehicle.id}/default`, undefined],
      ['DELETE', `/api/saved-vehicles/${vehicle.id}`, undefined],
    ]) {
      const res = await call(method, path, other.id, body);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('NOT_AUTHORIZED');
    }
    expect((await call('PATCH', '/api/saved-vehicles/nope', owner.id, { color: 'Red' })).status).toBe(404);

    const edited = await call('PATCH', `/api/saved-vehicles/${vehicle.id}`, owner.id, { color: 'Red', fuelEfficiencyKmL: 12 });
    expect(edited.status).toBe(200);
    expect((await edited.json()).vehicle).toMatchObject({ color: 'Red', fuelEfficiencyKmL: 12, make: 'Toyota' });

    const badEdit = await call('PATCH', `/api/saved-vehicles/${vehicle.id}`, owner.id, { fuelEfficiencyKmL: 99 });
    expect(badEdit.status).toBe(400);
  });

  test('setting a default clears the old one; deleting the default promotes the newest remaining car', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const a = (await (await call('POST', '/api/saved-vehicles', user.id, { ...CAR, model: 'A' })).json()).vehicle;
    const b = (await (await call('POST', '/api/saved-vehicles', user.id, { ...CAR, model: 'B' })).json()).vehicle;
    const c = (await (await call('POST', '/api/saved-vehicles', user.id, { ...CAR, model: 'C' })).json()).vehicle;

    expect((await call('POST', `/api/saved-vehicles/${b.id}/default`, user.id)).status).toBe(200);
    let { vehicles } = await (await call('GET', '/api/saved-vehicles', user.id)).json();
    expect(vehicles.filter((v) => v.isDefault).map((v) => v.id)).toEqual([b.id]);

    expect((await call('DELETE', `/api/saved-vehicles/${b.id}`, user.id)).status).toBe(200);
    ({ vehicles } = await (await call('GET', '/api/saved-vehicles', user.id)).json());
    expect(vehicles.map((v) => v.id)).toEqual([c.id, a.id]);
    expect(vehicles[0].isDefault).toBe(true);
  });
});

describe('POST /api/vehicles validation', () => {
  test('rejects an out-of-range fuel efficiency', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('POST', '/api/vehicles', user.id, { ...CAR, fuelEfficiencyKmL: 0 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_VEHICLE', field: 'fuelEfficiencyKmL' });
  });
});

describe('import-saved-cars script', () => {
  test('saves each host’s most recently used car as the default, once', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const older = await makeVehicle(bag, host.id);
    const newer = await prisma.vehicle.create({
      data: { ownerId: host.id, make: 'Honda', model: 'City', color: 'Gray', plate: 'NEW 123', fuelEfficiencyKmL: 16 },
    });
    bag.vehicleIds.push(newer.id);
    await makeTrip(bag, host.id, older.id, { departureTime: new Date('2026-09-01T00:00:00Z') });
    await makeTrip(bag, host.id, newer.id, { departureTime: new Date('2026-09-02T00:00:00Z') });

    const alreadySaved = await makeUser(bag);
    const theirCar = await makeVehicle(bag, alreadySaved.id);
    await makeTrip(bag, alreadySaved.id, theirCar.id);
    await prisma.savedVehicle.create({ data: { ownerId: alreadySaved.id, ...CAR, isDefault: true } });

    await importSavedVehicles({ ownerIds: [host.id, alreadySaved.id] });
    await importSavedVehicles({ ownerIds: [host.id, alreadySaved.id] });

    const hostCars = await prisma.savedVehicle.findMany({ where: { ownerId: host.id } });
    expect(hostCars).toHaveLength(1);
    expect(hostCars[0]).toMatchObject({ make: 'Honda', model: 'City', plate: 'NEW 123', isDefault: true });
    expect(await prisma.savedVehicle.count({ where: { ownerId: alreadySaved.id } })).toBe(1);
  });
});
