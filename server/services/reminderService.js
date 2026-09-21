const prisma = require('../config/db');
const { decryptTripFields } = require('./encryptionService');

// No per-trip/per-user configurability exists yet (mirrors GRACE_BUFFER_MINUTES
// in tripCompletionService.js) — a fixed lead time until a real requirement for
// configurability shows up.
const REMINDER_LEAD_MINUTES = 60;

function reminderWindowEnd(now, leadMinutes = REMINDER_LEAD_MINUTES) {
  return new Date(now.getTime() + leadMinutes * 60 * 1000);
}

// Same recipient split as tripCompletionService's RATING_PROMPT notifications:
// the host plus every APPROVED passenger. PENDING requesters don't have a
// confirmed seat and shouldn't be told a trip they may not be on is departing.
function reminderRecipients(trip) {
  const passengerIds = trip.matches.filter((m) => m.status === 'APPROVED').map((m) => m.passengerId);
  return [trip.hostId, ...passengerIds];
}

// Reminders don't reason about recurrence occurrences: departureTime is the
// only concrete upcoming instant the rest of the system tracks (the matcher
// only compares time-of-day, and tripCompletionService never advances a
// recurring trip past its first departure — see AGENTS.md). This job inherits
// that same limitation rather than building occurrence-expansion logic on top
// of a data model that doesn't otherwise support it.
async function sendDueReminders(now = new Date()) {
  const dueTripsRaw = await prisma.trip.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      departureTime: { gt: now, lte: reminderWindowEnd(now) },
    },
    include: { matches: { where: { status: 'APPROVED' } } },
  });
  const dueTrips = dueTripsRaw.map((t) => decryptTripFields(t));
  if (dueTrips.length === 0) return;

  // Was one `alreadyNotified` query per due trip (N+1 — confirmed via real
  // query-count instrumentation: 6 due trips fired 26 queries). A single
  // query scoped to every due trip's id, deduped in memory per trip below,
  // replaces all of them.
  const recipientsByTrip = new Map(dueTrips.map((trip) => [trip.id, reminderRecipients(trip)]));
  const alreadyNotified = await prisma.notification.findMany({
    where: {
      type: 'REMINDER',
      relatedTripId: { in: dueTrips.map((t) => t.id) },
    },
    select: { userId: true, relatedTripId: true },
  });
  const alreadyNotifiedKeys = new Set(alreadyNotified.map((n) => `${n.relatedTripId}:${n.userId}`));

  const toCreate = [];
  for (const trip of dueTrips) {
    for (const userId of recipientsByTrip.get(trip.id)) {
      if (alreadyNotifiedKeys.has(`${trip.id}:${userId}`)) continue;
      toCreate.push({
        userId,
        type: 'REMINDER',
        message: `Your trip to ${trip.destinationAddress} departs in about ${REMINDER_LEAD_MINUTES} minutes.`,
        relatedTripId: trip.id,
      });
    }
  }
  if (toCreate.length === 0) return;

  await prisma.notification.createMany({ data: toCreate });
}

module.exports = { REMINDER_LEAD_MINUTES, reminderWindowEnd, reminderRecipients, sendDueReminders };
