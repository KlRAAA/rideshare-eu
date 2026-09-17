const prisma = require('../config/db');
const { geocodeAddress, reverseGeocode } = require('../services/geocodingService');
const { validateClientRoute } = require('../services/routeSanity');
const { computeFuelSharePerSeat } = require('../services/fuelShareService');
const { classifyTripChanges, describeCategories, fuelShareWouldChange } = require('../services/tripUpdateService');
const { applyLazyCompletion, completeTrip } = require('../services/tripCompletionService');
const safeUserSelect = require('../config/safeUserSelect');
const { encryptField, decryptUserFields, decryptTripFields } = require('../services/encryptionService');

// Sanity bounds for the host-entered retail fuel price (PHP/L) — catches an
// obvious typo (an extra digit, a decimal slip) before it produces a wildly
// wrong fuel-share figure shown to passengers. Keep in sync with
// src/lib/constants.ts's MIN/MAX_FUEL_PRICE_PER_LITER (client-side copy for
// the same check, shown inline before the host even submits).
const MIN_FUEL_PRICE_PER_LITER = 20;
const MAX_FUEL_PRICE_PER_LITER = 150;

// For a recurring trip, an APPROVED match never reaches COMPLETED (it's a
// standing rider across every occurrence), so `ratedByMe` — a lifetime "have
// I ever rated this match" flag — can't gate the Rate button by itself the
// way it does for a ONE_TIME trip. This resolves, per match, the most recent
// occurrence this viewer was actually prompted (via a RATING_PROMPT
// notification) to rate and hasn't rated yet — null if there's nothing
// currently ratable, which is also always the case for a ONE_TIME trip
// (its RATING_PROMPT carries no occurrenceDate).
async function attachUnratedOccurrence(matches, viewerId) {
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return matches;

  const prompts = await prisma.notification.findMany({
    where: { type: 'RATING_PROMPT', userId: viewerId, relatedMatchId: { in: matchIds }, occurrenceDate: { not: null } },
    orderBy: { occurrenceDate: 'desc' },
    select: { relatedMatchId: true, occurrenceDate: true },
  });
  const latestPromptByMatch = new Map();
  for (const p of prompts) {
    if (!latestPromptByMatch.has(p.relatedMatchId)) latestPromptByMatch.set(p.relatedMatchId, p.occurrenceDate);
  }

  const ratings = await prisma.rating.findMany({
    where: { raterId: viewerId, matchId: { in: matchIds } },
    select: { matchId: true, occurrenceDate: true },
  });
  const ratedKeys = new Set(ratings.map((r) => `${r.matchId}:${r.occurrenceDate.getTime()}`));

  return matches.map((m) => {
    const latest = latestPromptByMatch.get(m.id);
    const isRated = latest && ratedKeys.has(`${m.id}:${latest.getTime()}`);
    return { ...m, unratedOccurrenceDate: latest && !isRated ? latest.toISOString() : null };
  });
}

// Fields a trip's creator may set at creation — mirrors updateTrip's
// EDITABLE_TRIP_FIELDS allowlist pattern. Everything a client POSTs is filtered
// through this, so lifecycle-controlled fields (`status`, `filledSeats`),
// server-derived fields (`hostId` -> req.user.id, `fuelSharePerSeat`,
// `cancelReason`/`cancelledAt`) and Prisma-managed fields (`id`, `createdAt`)
// can't be injected. A new trip always starts OPEN with 0 filled seats.
// Route geometry (routeWaypoints/distanceMeters/durationSeconds) is validated
// and added separately in createTrip, so it isn't listed here.
const CREATABLE_TRIP_FIELDS = [
  'vehicleId',
  'originAddress', 'originLat', 'originLng',
  'destinationAddress', 'destinationLat', 'destinationLng',
  'departureTime', 'recurrenceType', 'customDays', 'totalSeats',
  'driverNotes', 'genderPreference', 'flexibleDeparture', 'flexWindowMinutes', 'familiarRidersOnly',
  'meetingPointAddress', 'meetingPointLat', 'meetingPointLng', 'fuelPricePerLiter',
];

