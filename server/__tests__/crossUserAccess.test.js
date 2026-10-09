require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeLicense, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, makeNotification, cleanup } = require('../test-helpers/seed');

// User A creates private records through the API; user B, signed in but
// unrelated, tries to read, change and delete each one. Every attempt must be
// refused with 403 or 404, and A's records must be unchanged afterwards.
//
// A posted trip is not in this list as a "read": open trips are listings every
// signed-in student can see (Find a Ride). What stays private on a trip is
// checked instead: the plate, live location and chat, and every write.

let server;
let base;
let dbUp = false;
const bag = newBag();
const a = {};
let userA;
let userB;
const seen = []; // [attempt, status] — printed with SHOW_ACCESS_TABLE=1

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function created(res) {
  if (res.status !== 201 && res.status !== 200) throw new Error(`setup failed: ${res.status} ${await res.text()}`);
  return res.json();
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
  if (!dbUp) return;

  userA = await makeUser(bag, { fullName: 'Alice Owner' });
  userB = await makeUser(bag, { fullName: 'Bob Intruder' });
  const admin = await makeAdminUser(bag);
  const otherHost = await makeUser(bag, { fullName: 'Hana Host' });

  // A's saved car
  a.car = (await created(await call('POST', '/api/saved-vehicles', userA.id, {
    make: 'Toyota', model: 'Vios', color: 'White', plate: 'AAA 1111', fuelEfficiencyKmL: 14,
  }))).vehicle;

  // A's posted trip, with its own car snapshot
  const tripCar = (await created(await call('POST', '/api/vehicles', userA.id, {
    make: 'Toyota', model: 'Vios', color: 'White', plate: 'AAA 1111', fuelEfficiencyKmL: 14,
  }))).vehicle;
  bag.vehicleIds.push(tripCar.id);
  a.trip = (await created(await call('POST', '/api/trips', userA.id, {
    vehicleId: tripCar.id,
    originAddress: 'Lucena Grand Terminal', originLat: 13.94, originLng: 121.61,
    destinationAddress: 'MSEUF Lucena', destinationLat: 13.95, destinationLng: 121.62,
    departureTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    recurrenceType: 'ONE_TIME', totalSeats: 3, fuelPricePerLiter: 60,
  }))).trip;
  bag.tripIds.push(a.trip.id);
  a.tripDate = require('../services/recurrenceMath').phDateOnly(new Date(a.trip.departureTime)).toISOString().slice(0, 10);

  // A's support request, linked to A's own trip
  a.ticket = (await created(await call('POST', '/api/support', userA.id, {
    category: 'OTHER', subject: 'Question about my trip', body: 'How do I change the pickup point?', relatedTripId: a.trip.id,
  }))).ticket;

  // A's ride preferences
  await created(await call('PATCH', `/api/preferences/${userA.id}`, userA.id, { flexWindowMinutes: 30 }));

  // A's join request on someone else's trip
  const hostCar = await makeVehicle(bag, otherHost.id);
  const hostTrip = await makeTrip(bag, otherHost.id, hostCar.id, { departureTime: new Date(Date.now() + 2 * 86400000) });
  a.match = await makeMatch(bag, hostTrip.id, userA.id);

  // A notification and an official warning addressed to A
  a.notification = await makeNotification(bag, userA.id);
  a.warning = (await created(await call('POST', `/api/admin/users/${userA.id}/warnings`, admin.id, { reason: 'LATE_OR_NO_SHOW' }))).warning;
  a.license = await makeLicense(bag, userA.id, { status: 'PENDING', decidedAt: null });
});

