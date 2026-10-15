// A rider may ask several drivers for the same time (they can't know who will
// say yes). Once one approves, the others at that time can't all be kept, or
// the rider would hold seats on trips they won't take. Runs inside the
// approval's transaction.
const { overlaps } = require('./scheduleRules');

const ACTIVE = ['OPEN', 'FULL'];
const TRIP_FIELDS = {
  id: true, hostId: true, destinationAddress: true,
  departureTime: true, durationSeconds: true, recurrenceType: true, customDays: true,
};

// Serialises approvals for one rider, so two drivers approving at the same
// moment can't both see "no ride yet" (released when the transaction ends).
async function lockRider(tx, passengerId) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${passengerId} FOR UPDATE`;
}

// The rider's other PENDING or APPROVED requests whose trips overlap `trip`.
async function sameTimeRequests(tx, passengerId, trip, status) {
  const matches = await tx.match.findMany({
    where: { passengerId, status, tripId: { not: trip.id }, trip: { status: { in: ACTIVE } } },
    select: { id: true, trip: { select: TRIP_FIELDS } },
  });
  return matches.filter((m) => overlaps(trip, m.trip));
}

// Withdraws them like the rider would (CANCELLED, never approved, so not a
// cancellation on the admin watch list). Returns [{ id, trip }].
async function withdrawSameTime(tx, passengerId, trip) {
  const pending = await sameTimeRequests(tx, passengerId, trip, 'PENDING');
  if (pending.length > 0) {
    await tx.match.updateMany({ where: { id: { in: pending.map((m) => m.id) } }, data: { status: 'CANCELLED' } });
  }
  return pending;
}

module.exports = { lockRider, sameTimeRequests, withdrawSameTime };
