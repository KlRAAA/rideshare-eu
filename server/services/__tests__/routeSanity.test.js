const { validateClientRoute } = require('../routeSanity');

// ~1.05 km apart (crow-flies) — Lucena-ish coords
const origin = { lat: 13.9333, lng: 121.6167 };
const destination = { lat: 13.9357, lng: 121.622 };
// a realistic road route: ~1.4 km in ~4 min
const good = { origin, destination, distanceMeters: 1400, durationSeconds: 240 };

describe('validateClientRoute', () => {
  test('accepts a plausible road route', () => {
    expect(validateClientRoute(good)).toEqual({ ok: true });
  });

  test('rejects a missing endpoint', () => {
    expect(validateClientRoute({ ...good, origin: null }).reason).toBe('MISSING_ENDPOINTS');
  });

  test.each([0, -50, NaN, 'abc', undefined])('rejects distanceMeters=%p', (distanceMeters) => {
    expect(validateClientRoute({ ...good, distanceMeters }).reason).toBe('BAD_DISTANCE');
  });

  test.each([0, -1, NaN, undefined])('rejects durationSeconds=%p', (durationSeconds) => {
    expect(validateClientRoute({ ...good, durationSeconds }).reason).toBe('BAD_DURATION');
  });

  test('rejects a road distance shorter than the straight line', () => {
    expect(validateClientRoute({ ...good, distanceMeters: 500 }).reason).toBe('DISTANCE_BELOW_CROW_FLIES');
  });

  test('rejects a road distance many times the straight line', () => {
    expect(validateClientRoute({ ...good, distanceMeters: 40000, durationSeconds: 3000 }).reason).toBe(
      'DISTANCE_IMPLAUSIBLY_LONG'
    );
  });

  test('rejects an implausibly slow implied speed', () => {
    // 1400 m over 2 hours → 0.19 m/s
    expect(validateClientRoute({ ...good, durationSeconds: 7200 }).reason).toBe('IMPLAUSIBLE_SPEED');
  });

  test('rejects an implausibly fast implied speed', () => {
    // 1400 m over 10 s → 140 m/s
    expect(validateClientRoute({ ...good, durationSeconds: 10 }).reason).toBe('IMPLAUSIBLE_SPEED');
  });

  test('skips the crow-flies check when origin equals destination', () => {
    const samePoint = { origin, destination: origin, distanceMeters: 300, durationSeconds: 60 };
    expect(validateClientRoute(samePoint)).toEqual({ ok: true });
  });
});
