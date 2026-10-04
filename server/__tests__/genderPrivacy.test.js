require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Women+ spec S26: a user's gender is returned only on their own profile and
// to admins. Every other response that embeds a user must leave it out.

let server;
let base;
let dbUp = false;
const bag = newBag();
const DEST = { lat: 13.9357, lng: 121.622 };

let host;
let passenger;
let admin;
let trip;

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const noGender = (body) => expect(JSON.stringify(body)).not.toMatch(/"gender"/);

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
  host = await makeUser(bag, { fullName: 'Privacy Host', gender: 'WOMAN' });
  passenger = await makeUser(bag, { fullName: 'Privacy Rider', gender: 'MAN' });
  admin = await makeAdminUser(bag, { fullName: 'Privacy Admin' });
  const vehicle = await makeVehicle(bag, host.id);
  trip = await makeTrip(bag, host.id, vehicle.id, {
    destinationLat: DEST.lat,
    destinationLng: DEST.lng,
    departureTime: new Date('2099-01-05T23:00:00Z'),
  });
  await makeMatch(bag, trip.id, passenger.id, { status: 'APPROVED' });
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[genderPrivacy.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('gender is never sent to other users', () => {
  test('trip details, my trips, another profile and show-all leave it out', async () => {
    if (guard()) return;
    const detail = await call('GET', `/api/trips/${trip.id}`, passenger.id);
    expect(detail.status).toBe(200);
    noGender(await detail.json());

    const mineHost = await call('GET', '/api/trips/mine', host.id);
    noGender(await mineHost.json());
    const minePassenger = await call('GET', '/api/trips/mine', passenger.id);
    noGender(await minePassenger.json());

    const profile = await call('GET', `/api/users/${host.id}`, passenger.id);
    expect(profile.status).toBe(200);
    noGender(await profile.json());

    const showAll = await call('POST', '/api/matches/show-all', passenger.id, {
      origin: { lat: 14.5, lng: 121.0 },
      destination: DEST,
      departureMinutes: 420,
      flexWindowMinutes: 30,
      genderPreference: 'ANY',
      date: '2099-01-06',
    });
    expect(showAll.status).toBe(200);
    noGender(await showAll.json());
  });

  test('your own profile includes your gender', async () => {
    if (guard()) return;
    const res = await call('GET', `/api/users/${host.id}`, host.id);
    expect((await res.json()).user.gender).toBe('WOMAN');
  });

  test('admins see the declared gender on the user page (D10)', async () => {
    if (guard()) return;
    const res = await call('GET', `/api/admin/users/${passenger.id}`, admin.id);
    expect(res.status).toBe(200);
    expect((await res.json()).user.gender).toBe('MAN');
  });
});
