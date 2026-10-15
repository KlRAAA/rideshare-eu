require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');
const { buildWatchlist } = require('../services/watchlistService');

// A rider may ask several drivers for the same time. Once one approves, the
// other requests at that time are withdrawn, and no second driver can approve
// them for an overlapping trip.

let server;
let base;
let dbUp = false;
const bag = newBag();
const approve = (matchId, hostId) =>
  fetch(`${base}/api/matches/${matchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...bearer(hostId) },
    body: JSON.stringify({ status: 'APPROVED' }),
  });

// Philippine wall-clock time, three days from now.
const DAY = new Date(phDateOnly(new Date()).getTime() + 3 * 86400000);
const at = (hh, mm = 0) => new Date(DAY.getTime() + ((hh - 8) * 60 + mm) * 60000);

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
const guard = () => !dbUp;

async function tripAt(departure, overrides = {}) {
  const driver = await makeUser(bag, { fullName: 'Overlap Driver' });
  const vehicle = await makeVehicle(bag, driver.id);
  const trip = await makeTrip(bag, driver.id, vehicle.id, { departureTime: departure, durationSeconds: 1800, ...overrides });
  return { driver, trip };
}

test('approval withdraws the rider’s other requests at that time, and tells each driver', async () => {
  if (guard()) return;
  const rider = await makeUser(bag, { fullName: 'Maria Overlap' });
  const a = await tripAt(at(7));
  const b = await tripAt(at(7, 10));
  const c = await tripAt(at(7, 5));
  const later = await tripAt(at(15)); // a different time: left alone
  const mA = await makeMatch(bag, a.trip.id, rider.id);
  const mB = await makeMatch(bag, b.trip.id, rider.id);
  const mC = await makeMatch(bag, c.trip.id, rider.id);
  const mLater = await makeMatch(bag, later.trip.id, rider.id);

  const res = await approve(mA.id, a.driver.id);
  expect(res.status).toBe(200);

  const status = async (m) => (await prisma.match.findUnique({ where: { id: m.id } })).status;
  expect(await status(mA)).toBe('APPROVED');
  expect(await status(mB)).toBe('CANCELLED');
  expect(await status(mC)).toBe('CANCELLED');
  expect(await status(mLater)).toBe('PENDING');

  const told = await prisma.notification.findFirst({ where: { userId: b.driver.id, relatedMatchId: mB.id } });
  expect(told).toMatchObject({ type: 'TRIP_UPDATED' });
  expect(told.message).toBe('Maria Overlap found another ride at that time and withdrew their request to join your trip to Enverga University.');
  const approved = await prisma.notification.findFirst({ where: { userId: rider.id, relatedMatchId: mA.id, type: 'APPROVAL' } });
  expect(approved.message).toMatch(/Your other 2 requests at that time were withdrawn\.$/);

  // Withdrawn before any approval: not a passenger cancellation on the watch list.
  const watch = await buildWatchlist();
  expect(watch.find((w) => w.userId === rider.id)).toBeUndefined();
});

test('a second driver can’t approve a rider who already has a ride at that time', async () => {
  if (guard()) return;
  const rider = await makeUser(bag, { fullName: 'Double Booked' });
  const a = await tripAt(at(9));
  const b = await tripAt(at(9, 15));
  await makeMatch(bag, a.trip.id, rider.id, { status: 'APPROVED' });
  const mB = await makeMatch(bag, b.trip.id, rider.id); // pending from before this rule

  const res = await approve(mB.id, b.driver.id);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: 'RIDER_ALREADY_BOOKED' });
  expect((await prisma.match.findUnique({ where: { id: mB.id } })).status).toBe('CANCELLED');
  expect((await prisma.trip.findUnique({ where: { id: b.trip.id } })).filledSeats).toBe(0);
});

test('two drivers approving at the same moment: only one gets the rider', async () => {
  if (guard()) return;
  const rider = await makeUser(bag, { fullName: 'Race Rider' });
  const a = await tripAt(at(11));
  const b = await tripAt(at(11));
  const mA = await makeMatch(bag, a.trip.id, rider.id);
  const mB = await makeMatch(bag, b.trip.id, rider.id);

  const results = await Promise.all([approve(mA.id, a.driver.id), approve(mB.id, b.driver.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const approvedCount = await prisma.match.count({ where: { passengerId: rider.id, status: 'APPROVED' } });
  expect(approvedCount).toBe(1);
});
