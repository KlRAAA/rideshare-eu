require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { applyLazyCompletion } = require('../services/tripCompletionService');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// A DAILY trip whose occurrence has completed at a fixed, deterministic
// instant — see AGENTS.md / tripCompletionService.js for why a recurring
// trip must NOT end like a ONE_TIME one: the standing APPROVED match has to
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
// today = 2026-06-15; occurrence completes at 06:00 + 30min drive + 30min grace = 07:00 UTC
const OCCURRENCE_DATE = new Date(Date.UTC(2026, 5, 15));
const NOW_AFTER_COMPLETION = new Date('2026-06-15T07:00:01Z');

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

describe('applyLazyCompletion — recurring (DAILY/WEEKDAYS/CUSTOM) trips', () => {
  test('a due occurrence leaves the trip and the standing APPROVED match untouched, declines that day\'s PENDING match, and prompts host + passenger to rate', async () => {
    if (guard()) return;
    const { host, approvedPax, pendingPax, trip, approvedMatch, pendingMatch } = await seedDailyTrip();

    const freshTrip = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await applyLazyCompletion([freshTrip], NOW_AFTER_COMPLETION);

    // Never flips for a recurring trip — no recurrence-end concept exists.
    expect(freshTrip.status).toBe('OPEN');
    const refreshedTrip = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(refreshedTrip.status).toBe('OPEN');

    // The standing rider's match survives — it's not this occurrence's match,
    // it's every occurrence's match.
    const refreshedApproved = await prisma.match.findUnique({ where: { id: approvedMatch.id } });
    expect(refreshedApproved.status).toBe('APPROVED');
    expect(freshTrip.matches.find((m) => m.id === approvedMatch.id).status).toBe('APPROVED');

    // A request not approved before this ride left lapses, same as ONE_TIME.
    const refreshedPending = await prisma.match.findUnique({ where: { id: pendingMatch.id } });
    expect(refreshedPending.status).toBe('DECLINED');
    expect(freshTrip.matches.find((m) => m.id === pendingMatch.id).status).toBe('DECLINED');

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
    await applyLazyCompletion([trip1], NOW_AFTER_COMPLETION);
    const trip2 = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await applyLazyCompletion([trip2], new Date(NOW_AFTER_COMPLETION.getTime() + 60000)); // a later read, same day

    const hostPrompts = await prisma.notification.findMany({
      where: { userId: host.id, type: 'RATING_PROMPT', relatedTripId: trip.id, occurrenceDate: OCCURRENCE_DATE },
    });
    expect(hostPrompts).toHaveLength(1);
  });

  test('not due yet (before today\'s completion time) leaves everything alone', async () => {
    if (guard()) return;
    const { trip, approvedMatch, pendingMatch } = await seedDailyTrip();

    const freshTrip = await prisma.trip.findUnique({ where: { id: trip.id }, include: { matches: true } });
    await applyLazyCompletion([freshTrip], new Date('2026-06-15T06:30:00Z')); // before the 07:00 completion instant

    expect((await prisma.match.findUnique({ where: { id: pendingMatch.id } })).status).toBe('PENDING');
    expect((await prisma.match.findUnique({ where: { id: approvedMatch.id } })).status).toBe('APPROVED');
    const anyPrompt = await prisma.notification.findFirst({ where: { relatedTripId: trip.id, type: 'RATING_PROMPT' } });
    expect(anyPrompt).toBeNull();
  });
});
