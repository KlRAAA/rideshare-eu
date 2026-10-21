require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// "Rate your last ride first": a rider can't request the next ride, and a
// driver can't post the next trip (for 24 hours), until they've rated the
// other side of their last finished ride. 409 RATING_REQUIRED.

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

const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// A ride that leaves in 10 minutes, driven (start, end) so both sides are asked to rate.
async function finishedRide(over = {}) {
  const host = await makeUser(bag, { fullName: 'Rated Driver' });
  const rider = await makeUser(bag, { fullName: 'Rating Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, { departureTime: new Date(Date.now() + 10 * 60 * 1000), durationSeconds: 1800, filledSeats: 1, ...over });
  const match = await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(201);
  expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
  return { host, rider, vehicle, trip, match };
}

async function otherTrip(daysAhead = 3) {
  const driver = await makeUser(bag, { fullName: 'Next Driver' });
  const vehicle = await makeVehicle(bag, driver.id);
  // A few hours off the finished ride's time of day, so a daily ride doesn't clash with it.
  return makeTrip(bag, driver.id, vehicle.id, { departureTime: new Date(inDays(daysAhead).getTime() + 4 * 60 * 60 * 1000) });
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

describe('riders', () => {
  test('a rider must rate the driver of their last ride before requesting another', async () => {
    if (guard()) return;
    const { host, rider, match } = await finishedRide();
    const next = await otherTrip();

    const blocked = await req('POST', '/api/matches', rider.id, { tripId: next.id });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ error: 'RATING_REQUIRED', matchId: match.id, rateeId: host.id, rateeName: 'Rated Driver' });

    expect((await req('POST', `/api/matches/${match.id}/ratings`, rider.id, { rateeId: host.id, score: 5 })).status).toBe(201);
    const ok = await req('POST', '/api/matches', rider.id, { tripId: next.id });
    expect(ok.status).toBe(201);
    bag.matchIds.push((await ok.json()).match.id);
  });

  test('on a repeating trip the rating is per day', async () => {
    if (guard()) return;
    const { host, rider, match } = await finishedRide({ recurrenceType: 'DAILY' });
    const next = await otherTrip();

    const blocked = await (await req('POST', '/api/matches', rider.id, { tripId: next.id })).json();
    expect(blocked.error).toBe('RATING_REQUIRED');
    expect(blocked.occurrenceDate).toEqual(expect.any(String));

    const rated = await req('POST', `/api/matches/${match.id}/ratings`, rider.id, { rateeId: host.id, score: 4, occurrenceDate: blocked.occurrenceDate });
    expect(await rated.json()).toMatchObject({ rating: expect.any(Object) });
    const ok = await req('POST', '/api/matches', rider.id, { tripId: next.id });
    expect(ok.status).toBe(201);
    bag.matchIds.push((await ok.json()).match.id);
  });
});

describe('drivers', () => {
  test('a driver must rate the riders of their last ride before posting the next trip', async () => {
    if (guard()) return;
    const { host, rider, vehicle, match } = await finishedRide();

    const blocked = await req('POST', '/api/trips', host.id, tripBody(vehicle.id, inDays(4)));
    expect(blocked.status).toBe(409);
    const body = await blocked.json();
    expect(body.error).toBe('RATING_REQUIRED');
    expect(body.riders).toEqual([{ matchId: match.id, rateeId: rider.id, rateeName: 'Rating Rider' }]);

    expect((await req('POST', `/api/matches/${match.id}/ratings`, host.id, { rateeId: rider.id, score: 5 })).status).toBe(201);
    const ok = await req('POST', '/api/trips', host.id, tripBody(vehicle.id, inDays(4)));
    expect(ok.status).toBe(201);
    bag.tripIds.push((await ok.json()).trip.id);
  });

  test('the driver’s reminder lapses 24 hours after the ride', async () => {
    if (guard()) return;
    const { host, vehicle, trip } = await finishedRide();
    await prisma.notification.updateMany({
      where: { userId: host.id, type: 'RATING_PROMPT', relatedTripId: trip.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    const ok = await req('POST', '/api/trips', host.id, tripBody(vehicle.id, inDays(5)));
    expect(ok.status).toBe(201);
    bag.tripIds.push((await ok.json()).trip.id);
  });
});
