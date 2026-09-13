const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Parses the search form's "YYYY-MM-DD" (Philippine-local, from the
// DatePicker) into the same comparison key phDateOnly produces. A bare
// date-only ISO string has no instant/offset ambiguity of its own — it
// parses as UTC midnight of that calendar day, already the correct
// frame-agnostic key, unlike a stored departureTime (a real UTC instant
// that needs the +8h conversion above).
function parseSearchDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Does this trip have an occurrence on the passenger's selected (Philippine-
// local) date at all? Independent of time-of-day — that's still handled
// separately by departureTimeDiff/computeScheduleAlignment below, exactly as
// the manuscript's own PSGA formula documents (time-of-day scoring, not
// date). A ONE_TIME trip must match its own single date exactly (today,
// nothing checked this at all — see AGENTS.md); a recurring trip must
// actually run that day.
function tripRunsOnSearchDate(trip, searchDateStr) {
  const targetDay = parseSearchDate(searchDateStr);
  if (!targetDay) return false;
  return recurrenceRunsOnDay(trip, phDateOnly(trip.departureTime), targetDay);
}

function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Distance from point p to the nearest segment in the host's waypoint polyline.
function distanceToPolylineMeters(point, waypoints) {
  if (waypoints.length === 1) return haversineMeters(point, waypoints[0]);
  let min = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = distanceToSegmentMeters(point, waypoints[i], waypoints[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// Approximates point-to-segment distance by sampling the segment (sufficient
// at city scale; avoids a full planar projection for a 2-point corridor).
function distanceToSegmentMeters(point, segStart, segEnd, samples = 20) {
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sample = {
      lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
      lng: segStart.lng + (segEnd.lng - segStart.lng) * t,
    };
    const d = haversineMeters(point, sample);
    if (d < min) min = d;
  }
  return min;
}

// Samples the straight line from the passenger's origin to their destination and
// classifies each point as inside/outside the host route's corridor. `fraction`
// is the Stage 1 route-overlap score; `samples` is the same classification the
// RouteMap component paints, so the map and the algorithm can never disagree.
function computeRouteOverlapDetail(passenger, host, corridorMeters, samples = 20) {
  const { origin, destination } = passenger;
  const points = [];
  let within = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = {
      lat: origin.lat + (destination.lat - origin.lat) * t,
      lng: origin.lng + (destination.lng - origin.lng) * t,
    };
    const inside = distanceToPolylineMeters(p, host.waypoints) <= corridorMeters;
    if (inside) within++;
    points.push({ lat: p.lat, lng: p.lng, inside });
  }
  return { fraction: within / (samples + 1), corridorMeters, samples: points };
}

function computeRouteOverlap(passenger, host, corridorMeters, samples = 20) {
  return computeRouteOverlapDetail(passenger, host, corridorMeters, samples).fraction;
}

function computeScheduleAlignment(timeDiffMinutes, flexWindowMinutes) {
  if (flexWindowMinutes === 0) return timeDiffMinutes === 0 ? 1.0 : 0.0;
  return Math.max(0, 1 - timeDiffMinutes / flexWindowMinutes);
}

// matchController rejects a non-numeric `departureMinutes` at the HTTP boundary,
// but guard here too: `Math.abs(null - n)` silently coerces to `Math.abs(-n)`,
// which is how an empty search-form time field once matched every trip against
// 00:00. A non-finite input yields Infinity so it fails every time window.
function departureTimeDiff(passengerMinutes, tripMinutes) {
  if (!Number.isFinite(passengerMinutes) || !Number.isFinite(tripMinutes)) return Infinity;
  return Math.abs(passengerMinutes - tripMinutes);
}

// genderMatchesHost/familiarWithHost are read from `trip`, not `passenger`,
// deliberately: a single search spans many candidate trips with different
// hosts, so "does this passenger match THIS host's gender" and "has this
// passenger ridden with THIS host before" are per-candidate facts, not one
// flat value for the whole request. The caller (matchController.search)
// computes them per host before candidates ever reach this function.
function checkPreferenceMatch(passenger, trip) {
  if (trip.filledSeats >= trip.totalSeats) return false;
  if (trip.genderPreference === 'SAME_GENDER' && trip.genderMatchesHost === false) return false;
  if (trip.familiarRidersOnly && trip.familiarWithHost === false) return false;
  return true;
}

function runPSGA(passengerRequest, candidateTrips, config) {
  const { weights, minRouteOverlap, corridorMeters } = config;
  const filtered = [];

  for (const trip of candidateTrips) {
    const routeOverlap = computeRouteOverlap(passengerRequest, trip, corridorMeters);
    const timeDiff = departureTimeDiff(passengerRequest.departureMinutes, trip.departureMinutes);
    const flexWindow = passengerRequest.flexWindowMinutes;

    if (routeOverlap >= minRouteOverlap && timeDiff <= flexWindow) {
      filtered.push({ trip, routeOverlap, timeDiff, flexWindow });
    }
  }

  if (filtered.length === 0) return { status: 'NO_MATCH' };

  const scored = filtered.map(({ trip, routeOverlap, timeDiff, flexWindow }) => {
    const scheduleAlignment = computeScheduleAlignment(timeDiff, flexWindow);
    const preferenceMatch = checkPreferenceMatch(passengerRequest, trip) ? 1.0 : 0.0;
    const score = Number(
      (weights.w1 * routeOverlap + weights.w2 * scheduleAlignment + weights.w3 * preferenceMatch).toFixed(4)
    );
    return { tripId: trip.id, score, routeOverlap, scheduleAlignment, preferenceMatch: preferenceMatch === 1.0 };
  });

  scored.sort((a, b) => b.score - a.score);
  return { status: 'MATCHED', matches: scored };
}

// Empty-state fallback for Find a Ride. When runPSGA returns NO_MATCH because
// the matching pool is too thin, the "Show all trips to <destination>" link in
// the empty state calls this instead. It relaxes Stage 1 ONLY:
//
//   - the route-overlap threshold (minRouteOverlap) — dropped entirely
//   - the departure-time window (flexWindow)         — dropped entirely
//
// Everything the PSGA design treats as a safety constraint stays hard:
//
//   - the searcher's own "same-gender only" preference is already applied by
//     the caller (matchController.loadSearchCandidates → eligibleTrips) before
//     candidates ever reach this function
//   - the host's genderPreference / familiarRidersOnly — which normal matching
//     only feeds into the 20%-weight preferenceMatch score — are promoted here
//     to HARD filters via checkPreferenceMatch, so this view is never a way
//     around them
//   - the destination anchor: a candidate is kept only if its destination is
//     within config.destinationAnchorMeters of the searcher's destination, so
//     "show all" means "all trips going where you're going," not every trip.
//
// routeOverlap / scheduleAlignment are still computed for display and ranking.
function runShowAllFallback(passengerRequest, candidateTrips, config) {
  const { weights, corridorMeters, destinationAnchorMeters } = config;
  const flexWindow = passengerRequest.flexWindowMinutes;

  const kept = candidateTrips.filter((trip) => {
    if (!trip.destination) return false;
    const destGap = haversineMeters(passengerRequest.destination, trip.destination);
    if (destGap > destinationAnchorMeters) return false;
    // Hard safety gate — seats, host gender preference, familiar-riders-only.
    return checkPreferenceMatch(passengerRequest, trip);
  });

  if (kept.length === 0) return { status: 'NO_MATCH' };

  const scored = kept.map((trip) => {
    const routeOverlap = computeRouteOverlap(passengerRequest, trip, corridorMeters);
    const timeDiff = departureTimeDiff(passengerRequest.departureMinutes, trip.departureMinutes);
    const scheduleAlignment = computeScheduleAlignment(timeDiff, flexWindow);
    // Always 1.0 here (kept trips already passed checkPreferenceMatch), but kept
    // in the formula so a fallback card's score is comparable to a normal one.
    const preferenceMatch = 1.0;
    const score = Number(
      (weights.w1 * routeOverlap + weights.w2 * scheduleAlignment + weights.w3 * preferenceMatch).toFixed(4)
    );
    return { tripId: trip.id, score, routeOverlap, scheduleAlignment, preferenceMatch: true };
  });

  scored.sort((a, b) => b.score - a.score);
  return { status: 'MATCHED', matches: scored };
}

module.exports = {
  computeRouteOverlap,
  computeRouteOverlapDetail,
  computeScheduleAlignment,
  checkPreferenceMatch,
  runPSGA,
  runShowAllFallback,
  haversineMeters,
  phDateOnly,
  parseSearchDate,
  tripRunsOnSearchDate,
};
