require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth'); // API now requires a session token

// Server-side enforcement for POST /api/matches/:id/ratings. Every gate is
// checked here, not just in the UI: match must exist and be COMPLETED, rater
// and ratee must be the two real people on the match, score must be an integer
// 1–5, and one rating per (match, rater) — the DB @@unique backstops the last.
// Skips (not fails) when no database is reachable, like the other integration
// tests in this folder.

let server;
let base;
let dbUp = false;

const seeded = { userIds: [], vehicleIds: [], tripIds: [], matchIds: [] };
let host;
let pax1;
let pax2;
let outsider;
let matchDoneA; // tripDone, pax1, COMPLETED
let matchDoneB; // tripDone, pax2, COMPLETED
let matchPending; // tripOpen, pax1, PENDING

async function makeUser(fullName, universityId) {
  const u = await prisma.user.create({
    data: {
      fullName,
      universityId,
      email: `${universityId}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender: 'MALE',
      verified: true,
    },
  });
  seeded.userIds.push(u.id);
  return u;
}

async function makeTrip(hostId, vehicleId, status) {
  const t = await prisma.trip.create({
    data: {
      hostId,
      vehicleId,
      originAddress: 'Origin',
      originLat: 13.9,
      originLng: 121.6,
      destinationAddress: 'Enverga University',
      destinationLat: 13.95,
      destinationLng: 121.62,
      departureTime: new Date('2026-08-20T00:00:00Z'),
      recurrenceType: 'ONE_TIME',
      customDays: [],
      totalSeats: 3,
      genderPreference: 'ANY',
      flexibleDeparture: false,
      flexWindowMinutes: 15,
      familiarRidersOnly: false,
      status,
    },
  });
  seeded.tripIds.push(t.id);
  return t;
}

async function makeMatch(tripId, passengerId, status) {
  const m = await prisma.match.create({
    data: {
      tripId,
      passengerId,
      score: 0.9,
      routeOverlap: 0.9,
      scheduleAlignment: 0.9,
      preferenceMatch: true,
      status,
    },
  });
  seeded.matchIds.push(m.id);
  return m;
}

const rate = (matchId, body) =>
  fetch(`${base}/api/matches/${matchId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(body && body.raterId) },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch (e) {
    console.warn('[ratingController.test] no database reachable — skipping:', e.code || e.message);
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  if (!dbUp) return;

  const stamp = Date.now();
  host = await makeUser('Trip Host', `RT-${stamp}-H`);
  pax1 = await makeUser('Passenger One', `RT-${stamp}-P1`);
  pax2 = await makeUser('Passenger Two', `RT-${stamp}-P2`);
  outsider = await makeUser('Outsider', `RT-${stamp}-O`);

  const vehicle = await prisma.vehicle.create({
    data: { ownerId: host.id, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12 },
  });
  seeded.vehicleIds.push(vehicle.id);

  const tripDone = await makeTrip(host.id, vehicle.id, 'COMPLETED');
  const tripOpen = await makeTrip(host.id, vehicle.id, 'OPEN');
  matchDoneA = await makeMatch(tripDone.id, pax1.id, 'COMPLETED');
  matchDoneB = await makeMatch(tripDone.id, pax2.id, 'COMPLETED');
  matchPending = await makeMatch(tripOpen.id, pax1.id, 'PENDING');
});

afterAll(async () => {
  if (dbUp) {
    await prisma.rating.deleteMany({ where: { matchId: { in: seeded.matchIds } } });
    await prisma.match.deleteMany({ where: { id: { in: seeded.matchIds } } });
    await prisma.trip.deleteMany({ where: { id: { in: seeded.tripIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: seeded.vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: seeded.userIds } } });
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) {
    console.warn('[ratingController.test] DB unavailable — assertion not exercised this run');
    return true;
  }
  return false;
};

describe('POST /api/matches/:id/ratings', () => {
  // These two run first and mutate host/pax2 trust scores — later tests only
  // assert status codes, so order between them and the rest doesn't matter,
  // but the duplicate test below depends on this one having created a rating.
  test('passenger rates host on a completed match → 201, trust score updated by the manuscript formula', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: pax1.id, rateeId: host.id, score: 4 });
    expect(res.status).toBe(201);
    const body = await res.json();
    // host started at trustScore 5.0, tripCount 0 → (5.0*0 + 4) / (0+1) = 4
    expect(body.updatedTrustScore).toBe(4);
    const fresh = await prisma.user.findUnique({ where: { id: host.id }, select: { trustScore: true, tripCount: true } });
    expect(fresh.trustScore).toBe(4);
    expect(fresh.tripCount).toBe(1);
  });

  test('host rates passenger on the same completed match (other direction) → 201', async () => {
    if (guard()) return;
    const res = await rate(matchDoneB.id, { raterId: host.id, rateeId: pax2.id, score: 5 });
    expect(res.status).toBe(201);
    const fresh = await prisma.user.findUnique({ where: { id: pax2.id }, select: { trustScore: true } });
    expect(fresh.trustScore).toBe(5);
  });

  test('same (match, rater) rating again → 409 ALREADY_RATED', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: pax1.id, rateeId: host.id, score: 1 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('ALREADY_RATED');
  });

  test('rater who was not on the match → 403 NOT_A_PARTICIPANT', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: outsider.id, rateeId: host.id, score: 3 });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_A_PARTICIPANT');
  });

  test('ratee who is not the counterparty → 403', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: pax1.id, rateeId: outsider.id, score: 3 });
    expect(res.status).toBe(403);
  });

  test('match that is not COMPLETED → 409 TRIP_NOT_COMPLETED', async () => {
    if (guard()) return;
    const res = await rate(matchPending.id, { raterId: pax1.id, rateeId: host.id, score: 3 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('TRIP_NOT_COMPLETED');
  });

  test.each([[0], [6], [3.5], ['5'], [null]])('score %p → 400 INVALID_SCORE', async (score) => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: host.id, rateeId: pax1.id, score });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_SCORE');
  });

  test('unknown matchId → clean 404, not 500', async () => {
    if (guard()) return;
    const res = await rate('no-such-match', { raterId: pax1.id, rateeId: host.id, score: 5 });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('MATCH_NOT_FOUND');
  });

  test('unknown rateeId → clean 403, not 500', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: pax1.id, rateeId: 'ghost-user', score: 5 });
    expect(res.status).toBe(403);
  });

  test('missing rateeId → 400 MISSING_RATEE', async () => {
    if (guard()) return;
    const res = await rate(matchDoneA.id, { raterId: pax1.id, score: 5 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('MISSING_RATEE');
  });

  // Phase 2: the rater is the verified token identity, never the body.
  test('a body raterId claiming a real participant is ignored — the token identity is used', async () => {
    if (guard()) return;
    // token = outsider, body claims raterId = pax1 (a real participant on matchDoneB)
    const res = await fetch(`${base}/api/matches/${matchDoneB.id}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(outsider.id) },
      body: JSON.stringify({ raterId: pax1.id, rateeId: host.id, score: 5 }),
    });
    expect(res.status).toBe(403); // outsider is not a participant on matchDoneB
    expect((await res.json()).error).toBe('NOT_A_PARTICIPANT');
    const leaked = await prisma.rating.findFirst({ where: { matchId: matchDoneB.id, raterId: pax1.id } });
    expect(leaked).toBeNull();
  });
});
