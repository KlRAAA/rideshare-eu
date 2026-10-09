require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { isNearPickup } = require('../services/arrivalRules');

// "Your driver is almost here" (sub-project F).

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

// 0.009° of latitude ≈ 1,000 m.
const MEET = { lat: 13.95, lng: 121.6 };
const north = (m) => ({ lat: MEET.lat + (m / 1000) * 0.009, lng: MEET.lng });

test('near means within 1 km of the meeting point, or of the origin when there is none', () => {
  const withMeeting = { meetingPointLat: MEET.lat, meetingPointLng: MEET.lng, originLat: 14.5, originLng: 121.0 };
  expect(isNearPickup(north(900), withMeeting)).toBe(true);
  expect(isNearPickup(north(1100), withMeeting)).toBe(false);
  const noMeeting = { meetingPointLat: null, meetingPointLng: null, originLat: MEET.lat, originLng: MEET.lng };
  expect(isNearPickup(north(500), noMeeting)).toBe(true);
});

test('approved riders are told once per trip day when the driver gets close', async () => {
  if (!dbUp) return;
  const host = await makeUser(bag);
  const rider = await makeUser(bag);
  const waiting = await makeUser(bag);
  const trip = await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id, {
    departureTime: new Date(Date.now() + 10 * 60 * 1000),
    durationSeconds: 1800,
    meetingPointLat: MEET.lat,
    meetingPointLng: MEET.lng,
    meetingPointAddress: 'Plaza',
  });
  await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  await makeMatch(bag, trip.id, waiting.id, { status: 'PENDING' });
  expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(201);

  const count = (userId) => prisma.notification.count({ where: { userId, type: 'DRIVER_ARRIVING', relatedTripId: trip.id } });
  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, north(5000))).status).toBe(200);
  expect(await count(rider.id)).toBe(0);

  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, north(500))).status).toBe(200);
  expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, north(300))).status).toBe(200);
  expect(await count(rider.id)).toBe(1);
  expect(await count(waiting.id)).toBe(0);
  const note = await prisma.notification.findFirst({ where: { userId: rider.id, type: 'DRIVER_ARRIVING' } });
  expect(note.message).toMatch(/almost at the meeting point/);
  expect(note.occurrenceDate).toBeInstanceOf(Date);
});
