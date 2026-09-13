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

// Reproduces the exact overbooking gap found during investigation: approving
// used to be a plain read-then-write with no capacity check at all, so a host
// could approve more PENDING requests than a trip had seats for — every time,
// not just under a race. The fix is a single conditional update
// (filledSeats only increments if still under totalSeats at that instant) —
// these tests cover both the deterministic case and the actual race.
describe('PATCH /api/matches/:id — seat capacity enforced on approval', () => {
  test('a second approval on a now-full 1-seat trip is rejected with 409, not silently approved', async () => {
    if (guard()) return;
    const capHost = await makeUser(bag, { fullName: 'Capacity Host' });
    const capPax1 = await makeUser(bag, { fullName: 'Capacity Pax One' });
    const capPax2 = await makeUser(bag, { fullName: 'Capacity Pax Two' });
    const vehicle = await makeVehicle(bag, capHost.id);
    const trip = await makeTrip(bag, capHost.id, vehicle.id, { totalSeats: 1, status: 'OPEN' });
    const match1 = await makeMatch(bag, trip.id, capPax1.id, { status: 'PENDING' });
    const match2 = await makeMatch(bag, trip.id, capPax2.id, { status: 'PENDING' });

    const firstApproval = await req('PATCH', `/api/matches/${match1.id}`, { token: capHost.id, body: { status: 'APPROVED' } });
    expect(firstApproval.status).toBe(200);
    const filledTrip = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(filledTrip.filledSeats).toBe(1);
    expect(filledTrip.status).toBe('FULL');

    const secondApproval = await req('PATCH', `/api/matches/${match2.id}`, { token: capHost.id, body: { status: 'APPROVED' } });
    expect(secondApproval.status).toBe(409);
    expect((await secondApproval.json()).error).toBe('TRIP_FULL');

    // Rejected, not silently applied: match2 never flips, and the seat count
    // never overshoots past totalSeats.
    const freshMatch2 = await prisma.match.findUnique({ where: { id: match2.id } });
    expect(freshMatch2.status).toBe('PENDING');
    const freshTrip = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(freshTrip.filledSeats).toBe(1);
  });

  test('two truly simultaneous approvals on a 1-seat trip: exactly one wins, filledSeats never overshoots', async () => {
    if (guard()) return;
    const raceHost = await makeUser(bag, { fullName: 'Race Host' });
    const raceP1 = await makeUser(bag, { fullName: 'Race Pax One' });
    const raceP2 = await makeUser(bag, { fullName: 'Race Pax Two' });
    const vehicle = await makeVehicle(bag, raceHost.id);
    const trip = await makeTrip(bag, raceHost.id, vehicle.id, { totalSeats: 1, status: 'OPEN' });
    const m1 = await makeMatch(bag, trip.id, raceP1.id, { status: 'PENDING' });
    const m2 = await makeMatch(bag, trip.id, raceP2.id, { status: 'PENDING' });

    const [res1, res2] = await Promise.all([
      req('PATCH', `/api/matches/${m1.id}`, { token: raceHost.id, body: { status: 'APPROVED' } }),
      req('PATCH', `/api/matches/${m2.id}`, { token: raceHost.id, body: { status: 'APPROVED' } }),
    ]);

    expect([res1.status, res2.status].sort()).toEqual([200, 409]);

    const freshTrip = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(freshTrip.filledSeats).toBe(1); // never 2, regardless of which request won
    expect(freshTrip.status).toBe('FULL');
  });

  test('decline is unaffected by the capacity check — still succeeds on a full trip', async () => {
    if (guard()) return;
    const declineHost = await makeUser(bag, { fullName: 'Decline Host' });
    const declinePax1 = await makeUser(bag, { fullName: 'Decline Pax One' });
    const declinePax2 = await makeUser(bag, { fullName: 'Decline Pax Two' });
    const vehicle = await makeVehicle(bag, declineHost.id);
    const trip = await makeTrip(bag, declineHost.id, vehicle.id, { totalSeats: 1, status: 'OPEN' });
    const approved = await makeMatch(bag, trip.id, declinePax1.id, { status: 'PENDING' });
    const stillPending = await makeMatch(bag, trip.id, declinePax2.id, { status: 'PENDING' });

    await req('PATCH', `/api/matches/${approved.id}`, { token: declineHost.id, body: { status: 'APPROVED' } });

    const res = await req('PATCH', `/api/matches/${stillPending.id}`, { token: declineHost.id, body: { status: 'DECLINED' } });
    expect(res.status).toBe(200);
    const fresh = await prisma.match.findUnique({ where: { id: stillPending.id } });
    expect(fresh.status).toBe('DECLINED');
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
