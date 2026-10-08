require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');

// Drivers confirm or skip a trip day (sub-project D).

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
const guard = () => !dbUp;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (instant) => phDateOnly(instant);
const dateStr = (instant) => dayOf(instant).toISOString().slice(0, 10);

// A trip departing in a day (and every day after, unless one-time), with an approved rider.
async function seedTrip(over = {}) {
  const host = await makeUser(bag, { fullName: 'Day Host' });
  const rider = await makeUser(bag, { fullName: 'Day Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, {
    departureTime: new Date(Date.now() + DAY_MS),
    recurrenceType: 'DAILY',
    durationSeconds: 1800,
    ...over,
  });
  await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  return { host, rider, trip };
}
const days = (trip) => `/api/trips/${trip.id}/days`;

test('the host confirms a day once', async () => {
  if (guard()) return;
  const { host, trip } = await seedTrip();
  const date = dateStr(trip.departureTime);
  const res = await req('POST', `${days(trip)}/${date}/confirm`, host.id, {});
  expect(res.status).toBe(200);
  expect((await res.json()).run).toMatchObject({ status: 'CONFIRMED' });
  const again = await req('POST', `${days(trip)}/${date}/confirm`, host.id, {});
  expect(again.status).toBe(409);
  expect((await again.json()).error).toBe('ALREADY_STARTED');
});

test('skipping a day tells the riders; undoing it tells them again', async () => {
  if (guard()) return;
  const { host, rider, trip } = await seedTrip();
  const later = new Date(trip.departureTime.getTime() + DAY_MS);
  const date = dateStr(later);
  const res = await req('POST', `${days(trip)}/${date}/skip`, host.id, { reason: 'Car at the shop' });
  expect(res.status).toBe(200);
  expect((await res.json()).run).toMatchObject({ status: 'SKIPPED', skipReason: 'Car at the shop' });
  const told = await prisma.notification.findMany({ where: { userId: rider.id, type: 'TRIP_SKIPPED', relatedTripId: trip.id } });
  expect(told).toHaveLength(1);
  expect(told[0].occurrenceDate).toEqual(dayOf(later));
  expect(told[0].message).toContain('Car at the shop');

  const confirm = await req('POST', `${days(trip)}/${date}/confirm`, host.id, {});
  expect(confirm.status).toBe(409);
  expect((await confirm.json()).error).toBe('DAY_SKIPPED');

  expect((await req('DELETE', `${days(trip)}/${date}/skip`, host.id)).status).toBe(200);
  expect(await prisma.tripRun.count({ where: { tripId: trip.id } })).toBe(0);
  const after = await prisma.notification.findMany({ where: { userId: rider.id, type: 'TRIP_SKIPPED', relatedTripId: trip.id } });
  expect(after).toHaveLength(2);
  expect(after.some((n) => n.message.includes('again'))).toBe(true);

  const undoAgain = await req('DELETE', `${days(trip)}/${date}/skip`, host.id);
  expect(undoAgain.status).toBe(409);
  expect((await undoAgain.json()).error).toBe('NOT_SKIPPED');
});

test('refusals: one-time skip, wrong day, bad date, departed, too late to undo', async () => {
  if (guard()) return;
  const { host, trip } = await seedTrip({ recurrenceType: 'ONE_TIME' });
  const date = dateStr(trip.departureTime);
  const err = async (res, status, code) => {
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  };
  await err(await req('POST', `${days(trip)}/${date}/skip`, host.id, {}), 409, 'ONE_TIME_TRIP');
  await err(await req('POST', `${days(trip)}/${dateStr(new Date(trip.departureTime.getTime() + DAY_MS))}/confirm`, host.id, {}), 409, 'NOT_A_TRIP_DAY');
  await err(await req('POST', `${days(trip)}/2026-13-40/confirm`, host.id, {}), 400, 'INVALID_DATE');

  const { host: h2, trip: gone } = await seedTrip({ departureTime: new Date(Date.now() - 2 * 60 * 60 * 1000) });
  const goneDate = dateStr(gone.departureTime);
  await err(await req('POST', `${days(gone)}/${goneDate}/confirm`, h2.id, {}), 409, 'DEPARTED');
  await prisma.tripRun.create({
    data: { tripId: gone.id, runDate: dayOf(gone.departureTime), status: 'SKIPPED', plannedArrivalAt: gone.departureTime },
  });
  await err(await req('DELETE', `${days(gone)}/${goneDate}/skip`, h2.id), 409, 'TOO_LATE');
});

test("only the host can confirm or skip; an unknown trip is 404", async () => {
  if (guard()) return;
  const { rider, trip } = await seedTrip();
  const date = dateStr(trip.departureTime);
  expect((await req('POST', `${days(trip)}/${date}/confirm`, rider.id, {})).status).toBe(403);
  expect((await req('POST', `${days(trip)}/${date}/skip`, rider.id, {})).status).toBe(403);
  expect((await req('POST', `/api/trips/nope/days/${date}/confirm`, rider.id, {})).status).toBe(404);
});
