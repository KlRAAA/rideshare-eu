const prisma = require('../config/db');
const { inLuzon } = require('../config/serviceArea');
const { ongoingRun, finishRun } = require('../services/tripRunService');
const { nextDeparture, plannedArrival } = require('../services/tripRunRules');
const { phDateOnly } = require('../services/recurrenceMath');
const { geocodeAddress, reverseGeocode } = require('../services/geocodingService');
const { suggestAddresses } = require('../services/addressSuggestService');
const { validateClientRoute } = require('../services/routeSanity');
const { computeFuelSharePerSeat } = require('../services/fuelShareService');
const { classifyTripChanges, describeCategories, fuelShareWouldChange } = require('../services/tripUpdateService');
const { applyLazyCompletion, completeTrip } = require('../services/tripCompletionService');
const safeUserSelect = require('../config/safeUserSelect');
const { encryptField, decryptUserFields, decryptTripFields } = require('../services/encryptionService');

const { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER, getOfficialFuelPrice } = require('../services/fuelPriceService');
const { cancelWholeTrip, cancelPassengerMatch, ACTIVE_MATCH_STATUSES } = require('../services/tripCancellationService');
const { validateNewTrip } = require('../services/tripValidation');
const { GENDER_PREFERENCES, canHostWomenPlus, isWomenPlusEligible } = require('../services/riderRules');
const { riderFacts } = require('../services/riderFacts');

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

  const invalidField = validateNewTrip(body);
  if (invalidField) return res.status(400).json({ error: 'INVALID_TRIP', field: invalidField });
  if (body.recurrenceType !== 'CUSTOM') body.customDays = [];

  // The car must exist and belong to the caller — otherwise a host could post a
  // trip with someone else's car, plate and fuel efficiency attached.
  const vehicle = typeof body.vehicleId === 'string' ? await prisma.vehicle.findUnique({ where: { id: body.vehicleId } }) : null;
  if (!vehicle) return res.status(400).json({ error: 'VEHICLE_REQUIRED' });
  if (vehicle.ownerId !== req.user.id) return res.status(403).json({ error: 'VEHICLE_NOT_OWNED' });

  // Only a Women+ host may post a Women+ trip (Women+ spec D5).
  if (body.genderPreference === 'WOMEN_PLUS' && !canHostWomenPlus(await riderFacts(prisma, req.user.id, req.user.id))) {
    return res.status(403).json({ error: 'WOMEN_PLUS_HOST_NOT_ELIGIBLE' });
  }

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

    // Capped by the official price for this car's fuel type; with none set
    // for that type, only the sanity bounds above apply.
    const official = await getOfficialFuelPrice(vehicle.fuelType);
    if (official && price > official.pricePerLiter) {
      return res.status(400).json({ error: 'FUEL_PRICE_ABOVE_OFFICIAL', officialPrice: official.pricePerLiter, fuelType: vehicle.fuelType });
    }
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
  const fuelSharePerSeat = computeFuelSharePerSeat({
    distanceMeters: routeData.distanceMeters,
    efficiencyKmL: vehicle.fuelEfficiencyKmL,
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
  const ONGOING_RUN = { where: { status: 'ONGOING' }, select: { id: true } };
  const hosted = await prisma.trip.findMany({
    where: { hostId: userId },
    include: {
      runs: ONGOING_RUN,
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
    include: { trip: { include: { vehicle: true, host: { select: safeUserSelect }, runs: ONGOING_RUN } } },
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

  // A trip with an ongoing run shows "In progress" (sub-project B).
  const withProgress = ({ runs, ...t }) => ({ ...t, inProgress: runs.length > 0 });
  const hostedWithRatings = hosted.map((t) => ({
    ...withProgress(decryptTripFields(t)),
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
    const trip = { ...withProgress(decryptTripFields(m.trip)), host: decryptUserFields(m.trip.host) };
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

// A shared link must not expose a Women+ trip's route and schedule to someone
// who can't join it (Women+ spec S2): they get the same 404 as a missing trip,
// so the response doesn't confirm it exists. The host and riders already on
// the trip keep access, even after a gender change (D2).
async function canOpenTrip(trip, userId) {
  if (trip.genderPreference !== 'WOMEN_PLUS' || trip.hostId === userId) return true;
  const onTrip = trip.matches.some(
    (m) => m.passengerId === userId && ['PENDING', 'APPROVED', 'COMPLETED'].includes(m.status)
  );
  if (onTrip) return true;
  const viewer = await riderFacts(prisma, userId, trip.hostId);
  return viewer != null && isWomenPlusEligible(viewer.gender);
}

async function getById(req, res) {
  const userId = req.user.id;
  const tripRaw = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: {
      host: { select: safeUserSelect },
      vehicle: true,
      matches: { include: { passenger: { select: safeUserSelect } } },
      runs: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
  if (!tripRaw) return res.status(404).json({ error: 'Trip not found' });
  if (!(await canOpenTrip(tripRaw, userId))) return res.status(404).json({ error: 'Trip not found' });
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

  // Sub-project B: today's run (ongoing, or ended today) and, for an active
  // trip, the next departure that can still be started.
  const now = new Date();
  const [latestRun] = tripRaw.runs;
  delete trip.runs;
  trip.currentRun =
    latestRun && (latestRun.status === 'ONGOING' || latestRun.runDate.getTime() === phDateOnly(now).getTime())
      ? { status: latestRun.status, startedAt: latestRun.startedAt, plannedArrivalAt: latestRun.plannedArrivalAt, etaAt: latestRun.etaAt }
      : null;
  const next = ['OPEN', 'FULL'].includes(trip.status) ? nextDeparture(tripRaw, now) : null;
  trip.nextDeparture = next && { ...next, plannedArrivalAt: plannedArrival(tripRaw, next.departure) };

  res.json({ trip });
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

  // While a run is on the road, completing it means ending that run.
  const run = await ongoingRun(id);
  if (run) {
    await finishRun(run, 'DRIVER');
    return res.json({ trip: await prisma.trip.findUnique({ where: { id } }) });
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

// Up to 5 Philippine places for the address dropdown. Always 200: no match or a
// Photon outage is an empty list, and the field still accepts typed text.
const MAX_SUGGEST_QUERY = 200;
async function suggestAddress(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, MAX_SUGGEST_QUERY) : '';
  res.json({ suggestions: await suggestAddresses(q) });
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
  if (await ongoingRun(trip.id)) return res.status(409).json({ error: 'TRIP_IN_PROGRESS' });

  if (userId === trip.hostId) {
    // Host cancels: whole trip + every active match, notify every affected passenger.
    const affectedMatches = await prisma.$transaction((tx) => cancelWholeTrip(tx, trip, { reason }));
    return res.json({ status: 'TRIP_CANCELLED', affectedMatches });
  }

  const myMatch = trip.matches.find((m) => m.passengerId === userId && ACTIVE_MATCH_STATUSES.includes(m.status));
  if (!myMatch) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const passengerRaw = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  const passenger = decryptUserFields(passengerRaw);

  await prisma.$transaction(async (tx) => {
    await cancelPassengerMatch(tx, myMatch);
    await tx.notification.create({
      data: {
        userId: trip.hostId,
        type: 'CANCELLATION',
        message: `${passenger.fullName} cancelled their spot on your trip to ${trip.destinationAddress}.`,
        relatedMatchId: myMatch.id,
        relatedTripId: trip.id,
      },
    });
  });

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

// An edited point must stay in Luzon, like a new trip's (tripValidation.js).
// Returns the first point moved outside it, or null.
function pointOutsideLuzon(trip, incoming) {
  for (const point of ['origin', 'destination', 'meetingPoint']) {
    const latKey = `${point}Lat`;
    const lngKey = `${point}Lng`;
    if (!(latKey in incoming) && !(lngKey in incoming)) continue;
    const lat = Number(latKey in incoming ? incoming[latKey] : trip[latKey]);
    const lng = Number(lngKey in incoming ? incoming[lngKey] : trip[lngKey]);
    if (!inLuzon(lat, lng)) return point;
  }
  return null;
}

// "Who can join" (Women+ spec D3, D5, S13): only a Women+ host may choose
// Women+, and the rule can't change once a rider is approved, since riders
// agreed to the trip as it was. Switching to Women+ declines pending riders who
// can't join; they get the ordinary "declined" notification, which says
// nothing about gender. Returns { status, body } to refuse, or { declines }.
async function checkWhoCanJoinChange(trip, incoming, approvedCount, hostId) {
  if (!('genderPreference' in incoming) || incoming.genderPreference === trip.genderPreference) return { declines: [] };
  if (!GENDER_PREFERENCES.includes(incoming.genderPreference)) {
    return { status: 400, body: { error: 'INVALID_TRIP', field: 'genderPreference' } };
  }
  if (approvedCount > 0) return { status: 409, body: { error: 'WHO_CAN_JOIN_LOCKED' } };
  if (incoming.genderPreference !== 'WOMEN_PLUS') return { declines: [] };
  if (!canHostWomenPlus(await riderFacts(prisma, hostId, hostId))) {
    return { status: 403, body: { error: 'WOMEN_PLUS_HOST_NOT_ELIGIBLE' } };
  }
  const pending = trip.matches.filter((m) => m.status === 'PENDING');
  if (pending.length === 0) return { declines: [] };
  const riders = await prisma.user.findMany({
    where: { id: { in: pending.map((m) => m.passengerId) } },
    select: { id: true, gender: true },
  });
  const eligible = new Set(riders.filter((u) => isWomenPlusEligible(decryptUserFields(u).gender)).map((u) => u.id));
  return { declines: pending.filter((m) => !eligible.has(m.passengerId)) };
}

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

  const outside = pointOutsideLuzon(trip, incoming);
  if (outside) return res.status(400).json({ error: 'INVALID_TRIP', field: outside });

  const approvedCount = trip.matches.filter((m) => m.status === 'APPROVED').length;

  const whoCanJoin = await checkWhoCanJoinChange(trip, incoming, approvedCount, userId);
  if (whoCanJoin.body) return res.status(whoCanJoin.status).json(whoCanJoin.body);

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
  for (const m of whoCanJoin.declines) {
    ops.push(prisma.match.update({ where: { id: m.id }, data: { status: 'DECLINED', respondedAt: new Date() } }));
    ops.push(
      prisma.notification.create({
        data: {
          userId: m.passengerId,
          type: 'APPROVAL',
          message: `Your request to join the trip to ${trip.destinationAddress} was declined.`,
          relatedMatchId: m.id,
          relatedTripId: trip.id,
        },
      })
    );
  }
  await prisma.$transaction(ops);

  const updated = await prisma.trip.findUnique({ where: { id }, include: { vehicle: true } });
  res.json({ trip: decryptTripFields(updated), notified: notifyMatches.length });
}

module.exports = { createTrip, listMine, getById, geocode, suggestAddress, cancelTrip, markCompleted, updateTrip };