// The trip's own origin→destination route. Post a Ride fetches it from Mapbox
// Directions client-side (the RouteMap preview) and sends the geometry +
// distance + duration here, so there's no second server-side Directions call.
// The numbers are plausibility-checked against the straight-line distance
// (routeSanity) before being stored, since durationSeconds drives
// tripCompletionService's auto-completion window and the fuel-share estimate
// reads distance. A failed check drops all three — the trip is still created,
// just without route data (the pre-existing "routing unavailable" path).
async function createTrip(req, res) {
  const { originLat, originLng, destinationLat, destinationLng, routeWaypoints, distanceMeters, durationSeconds } = req.body;

  // Only the allowlisted creator-set fields — never a raw req.body spread, so a
  // client can't POST a trip pre-marked COMPLETED or with filledSeats set.
  const body = {};
  for (const k of CREATABLE_TRIP_FIELDS) if (k in req.body) body[k] = req.body[k];

  // The host's own typed retail price, not a fixed app-wide default (no
  // reliable free PH fuel-price API exists — see AGENTS.md). Rejected outright
  // if outside sane bounds, catching an obvious typo before it produces a
  // wildly wrong fuel-share figure; left unset (no suggested share, same as
  // missing distance) rather than required, since a host may not know it yet.
  if (body.fuelPricePerLiter != null) {
    const price = Number(body.fuelPricePerLiter);
    if (!Number.isFinite(price) || price < MIN_FUEL_PRICE_PER_LITER || price > MAX_FUEL_PRICE_PER_LITER) {
      return res.status(400).json({ error: 'INVALID_FUEL_PRICE' });
    }
    body.fuelPricePerLiter = price;
  }

  const check = validateClientRoute({
    origin: { lat: originLat, lng: originLng },
    destination: { lat: destinationLat, lng: destinationLng },
    distanceMeters,
    durationSeconds,
  });
  if (!check.ok) {
    console.warn(`[createTrip] client route rejected (${check.reason}) — creating trip without route data`);
  }

  const routeData = check.ok
    ? {
        routeWaypoints: Array.isArray(routeWaypoints) ? routeWaypoints : null,
        distanceMeters: Math.round(distanceMeters),
        durationSeconds: Math.round(durationSeconds),
      }
    : { routeWaypoints: null, distanceMeters: null, durationSeconds: null };

  // Fixed voluntary fuel share per passenger seat — computed once here, from the
  // vehicle's registered efficiency and the host's own entered fuel price,
  // divided by seats OFFERED (never the driver). Persisted so it stays the
  // same number for everyone and doesn't move as seats fill. For a recurring
  // trip this is one Trip row, so this is priced once for the whole series.
  // A future seats/vehicle-edit endpoint should recompute this ONLY while the
  // trip has no matches yet — once a passenger has seen the price it's locked.
  const vehicle = await prisma.vehicle.findUnique({ where: { id: body.vehicleId } });
  const fuelSharePerSeat = computeFuelSharePerSeat({
    distanceMeters: routeData.distanceMeters,
    efficiencyKmL: vehicle ? vehicle.fuelEfficiencyKmL : null,
    pricePerLiter: body.fuelPricePerLiter,
    passengerSeats: Number(body.totalSeats),
  });

  const encryptedBody = { ...body };
  if ('originAddress' in encryptedBody) encryptedBody.originAddress = encryptField(encryptedBody.originAddress);
  if ('destinationAddress' in encryptedBody) encryptedBody.destinationAddress = encryptField(encryptedBody.destinationAddress);
  if ('meetingPointAddress' in encryptedBody) encryptedBody.meetingPointAddress = encryptField(encryptedBody.meetingPointAddress);

  const trip = await prisma.trip.create({
    data: { ...encryptedBody, hostId: req.user.id, ...routeData, fuelSharePerSeat },
  });
  res.status(201).json({ trip: decryptTripFields(trip) });
}

