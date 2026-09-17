require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth'); // API now requires a session token
const { encryptField } = require('../services/encryptionService');

// GET /api/users/:id/ratings — the public rating summary + reviews behind the
// profile page — plus the `anonymous` field on submitRating. Anonymity must be
// genuine: an anonymous review carries no rater id or name in the response at
// all, including when the ratee fetches their own profile (the endpoint takes
// no viewer). Skips (not fails) with no database reachable.

let server;
let base;
let dbUp = false;

const seeded = { userIds: [], vehicleIds: [], tripIds: [], matchIds: [] };
let ratee;
let emptyUser;
let raterMulti; // "Alpha Bravo Kilo"  -> "Alpha K."
let raterSolo; // "Cher"               -> "Cher"
let raterAnon; // "Zoe Yankee"         -> null (anonymous)
let raterInvalid; // "Ivy Nolan"       -> "Ivy N." (anonymous:'yes' is not true -> stored false)

async function makeUser(fullName, universityId) {
  const u = await prisma.user.create({
    data: {
      fullName: encryptField(fullName),
      universityId,
      email: `${universityId}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender: encryptField('MALE'),
      verified: true,
    },
  });
  seeded.userIds.push(u.id);
  return { ...u, fullName };
}

async function makeCompletedMatch(hostId, vehicleId, passengerId) {
  const trip = await prisma.trip.create({
    data: {
      hostId,
      vehicleId,
      originAddress: encryptField('Origin'),
      originLat: 13.9,
      originLng: 121.6,
      destinationAddress: encryptField('Enverga University'),
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
      status: 'COMPLETED',
    },
  });
  seeded.tripIds.push(trip.id);
  const match = await prisma.match.create({
    data: {
      tripId: trip.id,
      passengerId,
      score: 0.9,
      routeOverlap: 0.9,
      scheduleAlignment: 0.9,
      preferenceMatch: true,
      status: 'COMPLETED',
    },
  });
  seeded.matchIds.push(match.id);
  return match;
}

const rate = (matchId, body) =>
  fetch(`${base}/api/matches/${matchId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(body && body.raterId) },
    body: JSON.stringify(body),
  });

const getRatings = (userId) => fetch(`${base}/api/users/${userId}/ratings`, { headers: bearer() });

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch (e) {
    console.warn('[userRatings.test] no database reachable — skipping:', e.code || e.message);
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (!dbUp) return;

  const stamp = Date.now();
  ratee = await makeUser('Rated Person', `UR-${stamp}-RATEE`);
  emptyUser = await makeUser('No Reviews Yet', `UR-${stamp}-EMPTY`);
  raterMulti = await makeUser('Alpha Bravo Kilo', `UR-${stamp}-M`);
  raterSolo = await makeUser('Cher', `UR-${stamp}-S`);
  raterAnon = await makeUser('Zoe Yankee', `UR-${stamp}-A`);
  raterInvalid = await makeUser('Ivy Nolan', `UR-${stamp}-I`);

  // `ratee` hosts; each rater is a completed passenger, so submitRating's
  // participant + completed checks pass. Each rater rates the host (ratee).
  const vehicle = await prisma.vehicle.create({
    data: { ownerId: ratee.id, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12 },
  });
  seeded.vehicleIds.push(vehicle.id);

  const mMulti = await makeCompletedMatch(ratee.id, vehicle.id, raterMulti.id);
  const mSolo = await makeCompletedMatch(ratee.id, vehicle.id, raterSolo.id);
  const mAnon = await makeCompletedMatch(ratee.id, vehicle.id, raterAnon.id);
  const mInvalid = await makeCompletedMatch(ratee.id, vehicle.id, raterInvalid.id);

  // Fire the reviews in sequence so createdAt ordering is deterministic.
  await rate(mMulti.id, { raterId: raterMulti.id, rateeId: ratee.id, score: 5, comment: 'Great driver' }); // no `anonymous`
  await rate(mSolo.id, { raterId: raterSolo.id, rateeId: ratee.id, score: 4 }); // no `anonymous`
  await rate(mAnon.id, { raterId: raterAnon.id, rateeId: ratee.id, score: 3, comment: 'ok', anonymous: true });
  await rate(mInvalid.id, { raterId: raterInvalid.id, rateeId: ratee.id, score: 2, anonymous: 'yes' }); // invalid -> false
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
    console.warn('[userRatings.test] DB unavailable — assertion not exercised this run');
    return true;
  }
  return false;
};

describe('anonymous field on submitRating', () => {
  test('defaults to false when the field is not sent', async () => {
    if (guard()) return;
    const row = await prisma.rating.findFirst({ where: { raterId: raterMulti.id, rateeId: ratee.id } });
    expect(row.anonymous).toBe(false);
  });

  test('stays false for a non-boolean value', async () => {
    if (guard()) return;
    const row = await prisma.rating.findFirst({ where: { raterId: raterInvalid.id, rateeId: ratee.id } });
    expect(row.anonymous).toBe(false);
  });

  test('stores true only for a literal true', async () => {
    if (guard()) return;
    const row = await prisma.rating.findFirst({ where: { raterId: raterAnon.id, rateeId: ratee.id } });
    expect(row.anonymous).toBe(true);
  });
});

describe('GET /api/users/:id/ratings', () => {
  test('aggregate + list for a user with ratings, newest first', async () => {
    if (guard()) return;
    const res = await getRatings(ratee.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.trustScore).toBe('number');
    expect(body.count).toBe(4);
    expect(body.ratings).toHaveLength(4);
    const times = body.ratings.map((r) => new Date(r.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a)); // desc
    expect(body.ratings.every((r) => 'score' in r && 'comment' in r && 'createdAt' in r && 'raterDisplayName' in r)).toBe(true);
  });

  test('non-anonymous review shows "First L."', async () => {
    if (guard()) return;
    const { ratings } = await (await getRatings(ratee.id)).json();
    const multi = ratings.find((r) => r.comment === 'Great driver');
    expect(multi.raterDisplayName).toBe('Alpha K.');
  });

  test('single-word rater name is shown as-is, no fabricated initial', async () => {
    if (guard()) return;
    const { ratings } = await (await getRatings(ratee.id)).json();
    const solo = ratings.find((r) => r.score === 4);
    expect(solo.raterDisplayName).toBe('Cher');
  });

  test('invalid anonymous value did not anonymize the review', async () => {
    if (guard()) return;
    const { ratings } = await (await getRatings(ratee.id)).json();
    const invalid = ratings.find((r) => r.score === 2);
    expect(invalid.raterDisplayName).toBe('Ivy N.');
  });

  test('anonymous review: raterDisplayName is null and NO rater id or name appears anywhere in the response', async () => {
    if (guard()) return;
    const res = await getRatings(ratee.id);
    const raw = await res.text();
    const body = JSON.parse(raw);

    const anon = body.ratings.find((r) => r.comment === 'ok' && r.score === 3);
    expect(anon).toBeTruthy();
    expect(anon.raterDisplayName).toBeNull();
    expect(Object.keys(anon).sort()).toEqual(['comment', 'createdAt', 'raterDisplayName', 'score']);

    // Nothing identifying the anonymous rater — not their id, not their name,
    // not "Zoe", not "Yankee" — in the entire payload.
    expect(raw).not.toContain(raterAnon.id);
    expect(raw).not.toContain('Zoe');
    expect(raw).not.toContain('Yankee');
  });

  test('user with no ratings → empty list, default trust score', async () => {
    if (guard()) return;
    const res = await getRatings(emptyUser.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.ratings).toEqual([]);
    expect(body.trustScore).toBe(5);
  });

  test('unknown user → 404', async () => {
    if (guard()) return;
    const res = await getRatings('no-such-user-id');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('USER_NOT_FOUND');
  });
});
