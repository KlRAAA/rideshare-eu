require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { phDateOnly } = require('../services/recurrenceMath');
const { askAt } = require('../services/tripDayRules');
const { settleTrips } = require('../services/tripDayService');
const { NO_SHOW_CANCEL_REASON } = require('../services/tripCancellationService');
const { buildWatchlist } = require('../services/watchlistService');

// The automatic steps of a trip day (sub-project D), with a fixed clock.
// settleTrips is given only this file's trips, never the whole database.

let dbUp = false;
const bag = newBag();
beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});
afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

const MIN = 60 * 1000;
const DAY_MS = 24 * 60 * MIN;
// A month ahead, so every trip here was created well before its 8 PM ask.
const DEP = new Date(Math.ceil(Date.now() / MIN) * MIN + 30 * DAY_MS);
const DAY = phDateOnly(DEP);
const ASK = askAt(DAY);

async function seedTrip({ approved = 1, pending = 0, ...over } = {}) {
  const host = await makeUser(bag, { fullName: 'Steps Host' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, { departureTime: DEP, durationSeconds: 1800, ...over });
  const riders = [];
  for (const status of [...Array(approved).fill('APPROVED'), ...Array(pending).fill('PENDING')]) {
    const rider = await makeUser(bag, { fullName: 'Steps Rider' });
    const match = await makeMatch(bag, trip.id, rider.id, { status });
    riders.push({ rider, match });
  }
  return { host, trip, riders };
}
const load = (id) => prisma.trip.findUnique({ where: { id }, include: { matches: true, host: true } });
const settleAt = async (tripId, now) => {
  const trip = await load(tripId);
  await settleTrips([trip], now);
  return trip;
};
const count = (userId, type, tripId) => prisma.notification.count({ where: { userId, type, relatedTripId: tripId } });
const runRow = (trip, status) =>
  prisma.tripRun.create({ data: { tripId: trip.id, runDate: DAY, status, plannedArrivalAt: DEP } });

describe('asking the driver the evening before', () => {
  test('one question at 8 PM, never twice', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip();
    await settleAt(trip.id, new Date(ASK.getTime() - MIN));
    expect(await count(host.id, 'CONFIRM_REQUEST', trip.id)).toBe(0);
    await settleAt(trip.id, new Date(ASK.getTime() + 5 * MIN));
    await settleAt(trip.id, new Date(ASK.getTime() + 10 * MIN));
    const asked = await prisma.notification.findMany({ where: { userId: host.id, type: 'CONFIRM_REQUEST', relatedTripId: trip.id } });
    expect(asked).toHaveLength(1);
    expect(asked[0].occurrenceDate).toEqual(DAY);
  });

  test('not asked with no riders, or for a trip posted after 8 PM', async () => {
    if (guard()) return;
    const { host: lonely, trip: empty } = await seedTrip({ approved: 0 });
    await settleAt(empty.id, new Date(ASK.getTime() + 5 * MIN));
    expect(await count(lonely.id, 'CONFIRM_REQUEST', empty.id)).toBe(0);

    const { host, trip } = await seedTrip();
    await prisma.trip.update({ where: { id: trip.id }, data: { createdAt: new Date(ASK.getTime() + MIN) } });
    await settleAt(trip.id, new Date(ASK.getTime() + 5 * MIN));
    expect(await count(host.id, 'CONFIRM_REQUEST', trip.id)).toBe(0);
  });
});

describe('warning riders', () => {
  test('an hour before, only when the driver was asked and has not confirmed', async () => {
    if (guard()) return;
    const before = new Date(DEP.getTime() - 30 * MIN);

    const asked = await seedTrip();
    await settleAt(asked.trip.id, new Date(ASK.getTime() + 5 * MIN));
    await settleAt(asked.trip.id, before);
    await settleAt(asked.trip.id, new Date(before.getTime() + 5 * MIN));
    expect(await count(asked.riders[0].rider.id, 'DRIVER_UNCONFIRMED', asked.trip.id)).toBe(1);

    const confirmed = await seedTrip();
    await settleAt(confirmed.trip.id, new Date(ASK.getTime() + 5 * MIN));
    await runRow(confirmed.trip, 'CONFIRMED');
    await settleAt(confirmed.trip.id, before);
    expect(await count(confirmed.riders[0].rider.id, 'DRIVER_UNCONFIRMED', confirmed.trip.id)).toBe(0);

    const neverAsked = await seedTrip();
    await settleAt(neverAsked.trip.id, before);
    expect(await count(neverAsked.riders[0].rider.id, 'DRIVER_UNCONFIRMED', neverAsked.trip.id)).toBe(0);
  });

  test('15 minutes after departure without a start, once', async () => {
    if (guard()) return;
    const { trip, riders } = await seedTrip();
    await settleAt(trip.id, new Date(DEP.getTime() + 20 * MIN));
    await settleAt(trip.id, new Date(DEP.getTime() + 25 * MIN));
    expect(await count(riders[0].rider.id, 'DRIVER_LATE', trip.id)).toBe(1);
  });
});

