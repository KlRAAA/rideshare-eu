require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { completeRecurringOccurrence } = require('../services/tripCompletionService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Ending a day's run of a DAILY trip (End Trip, or the overdue-run job, call
// completeRecurringOccurrence). A recurring trip must NOT end like a ONE_TIME one: the standing APPROVED match has to
// survive, only that day's stale PENDING request lapses, and the
// RATING_PROMPT fires per occurrence instead of once ever.

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
  if (!dbUp) console.warn('[recurringOccurrence.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const DEPARTURE_TIME = new Date('2026-01-01T06:00:00Z'); // 06:00 UTC, any date — only the time-of-day matters for DAILY
const DURATION_SECONDS = 1800; // 30 min drive
const OCCURRENCE_DATE = new Date(Date.UTC(2026, 5, 15));

async function seedDailyTrip() {
  const host = await makeUser(bag, { fullName: 'Recurring Host' });
  const approvedPax = await makeUser(bag, { fullName: 'Standing Rider' });
  const pendingPax = await makeUser(bag, { fullName: 'Late Requester' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id, {
    recurrenceType: 'DAILY',
    departureTime: DEPARTURE_TIME,
    durationSeconds: DURATION_SECONDS,
    status: 'OPEN',
  });
  const approvedMatch = await makeMatch(bag, trip.id, approvedPax.id, { status: 'APPROVED' });
  const pendingMatch = await makeMatch(bag, trip.id, pendingPax.id, { status: 'PENDING' });
  return { host, approvedPax, pendingPax, trip, approvedMatch, pendingMatch };
}

describe('completeRecurringOccurrence — recurring (DAILY/WEEKDAYS/CUSTOM) trips', () => {
  test('an ended day leaves the trip and the standing APPROVED match untouched, declines that day\'s PENDING match, and prompts host + passenger to rate', async () => {
    if (guard()) return;
    const { host, approvedPax, pendingPax, trip, approvedMatch, pendingMatch } = await seedDailyTrip();

    const freshTrip = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await completeRecurringOccurrence(freshTrip, OCCURRENCE_DATE);

    // Never flips for a recurring trip — no recurrence-end concept exists.
    const refreshedTrip = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(refreshedTrip.status).toBe('OPEN');

    // The standing rider's match survives — it's not this occurrence's match,
    // it's every occurrence's match.
    const refreshedApproved = await prisma.match.findUnique({ where: { id: approvedMatch.id } });
    expect(refreshedApproved.status).toBe('APPROVED');

    // A request not approved before this ride left lapses, same as ONE_TIME.
    const refreshedPending = await prisma.match.findUnique({ where: { id: pendingMatch.id } });
    expect(refreshedPending.status).toBe('DECLINED');

    const hostPrompt = await prisma.notification.findFirst({
      where: { userId: host.id, type: 'RATING_PROMPT', relatedTripId: trip.id, occurrenceDate: OCCURRENCE_DATE },
    });
    expect(hostPrompt).not.toBeNull();
    expect(hostPrompt.message).toMatch(/passengers/);
    expect(hostPrompt.relatedMatchId).toBeNull();

    const paxPrompt = await prisma.notification.findFirst({
      where: { userId: approvedPax.id, type: 'RATING_PROMPT', relatedMatchId: approvedMatch.id, occurrenceDate: OCCURRENCE_DATE },
    });
    expect(paxPrompt).not.toBeNull();
    expect(paxPrompt.message).toMatch(/host/);

    // A pending requester was never on this ride — no prompt for them.
    const noPendingPrompt = await prisma.notification.findFirst({
      where: { userId: pendingPax.id, type: 'RATING_PROMPT', relatedTripId: trip.id },
    });
    expect(noPendingPrompt).toBeNull();
  });

  test('running it again for the same occurrence does not duplicate the prompt', async () => {
    if (guard()) return;
    const { host, trip } = await seedDailyTrip();

    const trip1 = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await completeRecurringOccurrence(trip1, OCCURRENCE_DATE);
    const trip2 = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await completeRecurringOccurrence(trip2, OCCURRENCE_DATE); // a second End for the same day

    const hostPrompts = await prisma.notification.findMany({
      where: { userId: host.id, type: 'RATING_PROMPT', relatedTripId: trip.id, occurrenceDate: OCCURRENCE_DATE },
    });
    expect(hostPrompts).toHaveLength(1);
  });
});
