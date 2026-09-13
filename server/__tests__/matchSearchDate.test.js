require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

// The search form's DatePicker always collected a target date, but it never
// reached the API — every candidate was matched by time-of-day alone,
// regardless of whether the trip actually runs on the searched-for calendar
// date (a ONE_TIME trip on an unrelated date, a WEEKDAYS trip on a Saturday,
// etc. — see AGENTS.md). loadSearchCandidates now filters on this before
// either scoring path runs. Verified here via the show-all endpoint, which
// relaxes route-overlap/schedule but keeps hard constraints — exactly like
// matchShowAll.test.js already does for the destination/gender/familiar
// constraints, so a trip appearing or not here isolates the date filter
// specifically, not an unrelated route/time mismatch.

let server;
let base;
let dbUp = false;
const bag = newBag();
const SEARCH_DEST = { lat: 13.9357, lng: 121.622 };

const post = (path, token, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? bearer(token) : {}) },
    body: JSON.stringify(body),
  });

const searchBody = (passengerId, overrides = {}) => ({
  passengerId,
  origin: { lat: 14.5, lng: 121.0 },
  destination: SEARCH_DEST,
  departureMinutes: 420,
  flexWindowMinutes: 0,
  genderPreference: 'ANY',
  date: '2026-09-21', // a Monday
  ...overrides,
});

async function matchedTripIds(res) {
  const body = await res.json();
  return body.status === 'MATCHED' ? body.matches.map((m) => m.tripId) : [];
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
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[matchSearchDate.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('POST /api/matches/search and /show-all — date validation', () => {
  test.each([
    ['missing date', { date: undefined }],
    ['not zero-padded', { date: '2026-9-21' }],
    ['not a real date', { date: 'not-a-date' }],
  ])('search: %s → 400 INVALID_DATE', async (_label, override) => {
    const res = await post('/api/matches/search', 'u1', searchBody('u1', override));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_DATE');
  });

  test('show-all: missing date → 400 INVALID_DATE', async () => {
    const res = await post('/api/matches/show-all', 'u1', searchBody('u1', { date: undefined }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_DATE');
  });

  test('an invalid departureMinutes is still caught first, before the date is even checked', async () => {
    const res = await post('/api/matches/search', 'u1', searchBody('u1', { departureMinutes: null, date: undefined }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_DEPARTURE_MINUTES');
  });
});

describe('POST /api/matches/show-all — date eligibility', () => {
  let passenger;

  beforeAll(async () => {
    if (!dbUp) return;
    passenger = await makeUser(bag, { fullName: 'Date Search Passenger' });
  });

  test('a ONE_TIME trip appears only for its own PH-local date, not another — including the UTC/PH boundary case', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'One Time Host' });
    const vehicle = await makeVehicle(bag, host.id);
    // 2026-09-20T23:00Z = 7:00 AM PH on 2026-09-21 (Monday) — the thesis's own
    // stated peak commute time, deliberately straddling the UTC/PH boundary.
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      destinationLat: SEARCH_DEST.lat,
      destinationLng: SEARCH_DEST.lng,
      recurrenceType: 'ONE_TIME',
      departureTime: new Date('2026-09-20T23:00:00Z'),
    });

    const onOwnDate = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-21' }));
    expect(await matchedTripIds(onOwnDate)).toContain(trip.id);

    // The raw UTC calendar day of the same instant — must NOT match; this is
    // exactly the bug a naive UTC-day comparison would reintroduce.
    const onUtcDate = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-20' }));
    expect(await matchedTripIds(onUtcDate)).not.toContain(trip.id);

    const onUnrelatedDate = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-22' }));
    expect(await matchedTripIds(onUnrelatedDate)).not.toContain(trip.id);
  });

  test('a WEEKDAYS trip matches a Tuesday search but not a Saturday one', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Weekdays Host' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      destinationLat: SEARCH_DEST.lat,
      destinationLng: SEARCH_DEST.lng,
      recurrenceType: 'WEEKDAYS',
      departureTime: new Date('2026-09-01T22:00:00Z'), // 6:00 AM PH, Sep 2 (start date)
    });

    const tuesday = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-08' }));
    expect(await matchedTripIds(tuesday)).toContain(trip.id);

    const saturday = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-12' }));
    expect(await matchedTripIds(saturday)).not.toContain(trip.id);
  });

  test('a CUSTOM trip matches only its configured days', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Custom Days Host' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      destinationLat: SEARCH_DEST.lat,
      destinationLng: SEARCH_DEST.lng,
      recurrenceType: 'CUSTOM',
      customDays: [2, 4], // Tue, Thu
      departureTime: new Date('2026-09-01T22:00:00Z'),
    });

    const tuesday = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-08' }));
    expect(await matchedTripIds(tuesday)).toContain(trip.id);

    const wednesday = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-09-09' }));
    expect(await matchedTripIds(wednesday)).not.toContain(trip.id);
  });

  test('a DAILY trip matches any date on or after it started, not before', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Daily Host' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      destinationLat: SEARCH_DEST.lat,
      destinationLng: SEARCH_DEST.lng,
      recurrenceType: 'DAILY',
      departureTime: new Date('2026-09-01T22:00:00Z'), // 6:00 AM PH, Sep 2
    });

    const afterStart = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-10-01' }));
    expect(await matchedTripIds(afterStart)).toContain(trip.id);

    const beforeStart = await post('/api/matches/show-all', passenger.id, searchBody(passenger.id, { date: '2026-08-01' }));
    expect(await matchedTripIds(beforeStart)).not.toContain(trip.id);
  });
});
