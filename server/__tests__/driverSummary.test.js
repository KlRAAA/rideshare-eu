require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');

// The driver's rides, riders and fuel share (sub-project H).

let server;
let base;
let dbUp = false;
const bag = newBag();
const get = (path, userId) => fetch(`${base}${path}`, { headers: bearer(userId) });

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

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms);
const run = (tripId, endedAt, extra = {}) =>
  prisma.tripRun.create({
    data: { tripId, runDate: phDateOnly(endedAt), status: 'COMPLETED', startedAt: endedAt, endedAt, plannedArrivalAt: endedAt, ...extra },
  });

test('rides, riders and fuel share, counted from completed trips and trip days', async () => {
  if (!dbUp) return;
  const host = await makeUser(bag, { fullName: 'Summary Host' });
  const car = (await makeVehicle(bag, host.id)).id;
  const riders = [];
  for (let i = 0; i < 3; i++) riders.push(await makeUser(bag));

  // One-time, completed: two riders, one with a snapshot share of 30, one using the trip's 25.
  const oneTime = await makeTrip(bag, host.id, car, { status: 'COMPLETED', departureTime: ago(2 * 60 * 1000), destinationAddress: 'MSEUF' });
  await makeMatch(bag, oneTime.id, riders[0].id, { status: 'COMPLETED', fuelShareAmount: 30 });
  await makeMatch(bag, oneTime.id, riders[1].id, { status: 'COMPLETED' });
  // One-time closed with nobody: not a ride.
  await makeTrip(bag, host.id, car, { status: 'COMPLETED', departureTime: ago(3 * 60 * 1000) });
  // Recurring: a day saved by End Trip, an older day without saved values (estimated), and one 40 days ago.
  const daily = await makeTrip(bag, host.id, car, { recurrenceType: 'DAILY', departureTime: ago(50 * DAY) });
  await makeMatch(bag, daily.id, riders[2].id, { status: 'APPROVED' });
  await run(daily.id, ago(60 * 1000), { riderCount: 3, fuelShareTotal: 75 });
  await run(daily.id, ago(DAY + 60 * 1000));
  await run(daily.id, ago(40 * DAY));
  // Someone else's ride: never counted.
  const other = await makeUser(bag);
  const theirs = await makeTrip(bag, other.id, (await makeVehicle(bag, other.id)).id, { status: 'COMPLETED', departureTime: ago(60 * 1000) });
  await makeMatch(bag, theirs.id, riders[0].id, { status: 'COMPLETED' });

  const all = await (await get('/api/driver/summary?period=all', host.id)).json();
  // One-time: 2 riders, 55. Recurring: 3 riders 75 + two estimated days of 1 rider × 25.
  expect(all.totals).toEqual({ rides: 4, riders: 7, fuelShare: 180 }); // 55 + 75 + 25 + 25
  expect(all.recent).toHaveLength(4);
  expect(all.recent[0]).toMatchObject({ tripId: daily.id, riders: 3, fuelShare: 75, estimated: false });
  expect(all.recent.find((r) => r.tripId === oneTime.id)).toMatchObject({ riders: 2, fuelShare: 55, destination: 'MSEUF', estimated: false });
  expect(all.recent.filter((r) => r.estimated)).toHaveLength(2);
  expect(all.weeks).toHaveLength(12);
  expect(all.weeks.reduce((n, w) => n + w.rides, 0)).toBe(4); // 12 weeks reach back 84 days
});

test('periods narrow the totals; a bad period is refused; you only see your own', async () => {
  if (!dbUp) return;
  const host = await makeUser(bag);
  const car = (await makeVehicle(bag, host.id)).id;
  const daily = await makeTrip(bag, host.id, car, { recurrenceType: 'DAILY', departureTime: ago(50 * DAY) });
  await run(daily.id, ago(60 * 1000), { riderCount: 2, fuelShareTotal: 50 });
  await run(daily.id, ago(40 * DAY), { riderCount: 1, fuelShareTotal: 25 });

  const month = await (await get('/api/driver/summary?period=month', host.id)).json();
  expect(month.totals).toEqual({ rides: 1, riders: 2, fuelShare: 50 });
  const week = await (await get('/api/driver/summary?period=week', host.id)).json();
  expect(week.totals.rides).toBe(1);
  const bad = await get('/api/driver/summary?period=year', host.id);
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toBe('INVALID_PERIOD');

  const stranger = await makeUser(bag);
  expect((await (await get('/api/driver/summary?period=all', stranger.id)).json()).totals).toEqual({ rides: 0, riders: 0, fuelShare: 0 });
});
