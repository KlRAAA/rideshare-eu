require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

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
const cancel = (tripId, userId, body) =>
  fetch(`${base}/api/admin/trips/${tripId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: JSON.stringify(body),
  });

describe('PATCH /api/admin/trips/:id/cancel', () => {
  test('cancels the trip and active matches, notifies host and passengers, and audits it', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const host = await makeUser(bag);
    const approved = await makeUser(bag);
    const pending = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    await makeMatch(bag, trip.id, approved.id, { status: 'APPROVED' });
    await makeMatch(bag, trip.id, pending.id);

    const res = await cancel(trip.id, admin.id, { reason: 'Unsafe vehicle reported' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'TRIP_CANCELLED', affectedMatches: 2 });

    const saved = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    expect(saved.status).toBe('CANCELLED');
    expect(saved.cancelReason).toBe('Cancelled by an administrator: Unsafe vehicle reported');
    expect(saved.matches.every((m) => m.status === 'CANCELLED')).toBe(true);

    const notes = await prisma.notification.findMany({ where: { relatedTripId: trip.id, type: 'CANCELLATION' } });
    expect(notes.map((n) => n.userId).sort()).toEqual([approved.id, host.id, pending.id].sort());
    expect(notes.every((n) => n.message.includes('An administrator cancelled'))).toBe(true);

    const audit = await prisma.adminAction.findFirst({ where: { targetTripId: trip.id, action: 'TRIP_CANCELLED' } });
    expect(audit).toMatchObject({ actorId: admin.id, targetUserId: host.id });

    expect((await cancel(trip.id, admin.id, { reason: 'again' })).status).toBe(409);
  });

  test('requires a reason and an admin', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const host = await makeUser(bag);
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id);
    const missing = await cancel(trip.id, admin.id, {});
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('NOTE_REQUIRED');
    expect((await cancel(trip.id, host.id, { reason: 'x' })).status).toBe(403);
    expect((await cancel('nope', admin.id, { reason: 'x' })).status).toBe(404);
  });
});
