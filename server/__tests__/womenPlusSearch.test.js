require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Women+ spec §5 and S1, S4–S6, S10, S11, S16, S26: trips a rider can't join
// are removed before scoring, in both the normal search and Show all.

let server;
let base;
let dbUp = false;
const bag = newBag();

const ORIGIN = { lat: 13.9, lng: 121.6 };
const DEST = { lat: 13.9357, lng: 121.622 };
// 23:00 UTC = 07:00 in the Philippines on the next day (Tuesday 2099-01-06).
const DEPARTS = new Date('2099-01-05T23:00:00Z');
const DATE = '2099-01-06';

const riders = {};
const trips = {};

const post = (path, userId, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: JSON.stringify(body),
  });

const searchBody = (genderPreference = 'ANY') => ({
  origin: ORIGIN,
  destination: DEST,
  departureMinutes: 23 * 60,
  flexWindowMinutes: 30,
  genderPreference,
  date: DATE,
});

async function found(path, rider, genderPreference) {
  const res = await post(path, rider.id, searchBody(genderPreference));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(JSON.stringify(body)).not.toMatch(/"gender"/);
  return body.status === 'MATCHED' ? body.matches.map((m) => m.tripId) : [];
}

const BOTH = ['/api/matches/search', '/api/matches/show-all'];

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

  const tripAt = async (host, overrides = {}) =>
    makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id, {
      originLat: ORIGIN.lat,
      originLng: ORIGIN.lng,
      destinationLat: DEST.lat,
      destinationLng: DEST.lng,
      departureTime: DEPARTS,
      ...overrides,
    });

  const womanHost = await makeUser(bag, { fullName: 'W Host', gender: 'WOMAN' });
  const manHost = await makeUser(bag, { fullName: 'M Host', gender: 'MAN' });
  const familiarHost = await makeUser(bag, { fullName: 'F Host', gender: 'MAN' });
  trips.womenPlus = await tripAt(womanHost, { genderPreference: 'WOMEN_PLUS' });
  trips.womenPlusDaily = await tripAt(womanHost, { genderPreference: 'WOMEN_PLUS', recurrenceType: 'DAILY' });
  trips.open = await tripAt(manHost);
  trips.familiar = await tripAt(familiarHost, { familiarRidersOnly: true });

  riders.man = await makeUser(bag, { gender: 'MAN' });
  riders.nonBinary = await makeUser(bag, { gender: 'NON_BINARY' });
  riders.notSaying = await makeUser(bag, { gender: 'PREFER_NOT_TO_SAY' });
  riders.woman = await makeUser(bag, { gender: 'WOMAN' });
  riders.familiar = await makeUser(bag, { gender: 'MAN' });
  const earlier = await tripAt(familiarHost, { status: 'COMPLETED', departureTime: new Date('2026-01-05T23:00:00Z') });
  await makeMatch(bag, earlier.id, riders.familiar.id, { status: 'COMPLETED' });
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[womenPlusSearch.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe.each(BOTH)('%s', (path) => {
  test('S1/S16: a man never sees Women+ trips, one-time or recurring', async () => {
    if (guard()) return;
    const ids = await found(path, riders.man);
    expect(ids).toContain(trips.open.id);
    expect(ids).not.toContain(trips.womenPlus.id);
    expect(ids).not.toContain(trips.womenPlusDaily.id);
  });

  test('S4: a non-binary rider sees Women+ and open trips', async () => {
    if (guard()) return;
    const ids = await found(path, riders.nonBinary);
    expect(ids).toEqual(expect.arrayContaining([trips.womenPlus.id, trips.open.id]));
  });

  test('S5: prefer-not-to-say sees open trips only', async () => {
    if (guard()) return;
    const ids = await found(path, riders.notSaying);
    expect(ids).toContain(trips.open.id);
    expect(ids).not.toContain(trips.womenPlus.id);
  });

  test('S6: "Women+ trips only" shows only Women+ trips', async () => {
    if (guard()) return;
    const ids = await found(path, riders.woman, 'WOMEN_PLUS');
    expect(ids).toContain(trips.womenPlus.id);
    expect(ids).not.toContain(trips.open.id);
  });

  test('a man asking for Women+ trips is treated as All trips', async () => {
    if (guard()) return;
    const ids = await found(path, riders.man, 'WOMEN_PLUS');
    expect(ids).toContain(trips.open.id);
    expect(ids).not.toContain(trips.womenPlus.id);
  });

  test('S10/S11: familiar-riders-only trips show only to riders who rode with the host', async () => {
    if (guard()) return;
    expect(await found(path, riders.man)).not.toContain(trips.familiar.id);
    expect(await found(path, riders.familiar)).toContain(trips.familiar.id);
  });
});