async function listMine(req, res) {
  const userId = req.user.id;

  // `matches` is included so the host's My Trips "Past" tab can show a Rate
  // button per completed passenger (the passenger-side Rate button already had
  // one, via the joined trips below). Passenger fields are narrowed here — the
  // name is all the Rate button needs; the full safeUserSelect (incl. email)
  // stays on the trip-detail endpoint where the host coordinates pickup.
  const hosted = await prisma.trip.findMany({
    where: { hostId: userId },
    include: {
      vehicle: true,
      matches: { include: { passenger: { select: { id: true, fullName: true, avatarUrl: true } } } },
    },
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

  // Which of this user's matches they've already rated, so the client keeps the
  // "Rated" state after a reload — it used to be frontend-only React state that
  // reset to an active button on every refresh.
  const myRatings = await prisma.rating.findMany({ where: { raterId: userId }, select: { matchId: true } });
  const ratedMatchIds = new Set(myRatings.map((r) => r.matchId));

  const hostedMatchesWithOccurrence = await attachUnratedOccurrence(hosted.flatMap((t) => t.matches), userId);
  const occurrenceByMatchId = new Map(hostedMatchesWithOccurrence.map((m) => [m.id, m.unratedOccurrenceDate]));

  const hostedWithRatings = hosted.map((t) => ({
    ...decryptTripFields(t),
    matches: t.matches.map((m) => ({
      ...m,
      passenger: decryptUserFields(m.passenger),
      ratedByMe: ratedMatchIds.has(m.id),
      unratedOccurrenceDate: occurrenceByMatchId.get(m.id) ?? null,
    })),
  }));

  const joinedMatchesWithOccurrence = await attachUnratedOccurrence(joinedMatches, userId);
  const joined = joinedMatchesWithOccurrence.map((m) => {
    const canSeePlate = ['APPROVED', 'COMPLETED'].includes(m.status);
    const trip = { ...decryptTripFields(m.trip), host: decryptUserFields(m.trip.host) };
    return {
      ...trip,
      vehicle: canSeePlate ? trip.vehicle : { ...trip.vehicle, plate: null },
      matchStatus: m.status,
      matchId: m.id,
      fuelShareAmount: m.fuelShareAmount,
      ratedByMe: ratedMatchIds.has(m.id),
      unratedOccurrenceDate: m.unratedOccurrenceDate,
    };
  });

  res.json({ hosted: hostedWithRatings, joined });
}

// Plate number is masked from anyone but the host and passengers with an
// approved/completed match on this specific trip (RA 10173 / Data Privacy
// Act — a confirmed trip is when vehicle identification becomes relevant
// for safety, not before). `userId` is the verified req.user.id (phase 2).
function canViewPlate(trip, userId) {
  if (!userId) return false;
  if (userId === trip.hostId) return true;
  return trip.matches.some((m) => m.passengerId === userId && ['APPROVED', 'COMPLETED'].includes(m.status));
}

async function getById(req, res) {
  const userId = req.user.id;
  const tripRaw = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: {
      host: { select: safeUserSelect },
      vehicle: true,
      matches: { include: { passenger: { select: safeUserSelect } } },
    },
  });
  if (!tripRaw) return res.status(404).json({ error: 'Trip not found' });
  await applyLazyCompletion([tripRaw]);

  const trip = {
    ...decryptTripFields(tripRaw),
    host: decryptUserFields(tripRaw.host),
    matches: tripRaw.matches.map((m) => ({ ...m, passenger: decryptUserFields(m.passenger) })),
  };

  if (!canViewPlate(trip, userId)) {
    trip.vehicle = { ...trip.vehicle, plate: null };
  }

  // Tag each match with whether this user has already rated it, so the detail
  // page can keep the Rate button disabled across reloads instead of relying on
  // frontend-only state that resets on refresh.
  const myRatings = await prisma.rating.findMany({
    where: { raterId: userId, matchId: { in: trip.matches.map((m) => m.id) } },
    select: { matchId: true },
  });
  const rated = new Set(myRatings.map((r) => r.matchId));
  const matchesWithOccurrence = await attachUnratedOccurrence(trip.matches, userId);
  trip.matches = matchesWithOccurrence.map((m) => ({ ...m, ratedByMe: rated.has(m.id) }));

  res.json({ trip });
}

// A trip only broadcasts location while it's still upcoming/in-progress —
// once COMPLETED or CANCELLED there's nothing left to track toward. Same
// pair of statuses markCompleted already treats as "not active."
const LOCATION_SHAREABLE_STATUSES = ['OPEN', 'FULL'];
// ~3x the client's ~25-30s poll interval — long enough to absorb one missed
// tick, short enough that a passenger never sees a pin frozen in place long
// after the host closed the app or lost signal.
const STALE_LOCATION_MS = 90 * 1000;

