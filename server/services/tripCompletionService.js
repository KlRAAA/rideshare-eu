const prisma = require('../config/db');

const GRACE_BUFFER_MINUTES = 30;

function estimatedCompletionAt(trip) {
  if (trip.durationSeconds == null) return null;
  return new Date(trip.departureTime.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isOverdue(trip) {
  const est = estimatedCompletionAt(trip);
  return est != null && est < new Date();
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
      },
    }),
    ...approvedMatches.map((m) =>
      prisma.notification.create({
        data: {
          userId: m.passengerId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your host.`,
          relatedMatchId: m.id,
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

// The "lazy check on read": given trips an endpoint already fetched (no
// extra query), complete any that are overdue and mutate them in place so
// the same response reflects the fresh state without a second round-trip —
// including any already-included `matches` array, patched by id rather than
// re-fetched (see completeTrip's comment for why).
async function applyLazyCompletion(trips) {
  const overdue = trips.filter((t) => (t.status === 'OPEN' || t.status === 'FULL') && isOverdue(t));
  for (const t of overdue) {
    const { matchChanges } = await completeTrip(t.id);
    t.status = 'COMPLETED';
    if (Array.isArray(t.matches)) {
      for (const change of matchChanges) {
        const m = t.matches.find((match) => match.id === change.id);
        if (m) m.status = change.status;
      }
    }
  }
  return trips;
}

module.exports = { estimatedCompletionAt, isOverdue, completeTrip, applyLazyCompletion, GRACE_BUFFER_MINUTES };
