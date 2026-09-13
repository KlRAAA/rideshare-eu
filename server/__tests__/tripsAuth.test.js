require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Phase 2: every trip endpoint derives the caller from req.user.id. Self-identity
// fields (hostId on create, userId on mine) are taken from the token; ownership
// checks (edit / cancel / complete / plate visibility) compare the real
// trip.hostId against req.user.id.

let server;
let base;
let dbUp = false;
const bag = newBag();

let host;
let other;
let vehicle;

const json = (method, path, token, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? bearer(token) : {}) },
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
  host = await makeUser(bag, { fullName: 'Host User' });
  other = await makeUser(bag, { fullName: 'Other User' });
  vehicle = await makeVehicle(bag, host.id);
  await prisma.vehicle.update({ where: { id: vehicle.id }, data: { plate: 'ABC-1234' } });
});

afterAll(async () => {
  if (dbUp) {
    // Trips are created through the API here, not via the seed bag — tear them
    // down by host id, children first.
    const tripRows = await prisma.trip.findMany({ where: { hostId: { in: bag.userIds } }, select: { id: true } });
    const tripIds = tripRows.map((t) => t.id);
    await prisma.notification.deleteMany({ where: { relatedTripId: { in: tripIds } } });
    await prisma.match.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[tripsAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const tripBody = (over = {}) => ({
  vehicleId: vehicle.id,
  originAddress: 'A',
  originLat: 13.9,
  originLng: 121.6,
  destinationAddress: 'B',
  destinationLat: 13.95,
  destinationLng: 121.62,
  departureTime: '2026-09-25T00:00:00Z',
  recurrenceType: 'ONE_TIME',
  customDays: [],
  totalSeats: 3,
  genderPreference: 'ANY',
  flexibleDeparture: false,
  flexWindowMinutes: 15,
  familiarRidersOnly: false,
  ...over,
});

describe('POST /api/trips', () => {
  test('hostId is the verified caller; a body hostId claiming someone else is ignored', async () => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', host.id, tripBody({ hostId: other.id }));
    expect(res.status).toBe(201);
    const { trip } = await res.json();
    expect(trip.hostId).toBe(host.id);
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', null, tripBody());
    expect(res.status).toBe(401);
  });

  test('lifecycle fields in the body are ignored — a new trip starts OPEN with 0 filled seats', async () => {
    if (guard()) return;
    const res = await json(
      'POST',
      '/api/trips',
      host.id,
      tripBody({ status: 'COMPLETED', filledSeats: 99, cancelReason: 'x', fuelSharePerSeat: 9999 })
    );
    expect(res.status).toBe(201);
    const { trip } = await res.json();
    expect(trip.status).toBe('OPEN');
    expect(trip.filledSeats).toBe(0);
    expect(trip.cancelReason).toBeNull();

    const fresh = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(fresh.status).toBe('OPEN');
    expect(fresh.filledSeats).toBe(0);
    // fuelSharePerSeat is computed server-side, not taken from the body
    expect(fresh.fuelSharePerSeat).not.toBe(9999);
  });
});

// No reliable free PH fuel-price API exists, so the host types today's price
// at posting instead of a fixed app-wide default. Route data is included here
// (tripBody() alone has none) so fuelSharePerSeat is actually non-null and the
// price's effect on it is observable, not masked by the "no route" null path.
describe('POST /api/trips — fuelPricePerLiter', () => {
  const withRoute = (over = {}) =>
    tripBody({ distanceMeters: 8000, durationSeconds: 900, routeWaypoints: null, ...over });

  test('the host-supplied price is persisted and used to compute fuelSharePerSeat', async () => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', host.id, withRoute({ fuelPricePerLiter: 70, totalSeats: 3 }));
    expect(res.status).toBe(201);
    const { trip } = await res.json();
    expect(trip.fuelPricePerLiter).toBe(70);
    // 8km / 12km/L (seed vehicle) = 0.6667L * ₱70 / 3 seats = ₱15.56
    expect(trip.fuelSharePerSeat).toBeCloseTo(15.56, 2);
  });

  test.each([[19.99], [150.01], [0], [-5]])('price %p outside ₱20–₱150 → 400 INVALID_FUEL_PRICE, nothing created', async (price) => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', host.id, withRoute({ fuelPricePerLiter: price }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_FUEL_PRICE');
  });

  test.each([[20], [150]])('the boundary values %p are accepted, not rejected', async (price) => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', host.id, withRoute({ fuelPricePerLiter: price }));
    expect(res.status).toBe(201);
    const { trip } = await res.json();
    expect(trip.fuelPricePerLiter).toBe(price);
  });

  test('omitting the price entirely still creates the trip — no suggested share, not an error', async () => {
    if (guard()) return;
    const res = await json('POST', '/api/trips', host.id, withRoute());
    expect(res.status).toBe(201);
    const { trip } = await res.json();
    expect(trip.fuelPricePerLiter).toBeNull();
    expect(trip.fuelSharePerSeat).toBeNull();
  });

  test('editing seats before any approval recomputes fuelSharePerSeat from the trip\'s own stored price', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, withRoute({ fuelPricePerLiter: 80, totalSeats: 2 }))).json();
    const id = created.trip.id;
    expect(created.trip.fuelSharePerSeat).toBeCloseTo(26.67, 2); // 0.6667L * ₱80 / 2

    const edited = await (await json('PATCH', `/api/trips/${id}`, host.id, { totalSeats: 4 })).json();
    // Same price (₱80), now split 4 ways instead of 2 — proves the recompute
    // used the trip's own fuelPricePerLiter, not some other/default value.
    expect(edited.trip.fuelSharePerSeat).toBeCloseTo(13.33, 2); // 0.6667L * ₱80 / 4
  });
});

