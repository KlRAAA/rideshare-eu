const { haversineMeters } = require('./psgaService');

// The Post a Ride form fetches the route from Mapbox client-side and sends the
// distance/duration in the create payload, so the server never pays for a
// second Directions call. But those numbers drive the fuel-share figure shown
// to riders and the auto-completion timer, so trust them only after a cheap
// plausibility check against the straight-line (haversine) distance between the
// same two points. No network call — pure arithmetic.
//
// Bounds: a road can't be meaningfully shorter than the crow-flies line (0.9x
// absorbs geocoding jitter); a city route 15x the straight line is garbage
// (real detours run ~1.2-2.5x); implied average speed must sit between 1 m/s
// (~3.6 km/h, slower than walking) and 35 m/s (~126 km/h).
function validateClientRoute({ origin, destination, distanceMeters, durationSeconds }) {
  if (!origin || !destination) return { ok: false, reason: 'MISSING_ENDPOINTS' };

  const d = Number(distanceMeters);
  const t = Number(durationSeconds);
  if (!Number.isFinite(d) || d <= 0) return { ok: false, reason: 'BAD_DISTANCE' };
  if (!Number.isFinite(t) || t <= 0) return { ok: false, reason: 'BAD_DURATION' };

  const straightLine = haversineMeters(origin, destination);
  if (straightLine > 0) {
    if (d < straightLine * 0.9) return { ok: false, reason: 'DISTANCE_BELOW_CROW_FLIES' };
    if (d > straightLine * 15) return { ok: false, reason: 'DISTANCE_IMPLAUSIBLY_LONG' };
  }

  const speedMps = d / t;
  if (speedMps < 1 || speedMps > 35) return { ok: false, reason: 'IMPLAUSIBLE_SPEED' };

  return { ok: true };
}

module.exports = { validateClientRoute };