// Same shape as canViewPlate: the host, or a passenger with an APPROVED
// match on THIS specific trip — never a pending requester, never someone
// approved on a different trip, never the public.
function canViewLocation(trip, userId) {
  if (!userId) return false;
  if (userId === trip.hostId) return true;
  return trip.matches.some((m) => m.passengerId === userId && m.status === 'APPROVED');
}

// Host-only write, called every ~25-30s from the host's own device while
// liveLocationSharing is on. Re-checks the preference server-side on every
// call — never trusted from the client — so a host can't keep broadcasting
// past having turned the toggle off, and a client bug can't fake it on.
async function updateLocation(req, res) {
  const { id } = req.params;
  const { lat, lng } = req.body;

  const trip = await prisma.trip.findUnique({ where: { id }, select: { hostId: true, status: true } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  if (!LOCATION_SHAREABLE_STATUSES.includes(trip.status)) {
    return res.status(409).json({ error: 'TRIP_NOT_ACTIVE' });
  }

  const preference = await prisma.preference.findUnique({
    where: { userId: req.user.id },
    select: { liveLocationSharing: true },
  });
  if (!preference?.liveLocationSharing) {
    return res.status(403).json({ error: 'LOCATION_SHARING_DISABLED' });
  }

  // Number(null) is 0, not NaN — checked explicitly rather than relying on
  // Number.isFinite alone, or a missing lat/lng would silently become a real
  // (wrong) coordinate instead of being rejected (the same class of bug as
  // the departureMinutes null-coercion issue elsewhere in this codebase).
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'INVALID_COORDINATES' });
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
    return res.status(400).json({ error: 'INVALID_COORDINATES' });
  }

  await prisma.trip.update({
    where: { id },
    data: { lastKnownLat: latNum, lastKnownLng: lngNum, lastLocationUpdatedAt: new Date() },
  });
  res.json({ ok: true });
}

// Read side: host + this trip's approved passengers only. Returns a null
// location (200, not an error) for every "nothing to show right now" case —
// trip no longer active, host has since turned sharing off, or the last
// point is stale — so the frontend just hides the pin instead of treating a
// normal, expected state as a failure.
async function getLocation(req, res) {
  const { id } = req.params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { matches: { select: { passengerId: true, status: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!canViewLocation(trip, req.user.id)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  if (!LOCATION_SHAREABLE_STATUSES.includes(trip.status)) {
    return res.json({ location: null });
  }

  // Re-checked here, not just at write time — if the host shared for a while
  // then flipped the toggle off, the last point already sitting in the row
  // must stop being served immediately, not just stop being updated.
  const preference = await prisma.preference.findUnique({
    where: { userId: trip.hostId },
    select: { liveLocationSharing: true },
  });
  if (!preference?.liveLocationSharing) return res.json({ location: null });

  if (trip.lastKnownLat == null || trip.lastKnownLng == null || !trip.lastLocationUpdatedAt) {
    return res.json({ location: null });
  }
  const ageMs = Date.now() - trip.lastLocationUpdatedAt.getTime();
  if (ageMs > STALE_LOCATION_MS) return res.json({ location: null });

  res.json({ location: { lat: trip.lastKnownLat, lng: trip.lastKnownLng, updatedAt: trip.lastLocationUpdatedAt } });
}

// Host-only manual override — same underlying completeTrip() as the lazy
// auto-detect path, so both trigger identical downstream effects (approved
// matches complete, pending ones decline, both sides get rating prompts).
async function markCompleted(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== userId) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return res.status(409).json({ error: 'TRIP_NOT_ACTIVE' });
  }

  const { trip: updated } = await completeTrip(id);
  res.json({ trip: updated });
}

// Forward (?q=) or reverse (?lat=&lng=) — same endpoint, dispatched on which
// params are present, rather than a second route: it's the one geocoding
// endpoint either direction goes through.
async function geocode(req, res) {
  const { q, lat, lng } = req.query;

  if (lat != null && lng != null) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      return res.status(400).json({ error: 'INVALID_COORDINATES' });
    }
    const reverseResult = await reverseGeocode(latNum, lngNum);
    if (!reverseResult) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(reverseResult);
  }

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
  const { reason } = req.body;
  const userId = req.user.id;

  const tripRaw = await prisma.trip.findUnique({
    where: { id },
    include: { matches: true },
  });
  if (!tripRaw) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  const trip = decryptTripFields(tripRaw);
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
            relatedTripId: trip.id,
          },
        })
      ),
    ]);

    return res.json({ status: 'TRIP_CANCELLED', affectedMatches: affectedMatches.length });
  }

  const myMatch = trip.matches.find((m) => m.passengerId === userId && ACTIVE_MATCH_STATUSES.includes(m.status));
  if (!myMatch) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const passengerRaw = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  const passenger = decryptUserFields(passengerRaw);

  await prisma.$transaction([
    prisma.match.update({ where: { id: myMatch.id }, data: { status: 'CANCELLED' } }),
    prisma.notification.create({
      data: {
        userId: trip.hostId,
        type: 'CANCELLATION',
        message: `${passenger.fullName} cancelled their spot on your trip to ${trip.destinationAddress}.`,
        relatedMatchId: myMatch.id,
        relatedTripId: trip.id,
      },
    }),
  ]);

  return res.json({ status: 'MATCH_CANCELLED' });
}

