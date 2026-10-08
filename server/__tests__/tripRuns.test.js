require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { endOverdueRuns } = require('../services/tripRunService');

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

// A trip departing in 10 minutes, so it can be started now.
async function seedTrip(over = {}) {
  const host = await makeUser(bag, { fullName: 'Run Host' });
  const rider = await makeUser(bag, { fullName: 'Run Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, {
    departureTime: new Date(Date.now() + 10 * 60 * 1000),
    durationSeconds: 1800,
    ...over,
  });
  const match = await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  return { host, rider, trip, match };
}

describe('starting a run', () => {
  test('the host starts it, riders are told, a second start is refused', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    const res = await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect(res.status).toBe(201);
    expect((await res.json()).run.status).toBe('ONGOING');
    const told = await prisma.notification.findMany({ where: { userId: rider.id, type: 'TRIP_STARTED', relatedTripId: trip.id } });
    expect(told).toHaveLength(1);
    expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(409);
  });

  test('a rider cannot start it; a trip departing tomorrow is too early', async () => {
    if (guard()) return;
    const { rider, trip } = await seedTrip();
    expect((await req('POST', `/api/trips/${trip.id}/start`, rider.id, {})).status).toBe(403);
    const { host: h2, trip: later } = await seedTrip({ departureTime: new Date(Date.now() + 26 * 60 * 60 * 1000) });
    const res = await req('POST', `/api/trips/${later.id}/start`, h2.id, {});
    expect(res.status).toBe(409);
    expect(['TOO_EARLY_TO_START', 'NOT_A_TRIP_DAY']).toContain((await res.json()).error);
  });
});

describe('cancelling while a run is ongoing', () => {
  test('neither the host nor an approved rider can cancel', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    for (const who of [host, rider]) {
      const res = await req('PATCH', `/api/trips/${trip.id}/cancel`, who.id, {});
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('TRIP_IN_PROGRESS');
    }
  });
});

describe('ending a run', () => {
  test('End Trip completes a one-time trip and its approved rider', async () => {
    if (guard()) return;
    const { host, trip, match } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('COMPLETED');
    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('COMPLETED');
    const run = await prisma.tripRun.findFirst({ where: { tripId: trip.id } });
    expect(run).toMatchObject({ status: 'COMPLETED', endReason: 'DRIVER' });
  });

  test('End Trip on a recurring trip keeps it open and the rider approved', async () => {
    if (guard()) return;
    const { host, trip, match } = await seedTrip({ recurrenceType: 'DAILY' });
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
    expect((await prisma.match.findUnique({ where: { id: match.id } })).status).toBe('APPROVED');
  });

  test('arriving near campus before the trip started does nothing (early-completion bug)', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip();
    const res = await req('POST', `/api/trips/${trip.id}/arrived`, host.id, {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('NO_ONGOING_RUN');
    expect((await prisma.trip.findUnique({ where: { id: trip.id } })).status).toBe('OPEN');
  });

  test('the background job ends only runs an hour past their planned arrival', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip();
    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    const run = await prisma.tripRun.findFirst({ where: { tripId: trip.id } });
    await endOverdueRuns(new Date(run.plannedArrivalAt.getTime() + 59 * 60 * 1000));
    expect((await prisma.tripRun.findUnique({ where: { id: run.id } })).status).toBe('ONGOING');
    await endOverdueRuns(new Date(run.plannedArrivalAt.getTime() + 61 * 60 * 1000));
    expect((await prisma.tripRun.findUnique({ where: { id: run.id } }))).toMatchObject({ status: 'COMPLETED', endReason: 'AUTO' });
  });
});

describe('run state in the trip APIs', () => {
  test('trip details show the next departure, then the ongoing run; My Trips flags it', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seedTrip();
    let detail = (await (await req('GET', `/api/trips/${trip.id}`, rider.id)).json()).trip;
    expect(detail.currentRun).toBeNull();
    expect(new Date(detail.nextDeparture.opensAt).getTime()).toBeLessThan(Date.now());
    expect(new Date(detail.nextDeparture.plannedArrivalAt).getTime()).toBe(
      new Date(detail.nextDeparture.departure).getTime() + 1800 * 1000
    );
    expect(detail.runs).toBeUndefined();

    await req('POST', `/api/trips/${trip.id}/start`, host.id, {});
    detail = (await (await req('GET', `/api/trips/${trip.id}`, rider.id)).json()).trip;
    expect(detail.currentRun.status).toBe('ONGOING');

    const mine = await (await req('GET', '/api/trips/mine', rider.id)).json();
    expect(mine.joined.find((j) => j.id === trip.id).inProgress).toBe(true);
    const hosted = await (await req('GET', '/api/trips/mine', host.id)).json();
    expect(hosted.hosted.find((h) => h.id === trip.id).inProgress).toBe(true);
  });
});
