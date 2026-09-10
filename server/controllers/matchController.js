const prisma = require('../config/db');
const { runPSGA, runShowAllFallback, computeRouteOverlapDetail } = require('../services/psgaService');
const { applyLazyCompletion } = require('../services/tripCompletionService');
const psgaConfig = require('../config/psgaConfig');
const safeUserSelect = require('../config/safeUserSelect');
const { checkJoinEligibility } = require('../services/joinRequestService');

const MINUTES_IN_DAY = 1440;

// `departureMinutes` is "minutes since UTC midnight" and must be a real number
// in [0, 1440). The Find a Ride form derives it from a typed "HH:MM"; an empty
// or partial field there used to produce NaN, which JSON.stringify sends as
// `null`, which JS then coerces to 0 inside runPSGA's time comparison — so
// every trip got silently matched against 00:00 and the search returned zero
// results with no error. Reject it at the boundary instead. (Bug: two
// identical Sariaya→Enverga trips, only the one at the picker's default time
// ever appeared.)
function isValidDepartureMinutes(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < MINUTES_IN_DAY;
}

// Shared by `search` (normal PSGA) and `showAll` (empty-state fallback): both
// score the same candidate pool, built from the same real-data-only per-host
// facts — they differ only in which scoring function runs afterward. Returns
// `{ error }` for the caller to relay, or `{ openTrips, candidates }`.
async function loadSearchCandidates(passengerRequest) {
  const { passengerId } = passengerRequest;

  const searcher = await prisma.user.findUnique({ where: { id: passengerId }, select: { gender: true } });
  if (!searcher) return { error: { status: 404, body: { error: 'USER_NOT_FOUND' } } };

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
  await applyLazyCompletion(candidateTrips);
  const openTrips = candidateTrips.filter((t) => t.status === 'OPEN');

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
  // ride even from a host who set "Any". This is a hard filter in BOTH the
  // normal search and the "show all" fallback — the fallback never relaxes it.
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
      // Anchor point for the "show all" fallback's destination check.
      destination: { lat: t.destinationLat, lng: t.destinationLng },
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

  return { openTrips, candidates };
}

// The fixed per-seat fuel share was computed and frozen at posting time —
// search just surfaces it, never recomputes (it must not drift per searcher
// or as seats fill). Public search must never expose plate numbers — riders
// see the plate only once matched and approved on a specific trip (RA 10173
// masking, see tripController.getById).
function enrichMatches(matches, openTrips) {
  return matches.map((m) => {
    const trip = openTrips.find((t) => t.id === m.tripId);
    const { plate: _plate, ...vehicleWithoutPlate } = trip.vehicle;
    return { ...m, trip: { ...trip, vehicle: vehicleWithoutPlate }, fuelShare: trip.fuelSharePerSeat };
  });
}