describe('no-shows', () => {
  const late = new Date(DEP.getTime() + 61 * MIN);

  test('a one-time trip is cancelled quietly and riders are told the driver did not come', async () => {
    if (guard()) return;
    const { trip, riders } = await seedTrip({ pending: 1 });
    const settled = await settleAt(trip.id, late);
    expect(settled.status).toBe('CANCELLED');

    const run = await prisma.tripRun.findUnique({ where: { tripId_runDate: { tripId: trip.id, runDate: DAY } } });
    expect(run).toMatchObject({ status: 'NO_SHOW' });
    expect(run.endedAt).toEqual(late);
    const after = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    expect(after).toMatchObject({ status: 'CANCELLED', cancelReason: NO_SHOW_CANCEL_REASON });
    expect(after.matches.every((m) => m.status === 'CANCELLED')).toBe(true);
    expect(await count(riders[0].rider.id, 'DRIVER_NO_SHOW', trip.id)).toBe(1);
    expect(await count(riders[0].rider.id, 'CANCELLATION', trip.id)).toBe(0);
  });

  test('a recurring trip marks only that day; approved riders stay, pending requests lapse', async () => {
    if (guard()) return;
    const { trip, riders } = await seedTrip({ recurrenceType: 'DAILY', pending: 1 });
    await settleAt(trip.id, late);
    const after = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    expect(after.status).toBe('OPEN');
    expect(after.matches.find((m) => m.id === riders[0].match.id).status).toBe('APPROVED');
    expect(after.matches.find((m) => m.id === riders[1].match.id).status).toBe('DECLINED');
    const run = await prisma.tripRun.findUnique({ where: { tripId_runDate: { tripId: trip.id, runDate: DAY } } });
    expect(run.status).toBe('NO_SHOW');
    expect(await count(riders[0].rider.id, 'DRIVER_NO_SHOW', trip.id)).toBe(1);
  });

  test('a one-time trip nobody was approved for just closes, without a rating prompt', async () => {
    if (guard()) return;
    const { host, trip } = await seedTrip({ approved: 0, pending: 1 });
    await settleAt(trip.id, late);
    const after = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    expect(after.status).toBe('COMPLETED');
    expect(after.matches[0].status).toBe('DECLINED');
    expect(await prisma.tripRun.count({ where: { tripId: trip.id } })).toBe(0);
    expect(await count(host.id, 'RATING_PROMPT', trip.id)).toBe(0);
  });

  test('a skipped day is left alone', async () => {
    if (guard()) return;
    const { trip, riders } = await seedTrip({ recurrenceType: 'DAILY' });
    await runRow(trip, 'SKIPPED');
    await settleAt(trip.id, late);
    expect(await count(riders[0].rider.id, 'DRIVER_NO_SHOW', trip.id)).toBe(0);
    expect((await prisma.tripRun.findFirst({ where: { tripId: trip.id } })).status).toBe('SKIPPED');
  });
});

test('the watch list shows 2 no-shows and does not count them as host cancellations', async () => {
  if (guard()) return;
  const host = await makeUser(bag, { fullName: 'Steps Noshow' });
  const vehicle = await makeVehicle(bag, host.id);
  const rider = await makeUser(bag, { fullName: 'Steps Waiting' });
  for (let i = 0; i < 2; i++) {
    const trip = await makeTrip(bag, host.id, vehicle.id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: NO_SHOW_CANCEL_REASON,
    });
    await makeMatch(bag, trip.id, rider.id, { status: 'CANCELLED', respondedAt: new Date() });
    await prisma.tripRun.create({
      data: { tripId: trip.id, runDate: phDateOnly(new Date()), status: 'NO_SHOW', endedAt: new Date(), plannedArrivalAt: new Date() },
    });
  }
  const list = await buildWatchlist(new Date(Date.now() - 30 * DAY_MS));
  const entry = list.find((e) => e.userId === host.id);
  expect(entry.reasons).toEqual(['2 no-shows as driver']);
});
