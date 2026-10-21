require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');
const { buildWatchlist } = require('../services/watchlistService');

// Join, cancel, join again: a 2-hour pause before the same trip, a 1-hour
// pause after 3 cancellations in a day, and a flag on the admins' watch list.

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

// Trips on different days, so they never clash with each other.
async function tripOnDay(day) {
  const driver = await makeUser(bag, { fullName: 'Cooldown Driver' });
  const vehicle = await makeVehicle(bag, driver.id);
  return makeTrip(bag, driver.id, vehicle.id, { departureTime: new Date(Date.now() + day * 24 * 60 * 60 * 1000) });
}

async function joinAndCancel(riderId, tripId) {
  const joined = await req('POST', '/api/matches', riderId, { tripId });
  expect(joined.status).toBe(201);
  bag.matchIds.push((await joined.json()).match.id);
  expect((await req('PATCH', `/api/trips/${tripId}/cancel`, riderId, {})).status).toBe(200);
}

describe('join cooldowns', () => {
  test('a rider who cancelled a trip waits 2 hours before requesting it again', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { fullName: 'Cancelling Rider' });
    const trip = await tripOnDay(3);
    await joinAndCancel(rider.id, trip.id);

    const again = await req('POST', '/api/matches', rider.id, { tripId: trip.id });
    expect(again.status).toBe(409);
    const body = await again.json();
    expect(body.error).toBe('REJOIN_COOLDOWN');
    expect(new Date(body.retryAt).getTime()).toBeGreaterThan(Date.now() + 110 * 60 * 1000);
  });

  test('three cancellations in a day pause new requests and flag the rider', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { fullName: 'Looping Rider' });
    for (const day of [3, 4, 5]) await joinAndCancel(rider.id, (await tripOnDay(day)).id);

    const next = await tripOnDay(6);
    const paused = await req('POST', '/api/matches', rider.id, { tripId: next.id });
    expect(paused.status).toBe(429);
    expect((await paused.json()).error).toBe('JOIN_COOLDOWN');

    const watch = await buildWatchlist(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const entry = watch.find((u) => u.userId === rider.id);
    expect(entry.reasons).toContain('Cancelled 3 or more ride requests within 24 hours');
  });

  test('a trip the driver cancelled does not count against the rider', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { fullName: 'Unlucky Rider' });
    for (const day of [3, 4, 5]) {
      const trip = await tripOnDay(day);
      const joined = await req('POST', '/api/matches', rider.id, { tripId: trip.id });
      bag.matchIds.push((await joined.json()).match.id);
      expect((await req('PATCH', `/api/trips/${trip.id}/cancel`, trip.hostId, {})).status).toBe(200);
    }
    const next = await tripOnDay(6);
    const ok = await req('POST', '/api/matches', rider.id, { tripId: next.id });
    expect(ok.status).toBe(201);
    bag.matchIds.push((await ok.json()).match.id);
  });
});
