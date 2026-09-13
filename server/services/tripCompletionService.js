const prisma = require('../config/db');
const { recurrenceRunsOnDay } = require('./recurrenceMath');

const GRACE_BUFFER_MINUTES = 30;

function estimatedCompletionAt(trip) {
  if (trip.durationSeconds == null) return null;
  return new Date(trip.departureTime.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isOverdue(trip) {
  const est = estimatedCompletionAt(trip);
  return est != null && est < new Date();
}

function utcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Does this trip have a scheduled ride on `date` at all, independent of time-
// of-day? The schema has no recurrence end date, so DAILY/WEEKDAYS/CUSTOM
// recur indefinitely from the trip's original departureTime date onward —
// there's no principled point at which they'd stop being "active" on their
// own; only an explicit host cancellation ends a recurring trip.
//
// UTC calendar days throughout — correct for this function's actual job
// (has today's occurrence, by server clock, already happened), unlike
// psgaService's search-eligibility version of this same recurrence check,
// which needs Philippine-local calendar days instead (see recurrenceMath.js).
function runsOnDate(trip, date) {
  return recurrenceRunsOnDay(trip, utcDateOnly(trip.departureTime), utcDateOnly(date));
}

// When today's occurrence is considered complete: departureTime's own UTC
// time-of-day, re-anchored to `today`'s date, plus the same duration + grace
// buffer as estimatedCompletionAt. A recurring trip's departureTime is never
// advanced day to day (the matcher only ever compares time-of-day — see
// psgaService.js), so this recomputes "when did today's ride end" instead of
// relying on a stored timestamp that's stuck on the trip's very first day.
function occurrenceCompletionAt(trip, today) {
  if (trip.durationSeconds == null) return null;
  const day = utcDateOnly(today);
  const departure = trip.departureTime;
  const occurrenceDeparture = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      departure.getUTCHours(),
      departure.getUTCMinutes(),
      departure.getUTCSeconds()
    )
  );
  return new Date(occurrenceDeparture.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isRecurringOccurrenceDue(trip, now) {
  if (trip.recurrenceType === 'ONE_TIME') return false;
  if (!runsOnDate(trip, now)) return false;
  const completionAt = occurrenceCompletionAt(trip, now);
  return completionAt != null && completionAt < now;
}

// Shared by both completion paths — the lazy read-time sweep and the host's
// manual "Mark as Completed" button — so a trip completed either way gets
// the exact same downstream effects: approved matches complete, still-open
// requests get declined (a join request never approved before the trip
// already happened can't retroactively become valid), and both sides get a
// RATING_PROMPT notification.
// Returns { trip, matchChanges } — matchChanges is [{id, status}] for every
// match this call touched. Returning this explicitly (rather than just the
// trip) is what lets applyLazyCompletion patch an already-fetched, already-
// included `trip.matches` array in place: re-fetching matches here with our
// own `include`/`select` shape would risk not matching whatever shape the
// caller's original query used (e.g. a `safeUserSelect`-scoped passenger),
// so the caller patches its own array by id instead of trusting a fresh read.
async function completeTrip(tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { matches: true },
  });
  if (!trip) return null;
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') return { trip, matchChanges: [] };

  const approvedMatches = trip.matches.filter((m) => m.status === 'APPROVED');
  const pendingMatches = trip.matches.filter((m) => m.status === 'PENDING');

  await prisma.$transaction([
    prisma.trip.update({ where: { id: tripId }, data: { status: 'COMPLETED' } }),
    ...approvedMatches.map((m) => prisma.match.update({ where: { id: m.id }, data: { status: 'COMPLETED' } })),
    ...pendingMatches.map((m) => prisma.match.update({ where: { id: m.id }, data: { status: 'DECLINED' } })),
    prisma.notification.create({
      data: {
        userId: trip.hostId,
        type: 'RATING_PROMPT',
        message: `Your trip to ${trip.destinationAddress} is complete. Please rate your passengers.`,
        relatedTripId: tripId,
      },
    }),
    ...approvedMatches.map((m) =>
      prisma.notification.create({
        data: {
          userId: m.passengerId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your host.`,
          relatedMatchId: m.id,
          relatedTripId: tripId,
        },
      })
    ),
  ]);

  const matchChanges = [
    ...approvedMatches.map((m) => ({ id: m.id, status: 'COMPLETED' })),
    ...pendingMatches.map((m) => ({ id: m.id, status: 'DECLINED' })),
  ];

  return { trip: { ...trip, status: 'COMPLETED' }, matchChanges };
}

// Recurring counterpart to completeTrip. A single recurring Trip row spans
// many rides over time, so an occurrence passing must NOT end the trip or
// any standing APPROVED match on it (a passenger who matched a recurring post
// joins every future occurrence, not just the next one) — only that
// occurrence's still-PENDING requests lapse, same reasoning completeTrip uses
// for a ONE_TIME trip. A RATING_PROMPT fires per occurrence instead of once
// ever, deduped by (user, match, occurrenceDate) exactly like reminderService
// dedupes REMINDERs by (user, trip).
async function completeRecurringOccurrence(tripId, occurrenceDate) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { matches: true },
  });
  if (!trip) return null;

  const approvedMatches = trip.matches.filter((m) => m.status === 'APPROVED');
  const pendingMatches = trip.matches.filter((m) => m.status === 'PENDING');

  const recipients = [
    { userId: trip.hostId, relatedMatchId: null, ratee: 'passengers' },
    ...approvedMatches.map((m) => ({ userId: m.passengerId, relatedMatchId: m.id, ratee: 'host' })),
  ];

  const alreadyPrompted = await prisma.notification.findMany({
    where: {
      type: 'RATING_PROMPT',
      relatedTripId: tripId,
      occurrenceDate,
      userId: { in: recipients.map((r) => r.userId) },
    },
    select: { userId: true },
  });
  const alreadyPromptedIds = new Set(alreadyPrompted.map((n) => n.userId));
  const toPrompt = recipients.filter((r) => !alreadyPromptedIds.has(r.userId));

  await prisma.$transaction([
    ...pendingMatches.map((m) => prisma.match.update({ where: { id: m.id }, data: { status: 'DECLINED' } })),
    ...toPrompt.map((r) =>
      prisma.notification.create({
        data: {
          userId: r.userId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your ${r.ratee}.`,
          relatedMatchId: r.relatedMatchId,
          relatedTripId: tripId,
          occurrenceDate,
        },
      })
    ),
  ]);

  return { trip, pendingDeclinedIds: pendingMatches.map((m) => m.id) };
}

