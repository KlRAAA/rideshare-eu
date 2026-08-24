const prisma = require('../config/db');
const { geocodeAddress } = require('../services/geocodingService');
const { getRoute } = require('../services/routingService');
const { applyLazyCompletion, completeTrip } = require('../services/tripCompletionService');
const safeUserSelect = require('../config/safeUserSelect');

// This is the trip's own origin→destination route, not the passenger
// search-time route matchController.search computes — a different route by
// design (route-overlap matching means a passenger's path overlaps a host's
// without being identical to it). routeWaypoints has existed in the schema
// since Task 0 but nothing populated it until now; durationSeconds is what
// tripCompletionService's auto-completion window is computed from.
async function createTrip(req, res) {
  const { originLat, originLng, destinationLat, destinationLng } = req.body;
  const route = await getRoute({ lat: originLat, lng: originLng }, { lat: destinationLat, lng: destinationLng });

  const trip = await prisma.trip.create({
    data: {
      ...req.body,
      routeWaypoints: route ? route.waypoints : undefined,
      durationSeconds: route ? route.durationSeconds : undefined,
    },
  });
  res.status(201).json({ trip });
}

async function listMine(req, res) {
  const { userId } = req.query;

  const hosted = await prisma.trip.findMany({
    where: { hostId: userId },
    include: { vehicle: true },
    orderBy: { departureTime: 'asc' },
  });
  await applyLazyCompletion(hosted);

  // "Joined" trips: trips this user has a match on as a passenger, any
  // status — matches the thesis's My Trips distinction between trips a
  // user hosts and trips they've joined. The frontend buckets by tab
  // (Upcoming/Past/Cancelled) the same way it already does for `hosted`.
  const joinedMatches = await prisma.match.findMany({
    where: { passengerId: userId },
    include: { trip: { include: { vehicle: true, host: { select: safeUserSelect } } } },
    orderBy: { createdAt: 'desc' },
  });
  await applyLazyCompletion(joinedMatches.map((m) => m.trip));
  const joined = joinedMatches.map((m) => {
    const canSeePlate = ['APPROVED', 'COMPLETED'].includes(m.status);
    return {
      ...m.trip,
      vehicle: canSeePlate ? m.trip.vehicle : { ...m.trip.vehicle, plate: null },
      matchStatus: m.status,
      matchId: m.id,
      fuelShareAmount: m.fuelShareAmount,
    };
  });

  res.json({ hosted, joined });
}

// Plate number is masked from anyone but the host and passengers with an
// approved/completed match on this specific trip (RA 10173 / Data Privacy
// Act — a confirmed trip is when vehicle identification becomes relevant
// for safety, not before). `userId` is client-supplied like every other
// identity check in this backend (see plan doc's auth gap note) — this is
// a privacy gate against casual exposure, not a substitute for real auth.
function canViewPlate(trip, userId) {
  if (!userId) return false;
  if (userId === trip.hostId) return true;
  return trip.matches.some((m) => m.passengerId === userId && ['APPROVED', 'COMPLETED'].includes(m.status));
}

async function getById(req, res) {
  const { userId } = req.query;
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: {
      host: { select: safeUserSelect },
      vehicle: true,
      matches: { include: { passenger: { select: safeUserSelect } } },
    },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  await applyLazyCompletion([trip]);

  if (!canViewPlate(trip, userId)) {
    trip.vehicle = { ...trip.vehicle, plate: null };
  }

  res.json({ trip });
}

// Host-only manual override — same underlying completeTrip() as the lazy
// auto-detect path, so both trigger identical downstream effects (approved
// matches complete, pending ones decline, both sides get rating prompts).
async function markCompleted(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== userId) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return res.status(409).json({ error: 'TRIP_NOT_ACTIVE' });
  }

  const { trip: updated } = await completeTrip(id);
  res.json({ trip: updated });
}

async function geocode(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'MISSING_QUERY' });
  const result = await geocodeAddress(q);
  if (!result) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(result);
}

// Role-aware cancellation: role is resolved from the real DB relationship
// (hostId match, or an active Match row), never from a client-asserted role
// field. Host cancels the whole trip; a passenger only withdraws their own
// match. See Task 12 in the plan doc for the full rationale.
async function cancelTrip(req, res) {
  const { id } = req.params;
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'MISSING_USER_ID' });

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { matches: true },
  });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') {
    return res.status(409).json({ error: 'TRIP_NOT_CANCELLABLE' });
  }

  const ACTIVE_MATCH_STATUSES = ['PENDING', 'APPROVED'];

  if (userId === trip.hostId) {
    // Host cancels: whole trip + every active match, notify every affected passenger.
    const affectedMatches = trip.matches.filter((m) => ACTIVE_MATCH_STATUSES.includes(m.status));

    await prisma.$transaction([
      prisma.trip.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || null },
      }),
      ...affectedMatches.map((m) =>
        prisma.match.update({ where: { id: m.id }, data: { status: 'CANCELLED' } })
      ),
      ...affectedMatches.map((m) =>
        prisma.notification.create({
          data: {
            userId: m.passengerId,
            type: 'CANCELLATION',
            message: reason
              ? `Host cancelled: ${reason} (trip to ${trip.destinationAddress})`
              : `Your host cancelled the trip to ${trip.destinationAddress}.`,
            relatedMatchId: m.id,
          },
        })
      ),
    ]);

    return res.json({ status: 'TRIP_CANCELLED', affectedMatches: affectedMatches.length });
  }

  const myMatch = trip.matches.find((m) => m.passengerId === userId && ACTIVE_MATCH_STATUSES.includes(m.status));
  if (!myMatch) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const passenger = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });

  await prisma.$transaction([
    prisma.match.update({ where: { id: myMatch.id }, data: { status: 'CANCELLED' } }),
    prisma.notification.create({
      data: {
        userId: trip.hostId,
        type: 'CANCELLATION',
        message: `${passenger.fullName} cancelled their spot on your trip to ${trip.destinationAddress}.`,
        relatedMatchId: myMatch.id,
      },
    }),
  ]);

  return res.json({ status: 'MATCH_CANCELLED' });
}

module.exports = { createTrip, listMine, getById, geocode, cancelTrip, markCompleted };
