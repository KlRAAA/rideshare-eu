const prisma = require('../config/db');
const { decryptTripFields } = require('./encryptionService');
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

// No per-trip/per-user configurability exists yet — a fixed lead time until a
// real requirement for configurability shows up.
const REMINDER_LEAD_MINUTES = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

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

// The departure a reminder is due for, if one falls within the next
// REMINDER_LEAD_MINUTES: a one-time trip's own departure, or a recurring
// trip's run on a day it operates. A recurring trip's departureTime stays on
// its first day (the matcher only uses the time of day), and the Philippines
// has no daylight saving, so each later run is that instant plus whole days.
// occurrenceDate is the run's Philippine calendar day (null for one-time
// trips), the same key trip completion uses for RATING_PROMPT.
function upcomingDeparture(trip, now, leadMinutes = REMINDER_LEAD_MINUTES) {
  const end = reminderWindowEnd(now, leadMinutes);
  const first = trip.departureTime;
  if (trip.recurrenceType === 'ONE_TIME') {
    return first > now && first <= end ? { departure: first, occurrenceDate: null } : null;
  }
  const daysAhead = Math.max(0, Math.ceil((now - first) / DAY_MS));
  let departure = new Date(first.getTime() + daysAhead * DAY_MS);
  if (departure <= now) departure = new Date(departure.getTime() + DAY_MS);
  if (departure > end) return null;
  if (!recurrenceRunsOnDay(trip, phDateOnly(first), phDateOnly(departure))) return null;
  return { departure, occurrenceDate: phDateOnly(departure) };
}

const reminderKey = (tripId, userId, occurrenceDate) => `${tripId}:${userId}:${occurrenceDate?.getTime() ?? 'once'}`;

async function sendDueReminders(now = new Date()) {
  // ponytail: loads every active recurring trip each run (every 5 minutes);
  // fine at pilot scale, filter by time of day in SQL if it grows.
  const candidates = await prisma.trip.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      departureTime: { lte: reminderWindowEnd(now) },
      OR: [{ departureTime: { gt: now } }, { recurrenceType: { not: 'ONE_TIME' } }],
    },
    include: { matches: { where: { status: 'APPROVED' } } },
  });
  const due = candidates
    .map((trip) => ({ trip, run: upcomingDeparture(trip, now) }))
    .filter(({ run }) => run)
    .map(({ trip, run }) => ({ trip: decryptTripFields(trip), occurrenceDate: run.occurrenceDate, day: phDateOnly(run.departure) }));
  if (due.length === 0) return;

  // Sub-project D: nobody is driving a skipped day, and a no-show day is over.
  const closedRuns = await prisma.tripRun.findMany({
    where: { tripId: { in: due.map(({ trip }) => trip.id) }, status: { in: ['SKIPPED', 'NO_SHOW'] }, runDate: { in: due.map(({ day }) => day) } },
    select: { tripId: true, runDate: true },
  });
  const closed = new Set(closedRuns.map((r) => `${r.tripId}:${r.runDate.getTime()}`));

  // One query for every due trip's existing reminders (it used to be one per
  // trip), compared per trip, recipient and day.
  const alreadyNotified = await prisma.notification.findMany({
    where: { type: 'REMINDER', relatedTripId: { in: due.map(({ trip }) => trip.id) } },
    select: { userId: true, relatedTripId: true, occurrenceDate: true },
  });
  const sent = new Set(alreadyNotified.map((n) => reminderKey(n.relatedTripId, n.userId, n.occurrenceDate)));

  const toCreate = [];
  for (const { trip, occurrenceDate, day } of due) {
    if (closed.has(`${trip.id}:${day.getTime()}`)) continue;
    for (const userId of reminderRecipients(trip)) {
      if (sent.has(reminderKey(trip.id, userId, occurrenceDate))) continue;
      toCreate.push({
        userId,
        type: 'REMINDER',
        message: `Your trip to ${trip.destinationAddress} departs in about ${REMINDER_LEAD_MINUTES} minutes.`,
        relatedTripId: trip.id,
        occurrenceDate,
      });
    }
  }
  if (toCreate.length === 0) return;

  await prisma.notification.createMany({ data: toCreate });
}

module.exports = { REMINDER_LEAD_MINUTES, reminderWindowEnd, reminderRecipients, upcomingDeparture, sendDueReminders };