// The "lazy check on read": given trips an endpoint already fetched (no
// extra query), complete any that are overdue and mutate them in place so
// the same response reflects the fresh state without a second round-trip —
// including any already-included `matches` array, patched by id rather than
// re-fetched (see completeTrip's comment for why).
//
// ONE_TIME trips take exactly the path they always have (isOverdue +
// completeTrip, byte-for-byte unchanged). Everything else is a recurring
// trip: it never gets marked COMPLETED here (there's no recurrence-end
// concept in the schema — only an explicit host cancellation ends one), and
// its APPROVED matches are never touched; only a due occurrence's PENDING
// matches lapse, mutated in place the same way matchChanges is.
async function applyLazyCompletion(trips, now = new Date()) {
  for (const t of trips) {
    if (t.status !== 'OPEN' && t.status !== 'FULL') continue;

    if (t.recurrenceType === 'ONE_TIME') {
      if (!isOverdue(t)) continue;
      const { matchChanges } = await completeTrip(t.id);
      t.status = 'COMPLETED';
      if (Array.isArray(t.matches)) {
        for (const change of matchChanges) {
          const m = t.matches.find((match) => match.id === change.id);
          if (m) m.status = change.status;
        }
      }
    } else {
      if (!isRecurringOccurrenceDue(t, now)) continue;
      const occurrenceDate = utcDateOnly(now);
      const { pendingDeclinedIds } = await completeRecurringOccurrence(t.id, occurrenceDate);
      if (Array.isArray(t.matches)) {
        for (const id of pendingDeclinedIds) {
          const m = t.matches.find((match) => match.id === id);
          if (m) m.status = 'DECLINED';
        }
      }
    }
  }
  return trips;
}

module.exports = {
  estimatedCompletionAt,
  isOverdue,
  completeTrip,
  applyLazyCompletion,
  GRACE_BUFFER_MINUTES,
  utcDateOnly,
  runsOnDate,
  occurrenceCompletionAt,
  isRecurringOccurrenceDue,
  completeRecurringOccurrence,
};
