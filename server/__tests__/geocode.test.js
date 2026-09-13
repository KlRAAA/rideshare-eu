require('dotenv').config({ quiet: true });
const app = require('../app');
const { bearer } = require('../test-helpers/auth');

// GET /api/geocode dispatches on which query params are present: ?q= (forward,
// pre-existing) or ?lat=&lng= (reverse, new — for "Use my current location").
// These assertions only exercise validation/dispatch, which never reaches
// Nominatim — this codebase has no test that calls the real geocoding service
// (not even for the pre-existing forward path) and no jest.mock precedent
// anywhere in it, so introducing a real-network or newly-mocked test here
// would be a new pattern, not a consistent one. Nominatim's own usage policy
// also warns against automated/bulk lookups, which a CI-run test suite would
// effectively be. The actual reverse-geocode round trip was verified live in
// the browser instead.

let server;
let base;

beforeAll(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

describe('GET /api/geocode', () => {
  test('no token → 401', async () => {
    const res = await fetch(`${base}/api/geocode?q=Lucena`);
    expect(res.status).toBe(401);
  });

  test('neither q nor lat/lng → 400 MISSING_QUERY', async () => {
    const res = await fetch(`${base}/api/geocode`, { headers: bearer('u1') });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('MISSING_QUERY');
  });

  test.each([
    ['lat out of range', { lat: '999', lng: '121.6' }],
    ['lng out of range', { lat: '13.9', lng: '-999' }],
    ['non-numeric lat', { lat: 'not-a-number', lng: '121.6' }],
  ])('reverse lookup with %s → 400 INVALID_COORDINATES, never reaches the geocoder', async (_label, params) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${base}/api/geocode?${qs}`, { headers: bearer('u1') });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_COORDINATES');
  });

  test('lat/lng present takes the reverse path even if q is also present', async () => {
    // Confirms dispatch precedence (lat/lng wins) without needing a real
    // geocode result — an invalid lat/lng still short-circuits to the
    // reverse branch's own validation, not silently falling through to q.
    const res = await fetch(`${base}/api/geocode?q=Lucena&lat=999&lng=121.6`, { headers: bearer('u1') });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_COORDINATES');
  });
});
