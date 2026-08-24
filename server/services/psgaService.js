const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
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

function computeRouteOverlap(passenger, host, corridorMeters, samples = 20) {
  const { origin, destination } = passenger;
  let within = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sample = {
      lat: origin.lat + (destination.lat - origin.lat) * t,
      lng: origin.lng + (destination.lng - origin.lng) * t,
    };
    if (distanceToPolylineMeters(sample, host.waypoints) <= corridorMeters) within++;
  }
  return within / (samples + 1);
}

function computeScheduleAlignment(timeDiffMinutes, flexWindowMinutes) {
  if (flexWindowMinutes === 0) return timeDiffMinutes === 0 ? 1.0 : 0.0;
  return Math.max(0, 1 - timeDiffMinutes / flexWindowMinutes);
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

  // Temporary diagnostic logging (per explicit request) to see the Stage 1
  // filter's actual per-trip decisions instead of guessing why a trip is
  // missing from results. Left in place until the corridor/geocoding
  // precision issue described in Task 25's writeup is actually resolved.
  for (const trip of candidateTrips) {
    const routeOverlap = computeRouteOverlap(passengerRequest, trip, corridorMeters);
    const timeDiff = Math.abs(passengerRequest.departureMinutes - trip.departureMinutes);
    const flexWindow = passengerRequest.flexWindowMinutes;
    const overlapOk = routeOverlap >= minRouteOverlap;
    const timeOk = timeDiff <= flexWindow;

    if (overlapOk && timeOk) {
      filtered.push({ trip, routeOverlap, timeDiff, flexWindow });
      console.log(`[PSGA] Accepted trip ${trip.id}: routeOverlap=${routeOverlap.toFixed(2)} (>=${minRouteOverlap}), timeDiff=${timeDiff}min (<=${flexWindow}min)`);
    } else if (!overlapOk && !timeOk) {
      console.log(`[PSGA] Rejected trip ${trip.id}: Route overlap ${routeOverlap.toFixed(2)} below threshold ${minRouteOverlap} AND time mismatch (diff ${timeDiff}min > window ${flexWindow}min)`);
    } else if (!overlapOk) {
      console.log(`[PSGA] Rejected trip ${trip.id}: Route overlap ${routeOverlap.toFixed(2)} below threshold ${minRouteOverlap} (corridor=${corridorMeters}m)`);
    } else {
      console.log(`[PSGA] Rejected trip ${trip.id}: Time mismatch — diff ${timeDiff}min exceeds window ${flexWindow}min`);
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

module.exports = { computeRouteOverlap, computeScheduleAlignment, checkPreferenceMatch, runPSGA, haversineMeters };
