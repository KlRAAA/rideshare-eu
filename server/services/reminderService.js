const prisma = require('../config/db');

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
  const dueTrips = await prisma.trip.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      departureTime: { gt: now, lte: reminderWindowEnd(now) },
    },
    include: { matches: { where: { status: 'APPROVED' } } },
  });

  for (const trip of dueTrips) {
    const recipients = reminderRecipients(trip);

    const alreadyNotified = await prisma.notification.findMany({
      where: { type: 'REMINDER', relatedTripId: trip.id, userId: { in: recipients } },
      select: { userId: true },
    });
    const alreadyNotifiedIds = new Set(alreadyNotified.map((n) => n.userId));
    const toNotify = recipients.filter((id) => !alreadyNotifiedIds.has(id));
    if (toNotify.length === 0) continue;

    await prisma.$transaction(
      toNotify.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'REMINDER',
            message: `Your trip to ${trip.destinationAddress} departs in about ${REMINDER_LEAD_MINUTES} minutes.`,
            relatedTripId: trip.id,
          },
        })
      )
    );
  }
}

module.exports = { REMINDER_LEAD_MINUTES, reminderWindowEnd, reminderRecipients, sendDueReminders };
