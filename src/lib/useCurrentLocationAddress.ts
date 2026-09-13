import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geoProximity';

// Shared by the "Use my current location" button on both PostTripForm and
// SearchClient's origin field. Resolves a display address the caller can drop
// straight into its existing origin text state — neither form has a separate
// "set the coordinates directly" path today (PostTripForm's useGeocodedAddress
// only ever derives coords by forward-geocoding whatever text is in the
// field; SearchClient forward-geocodes the text at submit time). Setting the
// text here and letting that existing mechanism resolve coordinates is
// exactly how a typed address already works, so it's the correct way to
// "match how the existing flow sets both together" rather than inventing a
// second, bypassing path.
export function useCurrentLocationAddress() {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(): Promise<string | null> {
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
      return result.displayName;
    } catch {
      setError('Couldn’t get your location — you can still type your address.');
      return null;
    } finally {
      setResolving(false);
    }
  }

  return { resolving, error, resolve };
}
