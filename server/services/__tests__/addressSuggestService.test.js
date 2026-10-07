const { createSuggester, placeLabel } = require('../addressSuggestService');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const feature = (properties, lng, lat) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties });

const PUREGOLD_LUCENA = feature(
  { countrycode: 'PH', name: 'Puregold', street: 'Doña Aurora Boulevard', district: 'Ilayang Iyam', city: 'Lucena', county: '2nd District', state: 'Calabarzon' },
  121.6109,
  13.9411
);
const PUREGOLD_SAN_PABLO = feature({ countrycode: 'PH', name: 'Puregold', street: 'Maharlika Highway', city: 'San Pablo', county: 'Laguna', state: 'Calabarzon' }, 121.32, 14.07);
const LUCENA_SPAIN = feature({ countrycode: 'ES', name: 'Lucena', state: 'Andalucía' }, -4.48, 37.41);

function setup(features = [PUREGOLD_LUCENA, PUREGOLD_SAN_PABLO]) {
  const calls = [];
  let clock = 0;
  const fetchImpl = jest.fn(async (url) => {
    calls.push(url);
    return jsonResponse({ type: 'FeatureCollection', features });
  });
  const suggester = createSuggester({ fetchImpl, now: () => clock, ttlMs: 1000, maxEntries: 2 });
  return { suggester, fetchImpl, calls, advance: (ms) => (clock += ms) };
}

describe('address suggestions (Photon)', () => {
  test('asks Photon for Philippine places near Lucena', async () => {
    const { suggester, calls } = setup();
    await suggester.suggest('puregold');
    const url = new URL(calls[0]);
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('q')).toBe('puregold');
    expect(url.searchParams.get('lat')).toBe('13.94');
    expect(url.searchParams.get('lon')).toBe('121.62');
    expect(url.searchParams.get('bbox')).toBe('116,4.5,127,21.5');
  });

  test('returns readable labels with coordinates, nearest first as Photon ranked them', async () => {
    const { suggester } = setup();
    expect(await suggester.suggest('puregold')).toEqual([
      { label: 'Puregold, Doña Aurora Boulevard, Ilayang Iyam, Lucena', primary: 'Puregold', secondary: 'Doña Aurora Boulevard, Ilayang Iyam, Lucena', lat: 13.9411, lng: 121.6109 },
      { label: 'Puregold, Maharlika Highway, San Pablo, Laguna', primary: 'Puregold', secondary: 'Maharlika Highway, San Pablo, Laguna', lat: 14.07, lng: 121.32 },
    ]);
  });

  test('drops places outside the Philippines and repeated labels, and keeps at most 5', async () => {
    const many = Array.from({ length: 7 }, (_, i) => feature({ countrycode: 'PH', name: `Stop ${i}`, city: 'Lucena' }, 121.6, 13.9));
    const { suggester } = setup([LUCENA_SPAIN, PUREGOLD_LUCENA, PUREGOLD_LUCENA, ...many]);
    const result = await suggester.suggest('stop');
    expect(result).toHaveLength(5);
    expect(result.map((s) => s.label)).not.toContain('Lucena, Andalucía');
    expect(result.filter((s) => s.primary === 'Puregold')).toHaveLength(1);
  });

  test('fewer than 3 characters asks nothing', async () => {
    const { suggester, fetchImpl } = setup();
    expect(await suggester.suggest('  p ')).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a repeated query is answered from the cache until it expires', async () => {
    const { suggester, fetchImpl, advance } = setup();
    await suggester.suggest('Puregold');
    await suggester.suggest('  puregold ');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    advance(1001);
    await suggester.suggest('puregold');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('a Photon error or outage means no suggestions, not a crash', async () => {
    const down = createSuggester({ fetchImpl: async () => jsonResponse('busy', 503) });
    expect(await down.suggest('lucena')).toEqual([]);
    const unreachable = createSuggester({ fetchImpl: async () => { throw new Error('ECONNRESET'); } });
    expect(await unreachable.suggest('lucena')).toEqual([]);
  });
});

describe('placeLabel', () => {
  test('a town alone reads as the town and its region, without the legislative district', () => {
    expect(placeLabel({ name: 'Lucena', county: '2nd District', state: 'Calabarzon' })).toEqual({ primary: 'Lucena', secondary: 'Calabarzon' });
  });

  test('a street without a name uses the street as the main line', () => {
    expect(placeLabel({ street: 'Enverga Boulevard', district: 'Ilayang Iyam', city: 'Lucena' })).toEqual({
      primary: 'Enverga Boulevard',
      secondary: 'Ilayang Iyam, Lucena',
    });
  });
});
