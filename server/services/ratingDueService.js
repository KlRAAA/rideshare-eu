// "Rate your last ride first" (pre-defense fixes, item 10). Both sides are
// asked to rate after a ride (RATING_PROMPT); before the next one they must
// have done it:
//   - a rider can't send a new join request until they've rated the driver of
//     their most recent finished ride;
//   - a driver can't post a trip until they've rated the riders of their most
//     recent finished ride, for 24 hours after it ended (then it lapses, so a
//     driver is never locked out for good).
// The prompts are the record of "you were asked to rate this ride", the same
// way ratingController decides what is ratable. No schema change.
const prisma = require('../config/db');
const { utcDateOnly } = require('./tripCompletionService');
const { decryptUserFields } = require('./encryptionService');

const DRIVER_GRACE_MS = 24 * 60 * 60 * 1000;

// A one-time trip's prompt has no occurrenceDate; its rating is stored under
// the departure's date (ratingController).
const occurrenceOf = (prompt, trip) => prompt.occurrenceDate ?? utcDateOnly(trip.departureTime);
const nameOf = (user) => decryptUserFields({ fullName: user.fullName }).fullName;

async function riderRatingDue(userId, db = prisma) {
  const prompt = await db.notification.findFirst({
    where: { userId, type: 'RATING_PROMPT', relatedMatchId: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!prompt) return null;
  const match = await db.match.findUnique({
    where: { id: prompt.relatedMatchId },
    select: {
      id: true,
      passengerId: true,
      trip: { select: { id: true, hostId: true, departureTime: true, host: { select: { fullName: true, deletedAt: true } } } },
    },
  });
  if (!match || match.passengerId !== userId || match.trip.host.deletedAt) return null;
  const occurrenceDate = occurrenceOf(prompt, match.trip);
  const rated = await db.rating.findFirst({ where: { matchId: match.id, raterId: userId, occurrenceDate }, select: { id: true } });
  if (rated) return null;
  return {
    tripId: match.trip.id,
    matchId: match.id,
    rateeId: match.trip.hostId,
    rateeName: nameOf(match.trip.host),
    occurrenceDate: prompt.occurrenceDate ? prompt.occurrenceDate.toISOString() : null,
  };
}

async function driverRatingDue(userId, now = new Date(), db = prisma) {
  const prompt = await db.notification.findFirst({
    where: {
      userId,
      type: 'RATING_PROMPT',
      relatedMatchId: null,
      relatedTripId: { not: null },
      createdAt: { gte: new Date(now.getTime() - DRIVER_GRACE_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!prompt) return null;
  const trip = await db.trip.findUnique({ where: { id: prompt.relatedTripId }, select: { id: true, hostId: true, departureTime: true } });
  if (!trip || trip.hostId !== userId) return null;
  // The riders asked to rate that same ride are the ones the driver rates.
  const riderPrompts = await db.notification.findMany({
    where: { type: 'RATING_PROMPT', relatedTripId: trip.id, relatedMatchId: { not: null }, occurrenceDate: prompt.occurrenceDate },
    select: { relatedMatchId: true },
  });
  const matchIds = [...new Set(riderPrompts.map((p) => p.relatedMatchId))];
  if (matchIds.length === 0) return null;
  const occurrenceDate = occurrenceOf(prompt, trip);
  const rated = await db.rating.findMany({ where: { raterId: userId, matchId: { in: matchIds }, occurrenceDate }, select: { matchId: true } });
  const ratedIds = new Set(rated.map((r) => r.matchId));
  const unrated = await db.match.findMany({
    where: { id: { in: matchIds.filter((id) => !ratedIds.has(id)) }, passenger: { deletedAt: null } },
    select: { id: true, passengerId: true, passenger: { select: { fullName: true } } },
  });
  if (unrated.length === 0) return null;
  return {
    tripId: trip.id,
    occurrenceDate: prompt.occurrenceDate ? prompt.occurrenceDate.toISOString() : null,
    riders: unrated.map((m) => ({ matchId: m.id, rateeId: m.passengerId, rateeName: nameOf(m.passenger) })),
  };
}

module.exports = { riderRatingDue, driverRatingDue, DRIVER_GRACE_MS };
