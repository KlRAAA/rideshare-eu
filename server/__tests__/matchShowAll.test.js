require('dotenv').config({ quiet: true }); // jest doesn't load .env the way server.js does
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth'); // API now requires a session token

// Integration coverage for the Find a Ride empty-state fallback
// (POST /api/matches/show-all). Proves that the fallback:
//   - surfaces a destination-matching trip that normal PSGA rejects on route
//     overlap + schedule
//   - still anchors on the destination (a trip elsewhere never shows)
//   - still enforces the safety constraints the fallback must NOT relax:
//     the host's same-gender requirement and familiar-riders-only
// Skips (not fails) when no database is reachable, like tripEditDetail.test.js.

let server;
let base;
let dbUp = false;

const SEARCH_DEST = { lat: 13.9357, lng: 121.622 }; // MSEUF-ish; what the passenger searches for
const FAR_AWAY = { lat: 14.6, lng: 121.1 }; // ~70km off — outside the destination anchor

const seeded = { userIds: [], vehicleIds: [], tripIds: [] };

async function makeUser(fullName, universityId, gender) {
  const u = await prisma.user.create({
    data: {
      fullName,
      universityId,
      email: `${universityId}@test.local`,
      passwordHash: 'x',
      gender,
      role: 'STUDENT',
      verified: true,
    },
  });
  seeded.userIds.push(u.id);
  return u;
}

async function makeVehicle(ownerId) {
  const v = await prisma.vehicle.create({
    data: { ownerId, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12 },
  });
  seeded.vehicleIds.push(v.id);
  return v;
}

async function makeTrip(hostId, vehicleId, overrides = {}) {
  const t = await prisma.trip.create({
    data: {
      hostId,
      vehicleId,
      originAddress: 'Far Origin',
      originLat: 13.9,
      originLng: 121.61,
      destinationAddress: 'Dest',
      destinationLat: SEARCH_DEST.lat,
      destinationLng: SEARCH_DEST.lng,
      // 10:00 UTC → departureMinutes 600; passenger searches for 07:00 (420) with
      // a 0-minute window, so every seeded trip fails the Stage 1 time gate too.
      departureTime: new Date(Date.UTC(2099, 0, 1, 10, 0)),
      recurrenceType: 'ONE_TIME',
      customDays: [],
      totalSeats: 3,
      genderPreference: 'ANY',
      flexibleDeparture: false,
      flexWindowMinutes: 15,
      familiarRidersOnly: false,
      fuelSharePerSeat: 25,
      status: 'OPEN',
      ...overrides,
    },
  });
  seeded.tripIds.push(t.id);
  return t;
}

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch (e) {
    console.warn('[matchShowAll.test] no database reachable — skipping integration assertions:', e.code || e.message);
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (dbUp) {
    await prisma.notification.deleteMany({ where: { relatedTripId: { in: seeded.tripIds } } });
    await prisma.match.deleteMany({ where: { tripId: { in: seeded.tripIds } } });
    await prisma.trip.deleteMany({ where: { id: { in: seeded.tripIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: seeded.vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: seeded.userIds } } });
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

describe('POST /api/matches/show-all — Find a Ride empty-state fallback', () => {
  test('relaxes route/schedule but keeps destination + gender + familiar constraints', async () => {
    if (!dbUp) {
      console.warn('[matchShowAll.test] DB unavailable — assertions not exercised this run');
      return;
    }

    const stamp = Date.now();
    const maleHost = await makeUser('Male Host', `T-${stamp}-MH`, 'MALE');
    const femaleHost = await makeUser('Female Host', `T-${stamp}-FH`, 'FEMALE');
    const passenger = await makeUser('Male Passenger', `T-${stamp}-P`, 'MALE');

    const maleVehicle = await makeVehicle(maleHost.id);
    const femaleVehicle = await makeVehicle(femaleHost.id);

    // Should appear in the fallback: right destination, fails Stage 1 only.
    const tShowable = await makeTrip(maleHost.id, maleVehicle.id);
    // Should NOT appear: destination is far from what the passenger searched.
    const tFarDest = await makeTrip(maleHost.id, maleVehicle.id, {
      destinationLat: FAR_AWAY.lat,
      destinationLng: FAR_AWAY.lng,
    });
    // Should NOT appear: female host requires same-gender, passenger is male.
    const tSameGender = await makeTrip(femaleHost.id, femaleVehicle.id, { genderPreference: 'SAME_GENDER' });
    // Should NOT appear: host requires familiar riders, passenger has no history.
    const tFamiliarOnly = await makeTrip(maleHost.id, maleVehicle.id, { familiarRidersOnly: true });

    const body = {
      passengerId: passenger.id,
      origin: { lat: 14.5, lng: 121.0 }, // far from every seeded trip's corridor
      destination: SEARCH_DEST,
      departureMinutes: 420,
      // Every seeded trip departs 2099-01-01T10:00Z, which is still
      // 2099-01-01 in Philippine-local terms (10:00 UTC + 8h = 18:00 UTC,
      // no calendar-day rollover) — matches each ONE_TIME trip's own date.
      date: '2099-01-01',
      flexWindowMinutes: 0,
      genderPreference: 'ANY',
    };
    const post = (path) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearer(passenger.id) },
        body: JSON.stringify(body),
      }).then((r) => r.json());

    // Normal search finds nothing — this is the state that reveals the fallback.
    const normal = await post('/api/matches/search');
    expect(normal.status).toBe('NO_MATCH');

    const fallback = await post('/api/matches/show-all');
    expect(fallback.status).toBe('MATCHED');

    const ids = fallback.matches.map((m) => m.tripId);
    expect(ids).toContain(tShowable.id);
    expect(ids).not.toContain(tFarDest.id); // destination anchor kept
    expect(ids).not.toContain(tSameGender.id); // gender constraint NOT relaxed
    expect(ids).not.toContain(tFamiliarOnly.id); // familiar-riders constraint NOT relaxed
  });
});

// No DB needed — the departureMinutes guard runs before any query. Regression
// for: an empty Find a Ride time field sent `departureMinutes: null`, which
// used to reach runPSGA and coerce to a 00:00 comparison instead of erroring.
describe('departureMinutes validation (both search endpoints)', () => {
  const post = (path, body) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer() },
      body: JSON.stringify(body),
    });

  // passengerId is no longer a request field (phase 2 — it's req.user.id), so
  // the body carries only the time value being validated.
  test.each([
    ['/api/matches/search', { departureMinutes: null }],
    ['/api/matches/search', {}], // missing
    ['/api/matches/search', { departureMinutes: 1440 }], // out of range
    ['/api/matches/search', { departureMinutes: '60' }], // string
    ['/api/matches/show-all', { departureMinutes: null }],
    ['/api/matches/show-all', { departureMinutes: -1 }],
  ])('%s → 400 INVALID_DEPARTURE_MINUTES for %o', async (path, body) => {
    const res = await post(path, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_DEPARTURE_MINUTES');
  });
});
