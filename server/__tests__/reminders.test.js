require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { upcomingDeparture, sendDueReminders } = require('../services/reminderService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Dates are in 2020 so no trip in a shared dev database has started yet and
// none of them get reminders during these runs.
// 2020-06-01T00:00Z is Monday 8:00 AM in the Philippines.
const FIRST_DEPARTURE = new Date('2020-06-01T00:00:00Z');
const at = (iso) => new Date(iso);

describe('upcomingDeparture', () => {
  const daily = { recurrenceType: 'DAILY', departureTime: FIRST_DEPARTURE, customDays: [] };
  const weekdays = { ...daily, recurrenceType: 'WEEKDAYS' };
  const oneTime = { ...daily, recurrenceType: 'ONE_TIME' };

  test("finds a daily trip's run on a later day, dated by its Philippine day", () => {
    // Wednesday 7:30 AM PH, half an hour before that day's 8:00 run.
    expect(upcomingDeparture(daily, at('2020-06-02T23:30:00Z'))).toEqual({
      departure: at('2020-06-03T00:00:00Z'),
      occurrenceDate: at('2020-06-03T00:00:00Z'),
    });
  });

  test('nothing when the next run is more than an hour away', () => {
    expect(upcomingDeparture(daily, at('2020-06-02T22:00:00Z'))).toBeNull();
  });

  test('a weekday trip has no Saturday run, judged in Philippine time', () => {
    // Friday 23:30 UTC is already Saturday 7:30 AM in the Philippines.
    expect(upcomingDeparture(weekdays, at('2020-06-05T23:30:00Z'))).toBeNull();
    expect(upcomingDeparture(weekdays, at('2020-06-04T23:30:00Z'))).not.toBeNull(); // Friday PH
  });

  test('no runs before the first departure day', () => {
    expect(upcomingDeparture(daily, at('2020-05-30T23:30:00Z'))).toBeNull();
  });

  test('a one-time trip only has its own departure, with no occurrence date', () => {
    expect(upcomingDeparture(oneTime, at('2020-05-31T23:30:00Z'))).toEqual({
      departure: FIRST_DEPARTURE,
      occurrenceDate: null,
    });
    expect(upcomingDeparture(oneTime, at('2020-06-02T23:30:00Z'))).toBeNull();
  });
});

describe('sendDueReminders', () => {
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

  const guard = () => {
    if (!dbUp) console.warn('[reminders.test] DB unavailable — assertion not exercised this run');
    return !dbUp;
  };

  async function seed(recurrenceType) {
    const host = await makeUser(bag, { fullName: 'Reminder Host' });
    const rider = await makeUser(bag, { fullName: 'Reminder Rider' });
    const requester = await makeUser(bag, { fullName: 'Pending Requester' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { recurrenceType, departureTime: FIRST_DEPARTURE });
    await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });
    await makeMatch(bag, trip.id, requester.id, { status: 'PENDING' });
    return { host, rider, requester, trip };
  }

  const remindersFor = (tripId) =>
    prisma.notification.findMany({ where: { type: 'REMINDER', relatedTripId: tripId }, orderBy: { createdAt: 'asc' } });

  test('a daily trip reminds the host and approved rider before every day, once per day', async () => {
    if (guard()) return;
    const { host, rider, trip } = await seed('DAILY');

    await sendDueReminders(at('2020-06-02T23:30:00Z')); // Wednesday's run
    await sendDueReminders(at('2020-06-02T23:35:00Z')); // same day, next 5-minute run
    await sendDueReminders(at('2020-06-03T23:30:00Z')); // Thursday's run

    const reminders = await remindersFor(trip.id);
    expect(reminders).toHaveLength(4);
    expect(new Set(reminders.map((n) => n.userId))).toEqual(new Set([host.id, rider.id]));
    expect(reminders.map((n) => n.occurrenceDate.toISOString()).sort()).toEqual([
      '2020-06-03T00:00:00.000Z',
      '2020-06-03T00:00:00.000Z',
      '2020-06-04T00:00:00.000Z',
      '2020-06-04T00:00:00.000Z',
    ]);
  });

  test('a skipped or no-show day gets no reminder (sub-project D)', async () => {
    if (guard()) return;
    const { trip } = await seed('DAILY');
    const day = (iso) => new Date(iso);
    await prisma.tripRun.createMany({
      data: [
        { tripId: trip.id, runDate: day('2020-06-03T00:00:00Z'), status: 'SKIPPED', plannedArrivalAt: FIRST_DEPARTURE },
        { tripId: trip.id, runDate: day('2020-06-04T00:00:00Z'), status: 'NO_SHOW', plannedArrivalAt: FIRST_DEPARTURE },
      ],
    });
    await sendDueReminders(at('2020-06-02T23:30:00Z')); // Wednesday: skipped
    await sendDueReminders(at('2020-06-03T23:30:00Z')); // Thursday: no-show already recorded
    expect(await remindersFor(trip.id)).toHaveLength(0);
    await sendDueReminders(at('2020-06-04T23:30:00Z')); // Friday
    expect(await remindersFor(trip.id)).toHaveLength(2);
  });

  test('a weekday trip sends nothing for Saturday', async () => {
    if (guard()) return;
    const { trip } = await seed('WEEKDAYS');
    await sendDueReminders(at('2020-06-05T23:30:00Z'));
    expect(await remindersFor(trip.id)).toHaveLength(0);
  });

  test('a one-time trip is reminded once, without an occurrence date', async () => {
    if (guard()) return;
    const { trip } = await seed('ONE_TIME');
    await sendDueReminders(at('2020-05-31T23:30:00Z'));
    await sendDueReminders(at('2020-05-31T23:40:00Z'));
    const reminders = await remindersFor(trip.id);
    expect(reminders).toHaveLength(2);
    expect(reminders.every((n) => n.occurrenceDate === null)).toBe(true);
  });
});
