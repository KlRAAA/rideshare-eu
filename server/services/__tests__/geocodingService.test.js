const { createGeocoder } = require('../geocodingService');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const SARIAYA = [{ lat: '13.96', lon: '121.52', display_name: 'Sariaya, Quezon' }];

function setup(overrides = {}) {
  const calls = [];
  let clock = 0;
  const fetchImpl = jest.fn(async (url) => {
    calls.push({ url, at: clock });
    return overrides.respond ? overrides.respond(url) : jsonResponse(SARIAYA);
  });
  const geocoder = createGeocoder({
    fetchImpl,
    minIntervalMs: 1100,
    ttlMs: 24 * 60 * 60 * 1000,
    maxEntries: 3,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    ...overrides.options,
  });
  return { geocoder, fetchImpl, calls, advance: (ms) => (clock += ms) };
}

describe('geocoding cache and throttle', () => {
  test('a repeated address is answered from the cache, ignoring case and spacing', async () => {
    const { geocoder, fetchImpl } = setup();
    const first = await geocoder.geocodeAddress('Sariaya, Quezon');
    const second = await geocoder.geocodeAddress('  sariaya,   QUEZON ');
    expect(first).toEqual({ lat: 13.96, lng: 121.52, displayName: 'Sariaya, Quezon' });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('identical lookups in flight at the same time share one request', async () => {
    const { geocoder, fetchImpl } = setup();
    const [a, b] = await Promise.all([geocoder.geocodeAddress('Lucena'), geocoder.geocodeAddress('lucena')]);
    expect(a).toEqual(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('different lookups are spaced at least 1.1 seconds apart', async () => {
    const { geocoder, calls } = setup();
    await Promise.all([geocoder.geocodeAddress('Lucena'), geocoder.geocodeAddress('Tayabas'), geocoder.reverseGeocode(13.9, 121.6)]);
    expect(calls).toHaveLength(3);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1100);
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(1100);
  });

  test('cached answers expire after the time-to-live', async () => {
    const { geocoder, fetchImpl, advance } = setup();
    await geocoder.geocodeAddress('Lucena');
    advance(24 * 60 * 60 * 1000 + 1);
    await geocoder.geocodeAddress('Lucena');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('the cache keeps only the most recent entries', async () => {
    const { geocoder, fetchImpl } = setup();
    for (const q of ['A town', 'B town', 'C town', 'D town']) await geocoder.geocodeAddress(q);
    await geocoder.geocodeAddress('A town');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  test('reverse lookups are cached by coordinates rounded to about a metre', async () => {
    const { geocoder, fetchImpl } = setup({
      respond: () => jsonResponse({ lat: '13.9', lon: '121.6', display_name: 'Lucena City' }),
    });
    await geocoder.reverseGeocode(13.900001, 121.600001);
    await geocoder.reverseGeocode(13.900004, 121.599998);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('failures are not cached, so a later retry can succeed', async () => {
    let fail = true;
    const { geocoder, fetchImpl } = setup({
      respond: () => (fail ? jsonResponse({}, 429) : jsonResponse(SARIAYA)),
    });
    expect(await geocoder.geocodeAddress('Sariaya')).toBeNull();
    fail = false;
    expect(await geocoder.geocodeAddress('Sariaya')).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('every request identifies the app with a User-Agent', async () => {
    const { geocoder, fetchImpl } = setup();
    await geocoder.geocodeAddress('Lucena');
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toMatch(/RideShareEU/);
  });
});

describe('Luzon only', () => {
  const CEBU = { lat: '10.31', lon: '123.89', display_name: 'Cebu City, Central Visayas' };

  test('an address search is limited to the Philippines and prefers Lucena and its neighbouring towns', async () => {
    const { geocoder, calls } = setup();
    await geocoder.geocodeAddress('SM City Lucena');
    const url = new URL(calls[0].url);
    expect(url.searchParams.get('countrycodes')).toBe('ph');
    expect(url.searchParams.get('viewbox')).toBe('121.3,14.15,121.9,13.75');
    expect(url.searchParams.get('bounded')).toBeNull(); // a preference, not a fence: Manila still works
    expect(url.searchParams.get('limit')).toBe('5'); // room to skip matches outside Luzon
  });

  test('a result outside the Philippines is treated as no result', async () => {
    const { geocoder } = setup({ respond: () => jsonResponse([{ lat: '37.41', lon: '-4.48', display_name: 'Lucena, Córdoba, Spain' }]) });
    expect(await geocoder.geocodeAddress('Lucena')).toBeNull();
  });

  test('a result elsewhere in the Philippines but outside Luzon is treated as no result', async () => {
    const { geocoder } = setup({ respond: () => jsonResponse([CEBU]) });
    expect(await geocoder.geocodeAddress('SM City')).toBeNull();
  });

  test('the first match inside Luzon wins over earlier matches outside it', async () => {
    const { geocoder } = setup({ respond: () => jsonResponse([CEBU, ...SARIAYA]) });
    expect(await geocoder.geocodeAddress('Plaza')).toEqual({ lat: 13.96, lng: 121.52, displayName: 'Sariaya, Quezon' });
  });

  test('a pin outside Luzon is not looked up', async () => {
    const { geocoder, fetchImpl } = setup();
    expect(await geocoder.reverseGeocode(35.68, 139.69)).toBeNull(); // Tokyo
    expect(await geocoder.reverseGeocode(10.31, 123.89)).toBeNull(); // Cebu
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a pin in Luzon is still looked up', async () => {
    const { geocoder, fetchImpl } = setup({ respond: () => jsonResponse({ lat: '13.93', lon: '121.62', display_name: 'Lucena City' }) });
    expect(await geocoder.reverseGeocode(13.93, 121.62)).toEqual({ lat: 13.93, lng: 121.62, displayName: 'Lucena City' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
