const prisma = require('../config/db');
const { runPSGA, runShowAllFallback, computeRouteOverlapDetail, tripRunsOnSearchDate } = require('../services/psgaService');
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

// The search form's DatePicker already collects and validates this
// (required, min=today) but never sent it — every candidate was matched by
// time-of-day alone, so a ONE_TIME trip scheduled for an unrelated date (or
// a WEEKDAYS trip on a Saturday) could still surface. Same reject-at-the-
// boundary philosophy as isValidDepartureMinutes above, not a silent
// "skip the date filter if missing" fallback.
function isValidSearchDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

// Shared by `search` (normal PSGA) and `showAll` (empty-state fallback): both
// score the same candidate pool, built from the same real-data-only per-host
// facts — they differ only in which scoring function runs afterward. Returns
// `{ error }` for the caller to relay, or `{ candidates }`.
// `passengerId` is the verified req.user.id (phase 2).
//
// Lean by design: fetches only the scalar columns Stage 1/2 scoring actually
// reads (confirmed by inspection — genderPreference/familiarRidersOnly/seats/
// coordinates all live directly on Trip; nothing here touches vehicle or host
// beyond hostId). Profiling found the previous `include: { vehicle: true,
// host: {...} }` on this same query was the actual load-test bottleneck: it
// joins every open/full trip's full vehicle+host records on every search
// regardless of whether that trip ever reaches the response, and that join
// alone measured 889-1273ms average under 50 concurrent requests (vs ~50ms
// isolated) — see loadTest.js's header. The full vehicle/host data those
// candidates would need IS still fetched, just deferred to fetchEnrichedTrips
// below, after scoring has already cut the set down to actual matches.
async function loadSearchCandidates(passengerId, passengerRequest) {
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
    select: {
      id: true,
      hostId: true,
      status: true,
      recurrenceType: true,
      customDays: true,
      departureTime: true,
      durationSeconds: true,
      routeWaypoints: true,
      originLat: true,
      originLng: true,
      destinationLat: true,
      destinationLng: true,
      genderPreference: true,
      familiarRidersOnly: true,
      filledSeats: true,
      totalSeats: true,
    },
  });
  await applyLazyCompletion(candidateTrips);
  // Date eligibility is a hard gate applied once here, upstream of both
  // scoring paths (runPSGA and runShowAllFallback both consume openTrips) —
  // a trip that doesn't run on the searcher's chosen date is never a
  // candidate at all, not just low-scored. Validated by the caller
  // (search/showAll) before this function runs, so passengerRequest.date is
  // already a real "YYYY-MM-DD" here.
  const openTrips = candidateTrips.filter(
    (t) => t.status === 'OPEN' && tripRunsOnSearchDate(t, passengerRequest.date)
  );

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

  return { candidates };
}

// The full trip (+ vehicle + host) records scoring's lean query above
// deliberately doesn't fetch — looked up only for the trips actually being
// returned to the client (typically a handful, not every open trip), keyed
// by id for enrichMatches below.
async function fetchEnrichedTrips(tripIds) {
  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    include: { vehicle: true, host: { select: safeUserSelect } },
  });
  return new Map(trips.map((t) => [t.id, t]));
}

// The fixed per-seat fuel share was computed and frozen at posting time —
// search just surfaces it, never recomputes (it must not drift per searcher
// or as seats fill). Public search must never expose plate numbers — riders
// see the plate only once matched and approved on a specific trip (RA 10173
// masking, see tripController.getById).
function enrichMatches(matches, tripsById) {
  return matches.map((m) => {
    const trip = tripsById.get(m.tripId);
    const { plate: _plate, ...vehicleWithoutPlate } = trip.vehicle;
    return { ...m, trip: { ...trip, vehicle: vehicleWithoutPlate }, fuelShare: trip.fuelSharePerSeat };
  });
}

async function search(req, res) {
  const passengerRequest = req.body; // { origin: {lat,lng}, destination: {lat,lng}, departureMinutes, date, flexWindowMinutes, genderPreference }
  if (!isValidDepartureMinutes(passengerRequest.departureMinutes)) {
    return res.status(400).json({ error: 'INVALID_DEPARTURE_MINUTES' });
  }
  if (!isValidSearchDate(passengerRequest.date)) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }

  const loaded = await loadSearchCandidates(req.user.id, passengerRequest);
  if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

  const result = runPSGA(passengerRequest, loaded.candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  const tripsById = await fetchEnrichedTrips(result.matches.map((m) => m.tripId));
  res.json({ status: 'MATCHED', matches: enrichMatches(result.matches, tripsById) });
}

