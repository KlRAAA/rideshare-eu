const prisma = require('../config/db');
const { decryptTripFields } = require('./encryptionService');

function utcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Shared by End Trip (via tripRunService.finishRun) and the host's manual
// "Mark as Completed" button, so a trip completed either way gets the exact
// same downstream effects: approved matches complete, still-open
// requests get declined (a join request never approved before the trip
// already happened can't retroactively become valid), and both sides get a
// RATING_PROMPT notification.
// Returns { trip, matchChanges } — matchChanges is [{id, status}] for every
// match this call touched.
//
// `tripOrId` is either a tripId (string) or an already-fetched raw trip row
// with `matches` included, to skip a redundant re-fetch.
async function completeTrip(tripOrId) {
  const tripRaw =
    typeof tripOrId === 'string'
      ? await prisma.trip.findUnique({ where: { id: tripOrId }, include: { matches: true } })
      : tripOrId;
  if (!tripRaw) return null;
  const tripId = tripRaw.id;
  const trip = decryptTripFields(tripRaw);
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') return { trip, matchChanges: [] };

  const approvedMatches = trip.matches.filter((m) => m.status === 'APPROVED');
  const pendingMatches = trip.matches.filter((m) => m.status === 'PENDING');

  // Same-status match updates collapse into one updateMany per status instead
  // of one update per match — every approved match gets the identical
  // {status: 'COMPLETED'} write, so there's nothing per-row to vary. Likewise
  // every RATING_PROMPT for an approved passenger shares the same shape
  // (only userId/relatedMatchId differ), so createMany replaces one insert
  // per passenger with a single multi-row insert. Real effect confirmed by
  // query-count instrumentation, not assumed: a trip with M approved + P
  // pending matches used to fire M+P separate match.update statements plus
  // 1+M separate notification.create statements inside the transaction; this
  // fires at most 2 match writes and 2 notification writes total, regardless
  // of M/P.
  const ops = [prisma.trip.update({ where: { id: tripId }, data: { status: 'COMPLETED' } })];
  if (approvedMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: approvedMatches.map((m) => m.id) } },
        data: { status: 'COMPLETED' },
      })
    );
  }
  if (pendingMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: pendingMatches.map((m) => m.id) } },
        data: { status: 'DECLINED' },
      })
    );
  }
  ops.push(
    prisma.notification.create({
      data: {
        userId: trip.hostId,
        type: 'RATING_PROMPT',
        message: `Your trip to ${trip.destinationAddress} is complete. Please rate your passengers.`,
        relatedTripId: tripId,
      },
    })
  );
  if (approvedMatches.length > 0) {
    ops.push(
      prisma.notification.createMany({
        data: approvedMatches.map((m) => ({
          userId: m.passengerId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your host.`,
          relatedMatchId: m.id,
          relatedTripId: tripId,
        })),
      })
    );
  }
  await prisma.$transaction(ops);

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
async function completeRecurringOccurrence(tripOrId, occurrenceDate) {
  const tripRaw =
    typeof tripOrId === 'string'
      ? await prisma.trip.findUnique({ where: { id: tripOrId }, include: { matches: true } })
      : tripOrId;
  if (!tripRaw) return null;
  const tripId = tripRaw.id;
  const trip = decryptTripFields(tripRaw);

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

  // Same collapse as completeTrip: every pending match gets the identical
  // DECLINED write, and every prompt is one row in a single multi-row insert,
  // instead of one match.update / notification.create per row.
  const ops = [];
  if (pendingMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: pendingMatches.map((m) => m.id) } },
        data: { status: 'DECLINED' },
      })
    );
  }
  if (toPrompt.length > 0) {
    ops.push(
      prisma.notification.createMany({
        data: toPrompt.map((r) => ({
          userId: r.userId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your ${r.ratee}.`,
          relatedMatchId: r.relatedMatchId,
          relatedTripId: tripId,
          occurrenceDate,
        })),
      })
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);

  return { trip, pendingDeclinedIds: pendingMatches.map((m) => m.id) };
}

module.exports = {
  completeTrip,
  utcDateOnly,
  completeRecurringOccurrence,
};
