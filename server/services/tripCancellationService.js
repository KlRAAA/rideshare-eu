const ACTIVE_MATCH_STATUSES = ['PENDING', 'APPROVED'];
const ADMIN_CANCEL_PREFIX = 'Cancelled by an administrator: ';
// Set by the trip-day job when a one-time trip's driver never started (sub-project D).
const NO_SHOW_CANCEL_REASON = "The driver didn't start the trip";

function passengerMessage(trip, reason, byAdmin) {
  if (byAdmin) return `An administrator cancelled the trip to ${trip.destinationAddress}: ${reason}`;
  return reason
    ? `Host cancelled: ${reason} (trip to ${trip.destinationAddress})`
    : `Your host cancelled the trip to ${trip.destinationAddress}.`;
}

// Cancels the whole trip and every active match, and notifies each affected
// passenger. `trip` must be decrypted and include `matches`.
async function cancelWholeTrip(tx, trip, { reason, byAdmin = false }) {
  const affected = trip.matches.filter((m) => ACTIVE_MATCH_STATUSES.includes(m.status));
  await tx.trip.update({
    where: { id: trip.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: byAdmin ? `${ADMIN_CANCEL_PREFIX}${reason}` : reason || null,
    },
  });
  for (const m of affected) {
    await tx.match.update({ where: { id: m.id }, data: { status: 'CANCELLED' } });
    await tx.notification.create({
      data: {
        userId: m.passengerId,
        type: 'CANCELLATION',
        message: passengerMessage(trip, reason, byAdmin),
        relatedMatchId: m.id,
        relatedTripId: trip.id,
      },
    });
  }
  return affected.length;
}

// Cancels one passenger's request. An approved passenger held a seat, so the
// seat is given back and a full trip reopens for search.
async function cancelPassengerMatch(tx, match) {
  await tx.match.update({ where: { id: match.id }, data: { status: 'CANCELLED' } });
  if (match.status !== 'APPROVED') return;
  const { count } = await tx.trip.updateMany({
    where: { id: match.tripId, filledSeats: { gt: 0 } },
    data: { filledSeats: { decrement: 1 } },
  });
  if (count === 0) return;
  await tx.trip.updateMany({ where: { id: match.tripId, status: 'FULL' }, data: { status: 'OPEN' } });
}

module.exports = { cancelWholeTrip, cancelPassengerMatch, ACTIVE_MATCH_STATUSES, ADMIN_CANCEL_PREFIX, NO_SHOW_CANCEL_REASON };
