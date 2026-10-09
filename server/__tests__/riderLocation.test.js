require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { clearStaleRiderLocations } = require('../services/riderLocationService');
const { deleteAccount } = require('../services/accountDeletionService');

// Riders share their location with the driver before pickup (sub-project G).

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

const MEET = { lat: 13.95, lng: 121.6 };
const NEAR = { lat: 13.9505, lng: 121.6 }; // ~55 m
const FAR = { lat: 13.9532, lng: 121.6 }; // ~355 m

// A trip leaving in 10 minutes (so sharing is open), with riders.
async function seed({ departsInMin = 10 } = {}) {
  const host = await makeUser(bag, { fullName: 'Share Host' });
  const rider = await makeUser(bag, { fullName: 'Maria Rider' });
  const quiet = await makeUser(bag, { fullName: 'Quiet Rider' });
  const pending = await makeUser(bag, { fullName: 'Pending Rider' });
  const trip = await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id, {
    departureTime: new Date(Date.now() + departsInMin * 60 * 1000),
    durationSeconds: 1800,
    meetingPointLat: MEET.lat,
    meetingPointLng: MEET.lng,
    meetingPointAddress: 'Plaza',
  });
  const match = await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
  const quietMatch = await makeMatch(bag, trip.id, quiet.id, { status: 'APPROVED' });
  const pendingMatch = await makeMatch(bag, trip.id, pending.id, { status: 'PENDING' });
  return { host, rider, quiet, pending, trip, match, quietMatch, pendingMatch };
}
const share = (s, userId, matchId, on = true) => req('PATCH', `/api/matches/${matchId}/location-sharing`, userId, { on });
const post = (s, userId, point) => req('POST', `/api/trips/${s.trip.id}/rider-location`, userId, point);
const read = (s, userId) => req('GET', `/api/trips/${s.trip.id}/rider-locations`, userId);
const err = async (res, status, code) => {
  expect(res.status).toBe(status);
  const body = await res.json();
  expect(body.error).toBe(code);
  return body;
};

test('the rider switches sharing on; nobody else can, and only on an approved request', async () => {
  if (guard()) return;
  const s = await seed();
  const res = await share(s, s.rider.id, s.match.id);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ sharesLocation: true });
  expect((await share(s, s.host.id, s.match.id)).status).toBe(403);
  expect((await share(s, s.quiet.id, s.match.id)).status).toBe(403);
  await err(await share(s, s.pending.id, s.pendingMatch.id), 409, 'NOT_APPROVED');
  const detail = await (await req('GET', `/api/trips/${s.trip.id}`, s.rider.id)).json();
  expect(detail.trip.myLocationSharing).toBe(true);
});

test('positions are accepted only when sharing is on, valid and inside the window', async () => {
  if (guard()) return;
  const s = await seed();
  await err(await post(s, s.rider.id, NEAR), 409, 'NOT_SHARING');
  await share(s, s.rider.id, s.match.id);
  expect((await post(s, s.rider.id, NEAR)).status).toBe(200);
  await err(await post(s, s.rider.id, { lat: 99, lng: 0 }), 400, 'INVALID_COORDINATES');
  expect((await post(s, s.pending.id, NEAR)).status).toBe(403);

  const later = await seed({ departsInMin: 24 * 60 });
  await share(later, later.rider.id, later.match.id);
  const body = await err(await post(later, later.rider.id, NEAR), 409, 'NOT_IN_WINDOW');
  expect(Date.parse(body.opensAt)).toBeGreaterThan(Date.now());
});

test('only the driver reads positions, with distance to the meeting point', async () => {
  if (guard()) return;
  const s = await seed();
  await share(s, s.rider.id, s.match.id);
  await post(s, s.rider.id, FAR);
  const res = await read(s, s.host.id);
  expect(res.status).toBe(200);
  const { riders } = await res.json();
  const maria = riders.find((r) => r.passengerId === s.rider.id);
  expect(maria).toMatchObject({ fullName: 'Maria Rider', sharing: true, atPickup: false, location: FAR });
  expect(maria.metersToPickup).toBeGreaterThan(300);
  expect(riders.find((r) => r.passengerId === s.quiet.id)).toMatchObject({ sharing: false, location: null });
  expect(riders.some((r) => r.passengerId === s.pending.id)).toBe(false);
  expect((await read(s, s.rider.id)).status).toBe(403);
  expect((await read(s, s.quiet.id)).status).toBe(403);

  await prisma.match.update({ where: { id: s.match.id }, data: { riderLocatedAt: new Date(Date.now() - 31 * 60 * 1000) } });
  const stale = (await (await read(s, s.host.id)).json()).riders.find((r) => r.passengerId === s.rider.id);
  expect(stale.location).toBeNull();
});

test('positions are erased: switch off, Start Trip, the cleanup job and account deletion', async () => {
  if (guard()) return;
  const point = (id) => prisma.match.findUnique({ where: { id }, select: { riderLat: true, riderLocatedAt: true } });

  const s = await seed();
  await share(s, s.rider.id, s.match.id);
  await post(s, s.rider.id, NEAR);
  await share(s, s.rider.id, s.match.id, false);
  expect(await point(s.match.id)).toEqual({ riderLat: null, riderLocatedAt: null });

  await share(s, s.rider.id, s.match.id);
  await post(s, s.rider.id, NEAR);
  expect((await req('POST', `/api/trips/${s.trip.id}/start`, s.host.id, {})).status).toBe(201);
  expect((await point(s.match.id)).riderLat).toBeNull();
  await err(await post(s, s.rider.id, NEAR), 409, 'TRIP_STARTED');
  expect((await (await read(s, s.host.id)).json()).riders).toEqual([]);

  const j = await seed();
  await share(j, j.rider.id, j.match.id);
  await share(j, j.quiet.id, j.quietMatch.id);
  await post(j, j.rider.id, NEAR);
  await post(j, j.quiet.id, NEAR);
  await prisma.match.update({ where: { id: j.match.id }, data: { riderLocatedAt: new Date(Date.now() - 31 * 60 * 1000) } });
  await prisma.match.update({ where: { id: j.quietMatch.id }, data: { status: 'CANCELLED' } });
  await clearStaleRiderLocations();
  expect((await point(j.match.id)).riderLat).toBeNull();
  expect((await point(j.quietMatch.id)).riderLat).toBeNull();

  const d = await seed();
  await share(d, d.rider.id, d.match.id);
  await post(d, d.rider.id, NEAR);
  await deleteAccount(d.rider.id);
  expect((await point(d.match.id)).riderLat).toBeNull();
});
