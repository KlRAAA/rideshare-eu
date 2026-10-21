// Database side of the overlap rule (sub-project C): the trips a user drives,
// or has asked to ride, that a new trip or join would clash with.
const { findConflict } = require('./scheduleRules');

const ACTIVE = ['OPEN', 'FULL'];
const FIELDS = { id: true, departureTime: true, durationSeconds: true, recurrenceType: true, customDays: true };

async function conflictWithHosted(userId, candidate, db) {
  const trips = await db.trip.findMany({ where: { hostId: userId, status: { in: ACTIVE } }, select: FIELDS });
  return findConflict(candidate, trips);
}

// statuses: which of the user's ride requests count. Posting a trip counts
// pending ones too; joining counts only confirmed rides, since a rider may ask
// two or three drivers for the same time (approving one withdraws the others).
async function conflictWithRides(userId, candidate, db, statuses = ['PENDING', 'APPROVED']) {
  const matches = await db.match.findMany({
    where: { passengerId: userId, status: { in: statuses }, trip: { status: { in: ACTIVE } } },
    select: { trip: { select: FIELDS } },
  });
  return findConflict(candidate, matches.map((m) => m.trip));
}

const conflictBody = (trip) => ({ error: 'SCHEDULE_CONFLICT', conflictTripId: trip.id, conflictDepartureTime: trip.departureTime });

module.exports = { conflictWithHosted, conflictWithRides, conflictBody };
