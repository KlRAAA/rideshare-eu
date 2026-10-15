require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');

// A trip is completed only by ending a run (End Trip). A repeating trip the
// driver is done with (end of the semester) is stopped instead: it closes
// without rating prompts and doesn't count as a cancellation.

let server;
let base;
let dbUp = false;
const bag = newBag();
const post = (path, userId) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(userId) }, body: '{}' });

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

async function weekdayTrip(overrides = {}) {
  const host = await makeUser(bag, { fullName: 'Repeat Driver' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, { recurrenceType: 'WEEKDAYS', filledSeats: 1, ...overrides });
  return { host, trip };
}

describe('POST /api/trips/:id/complete', () => {
  test('a trip nobody started cannot be completed', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const rider = await makeUser(bag);
    await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });

    const res = await post(`/api/trips/${trip.id}/complete`, host.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'NO_ONGOING_RUN' });
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
    expect(await prisma.notification.count({ where: { userId: rider.id, type: 'RATING_PROMPT' } })).toBe(0);
  });
});

describe('POST /api/trips/:id/stop-repeating', () => {
  test('closes the repeating trip: riders are told, requests closed, no rating prompts', async () => {
    if (guard()) return;
    const { host, trip } = await weekdayTrip();
    const approved = await makeUser(bag);
    const pending = await makeUser(bag);
    const approvedMatch = await makeMatch(bag, trip.id, approved.id, { status: 'APPROVED' });
    const pendingMatch = await makeMatch(bag, trip.id, pending.id, { status: 'PENDING' });

    const res = await post(`/api/trips/${trip.id}/stop-repeating`, host.id);
    expect(res.status).toBe(200);
    expect((await res.json()).trip.status).toBe('COMPLETED');

    expect((await prisma.match.findUnique({ where: { id: approvedMatch.id } })).status).toBe('COMPLETED');
    expect((await prisma.match.findUnique({ where: { id: pendingMatch.id } })).status).toBe('DECLINED');

    const told = await prisma.notification.findFirst({ where: { userId: approved.id, relatedTripId: trip.id } });
    expect(told).toMatchObject({ type: 'CANCELLATION' });
    expect(told.message).toBe('Your driver stopped the weekday trip to Enverga University. It won’t run again.');
    const closed = await prisma.notification.findFirst({ where: { userId: pending.id, relatedTripId: trip.id } });
    expect(closed).toMatchObject({ type: 'APPROVAL' });
    expect(closed.message).toBe('Your driver stopped the weekday trip to Enverga University, so your request was closed.');
    expect(await prisma.notification.count({ where: { relatedTripId: trip.id, type: 'RATING_PROMPT' } })).toBe(0);
  });

  test('only for repeating trips that are still active and not on the road', async () => {
    if (guard()) return;
    const { host, trip: oneTime } = await weekdayTrip({ recurrenceType: 'ONE_TIME' });
    let res = await post(`/api/trips/${oneTime.id}/stop-repeating`, host.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'ONE_TIME_TRIP' });

    const { host: h2, trip: cancelled } = await weekdayTrip({ status: 'CANCELLED' });
    res = await post(`/api/trips/${cancelled.id}/stop-repeating`, h2.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'TRIP_NOT_ACTIVE' });

    const { host: h3, trip: driving } = await weekdayTrip();
    await prisma.tripRun.create({
      data: { tripId: driving.id, runDate: phDateOnly(new Date()), status: 'ONGOING', startedAt: new Date(), plannedArrivalAt: new Date() },
    });
    res = await post(`/api/trips/${driving.id}/stop-repeating`, h3.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'TRIP_IN_PROGRESS' });
  });

  test('only the driver can stop it, and a missing trip is 404', async () => {
    if (guard()) return;
    const { trip } = await weekdayTrip();
    const stranger = await makeUser(bag);
    expect((await post(`/api/trips/${trip.id}/stop-repeating`, stranger.id)).status).toBe(403);
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
    expect((await post('/api/trips/does-not-exist/stop-repeating', stranger.id)).status).toBe(404);
  });
});
