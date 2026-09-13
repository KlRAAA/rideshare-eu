require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// POST/GET /api/trips/:id/location — the host's own device writes its
// current position; only the host and this specific trip's APPROVED
// passengers may read it back. liveLocationSharing is re-checked
// server-side on every call (write AND read), never trusted from the
// client or assumed to still hold just because a point was written earlier.

let server;
let base;
let dbUp = false;
const bag = newBag();

let host;
let approvedPax;
let pendingPax;
let outsider;
let otherTripApprovedPax; // approved, but on a DIFFERENT trip
let trip; // OPEN, host has liveLocationSharing on
let inactiveTrip; // COMPLETED

const req = (method, path, token, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? bearer(token) : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function setSharing(userId, enabled) {
  await prisma.preference.upsert({
    where: { userId },
    update: { liveLocationSharing: enabled },
    create: { userId, genderPreference: 'ANY', flexWindowMinutes: 15, familiarRidersOnly: false, liveLocationSharing: enabled },
  });
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
  if (!dbUp) return;

  host = await makeUser(bag, { fullName: 'Location Host' });
  approvedPax = await makeUser(bag, { fullName: 'Approved Pax' });
  pendingPax = await makeUser(bag, { fullName: 'Pending Pax' });
  outsider = await makeUser(bag, { fullName: 'Outsider' });
  otherTripApprovedPax = await makeUser(bag, { fullName: 'Other Trip Pax' });

  const vehicle = await makeVehicle(bag, host.id);
  trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
  inactiveTrip = await makeTrip(bag, host.id, vehicle.id, { status: 'COMPLETED' });

  await makeMatch(bag, trip.id, approvedPax.id, { status: 'APPROVED' });
  await makeMatch(bag, trip.id, pendingPax.id, { status: 'PENDING' });

  // otherTripApprovedPax is genuinely approved, just on a trip that isn't
  // this one — the read endpoint must still reject them for `trip`.
  const otherVehicle = await makeVehicle(bag, outsider.id);
  const otherTrip = await makeTrip(bag, outsider.id, otherVehicle.id, { status: 'OPEN' });
  await makeMatch(bag, otherTrip.id, otherTripApprovedPax.id, { status: 'APPROVED' });

  await setSharing(host.id, true);
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[tripLocation.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const VALID_COORDS = { lat: 13.9312, lng: 121.6142 };

describe('POST /api/trips/:id/location', () => {
  test('no token → 401', async () => {
    if (guard()) return;
    const res = await req('POST', `/api/trips/${trip.id}/location`, null, VALID_COORDS);
    expect(res.status).toBe(401);
  });

  test('a non-host authenticated user → 403 NOT_AUTHORIZED, nothing written', async () => {
    if (guard()) return;
    const res = await req('POST', `/api/trips/${trip.id}/location`, approvedPax.id, VALID_COORDS);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_AUTHORIZED');
  });

  test('the host, with sharing OFF → 403 LOCATION_SHARING_DISABLED', async () => {
    if (guard()) return;
    await setSharing(host.id, false);
    const res = await req('POST', `/api/trips/${trip.id}/location`, host.id, VALID_COORDS);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('LOCATION_SHARING_DISABLED');
    await setSharing(host.id, true); // restore for the rest of the suite
  });

  test('the host, on a COMPLETED trip → 409 TRIP_NOT_ACTIVE', async () => {
    if (guard()) return;
    const res = await req('POST', `/api/trips/${inactiveTrip.id}/location`, host.id, VALID_COORDS);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('TRIP_NOT_ACTIVE');
  });

  test.each([
    [{ lat: 999, lng: 121.6 }],
    [{ lat: 13.9, lng: -999 }],
    [{ lat: 'not-a-number', lng: 121.6 }],
    [{ lat: null, lng: 121.6 }],
  ])('invalid coordinates %p → 400 INVALID_COORDINATES', async (coords) => {
    if (guard()) return;
    const res = await req('POST', `/api/trips/${trip.id}/location`, host.id, coords);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_COORDINATES');
  });

  test('the host, sharing ON, trip OPEN → 200, persisted with a fresh timestamp', async () => {
    if (guard()) return;
    const before = Date.now();
    const res = await req('POST', `/api/trips/${trip.id}/location`, host.id, VALID_COORDS);
    expect(res.status).toBe(200);
    const fresh = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(fresh.lastKnownLat).toBeCloseTo(VALID_COORDS.lat, 5);
    expect(fresh.lastKnownLng).toBeCloseTo(VALID_COORDS.lng, 5);
    expect(fresh.lastLocationUpdatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('GET /api/trips/:id/location', () => {
  beforeEach(async () => {
    if (!dbUp) return;
    await setSharing(host.id, true);
    await prisma.trip.update({
      where: { id: trip.id },
      data: { lastKnownLat: VALID_COORDS.lat, lastKnownLng: VALID_COORDS.lng, lastLocationUpdatedAt: new Date() },
    });
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, null);
    expect(res.status).toBe(401);
  });

  test('the host can read their own trip\'s location', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, host.id);
    expect(res.status).toBe(200);
    const { location } = await res.json();
    expect(location).not.toBeNull();
    expect(location.lat).toBeCloseTo(VALID_COORDS.lat, 5);
  });

  test('an APPROVED passenger on this trip can read it', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id);
    expect(res.status).toBe(200);
    const { location } = await res.json();
    expect(location).not.toBeNull();
  });

  test('a PENDING requester on this trip → 403, never a location leak', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, pendingPax.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_AUTHORIZED');
  });

  test('a passenger APPROVED on a different trip → 403, not just filtered to null', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, otherTripApprovedPax.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_AUTHORIZED');
  });

  test('a complete outsider → 403', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${trip.id}/location`, outsider.id);
    expect(res.status).toBe(403);
  });

  test('an inactive (COMPLETED) trip → 200 with a null location, not an error', async () => {
    if (guard()) return;
    const res = await req('GET', `/api/trips/${inactiveTrip.id}/location`, host.id);
    expect(res.status).toBe(200);
    expect((await res.json()).location).toBeNull();
  });

  test('sharing turned off after a point was already written → null, not the stale point', async () => {
    if (guard()) return;
    await setSharing(host.id, false);
    const res = await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id);
    expect(res.status).toBe(200);
    expect((await res.json()).location).toBeNull();
    await setSharing(host.id, true);
  });

  test('a stale point (older than the freshness window) → null', async () => {
    if (guard()) return;
    await prisma.trip.update({
      where: { id: trip.id },
      data: { lastLocationUpdatedAt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 min old
    });
    const res = await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id);
    expect(res.status).toBe(200);
    expect((await res.json()).location).toBeNull();
  });
});
