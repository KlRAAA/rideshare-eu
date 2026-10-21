// Database side of joinCooldownRules: when a rider cancelled their own
// requests. Match has no cancelledAt, but cancelling sends the driver a
// CANCELLATION notification about that request (tripController.cancelTrip),
// and its createdAt is the moment of the cancel. Notifications the rider
// received (the driver or an admin cancelled the whole trip) don't count.
const prisma = require('../config/db');
const { joinCooldown, BURST_WINDOW_MS, REJOIN_COOLDOWN_MS } = require('./joinCooldownRules');

// [{ passengerId, tripId, at }] for cancellations since `since`; one rider, or everyone.
async function riderCancellations(since, { passengerId } = {}, db = prisma) {
  const MATCH = { id: true, passengerId: true, tripId: true, trip: { select: { hostId: true } } };
  const NOTE = { type: 'CANCELLATION', createdAt: { gte: since } };
  let matches;
  let notes;
  if (passengerId) {
    matches = await db.match.findMany({ where: { passengerId, status: 'CANCELLED' }, select: MATCH });
    if (matches.length === 0) return [];
    notes = await db.notification.findMany({
      where: { ...NOTE, relatedMatchId: { in: matches.map((m) => m.id) } },
      select: { relatedMatchId: true, userId: true, createdAt: true },
    });
  } else {
    notes = await db.notification.findMany({
      where: { ...NOTE, relatedMatchId: { not: null } },
      select: { relatedMatchId: true, userId: true, createdAt: true },
    });
    if (notes.length === 0) return [];
    matches = await db.match.findMany({ where: { id: { in: notes.map((n) => n.relatedMatchId) }, status: 'CANCELLED' }, select: MATCH });
  }
  const byId = new Map(matches.map((m) => [m.id, m]));
  return notes.flatMap((n) => {
    const m = byId.get(n.relatedMatchId);
    return m && n.userId === m.trip.hostId ? [{ passengerId: m.passengerId, tripId: m.tripId, at: n.createdAt }] : [];
  });
}

async function joinCooldownFor(passengerId, tripId, now = new Date(), db = prisma) {
  const since = new Date(now.getTime() - Math.max(BURST_WINDOW_MS, REJOIN_COOLDOWN_MS));
  const cancels = await riderCancellations(since, { passengerId }, db);
  return joinCooldown(cancels, tripId, now);
}

module.exports = { riderCancellations, joinCooldownFor };
