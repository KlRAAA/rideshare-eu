require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');

// My Trips sorts and filters past trips by when they last happened
// (`lastActiveAt`): a cancelled trip by its cancellation, a repeating trip
// by its most recent driven day, any other by its departure.

let server;
let base;
let dbUp = false;
const bag = newBag();
const DAY = 24 * 60 * 60 * 1000;

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

test('each trip carries the date it last happened', async () => {
  if (!dbUp) return;
  const host = await makeUser(bag);
  const vehicle = await makeVehicle(bag, host.id);
  const oneTime = await makeTrip(bag, host.id, vehicle.id);
  const cancelledAt = new Date(Date.now() - 2 * DAY);
  const cancelled = await makeTrip(bag, host.id, vehicle.id, { status: 'CANCELLED', cancelledAt, departureTime: new Date(Date.now() + 9 * DAY) });
  const weekly = await makeTrip(bag, host.id, vehicle.id, {
    recurrenceType: 'DAILY',
    status: 'COMPLETED',
    departureTime: new Date(Date.now() - 40 * DAY),
  });
  const drove = new Date(Date.now() - 3 * DAY);
  await prisma.tripRun.create({
    data: { tripId: weekly.id, runDate: phDateOnly(drove), status: 'COMPLETED', startedAt: drove, endedAt: drove, plannedArrivalAt: drove },
  });

  const res = await fetch(`${base}/api/trips/mine`, { headers: bearer(host.id) });
  expect(res.status).toBe(200);
  const { hosted } = await res.json();
  const at = (id) => hosted.find((t) => t.id === id).lastActiveAt;
  expect(at(oneTime.id)).toBe(oneTime.departureTime.toISOString());
  expect(at(cancelled.id)).toBe(cancelledAt.toISOString());
  expect(at(weekly.id)).toBe(drove.toISOString());
});
