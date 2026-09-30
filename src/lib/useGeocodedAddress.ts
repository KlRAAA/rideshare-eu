import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import type { LatLng } from './directions';

// Debounced forward-geocoding of typed address text (via /api/geocode →
// Nominatim). The result is approximate; callers let the user drag a map pin
// to override it.
export function useGeocodedAddress(query: string, initial: LatLng | null = null) {
  const [coords, setCoords] = useState<LatLng | null>(initial);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setCoords(null);
      return;
    }
    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<LatLng & { displayName: string }>(`/api/geocode?q=${encodeURIComponent(query)}`);
        setCoords({ lat: result.lat, lng: result.lng });
      } catch {
        setCoords(null);
      } finally {
        setResolving(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  return { coords, resolving };
}

// Readable label for a dropped pin, or null if the reverse lookup fails.
export async function reverseGeocodeLabel(point: LatLng): Promise<string | null> {
  try {
    const { displayName } = await apiFetch<{ displayName: string }>(`/api/geocode?lat=${point.lat}&lng=${point.lng}`);
    return displayName;
  } catch {
    return null;
  }
}
