// Manuel S. Enverga University Foundation — Lucena City campus (Brgy. Ibabang
// Dupay, off the Diversion Road). The one fixed destination every commute in
// this app converges on. Used as the default destination marker in RouteMap and
// available to the Post a Ride / Find a Ride forms so they don't re-geocode the
// same place name on every keystroke.
//
// NOTE: verify this pin lands on the actual campus once RouteMap renders — it
// started as a geocode of the place-name string, not a surveyed point.
export const MSEUF_LUCENA = {
  lat: 13.9490188,
  lng: 121.6202904,
  label: 'MSEUF Lucena City',
} as const;

// Retail gas price (PHP/L), for the Post a Ride "≈ ₱x per seat" preview ONLY.
// The authoritative value is computed and persisted server-side at posting time
// (server/config/psgaConfig.js `fuelPricePerLiter`) — keep this in sync with it.
export const FUEL_PRICE_PER_LITER = 62.55;