const EDITABLE_TRIP_FIELDS = [
  'originAddress', 'originLat', 'originLng',
  'destinationAddress', 'destinationLat', 'destinationLng',
  'routeWaypoints', 'distanceMeters', 'durationSeconds',
  'departureTime', 'recurrenceType', 'customDays', 'totalSeats',
  'driverNotes', 'genderPreference', 'flexibleDeparture', 'flexWindowMinutes', 'familiarRidersOnly',
  'meetingPointAddress', 'meetingPointLat', 'meetingPointLng',
];
const EDITABLE_VEHICLE_FIELDS = ['make', 'model', 'color', 'plate', 'fuelEfficiencyKmL'];
const LATLNG_FIELDS = new Set(['originLat', 'originLng', 'destinationLat', 'destinationLng', 'meetingPointLat', 'meetingPointLng']);

// Host-only edit of a posted trip. Which fields changed is decided here from the
// stored values, never from a client flag. A structural change (route, schedule,
// seats, vehicle) on a trip that already has an approved passenger needs a
// second submit with confirmStructural:true and notifies every active passenger.
// The locked fuelSharePerSeat is NEVER recomputed once a passenger is approved —
// fuelShareWouldChange is returned only so the host sees the note.
async function updateTrip(req, res) {
  const { id } = req.params;
  const { userId: _clientUserId, confirmStructural, vehicle: vehiclePatch, ...bodyFields } = req.body;
  const userId = req.user.id;

  const tripRaw = await prisma.trip.findUnique({ where: { id }, include: { matches: true, vehicle: true } });
  if (!tripRaw) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (tripRaw.hostId !== userId) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  if (tripRaw.status !== 'OPEN' && tripRaw.status !== 'FULL') return res.status(409).json({ error: 'TRIP_NOT_EDITABLE' });
  // Decrypted BEFORE classifyTripChanges — it does plain string equality
  // against incoming.originAddress/destinationAddress/meetingPointAddress
  // (plaintext from the client), which would otherwise always register as
  // "changed" when compared against still-encrypted ciphertext.
  const trip = decryptTripFields(tripRaw);

  const incoming = {};
  for (const k of EDITABLE_TRIP_FIELDS) if (k in bodyFields) incoming[k] = bodyFields[k];
  if (vehiclePatch && typeof vehiclePatch === 'object') {
    incoming.vehicle = {};
    for (const k of EDITABLE_VEHICLE_FIELDS) if (k in vehiclePatch) incoming.vehicle[k] = vehiclePatch[k];
  }

  const { changed, structural } = classifyTripChanges(trip, incoming);
  if (changed.length === 0) return res.json({ trip });

  const approvedCount = trip.matches.filter((m) => m.status === 'APPROVED').length;

  if ('totalSeats' in incoming && Number(incoming.totalSeats) < trip.filledSeats) {
    return res.status(409).json({ error: 'SEAT_COUNT_BELOW_FILLED', filledSeats: trip.filledSeats });
  }

  // The trip's own price, not a global default — fuelPricePerLiter isn't
  // editable, so this is always the same value the host entered at posting.
  const fsChange = fuelShareWouldChange({ current: trip, incoming, pricePerLiter: trip.fuelPricePerLiter });

  if (structural.length > 0 && approvedCount > 0 && !confirmStructural) {
    return res.status(409).json({
      error: 'CONFIRMATION_REQUIRED',
      changedCategories: structural,
      changeSummary: describeCategories(structural),
      approvedCount,
      fuelShareWouldChange: fsChange,
    });
  }

  const tripData = {};
  for (const k of EDITABLE_TRIP_FIELDS) {
    if (!(k in incoming)) continue;
    const v = incoming[k];
    if (k === 'departureTime') tripData[k] = new Date(v);
    else if (k === 'distanceMeters' || k === 'durationSeconds') tripData[k] = v == null ? null : Math.round(Number(v));
    else if (k === 'totalSeats' || k === 'flexWindowMinutes') tripData[k] = Number(v);
    else if (LATLNG_FIELDS.has(k)) tripData[k] = v == null ? null : Number(v);
    else if (k === 'originAddress' || k === 'destinationAddress' || k === 'meetingPointAddress') tripData[k] = encryptField(v);
    else tripData[k] = v;
  }

  // Keep status in step with capacity when seats change.
  if ('totalSeats' in incoming) {
    const newTotal = Number(incoming.totalSeats);
    if (trip.status === 'FULL' && trip.filledSeats < newTotal) tripData.status = 'OPEN';
    else if (trip.status === 'OPEN' && trip.filledSeats >= newTotal) tripData.status = 'FULL';
  }

  // Only recompute the per-seat share while it is still unlocked.
  if (approvedCount === 0 && ['route', 'seats', 'vehicle'].some((c) => structural.includes(c))) {
    const newSeats = 'totalSeats' in incoming ? Number(incoming.totalSeats) : trip.totalSeats;
    const newEff =
      incoming.vehicle && 'fuelEfficiencyKmL' in incoming.vehicle
        ? Number(incoming.vehicle.fuelEfficiencyKmL)
        : trip.vehicle.fuelEfficiencyKmL;
    const newDist =
      'distanceMeters' in incoming && incoming.distanceMeters != null
        ? Math.round(Number(incoming.distanceMeters))
        : trip.distanceMeters;
    tripData.fuelSharePerSeat = computeFuelSharePerSeat({
      distanceMeters: newDist,
      efficiencyKmL: newEff,
      pricePerLiter: trip.fuelPricePerLiter,
      passengerSeats: newSeats,
    });
  }

  const vehicleData = {};
  if (incoming.vehicle) {
    for (const k of EDITABLE_VEHICLE_FIELDS) {
      if (!(k in incoming.vehicle)) continue;
      if (k === 'fuelEfficiencyKmL') vehicleData[k] = Number(incoming.vehicle[k]);
      else if (k === 'plate') vehicleData[k] = incoming.vehicle[k] || null;
      else vehicleData[k] = incoming.vehicle[k];
    }
  }

  const notifyMatches =
    structural.length > 0 && approvedCount > 0
      ? trip.matches.filter((m) => m.status === 'PENDING' || m.status === 'APPROVED')
      : [];

  let notifMessage = '';
  if (notifyMatches.length) {
    const hostRaw = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const host = decryptUserFields(hostRaw);
    const fuelLine = fsChange ? ` Your fuel share stays ₱${fsChange.from.toFixed(2)} as agreed.` : '';
    notifMessage = `${host.fullName} changed ${describeCategories(structural)} on the trip to ${trip.destinationAddress}.${fuelLine}`;
  }

  const ops = [prisma.trip.update({ where: { id }, data: tripData })];
  if (Object.keys(vehicleData).length) ops.push(prisma.vehicle.update({ where: { id: trip.vehicleId }, data: vehicleData }));
  for (const m of notifyMatches) {
    ops.push(
      prisma.notification.create({
        data: { userId: m.passengerId, type: 'TRIP_UPDATED', message: notifMessage, relatedMatchId: m.id, relatedTripId: trip.id },
      })
    );
  }
  await prisma.$transaction(ops);

  const updated = await prisma.trip.findUnique({ where: { id }, include: { vehicle: true } });
  res.json({ trip: decryptTripFields(updated), notified: notifyMatches.length });
}

module.exports = { createTrip, listMine, getById, geocode, cancelTrip, markCompleted, updateTrip, updateLocation, getLocation };
