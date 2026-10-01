// Address lookup through OpenStreetMap's public Nominatim service. Its usage
// policy (operations.osmfoundation.org/policies/nominatim) requires an
// identifying User-Agent, at most 1 request per second, and caching of
// results. This module enforces all three for the whole server process:
// results are cached, identical lookups in flight share one request, and
// every outgoing request waits its turn in a spaced queue.

const USER_AGENT = 'RideShareEU-MSEUF-Thesis-Prototype/1.0';
const BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULTS = {
  minIntervalMs: 1100,
  ttlMs: 24 * 60 * 60 * 1000,
  maxEntries: 1000,
};

function createGeocoder({
  fetchImpl = (...args) => fetch(...args),
  minIntervalMs = DEFAULTS.minIntervalMs,
  ttlMs = DEFAULTS.ttlMs,
  maxEntries = DEFAULTS.maxEntries,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const cache = new Map(); // key -> { value, expiresAt }; Map order doubles as LRU order
  const inFlight = new Map(); // key -> Promise
  let queue = Promise.resolve();
  let lastRequestAt = null;

  function readCache(key) {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now()) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, hit);
    return hit.value;
  }

  function writeCache(key, value) {
    cache.set(key, { value, expiresAt: now() + ttlMs });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  }

  // Runs `task` after the previous request plus the minimum spacing.
  function throttled(task) {
    const run = queue.then(async () => {
      if (lastRequestAt !== null) {
        const wait = lastRequestAt + minIntervalMs - now();
        if (wait > 0) await sleep(wait);
      }
      lastRequestAt = now();
      return task();
    });
    queue = run.catch(() => {});
    return run;
  }

  async function lookup(key, url, parse) {
    const cached = readCache(key);
    if (cached !== undefined) return cached;
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = throttled(async () => {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
      // Nominatim answers errors (most often a 429 rate limit) with a non-JSON
      // body; treat any non-2xx as "no result" instead of throwing.
      if (!res.ok) {
        console.warn(`[geocode] Nominatim returned ${res.status} for ${url}`);
        return null;
      }
      return parse(await res.json());
    })
      .then((value) => {
        if (value) writeCache(key, value);
        return value;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
  }

  function geocodeAddress(query) {
    const normalized = String(query).trim().toLowerCase().replace(/\s+/g, ' ');
    const url = `${BASE_URL}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    return lookup(`fwd:${normalized}`, url, (results) =>
      Array.isArray(results) && results.length
        ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name }
        : null
    );
  }

  // A failed reverse lookup comes back as 200 with an `error` field, not a non-2xx.
  function reverseGeocode(lat, lng) {
    const key = `rev:${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
    const url = `${BASE_URL}/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    return lookup(key, url, (result) =>
      result && !result.error && result.display_name
        ? { lat: parseFloat(result.lat), lng: parseFloat(result.lon), displayName: result.display_name }
        : null
    );
  }

  return { geocodeAddress, reverseGeocode };
}

const shared = createGeocoder();

module.exports = {
  createGeocoder,
  geocodeAddress: shared.geocodeAddress,
  reverseGeocode: shared.reverseGeocode,
};
