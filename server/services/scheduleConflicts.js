// Database side of the overlap rule (sub-project C): the trips a user drives,
// or has asked to ride, that a new trip or join would clash with.
const { findConflict } = require('./scheduleRules');

const ACTIVE = ['OPEN', 'FULL'];
const FIELDS = { id: true, departureTime: true, durationSeconds: true, recurrenceType: true, customDays: true };

async function conflictWithHosted(userId, candidate, db) {
  const trips = await db.trip.findMany({ where: { hostId: userId, status: { in: ACTIVE } }, select: FIELDS });
  return findConflict(candidate, trips);
}

async function conflictWithRides(userId, candidate, db) {
  const matches = await db.match.findMany({
    where: { passengerId: userId, status: { in: ['PENDING', 'APPROVED'] }, trip: { status: { in: ACTIVE } } },
    select: { trip: { select: FIELDS } },
  });
  return findConflict(candidate, matches.map((m) => m.trip));
}

const conflictBody = (trip) => ({ error: 'SCHEDULE_CONFLICT', conflictTripId: trip.id, conflictDepartureTime: trip.departureTime });

module.exports = { conflictWithHosted, conflictWithRides, conflictBody };
