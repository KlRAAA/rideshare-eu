require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');

// Nobody can drive one trip and ride another at the same time (sub-project C):
// joining, approving, posting and schedule edits that clash → 409 SCHEDULE_CONFLICT.

let server;
let base;
let dbUp = false;
const bag = newBag();
const req = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Philippine wall-clock time, two days from now.
const DAY = new Date(phDateOnly(new Date()).getTime() + 2 * 86400000);
const at = (hh, mm = 0) => new Date(DAY.getTime() + ((hh - 8) * 60 + mm) * 60000);

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
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

async function driverWithTrip(hh, mm = 0) {
  const driver = await makeUser(bag, { fullName: 'Clash Driver' });
  const vehicle = await makeVehicle(bag, driver.id);
  const trip = await makeTrip(bag, driver.id, vehicle.id, { departureTime: at(hh, mm), durationSeconds: 1800 });
  return { driver, vehicle, trip };
}

const tripBody = (vehicleId, departure) => ({
  vehicleId,
  originAddress: 'A',
  originLat: 13.9,
  originLng: 121.6,
  destinationAddress: 'B',
  destinationLat: 13.95,
  destinationLng: 121.62,
  departureTime: departure.toISOString(),
  recurrenceType: 'ONE_TIME',
  customDays: [],
  totalSeats: 3,
  genderPreference: 'ANY',
  flexibleDeparture: false,
  flexWindowMinutes: 15,
  familiarRidersOnly: false,
  durationSeconds: 1800,
});

describe('joining', () => {
  test('a driver cannot join a ride that overlaps their own trip, but can join one later that day', async () => {
    if (guard()) return;
    const { driver, trip: mine } = await driverWithTrip(7);
    const { trip: clashing } = await driverWithTrip(7, 15);
    const { trip: later } = await driverWithTrip(9);

    const res = await req('POST', '/api/matches', driver.id, { tripId: clashing.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'SCHEDULE_CONFLICT', conflictTripId: mine.id });
    const joined = await req('POST', '/api/matches', driver.id, { tripId: later.id });
    expect(joined.status).toBe(201);
    bag.matchIds.push((await joined.json()).match.id);
  });
});

describe('posting and editing', () => {
  test('a rider cannot post a trip that overlaps a ride they asked to join', async () => {
    if (guard()) return;
    const { trip: ride } = await driverWithTrip(7);
    const rider = await makeUser(bag, { fullName: 'Clash Rider' });
    const vehicle = await makeVehicle(bag, rider.id);
    await makeMatch(bag, ride.id, rider.id, { status: 'PENDING' });

    const clash = await req('POST', '/api/trips', rider.id, tripBody(vehicle.id, at(7, 15)));
    expect(clash.status).toBe(409);
    expect((await clash.json()).conflictTripId).toBe(ride.id);

    const ok = await req('POST', '/api/trips', rider.id, tripBody(vehicle.id, at(10)));
    expect(ok.status).toBe(201);
    const posted = (await ok.json()).trip;
    bag.tripIds.push(posted.id);

    const edit = await req('PATCH', `/api/trips/${posted.id}`, rider.id, { departureTime: at(7, 10).toISOString() });
    expect(edit.status).toBe(409);
    expect((await prisma.trip.findUnique({ where: { id: posted.id } })).departureTime).toEqual(at(10));
  });
});

describe('approving', () => {
  test('a host cannot approve a rider who now drives at the same time', async () => {
    if (guard()) return;
    const { driver: host, trip } = await driverWithTrip(8);
    const rider = await makeUser(bag, { fullName: 'Busy Rider' });
    const match = await makeMatch(bag, trip.id, rider.id, { status: 'PENDING' });
    const riderCar = await makeVehicle(bag, rider.id);
    await makeTrip(bag, rider.id, riderCar.id, { departureTime: at(8, 10), durationSeconds: 1800 });

    const res = await req('PATCH', `/api/matches/${match.id}`, host.id, { status: 'APPROVED' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('SCHEDULE_CONFLICT');
    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('PENDING');
  });
});
