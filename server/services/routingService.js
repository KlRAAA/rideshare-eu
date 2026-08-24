// OSRM's public demo server plays the role Google Directions would have —
// same purpose (route geometry + distance + duration), free, no key, not for
// heavy production traffic. Waypoints feed psgaService's corridor check
// directly; durationSeconds feeds tripCompletionService's auto-completion
// window. This is the only routing call site in the codebase — trip
// creation (tripController.createTrip) calls this same function with the
// trip's own origin/destination, it does not duplicate the logic.
async function getRouteFromOsrm(origin, destination) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) return null;
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationSeconds: Math.round(route.duration),
    waypoints: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

// Fallback used only when OSRM fails and ORS_API_KEY is configured — OSRM's
// public demo server is fair-use only, not meant for sustained load (the
// thesis's own load test targets 50 concurrent users). ORS's free tier
// requires a real signup + API key, it is not keyless like OSRM, so this
// silently no-ops (falls through to returning null) when the key isn't set
// rather than ever blocking a trip creation on a routing provider being
// unavailable.
async function getRouteFromOrs(origin, destination) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;

  const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) return null;
  const summary = feature.properties.summary;
  return {
    distanceKm: summary.distance / 1000,
    durationSeconds: Math.round(summary.duration),
    waypoints: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

async function getRoute(origin, destination) {
  try {
    const osrmResult = await getRouteFromOsrm(origin, destination);
    if (osrmResult) return osrmResult;
  } catch {
    // fall through to ORS
  }
  try {
    return await getRouteFromOrs(origin, destination);
  } catch {
    return null;
  }
}

module.exports = { getRoute };
