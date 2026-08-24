// Nominatim usage policy requires a descriptive User-Agent and forbids
// unbounded/automated bulk lookups — this is fine for a user typing one
// address into a form, not for background batch geocoding.
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'RideShareEU-MSEUF-Thesis-Prototype/1.0' } });
  // Nominatim returns a non-JSON (XML/HTML) error body on failure — most
  // commonly a 429 from its strict rate limit, but any non-2xx is possible.
  // Treat it the same as "no results" rather than letting res.json() throw
  // and surface a raw unhandled-exception 500 to the client.
  if (!res.ok) {
    console.warn(`[geocode] Nominatim returned ${res.status} for query "${query}"`);
    return null;
  }
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name };
}

module.exports = { geocodeAddress };
