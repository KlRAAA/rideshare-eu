const prisma = require('../config/db');
const { runPSGA } = require('../services/psgaService');
const { computeFuelShare } = require('../services/fuelShareService');
const { getRoute } = require('../services/routingService');
const { applyLazyCompletion } = require('../services/tripCompletionService');
const psgaConfig = require('../config/psgaConfig');
const safeUserSelect = require('../config/safeUserSelect');

async function search(req, res) {
  const passengerRequest = req.body; // { passengerId, origin: {lat,lng}, destination: {lat,lng}, departureMinutes, flexWindowMinutes }
  const { passengerId } = passengerRequest;
  if (!passengerId) return res.status(400).json({ error: 'MISSING_PASSENGER_ID' });

  const searcher = await prisma.user.findUnique({ where: { id: passengerId }, select: { gender: true } });
  if (!searcher) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  // Exclude the searcher's own hosted trips — a host joining their own trip
  // as a passenger isn't a real scenario the UI (or the Join button) should
  // ever present. Found by actually searching as a user who had a trip
  // posted, not by reading the code.
  //
  // Fetch OPEN + FULL (not just OPEN) so the lazy completion check below can
  // catch a trip that just became overdue — filtered back down to OPEN
  // candidates immediately after, so an auto-completed trip never surfaces
  // as joinable in the same request that just completed it.
  const candidateTrips = await prisma.trip.findMany({
    where: { status: { in: ['OPEN', 'FULL'] }, hostId: { not: passengerId } },
    include: { vehicle: true, host: { select: safeUserSelect } },
  });
  console.log(`[search] candidateTrips after status+self-filter (hostId != ${passengerId}): ${candidateTrips.length}`);
  await applyLazyCompletion(candidateTrips);
  const openTrips = candidateTrips.filter((t) => t.status === 'OPEN');
  console.log(`[search] openTrips after lazy-completion filter: ${openTrips.length}`);

  // genderMatchesHost/familiarWithHost are per-host facts (see psgaService's
  // checkPreferenceMatch comment) — computed here from real data, not taken
  // from client input, since a client could otherwise just always claim
  // "true" and silently bypass the same-gender/familiar-riders safety
  // filters the thesis frames as protecting female commuters specifically.
  const hostIds = [...new Set(openTrips.map((t) => t.hostId))];
  const hosts = await prisma.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, gender: true } });
  const hostGenderById = new Map(hosts.map((h) => [h.id, h.gender]));

  const priorCompletedMatches = await prisma.match.findMany({
    where: { passengerId, status: 'COMPLETED', trip: { hostId: { in: hostIds } } },
    select: { trip: { select: { hostId: true } } },
  });
  const familiarHostIds = new Set(priorCompletedMatches.map((m) => m.trip.hostId));

  // Passenger-side symmetric filter: the search form's own Gender Preference
  // control (thesis: "When a female user enables this setting, the PSGA
  // applies it as a hard constraint"). Distinct from `trip.genderPreference`,
  // which is the host's own setting — a passenger can want a same-gender
  // ride even from a host who set "Any".
  const requireSameGender = passengerRequest.genderPreference === 'SAME_GENDER';
  const eligibleTrips = requireSameGender
    ? openTrips.filter((t) => {
        const hostGender = hostGenderById.get(t.hostId);
        return searcher.gender !== 'UNSPECIFIED' && hostGender !== 'UNSPECIFIED' && searcher.gender === hostGender;
      })
    : openTrips;

  const candidates = eligibleTrips.map((t) => {
    const hostGender = hostGenderById.get(t.hostId);
    return {
      id: t.id,
      waypoints: t.routeWaypoints || [
        { lat: t.originLat, lng: t.originLng },
        { lat: t.destinationLat, lng: t.destinationLng },
      ],
      // Thesis §5.1.4 (Data Pre-Processing): "All time arithmetic in the PSGA
      // operates in UTC to avoid conversion errors" — .getHours() would use
      // the server process's local timezone instead, which is wrong here.
      departureMinutes: t.departureTime.getUTCHours() * 60 + t.departureTime.getUTCMinutes(),
      genderPreference: t.genderPreference,
      familiarRidersOnly: t.familiarRidersOnly,
      filledSeats: t.filledSeats,
      totalSeats: t.totalSeats,
      genderMatchesHost: searcher.gender !== 'UNSPECIFIED' && hostGender !== 'UNSPECIFIED' && searcher.gender === hostGender,
      familiarWithHost: familiarHostIds.has(t.hostId),
    };
  });

  const result = runPSGA(passengerRequest, candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  const passengerRoute = await getRoute(passengerRequest.origin, passengerRequest.destination);

  const enriched = result.matches.map((m) => {
    const trip = openTrips.find((t) => t.id === m.tripId);
    const fuelShare = computeFuelShare({
      distanceKm: passengerRoute ? passengerRoute.distanceKm : 0,
      fuelEfficiencyKmL: trip.vehicle.fuelEfficiencyKmL,
      fuelPricePerLiter: psgaConfig.fuelPricePerLiter,
      filledSeats: trip.filledSeats,
    });
    // Public search must never expose plate numbers — riders see the plate
    // only once matched and approved on a specific trip (RA 10173 masking,
    // see tripController.getById).
    const { plate: _plate, ...vehicleWithoutPlate } = trip.vehicle;
    return { ...m, trip: { ...trip, vehicle: vehicleWithoutPlate }, fuelShare: Number(fuelShare.toFixed(2)) };
  });

  res.json({ status: 'MATCHED', matches: enriched });
}

// "Join" action from Find a Ride — creates a pending match + notifies the host.
async function create(req, res) {
  const { tripId, passengerId, score, routeOverlap, scheduleAlignment, preferenceMatch, fuelShareAmount } = req.body;

  const match = await prisma.match.create({
    data: { tripId, passengerId, score, routeOverlap, scheduleAlignment, preferenceMatch, fuelShareAmount, status: 'PENDING' },
    include: { trip: true, passenger: { select: safeUserSelect } },
  });

  await prisma.notification.create({
    data: {
      userId: match.trip.hostId,
      type: 'MATCH_REQUEST',
      message: `${match.passenger.fullName} requested to join your trip to ${match.trip.destinationAddress}.`,
      relatedMatchId: match.id,
    },
  });

  res.status(201).json({ match });
}

// Host approves/declines a join request. Thesis: "Hosts approve manually."
// Approving increments the trip's filledSeats and notifies the passenger;
// declining just notifies them, seats are untouched.
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' | 'DECLINED'
  if (status !== 'APPROVED' && status !== 'DECLINED') {
    return res.status(400).json({ error: 'INVALID_STATUS' });
  }

  const match = await prisma.match.update({
    where: { id },
    data: { status, respondedAt: new Date() },
    include: { trip: true, passenger: { select: safeUserSelect } },
  });

  if (status === 'APPROVED') {
    await prisma.trip.update({
      where: { id: match.tripId },
      data: { filledSeats: { increment: 1 } },
    });
  }

  await prisma.notification.create({
    data: {
      userId: match.passengerId,
      type: 'APPROVAL',
      message:
        status === 'APPROVED'
          ? `Your request to join the trip to ${match.trip.destinationAddress} has been approved.`
          : `Your request to join the trip to ${match.trip.destinationAddress} was declined.`,
      relatedMatchId: match.id,
    },
  });

  res.json({ match });
}

module.exports = { search, create, updateStatus };
