module.exports = {
  weights: { w1: 0.5, w2: 0.3, w3: 0.2 },
  minRouteOverlap: 0.4,
  // Widened from 500m (Task 25): free-tier geocoding (Nominatim) commonly
  // resolves a typed place name to a point 1-2km off from where the host or
  // passenger actually meant, and a trip with no OSRM/ORS-derived
  // routeWaypoints falls back to a straight origin-destination line rather
  // than a road-following polyline — both push real, intended matches below
  // a tight corridor. Reproduced against a real trip in the local DB: a
  // ~1.5-2km offset on an otherwise-identical search computed
  // routeOverlap=0.00 at 500m; this value was chosen to tolerate that
  // specific, demonstrated case while still requiring genuine route
  // proximity, not just "same city."
  corridorMeters: 1500,
  defaultFlexWindowMinutes: 15,
  // Only used by the Find a Ride empty-state "Show all trips to <destination>"
  // fallback (server/services/psgaService.js → runShowAllFallback). That view
  // relaxes the Stage 1 route-overlap and departure-time gates, but still
  // anchors on the destination: a candidate trip is kept only if its own
  // destination is within this radius of the searcher's destination. 3km is
  // loose enough to absorb the ±1-2km Nominatim geocoding drift noted above
  // while still meaning "heading to the same place," not "same city."
  destinationAnchorMeters: 3000,
};
