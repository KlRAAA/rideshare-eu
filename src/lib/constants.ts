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

// Default pre-fill for the Post a Ride form's own fuel-price input — the host
// types today's actual retail price (no reliable free PH fuel-price API
// exists), this is just a sensible starting point so the field isn't blank.
// Also drives the live "≈ ₱x per seat" preview while typing.
export const FUEL_PRICE_PER_LITER = 62.55;

// Sanity bounds on the host's typed price — catches an obvious typo (an extra
// digit, a misplaced decimal) before it produces a wildly wrong fuel-share
// figure. Keep in sync with server/controllers/tripController.js's
// MIN/MAX_FUEL_PRICE_PER_LITER (the authoritative, server-side copy of this
// same check).
export const MIN_FUEL_PRICE_PER_LITER = 20;
export const MAX_FUEL_PRICE_PER_LITER = 150;