describe('GET /api/trips/mine', () => {
  test('returns only the caller\'s trips, ignoring a spoofed ?userId', async () => {
    if (guard()) return;
    await json('POST', '/api/trips', host.id, tripBody());
    const res = await fetch(`${base}/api/trips/mine?userId=${host.id}`, { headers: bearer(other.id) });
    expect(res.status).toBe(200);
    const { hosted } = await res.json();
    expect(hosted.every((t) => t.hostId === other.id)).toBe(true);
  });
});

describe('PATCH /api/trips/:id (edit) — ownership', () => {
  test('a non-host authenticated user → 403; the host → 200', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, tripBody())).json();
    const id = created.trip.id;

    const asOther = await json('PATCH', `/api/trips/${id}`, other.id, { userId: host.id, driverNotes: 'hijack' });
    expect(asOther.status).toBe(403);

    const asHost = await json('PATCH', `/api/trips/${id}`, host.id, { driverNotes: 'ok' });
    expect(asHost.status).toBe(200);
    const fresh = await prisma.trip.findUnique({ where: { id } });
    expect(fresh.driverNotes).toBe('ok');
  });
});

describe('POST /api/trips/:id/complete — ownership', () => {
  test('a non-host → 403; the host → 200', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, tripBody())).json();
    const id = created.trip.id;

    expect((await json('POST', `/api/trips/${id}/complete`, other.id, {})).status).toBe(403);
    expect((await json('POST', `/api/trips/${id}/complete`, host.id, {})).status).toBe(200);
    const fresh = await prisma.trip.findUnique({ where: { id } });
    expect(fresh.status).toBe('COMPLETED');
  });
});

describe('PATCH /api/trips/:id/cancel — ownership', () => {
  test('an unrelated authenticated user (not host, not passenger) → 403', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, tripBody())).json();
    const id = created.trip.id;
    const res = await json('PATCH', `/api/trips/${id}/cancel`, other.id, {});
    expect(res.status).toBe(403);
    const fresh = await prisma.trip.findUnique({ where: { id } });
    expect(fresh.status).toBe('OPEN');
  });

  test('the host cancels their own trip → 200', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, tripBody())).json();
    const id = created.trip.id;
    const res = await json('PATCH', `/api/trips/${id}/cancel`, host.id, { reason: 'plans changed' });
    expect(res.status).toBe(200);
    const fresh = await prisma.trip.findUnique({ where: { id } });
    expect(fresh.status).toBe('CANCELLED');
  });
});

describe('GET /api/trips/:id — plate visibility keyed to the verified caller', () => {
  test('the host sees the plate; an unrelated authenticated user does not', async () => {
    if (guard()) return;
    const created = await (await json('POST', '/api/trips', host.id, tripBody())).json();
    const id = created.trip.id;

    const asHost = await (await fetch(`${base}/api/trips/${id}`, { headers: bearer(host.id) })).json();
    expect(asHost.trip.vehicle.plate).toBe('ABC-1234');

    const asOther = await (await fetch(`${base}/api/trips/${id}`, { headers: bearer(other.id) })).json();
    expect(asOther.trip.vehicle.plate).toBeNull();
  });
});