async function search(req, res) {
  const passengerRequest = req.body; // { passengerId, origin: {lat,lng}, destination: {lat,lng}, departureMinutes, flexWindowMinutes }
  if (!passengerRequest.passengerId) return res.status(400).json({ error: 'MISSING_PASSENGER_ID' });
  if (!isValidDepartureMinutes(passengerRequest.departureMinutes)) {
    return res.status(400).json({ error: 'INVALID_DEPARTURE_MINUTES' });
  }

  const loaded = await loadSearchCandidates(passengerRequest);
  if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

  const result = runPSGA(passengerRequest, loaded.candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  res.json({ status: 'MATCHED', matches: enrichMatches(result.matches, loaded.openTrips) });
}

// Empty-state fallback: only the Find a Ride "Show all trips to <destination>"
// link (shown after a normal search returns zero matches) calls this. It
// relaxes Stage 1's route-overlap and departure-time gates but keeps the
// destination anchor and every safety constraint hard — see
// psgaService.runShowAllFallback. A fresh search always hits `search` first.
async function showAll(req, res) {
  const passengerRequest = req.body;
  if (!passengerRequest.passengerId) return res.status(400).json({ error: 'MISSING_PASSENGER_ID' });
  if (!isValidDepartureMinutes(passengerRequest.departureMinutes)) {
    return res.status(400).json({ error: 'INVALID_DEPARTURE_MINUTES' });
  }

  const loaded = await loadSearchCandidates(passengerRequest);
  if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

  const result = runShowAllFallback(passengerRequest, loaded.candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  res.json({ status: 'MATCHED', matches: enrichMatches(result.matches, loaded.openTrips) });
}

// "Request to Join" action from Find a Ride / the Ride Details page — creates a
// PENDING match and notifies the host. `message` is the passenger's optional
// note to the host. Eligibility (own trip, duplicate request, full, not open) is
// checked before anything is written; the frontend mirrors the seat check for
// immediate feedback but this is the authoritative gate.
async function create(req, res) {
  const { tripId, passengerId, score, routeOverlap, scheduleAlignment, preferenceMatch, message } = req.body;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { matches: { where: { passengerId } } },
  });

  const eligibility = checkJoinEligibility({ trip, passengerId, existingMatches: trip ? trip.matches : [] });
  if (!eligibility.ok) return res.status(eligibility.status).json({ error: eligibility.error });

  const match = await prisma.match.create({
    data: {
      tripId,
      passengerId,
      score,
      routeOverlap,
      scheduleAlignment,
      preferenceMatch,
      // Snapshot the trip's fixed per-seat share, server-side — the client's
      // figure is display-only and never trusted here. Locks the price the
      // passenger saw onto their request.
      fuelShareAmount: trip.fuelSharePerSeat,
      message: message || null,
      status: 'PENDING',
    },
    include: { trip: true, passenger: { select: safeUserSelect } },
  });

  await prisma.notification.create({
    data: {
      userId: match.trip.hostId,
      type: 'MATCH_REQUEST',
      message: `${match.passenger.fullName} requested to join your trip to ${match.trip.destinationAddress}.`,
      relatedMatchId: match.id,
      relatedTripId: match.tripId,
    },
  });

  res.status(201).json({ match });
}

// Host approves/declines a join request. Thesis: "Hosts approve manually."
// Approving increments the trip's filledSeats and notifies the passenger;
// declining just notifies them, seats are untouched.
//
// Only the host of the trip this match belongs to may approve/decline it —
// checked against the verified req.user.id (phase 2), which the auth middleware
// set from the session token. Before phase 2 this endpoint checked no caller
// identity at all.
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' | 'DECLINED'
  if (status !== 'APPROVED' && status !== 'DECLINED') {
    return res.status(400).json({ error: 'INVALID_STATUS' });
  }

  const existing = await prisma.match.findUnique({
    where: { id },
    include: { trip: { select: { hostId: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  if (existing.trip.hostId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const match = await prisma.match.update({
    where: { id },
    data: { status, respondedAt: new Date() },
    include: { trip: true, passenger: { select: safeUserSelect } },
  });

  if (status === 'APPROVED') {
    const trip = await prisma.trip.update({
      where: { id: match.tripId },
      data: { filledSeats: { increment: 1 } },
    });
    // Take the trip out of search once the last seat is claimed — `search`
    // surfaces only OPEN trips, so this is what "Ride Full" keys off of.
    if (trip.status === 'OPEN' && trip.filledSeats >= trip.totalSeats) {
      await prisma.trip.update({ where: { id: trip.id }, data: { status: 'FULL' } });
    }
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
      relatedTripId: match.tripId,
    },
  });

  res.json({ match });
}

// Feeds the RouteMap's overlap layer on the pre-join Ride Details page. Returns
// the exact per-sample classification Stage 1 filtering uses — same function,
// same `corridorMeters` from psgaConfig — plus `minRouteOverlap` so the map can
// state whether the fraction actually clears the matching threshold, not just
// paint the corridor.
async function routeOverlap(req, res) {
  const { tripId, origin, destination } = req.body;
  if (!tripId || !origin || !destination || origin.lat == null || destination.lat == null) {
    return res.status(400).json({ error: 'MISSING_PARAMS' });
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });

  const hostWaypoints = Array.isArray(trip.routeWaypoints) && trip.routeWaypoints.length
    ? trip.routeWaypoints
    : [
        { lat: trip.originLat, lng: trip.originLng },
        { lat: trip.destinationLat, lng: trip.destinationLng },
      ];

  const detail = computeRouteOverlapDetail({ origin, destination }, { waypoints: hostWaypoints }, psgaConfig.corridorMeters);

  res.json({
    fraction: detail.fraction,
    corridorMeters: detail.corridorMeters,
    minRouteOverlap: psgaConfig.minRouteOverlap,
    samples: detail.samples,
    hostWaypoints,
  });
}

module.exports = { search, showAll, create, updateStatus, routeOverlap };
