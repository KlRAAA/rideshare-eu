import { MSEUF_LUCENA } from '@/lib/constants';

const PROXIMITY_THRESHOLD_METERS = 150;
const EARTH_RADIUS_M = 6371000;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface GeoCoords {
  lat: number;
  lng: number;
}

// Wraps the browser Geolocation API in a promise that resolves `null` on any
// failure (permission denied, unsupported, timeout) instead of rejecting, so
// a caller treats "no signal" as a plain value to check rather than an
// exception to catch. Shared plumbing only — checkCampusProximity (a
// one-shot check on mount) and the live-location broadcast loop (repeated on
// its own ~25-30s interval for as long as a trip is active) each call this
// independently rather than sharing one interval: they run on genuinely
// different cadences and lifetimes, and forcing them into one loop would
// mean either the one-shot proximity check re-firing repeatedly (changing
// existing behavior) or the broadcast being one-shot (useless for its
// purpose).
export function getCurrentCoords(options: PositionOptions = { timeout: 10000, maximumAge: 60000 }): Promise<GeoCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      options
    );
  });
}

// Resolves `true` if the browser reports a position within ~150m of campus,
// `false` if it reports a position further away, and `null` for every
// failure mode — never throws, so a caller can treat `null` exactly like
// "signal not available" and fall back to the lazy/manual completion paths
// without any special-casing. Behavior unchanged from before this was
// rewritten atop getCurrentCoords — same options, same signature.
export function checkCampusProximity(): Promise<boolean | null> {
  return getCurrentCoords({ timeout: 10000, maximumAge: 60000 }).then((coords) => {
    if (!coords) return null;
    return haversineMeters(coords, MSEUF_LUCENA) <= PROXIMITY_THRESHOLD_METERS;
  });
}
