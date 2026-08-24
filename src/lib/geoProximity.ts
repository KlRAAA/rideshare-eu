// Geocoded once via Nominatim during this session's Task 7 testing
// ("Manuel S. Enverga University Foundation, Lucena") and reused here rather
// than re-geocoded, per the plan's instruction to hardcode a single lookup.
export const MSEUF_CAMPUS = { lat: 13.9490188, lng: 121.6202904 };

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

// Resolves `true` if the browser reports a position within ~150m of campus,
// `false` if it reports a position further away, and `null` for every
// failure mode (permission denied, unsupported, timeout) — never throws, so
// a caller can treat `null` exactly like "signal not available" and fall
// back to the lazy/manual completion paths without any special-casing.
export function checkCampusProximity(): Promise<boolean | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = haversineMeters(
          { lat: position.coords.latitude, lng: position.coords.longitude },
          MSEUF_CAMPUS
        );
        resolve(distance <= PROXIMITY_THRESHOLD_METERS);
      },
      () => resolve(null),
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}
