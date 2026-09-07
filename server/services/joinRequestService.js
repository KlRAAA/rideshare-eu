// Guard logic for a passenger's "Request to Join" action, kept as a pure
// function so it can be unit-tested without a database. matchController.create
// loads the trip (plus this passenger's own matches) and hands both here before
// creating anything. The frontend performs the same seat check for immediate
// feedback — these are the authoritative backstop, since userId/passengerId are
// client-supplied throughout this backend (see plan doc's auth gap note).
const ACTIVE_REQUEST_STATUSES = ['PENDING', 'APPROVED'];

function checkJoinEligibility({ trip, passengerId, existingMatches = [] }) {
  if (!trip) {
    return { ok: false, error: 'TRIP_NOT_FOUND', status: 404 };
  }
  if (trip.hostId === passengerId) {
    return { ok: false, error: 'CANNOT_JOIN_OWN_TRIP', status: 400 };
  }
  if (existingMatches.some((m) => m.passengerId === passengerId && ACTIVE_REQUEST_STATUSES.includes(m.status))) {
    return { ok: false, error: 'ALREADY_REQUESTED', status: 409 };
  }
  if (trip.status === 'FULL' || trip.filledSeats >= trip.totalSeats) {
    return { ok: false, error: 'TRIP_FULL', status: 409 };
  }
  if (trip.status !== 'OPEN') {
    return { ok: false, error: 'TRIP_NOT_OPEN', status: 409 };
  }
  return { ok: true };
}

module.exports = { checkJoinEligibility, ACTIVE_REQUEST_STATUSES };
