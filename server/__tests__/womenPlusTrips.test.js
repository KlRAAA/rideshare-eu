require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { encryptField } = require('../services/encryptionService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

jest.mock('../services/fuelPriceService', () => ({
  ...jest.requireActual('../services/fuelPriceService'),
  getOfficialFuelPrice: jest.fn().mockResolvedValue(null),
}));

// Women+ spec §5, D3, D5 and S2, S12–S15, S18, S23: who may post a Women+
// trip, when "who can join" may change, and who may open a Women+ trip.

let server;
let base;
let dbUp = false;
const bag = newBag();

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const tripBody = (vehicleId, over = {}) => ({
  vehicleId,
  originAddress: 'A',
  originLat: 13.9,
  originLng: 121.6,
  destinationAddress: 'B',
  destinationLat: 13.95,
  destinationLng: 121.62,
  departureTime: new Date(Date.now() + 2 * 86400000).toISOString(),
  recurrenceType: 'ONE_TIME',
  customDays: [],
  totalSeats: 3,
  genderPreference: 'ANY',
  flexibleDeparture: false,
  flexWindowMinutes: 15,
  familiarRidersOnly: false,
  ...over,
});

async function hostWithCar(gender) {
  const user = await makeUser(bag, { fullName: `${gender} Host`, gender });
  const vehicle = await makeVehicle(bag, user.id);
  return { user, vehicle };
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
    // Trips posted through the API aren't in the bag; clear them by host.
    const posted = await prisma.trip.findMany({ where: { hostId: { in: bag.userIds } }, select: { id: true } });
    const ids = posted.map((t) => t.id);
    await prisma.notification.deleteMany({ where: { relatedTripId: { in: ids } } });
    await prisma.match.deleteMany({ where: { tripId: { in: ids } } });
    await prisma.trip.deleteMany({ where: { id: { in: ids } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[womenPlusTrips.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('posting a trip', () => {
  test('S12: a man cannot post a Women+ trip', async () => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('MAN');
    const res = await call('POST', '/api/trips', user.id, tripBody(vehicle.id, { genderPreference: 'WOMEN_PLUS' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('WOMEN_PLUS_HOST_NOT_ELIGIBLE');
    expect(await prisma.trip.count({ where: { hostId: user.id } })).toBe(0);
  });

  test.each(['WOMAN', 'NON_BINARY'])('a %s host can post a Women+ trip', async (gender) => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar(gender);
    const res = await call('POST', '/api/trips', user.id, tripBody(vehicle.id, { genderPreference: 'WOMEN_PLUS' }));
    expect(res.status).toBe(201);
    expect((await res.json()).trip.genderPreference).toBe('WOMEN_PLUS');
  });

  test('S23: the retired SAME_GENDER value is rejected', async () => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('WOMAN');
    const res = await call('POST', '/api/trips', user.id, tripBody(vehicle.id, { genderPreference: 'SAME_GENDER' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_TRIP', field: 'genderPreference' });
  });
});

describe('changing who can join', () => {
  test('S12: a man cannot switch his trip to Women+', async () => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('MAN');
    const trip = await makeTrip(bag, user.id, vehicle.id);
    const res = await call('PATCH', `/api/trips/${trip.id}`, user.id, { genderPreference: 'WOMEN_PLUS' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('WOMEN_PLUS_HOST_NOT_ELIGIBLE');
  });

  test('S13: switching to Women+ declines pending riders who are not eligible', async () => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('WOMAN');
    const trip = await makeTrip(bag, user.id, vehicle.id, { destinationAddress: 'Enverga University' });
    const man = await makeUser(bag, { gender: 'MAN' });
    const nonBinary = await makeUser(bag, { gender: 'NON_BINARY' });
    const manMatch = await makeMatch(bag, trip.id, man.id);
    const nbMatch = await makeMatch(bag, trip.id, nonBinary.id);

    const res = await call('PATCH', `/api/trips/${trip.id}`, user.id, { genderPreference: 'WOMEN_PLUS' });
    expect(res.status).toBe(200);

    expect((await prisma.match.findUnique({ where: { id: manMatch.id } })).status).toBe('DECLINED');
    expect((await prisma.match.findUnique({ where: { id: nbMatch.id } })).status).toBe('PENDING');
    const note = await prisma.notification.findFirst({ where: { userId: man.id, relatedMatchId: manMatch.id } });
    expect(note.type).toBe('APPROVAL');
    expect(note.message).toBe('Your request to join the trip to Enverga University was declined.');
  });

  test.each([
    ['ANY', 'WOMEN_PLUS'],
    ['WOMEN_PLUS', 'ANY'],
  ])('S14: %s → %s is locked once a rider is approved', async (from, to) => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('WOMAN');
    const trip = await makeTrip(bag, user.id, vehicle.id, { genderPreference: from, filledSeats: 1 });
    const rider = await makeUser(bag, { gender: 'WOMAN' });
    await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });

    const res = await call('PATCH', `/api/trips/${trip.id}`, user.id, { genderPreference: to, confirmStructural: true });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('WHO_CAN_JOIN_LOCKED');
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).genderPreference).toBe(from);
  });

  test('S15: Women+ → Anyone is allowed with no approved riders', async () => {
    if (guard()) return;
    const { user, vehicle } = await hostWithCar('WOMAN');
    const trip = await makeTrip(bag, user.id, vehicle.id, { genderPreference: 'WOMEN_PLUS' });
    const res = await call('PATCH', `/api/trips/${trip.id}`, user.id, { genderPreference: 'ANY' });
    expect(res.status).toBe(200);
    expect((await res.json()).trip.genderPreference).toBe('ANY');
  });
});

describe('opening a Women+ trip', () => {
  let host;
  let trip;

  beforeAll(async () => {
    if (!dbUp) return;
    const h = await hostWithCar('WOMAN');
    host = h.user;
    trip = await makeTrip(bag, host.id, h.vehicle.id, { genderPreference: 'WOMEN_PLUS' });
  });

  test('S2: a man gets the same 404 as for a missing trip', async () => {
    if (guard()) return;
    const man = await makeUser(bag, { gender: 'MAN' });
    const res = await call('GET', `/api/trips/${trip.id}`, man.id);
    expect(res.status).toBe(404);
    const missing = await call('GET', '/api/trips/does-not-exist', man.id);
    expect(await res.json()).toEqual(await missing.json());
  });

  test('a woman who is not on the trip can open it', async () => {
    if (guard()) return;
    const woman = await makeUser(bag, { gender: 'WOMAN' });
    expect((await call('GET', `/api/trips/${trip.id}`, woman.id)).status).toBe(200);
  });

  test('the host can open it', async () => {
    if (guard()) return;
    expect((await call('GET', `/api/trips/${trip.id}`, host.id)).status).toBe(200);
  });

  test('S18: an approved rider keeps access after changing gender', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { gender: 'WOMAN' });
    await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
    await prisma.user.update({ where: { id: rider.id }, data: { gender: encryptField('MAN') } });
    expect((await call('GET', `/api/trips/${trip.id}`, rider.id)).status).toBe(200);
  });
});
