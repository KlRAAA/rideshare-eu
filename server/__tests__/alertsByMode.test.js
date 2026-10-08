require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeNotification, cleanup } = require('../test-helpers/seed');

// GET /api/alerts?mode= (sub-project C): Driver mode shows notifications about
// trips you host, Passenger mode the others; ones without a trip show in both.

let server;
let base;
let dbUp = false;
const bag = newBag();
const get = (path, userId) => fetch(`${base}${path}`, { headers: bearer(userId) }).then((r) => r.json());

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

test('each mode gets its own notifications plus account-wide ones, and a count of the other side', async () => {
  if (!dbUp) return;
  const me = await makeUser(bag, { fullName: 'Two Hats' });
  const other = await makeUser(bag, { fullName: 'Other Driver' });
  const myCar = await makeVehicle(bag, me.id);
  const theirCar = await makeVehicle(bag, other.id);
  const hosted = await makeTrip(bag, me.id, myCar.id);
  const riding = await makeTrip(bag, other.id, theirCar.id);
  const request = await makeNotification(bag, me.id, { type: 'MATCH_REQUEST', relatedTripId: hosted.id });
  const approval = await makeNotification(bag, me.id, { type: 'APPROVAL', relatedTripId: riding.id });
  const news = await makeNotification(bag, me.id, { type: 'ANNOUNCEMENT' });
  const ids = (body) => body.notifications.map((n) => n.id).sort();

  const driver = await get('/api/alerts?mode=driver', me.id);
  expect(ids(driver)).toEqual([request.id, news.id].sort());
  expect(driver.otherModeUnread).toBe(1);

  const passenger = await get('/api/alerts?mode=passenger', me.id);
  expect(ids(passenger)).toEqual([approval.id, news.id].sort());
  expect(passenger.otherModeUnread).toBe(1);

  const all = await get('/api/alerts', me.id);
  expect(ids(all)).toEqual([request.id, approval.id, news.id].sort());
  expect(all.otherModeUnread).toBeUndefined();
});