// Empty-state fallback: only the Find a Ride "Show all trips to <destination>"
// link (shown after a normal search returns zero matches) calls this. It
// relaxes Stage 1's route-overlap and departure-time gates but keeps the
// destination anchor and every safety constraint hard — see
// psgaService.runShowAllFallback. A fresh search always hits `search` first.
async function showAll(req, res) {
  const passengerRequest = req.body;
  if (!isValidDepartureMinutes(passengerRequest.departureMinutes)) {
    return res.status(400).json({ error: 'INVALID_DEPARTURE_MINUTES' });
  }
  if (!isValidSearchDate(passengerRequest.date)) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }

  const loaded = await loadSearchCandidates(req.user.id, passengerRequest);
  if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

  const result = runShowAllFallback(passengerRequest, loaded.candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  const tripsById = await fetchEnrichedTrips(result.matches.map((m) => m.tripId));
  res.json({ status: 'MATCHED', matches: enrichMatches(result.matches, tripsById) });
}

// "Request to Join" action from Find a Ride / the Ride Details page — creates a
// PENDING match and notifies the host. `message` is the passenger's optional
// note to the host. Eligibility (own trip, duplicate request, full, not open) is
// checked before anything is written; the frontend mirrors the seat check for
// immediate feedback but this is the authoritative gate.
async function create(req, res) {
  const passengerId = req.user.id;
  const { tripId, score, routeOverlap, scheduleAlignment, preferenceMatch, message } = req.body;

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
    include: { trip: { select: { hostId: true, totalSeats: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  if (existing.trip.hostId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  let match;
  let autoDeclinedMatches = []; // [{ id, passengerId }] — only set when this approval fills the last seat
  if (status === 'DECLINED') {
    match = await prisma.match.update({
      where: { id },
      data: { status, respondedAt: new Date() },
      include: { trip: true, passenger: { select: safeUserSelect } },
    });
  } else {
    // Approving used to be a plain read-then-write: increment filledSeats,
    // then check if that pushed the trip over totalSeats. Nothing stopped two
    // approvals on the same trip from both reading "still room" before either
    // write landed — reproducible every time, not just under a race, since
    // there was no check on the approval path at all (see AGENTS.md). The fix
    // is a single conditional write: filledSeats only increments if the trip
    // still has room *at that instant*, and the match only flips to APPROVED
    // if that write actually happened — both inside one transaction, so a
    // trip can never end up with an approved match the seat count didn't
    // actually have room for.
    const result = await prisma.$transaction(async (tx) => {
      const seatUpdate = await tx.trip.updateMany({
        where: { id: existing.tripId, status: { not: 'FULL' }, filledSeats: { lt: existing.trip.totalSeats } },
        data: { filledSeats: { increment: 1 } },
      });
      if (seatUpdate.count === 0) {
        return { ok: false };
      }

      // Take the trip out of search once the last seat is claimed — `search`
      // surfaces only OPEN trips, so this is what "Ride Full" keys off of.
      const updatedTrip = await tx.trip.findUnique({
        where: { id: existing.tripId },
        select: { filledSeats: true, totalSeats: true, status: true },
      });
      let declinedOthers = [];
      if (updatedTrip.status === 'OPEN' && updatedTrip.filledSeats >= updatedTrip.totalSeats) {
        await tx.trip.update({ where: { id: existing.tripId }, data: { status: 'FULL' } });

        // This was the last seat, not just any approval — every other still-
        // PENDING request on the trip can now never be approved. Declined in
        // the same transaction as the seat claim (not a follow-up query
        // after commit), so it can't run against a stale "still pending"
        // list if another request is approved/declined concurrently.
        const stillPending = await tx.match.findMany({
          where: { tripId: existing.tripId, status: 'PENDING', id: { not: id } },
          select: { id: true, passengerId: true },
        });
        if (stillPending.length > 0) {
          await tx.match.updateMany({
            where: { id: { in: stillPending.map((m) => m.id) } },
            data: { status: 'DECLINED', respondedAt: new Date() },
          });
          declinedOthers = stillPending;
        }
      }

      const approvedMatch = await tx.match.update({
        where: { id },
        data: { status: 'APPROVED', respondedAt: new Date() },
        include: { trip: true, passenger: { select: safeUserSelect } },
      });
      return { ok: true, match: approvedMatch, declinedOthers };
    });

    if (!result.ok) {
      // The trip was already full before this call — whichever earlier
      // approval actually claimed the last seat already auto-declined every
      // other PENDING request in its own transaction (below), so there's
      // nothing left here to clean up.
      return res.status(409).json({ error: 'TRIP_FULL', message: 'This trip is already full.' });
    }
    match = result.match;
    autoDeclinedMatches = result.declinedOthers;
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

  // Same notification type/shape a manual host decline uses — just distinct
  // wording, since these passengers weren't reviewed and rejected, the trip
  // simply filled first. Sent after the transaction commits, same as the
  // primary notification above (notification creation isn't part of the
  // atomic seat-claim itself, matching the existing convention here).
  if (autoDeclinedMatches.length > 0) {
    await prisma.notification.createMany({
      data: autoDeclinedMatches.map((m) => ({
        userId: m.passengerId,
        type: 'APPROVAL',
        message: `This trip to ${match.trip.destinationAddress} filled up before your request could be reviewed.`,
        relatedMatchId: m.id,
        relatedTripId: match.tripId,
      })),
    });
  }

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
