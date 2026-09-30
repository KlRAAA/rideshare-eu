import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geoProximity';
import type { LatLng } from './directions';

// Shared by the "Use my current location" button on both PostTripForm and
// SearchClient's origin field. Returns the device's exact coordinates (which
// the caller pins on the map) plus a readable address for the text field.
export function useCurrentLocationAddress() {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(): Promise<{ address: string; coords: LatLng } | null> {
    setResolving(true);
    setError(null);
    try {
      // One-shot, fail-soft — same as checkCampusProximity: resolves null on
      // denial/timeout/unsupported rather than throwing.
      const coords = await getCurrentCoords();
      if (!coords) {
        setError('Couldn’t get your location — you can still type your address.');
        return null;
      }
      const result = await apiFetch<{ displayName: string }>(`/api/geocode?lat=${coords.lat}&lng=${coords.lng}`);
      return { address: result.displayName, coords: { lat: coords.lat, lng: coords.lng } };
    } catch {
      setError('Couldn’t get your location — you can still type your address.');
      return null;
    } finally {
      setResolving(false);
    }
  }

  return { resolving, error, resolve };
}
