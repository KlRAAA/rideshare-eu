// Suggestions for the address fields, from komoot's public Photon service
// (photon.komoot.io), which is built on OpenStreetMap and, unlike Nominatim,
// allows search-as-you-type ("please be fair"). Results are limited to the
// Philippines and ranked toward Lucena; repeated queries come from a cache.

const USER_AGENT = 'RideShareEU-MSEUF-Thesis-Prototype/1.0';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const LUCENA = { lat: '13.94', lon: '121.62' };
const PH_BBOX = '116,4.5,127,21.5'; // west,south,east,north
const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
const ASK_FOR = 10; // extra, since non-PH and duplicate entries are dropped
const DEFAULTS = { ttlMs: 60 * 60 * 1000, maxEntries: 2000, timeoutMs: 4000 };

// "Puregold" + "Doña Aurora Boulevard, Ilayang Iyam, Lucena". In Philippine
// data Photon puts the province in `county` and the region in `state`; a city's
// county is its legislative district ("2nd District"), which reads as noise,
// so it is left out. The region is shown only when nothing more local is known.
function placeLabel(p) {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
  const primary = p.name || streetLine || p.city || p.state || '';
  const county = p.county && !/district/i.test(p.county) ? p.county : '';
  const parts = [p.name ? streetLine : '', p.district || p.locality, p.city, county];
  if (!parts.some(Boolean)) parts.push(p.state);
  const seen = new Set([primary.toLowerCase()]);
  const secondary = parts.filter((part) => {
    if (!part || seen.has(part.toLowerCase())) return false;
    seen.add(part.toLowerCase());
    return true;
  });
  return { primary, secondary: secondary.join(', ') };
}

function toSuggestions(collection) {
  const features = Array.isArray(collection?.features) ? collection.features : [];
  const out = [];
  const labels = new Set();
  for (const f of features) {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [];
    if (p.countrycode !== 'PH' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const { primary, secondary } = placeLabel(p);
    if (!primary) continue;
    const label = secondary ? `${primary}, ${secondary}` : primary;
    if (labels.has(label)) continue;
    labels.add(label);
    out.push({ label, primary, secondary, lat, lng });
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

function createSuggester({
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  ttlMs = DEFAULTS.ttlMs,
  maxEntries = DEFAULTS.maxEntries,
  timeoutMs = DEFAULTS.timeoutMs,
} = {}) {
  const cache = new Map(); // key -> { value, expiresAt }; insertion order = LRU order

  async function fetchSuggestions(query) {
    const url = new URL(PHOTON_URL);
    url.search = new URLSearchParams({ q: query, limit: String(ASK_FOR), lat: LUCENA.lat, lon: LUCENA.lon, bbox: PH_BBOX }).toString();
    try {
      const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        console.warn(`[suggest] Photon returned ${res.status}`);
        return null;
      }
      return toSuggestions(await res.json());
    } catch (err) {
      console.warn(`[suggest] Photon unreachable: ${err.message}`);
      return null;
    }
  }

  // Never throws: an outage means no suggestions, and the address field still
  // works by typing and moving the map pin.
  async function suggest(rawQuery) {
    const query = String(rawQuery ?? '').trim().replace(/\s+/g, ' ');
    if (query.length < MIN_QUERY_LENGTH) return [];
    const key = query.toLowerCase();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) {
      cache.delete(key);
      cache.set(key, hit);
      return hit.value;
    }
    const value = await fetchSuggestions(query);
    if (value === null) return [];
    cache.set(key, { value, expiresAt: now() + ttlMs });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
    return value;
  }

  return { suggest };
}

const shared = createSuggester();

module.exports = { createSuggester, placeLabel, suggestAddresses: shared.suggest };