afterAll(async () => {
  if (process.env.SHOW_ACCESS_TABLE === '1') {
    const lines = seen.map(([label, status]) => `${status}  B tries to ${label}`);
    process.stdout.write(['', ...lines, ''].join('\n'));
  }
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const ATTEMPTS = [
  // Saved cars
  ['update A’s saved car', 'PATCH', () => `/api/saved-vehicles/${a.car.id}`, { color: 'Black' }],
  ['make A’s saved car B’s default', 'POST', () => `/api/saved-vehicles/${a.car.id}/default`],
  ['delete A’s saved car', 'DELETE', () => `/api/saved-vehicles/${a.car.id}`],
  // Trip: private parts and every write
  ['read the live location on A’s trip', 'GET', () => `/api/trips/${a.trip.id}/location`],
  ['read the chat on A’s trip', 'GET', () => `/api/trips/${a.trip.id}/messages`],
  ['post in the chat on A’s trip', 'POST', () => `/api/trips/${a.trip.id}/messages`, { body: 'hello' }],
  ['edit A’s trip', 'PATCH', () => `/api/trips/${a.trip.id}`, { driverNotes: 'hijacked' }],
  ['share a location as A’s trip', 'POST', () => `/api/trips/${a.trip.id}/location`, { lat: 13.9, lng: 121.6 }],
  ['mark A’s trip completed', 'POST', () => `/api/trips/${a.trip.id}/complete`],
  ['cancel A’s trip', 'PATCH', () => `/api/trips/${a.trip.id}/cancel`, { reason: 'hijacked' }],
  ['confirm a day of A’s trip', 'POST', () => `/api/trips/${a.trip.id}/days/${a.tripDate}/confirm`],
  ['skip a day of A’s trip', 'POST', () => `/api/trips/${a.trip.id}/days/${a.tripDate}/skip`, { reason: 'hijacked' }],
  ['undo a skipped day of A’s trip', 'DELETE', () => `/api/trips/${a.trip.id}/days/${a.tripDate}/skip`],
  ['read the riders’ locations on A’s trip', 'GET', () => `/api/trips/${a.trip.id}/rider-locations`],
  ['post a rider location on A’s trip', 'POST', () => `/api/trips/${a.trip.id}/rider-location`, { lat: 13.9, lng: 121.6 }],
  // Support request
  ['read A’s support request', 'GET', () => `/api/support/${a.ticket.id}`],
  ['reply to A’s support request', 'POST', () => `/api/support/${a.ticket.id}/messages`, { body: 'hijacked' }],
  ['close A’s support request', 'PATCH', () => `/api/support/${a.ticket.id}/close`],
  // Preferences
  ['read A’s preferences', 'GET', () => `/api/preferences/${userA.id}`],
  ['change A’s preferences', 'PATCH', () => `/api/preferences/${userA.id}`, { flexWindowMinutes: 120 }],
  // Join request (B is neither the passenger nor the host)
  ['approve A’s join request', 'PATCH', () => `/api/matches/${a.match.id}`, { status: 'APPROVED' }],
  ['switch location sharing on A’s join request', 'PATCH', () => `/api/matches/${a.match.id}/location-sharing`, { on: true }],
  ['rate on A’s join request', 'POST', () => `/api/matches/${a.match.id}/ratings`, () => ({ rateeId: userA.id, score: 1 })],
  // Notification and warning
  ['mark A’s notification read', 'PATCH', () => `/api/alerts/${a.notification.id}/read`],
  ['acknowledge A’s warning', 'PATCH', () => `/api/warnings/${a.warning.id}/acknowledge`],
  // Admin view of A (B is not an admin)
  ['open A’s admin record', 'GET', () => `/api/admin/users/${userA.id}`],
  ['view A’s license photo', 'GET', () => `/api/admin/licenses/${a.license.id}/photo`],
  ['approve A’s license', 'POST', () => `/api/admin/licenses/${a.license.id}/approve`],
  ['reject A’s license', 'POST', () => `/api/admin/licenses/${a.license.id}/reject`, { reason: 'UNREADABLE' }],
];

describe('user B cannot read, change or delete user A’s records', () => {
  const rows = ATTEMPTS.map(([label, method, path, body]) => ({ label, method, path, body }));
  test.each(rows)('B tries to $label → 403 or 404', async ({ label, method, path, body }) => {
    if (!dbUp) return;
    const res = await call(method, path(), userB.id, typeof body === 'function' ? body() : body);
    await res.arrayBuffer(); // drain, so the connection is free for the next request
    seen.push([label, res.status]);
    expect([403, 404]).toContain(res.status);
  });

  test('B’s own lists never include A’s records', async () => {
    if (!dbUp) return;
    const cars = (await (await call('GET', '/api/saved-vehicles', userB.id)).json()).vehicles;
    const tickets = (await (await call('GET', '/api/support', userB.id)).json()).tickets;
    const alerts = await (await call('GET', '/api/alerts', userB.id)).json();
    const warnings = (await (await call('GET', '/api/warnings/active', userB.id)).json()).warnings;
    expect(cars.map((c) => c.id)).not.toContain(a.car.id);
    expect(tickets.map((t) => t.id)).not.toContain(a.ticket.id);
    expect(JSON.stringify(alerts)).not.toContain(a.notification.id);
    expect(warnings.map((w) => w.id)).not.toContain(a.warning.id);
  });

  test('B sees A’s trip listing without the plate', async () => {
    if (!dbUp) return;
    const res = await call('GET', `/api/trips/${a.trip.id}`, userB.id);
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('AAA 1111');
  });

  // The Privacy Policy says other students see your name and photo, never your
  // school email or university ID.
  test.each([
    ['A’s trip listing (A is the host)', () => `/api/trips/${a.trip.id}`],
    ['a trip A asked to join (A is a passenger)', () => `/api/trips/${a.match.tripId}`],
    ['A’s public profile', () => `/api/users/${userA.id}`],
  ])('B never sees A’s email or university ID on %s', async (_label, path) => {
    if (!dbUp) return;
    const res = await call('GET', path(), userB.id);
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json()).toLowerCase();
    expect(body).not.toContain(userA.email.toLowerCase());
    expect(body).not.toContain(userA.universityId.toLowerCase());
  });

  test('A still sees their own email and university ID on their profile', async () => {
    if (!dbUp) return;
    const { user } = await (await call('GET', `/api/users/${userA.id}`, userA.id)).json();
    expect(user).toMatchObject({ email: userA.email, universityId: userA.universityId });
  });

  test('after every attempt, A’s records are unchanged', async () => {
    if (!dbUp) return;
    const [car, trip, ticket, pref, match, note, warning] = await Promise.all([
      prisma.savedVehicle.findUnique({ where: { id: a.car.id } }),
      prisma.trip.findUnique({ where: { id: a.trip.id } }),
      prisma.supportTicket.findUnique({ where: { id: a.ticket.id }, include: { messages: true } }),
      prisma.preference.findUnique({ where: { userId: userA.id } }),
      prisma.match.findUnique({ where: { id: a.match.id } }),
      prisma.notification.findUnique({ where: { id: a.notification.id } }),
      prisma.userWarning.findUnique({ where: { id: a.warning.id } }),
    ]);
    expect(car).toMatchObject({ color: 'White', isDefault: true });
    expect(trip).toMatchObject({ status: 'OPEN', driverNotes: null });
    expect(ticket.status).toBe('OPEN');
    expect(ticket.messages).toHaveLength(1);
    expect(pref.flexWindowMinutes).toBe(30);
    expect(match.status).toBe('PENDING');
    expect(note.isRead).toBe(false);
    expect(warning.acknowledgedAt).toBeNull();
    expect(await prisma.message.count({ where: { tripId: a.trip.id } })).toBe(0);
    expect(await prisma.rating.count({ where: { matchId: a.match.id } })).toBe(0);
  });
});
