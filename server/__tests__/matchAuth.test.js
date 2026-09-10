require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Phase 2 auth behavior for the match endpoints: the caller identity now comes
// from the verified session token (req.user.id), not the request body/params.

let server;
let base;
let dbUp = false;
const bag = newBag();

let host;
let passenger;
let outsider;
let pendingMatch;
let joinTrip;

const req = (method, path, { token, body } = {}) =>
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
  passenger = await makeUser(bag, { fullName: 'Passenger User' });
  outsider = await makeUser(bag, { fullName: 'Outsider User' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id);
  pendingMatch = await makeMatch(bag, trip.id, passenger.id, { status: 'PENDING' });
  joinTrip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[matchAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('PATCH /api/matches/:id (approve/decline)', () => {
  test('no token → 401 (auth middleware)', async () => {
    if (guard()) return;
    const res = await req('PATCH', `/api/matches/${pendingMatch.id}`, { body: { status: 'APPROVED' } });
    expect(res.status).toBe(401);
  });

  test('a non-host authenticated user cannot approve → 403 NOT_AUTHORIZED, match stays PENDING', async () => {
    if (guard()) return;
    const res = await req('PATCH', `/api/matches/${pendingMatch.id}`, {
      token: outsider.id,
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_AUTHORIZED');
    const fresh = await prisma.match.findUnique({ where: { id: pendingMatch.id } });
    expect(fresh.status).toBe('PENDING');
  });

  test('the passenger on the match cannot approve their own request → 403', async () => {
    if (guard()) return;
    const res = await req('PATCH', `/api/matches/${pendingMatch.id}`, {
      token: passenger.id,
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(403);
  });

  test('unknown match id → 404 MATCH_NOT_FOUND', async () => {
    if (guard()) return;
    const res = await req('PATCH', '/api/matches/no-such-match', { token: host.id, body: { status: 'DECLINED' } });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('MATCH_NOT_FOUND');
  });

  test('invalid status is still rejected before the auth check', async () => {
    if (guard()) return;
    const res = await req('PATCH', `/api/matches/${pendingMatch.id}`, { token: host.id, body: { status: 'MAYBE' } });
    expect(res.status).toBe(400);
  });

  test('the trip host approves → 200, match APPROVED, seat filled', async () => {
    if (guard()) return;
    const res = await req('PATCH', `/api/matches/${pendingMatch.id}`, {
      token: host.id,
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(200);
    const fresh = await prisma.match.findUnique({ where: { id: pendingMatch.id }, include: { trip: true } });
    expect(fresh.status).toBe('APPROVED');
    expect(fresh.trip.filledSeats).toBe(1);
  });
});

describe('POST /api/matches (join request)', () => {
  test('no token → 401', async () => {
    if (guard()) return;
    const res = await req('POST', '/api/matches', { body: { tripId: joinTrip.id } });
    expect(res.status).toBe(401);
  });

  test("passengerId is the verified caller; a body passengerId claiming someone else is ignored", async () => {
    if (guard()) return;
    const res = await req('POST', '/api/matches', {
      token: outsider.id,
      body: { tripId: joinTrip.id, passengerId: passenger.id, score: 0.8, routeOverlap: 0.8, scheduleAlignment: 0.8, preferenceMatch: true },
    });
    expect(res.status).toBe(201);
    const { match } = await res.json();
    expect(match.passengerId).toBe(outsider.id);
    bag.matchIds.push(match.id);
  });

  test('the host cannot join their own trip (passengerId comes from the token) → 400', async () => {
    if (guard()) return;
    const res = await req('POST', '/api/matches', {
      token: host.id,
      body: { tripId: joinTrip.id, score: 0.8, routeOverlap: 0.8, scheduleAlignment: 0.8, preferenceMatch: true },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('CANNOT_JOIN_OWN_TRIP');
  });
});
