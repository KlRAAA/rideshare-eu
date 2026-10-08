require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// POST/GET /api/trips/:id/location — the driver's position belongs to a
// started run (sub-project B): the host's phone writes it (with a live ETA)
// only while today's run is ongoing, and only the host and this trip's
// APPROVED riders may read it back. Before the start and after the end,
// nothing is served.

let server;
let base;
let dbUp = false;
const bag = newBag();

let host;
let approvedPax;
let pendingPax;
let outsider;
let otherTripApprovedPax; // approved, but on a DIFFERENT trip
let trip; // OPEN, departs in 10 minutes, so it can be started

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
  if (!dbUp) return;

  host = await makeUser(bag, { fullName: 'Location Host' });
  approvedPax = await makeUser(bag, { fullName: 'Approved Pax' });
  pendingPax = await makeUser(bag, { fullName: 'Pending Pax' });
  outsider = await makeUser(bag, { fullName: 'Outsider' });
  otherTripApprovedPax = await makeUser(bag, { fullName: 'Other Trip Pax' });

  const vehicle = await makeVehicle(bag, host.id);
  trip = await makeTrip(bag, host.id, vehicle.id, {
    status: 'OPEN',
    departureTime: new Date(Date.now() + 10 * 60 * 1000),
    durationSeconds: 1800,
  });
  await makeMatch(bag, trip.id, approvedPax.id, { status: 'APPROVED' });
  await makeMatch(bag, trip.id, pendingPax.id, { status: 'PENDING' });

  const otherVehicle = await makeVehicle(bag, outsider.id);
  const otherTrip = await makeTrip(bag, outsider.id, otherVehicle.id, { status: 'OPEN' });
  await makeMatch(bag, otherTrip.id, otherTripApprovedPax.id, { status: 'APPROVED' });
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

// Tests run in order: before the start, during the run, after the end.
describe('driver location during a run', () => {
  test('no token → 401', async () => {
    if (guard()) return;
    expect((await req('POST', `/api/trips/${trip.id}/location`, null, VALID_COORDS)).status).toBe(401);
  });

  test('writing before the run starts → 409 NO_ONGOING_RUN', async () => {
    if (guard()) return;
    const res = await req('POST', `/api/trips/${trip.id}/location`, host.id, VALID_COORDS);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('NO_ONGOING_RUN');
  });

  test('before the start, riders get no location', async () => {
    if (guard()) return;
    const body = await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json();
    expect(body).toEqual({ location: null, etaAt: null });
  });

  test('once started, the host writes position and ETA; approved riders read them', async () => {
    if (guard()) return;
    expect((await req('POST', `/api/trips/${trip.id}/start`, host.id, {})).status).toBe(201);
    const write = await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, etaSeconds: 600 });
    expect(write.status).toBe(200);
    const body = await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json();
    expect(body.location).toMatchObject(VALID_COORDS);
    expect(new Date(body.etaAt).getTime()).toBeGreaterThan(Date.now() + 500 * 1000);
  });

  test.each([
    ['a pending rider', () => pendingPax],
    ['an outsider', () => outsider],
    ['a rider approved on another trip', () => otherTripApprovedPax],
  ])('%s cannot read it → 403', async (_label, who) => {
    if (guard()) return;
    expect((await req('GET', `/api/trips/${trip.id}/location`, who().id)).status).toBe(403);
  });

  test('a non-host cannot write; bad coordinates and ETA are refused', async () => {
    if (guard()) return;
    expect((await req('POST', `/api/trips/${trip.id}/location`, approvedPax.id, VALID_COORDS)).status).toBe(403);
    const badLat = await req('POST', `/api/trips/${trip.id}/location`, host.id, { lat: 91, lng: 0 });
    expect(badLat.status).toBe(400);
    expect((await badLat.json()).error).toBe('INVALID_COORDINATES');
    const badEta = await req('POST', `/api/trips/${trip.id}/location`, host.id, { ...VALID_COORDS, etaSeconds: -5 });
    expect(badEta.status).toBe(400);
    expect((await badEta.json()).error).toBe('INVALID_ETA');
  });

  test('a position older than 90 seconds is not served', async () => {
    if (guard()) return;
    await prisma.tripRun.updateMany({
      where: { tripId: trip.id },
      data: { lastLocationUpdatedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    expect((await (await req('GET', `/api/trips/${trip.id}/location`, approvedPax.id)).json()).location).toBeNull();
  });

  test('after the run ends nothing is served and writes are refused', async () => {
    if (guard()) return;
    expect((await req('POST', `/api/trips/${trip.id}/end`, host.id, {})).status).toBe(200);
    expect((await (await req('GET', `/api/trips/${trip.id}/location`, host.id)).json()).location).toBeNull();
    expect((await req('POST', `/api/trips/${trip.id}/location`, host.id, VALID_COORDS)).status).toBe(409);
  });
});
