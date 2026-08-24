const { computeRouteOverlap, computeScheduleAlignment, checkPreferenceMatch, runPSGA } = require('../psgaService');

describe('computeRouteOverlap', () => {
  test('full overlap when passenger route lies exactly on host route', () => {
    const passenger = { origin: { lat: 13.9333, lng: 121.6167 }, destination: { lat: 13.9357, lng: 121.6220 } };
    const host = { waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }] };
    expect(computeRouteOverlap(passenger, host, 500)).toBeCloseTo(1.0, 1);
  });

  test('zero overlap when passenger route is far from host corridor', () => {
    const passenger = { origin: { lat: 14.5, lng: 121.0 }, destination: { lat: 14.6, lng: 121.1 } };
    const host = { waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }] };
    expect(computeRouteOverlap(passenger, host, 500)).toBeCloseTo(0.0, 1);
  });
});

describe('computeScheduleAlignment', () => {
  test('returns 1.0 when time diff is 0', () => {
    expect(computeScheduleAlignment(0, 15)).toBe(1.0);
  });
  test('returns 0.0 when time diff equals flex window', () => {
    expect(computeScheduleAlignment(15, 15)).toBe(0.0);
  });
  test('returns 0.5 at half the flex window', () => {
    expect(computeScheduleAlignment(7.5, 15)).toBe(0.5);
  });
});

describe('checkPreferenceMatch', () => {
  // genderMatchesHost/familiarWithHost live on `trip` (the per-candidate
  // view the caller builds), not on `passenger` — a single search spans
  // many hosts, so these are per-candidate facts, not one flat value.
  const trip = { genderPreference: 'ANY', familiarRidersOnly: false, filledSeats: 1, totalSeats: 3 };
  test('passes when no hard constraints conflict and seats available', () => {
    expect(checkPreferenceMatch({}, { ...trip, familiarWithHost: false })).toBe(true);
  });
  test('fails when seats are full', () => {
    expect(checkPreferenceMatch({}, { ...trip, filledSeats: 3 })).toBe(false);
  });
  test('fails when host requires same-gender and passenger does not match', () => {
    expect(checkPreferenceMatch({}, { ...trip, genderPreference: 'SAME_GENDER', genderMatchesHost: false })).toBe(false);
  });
  test('passes when host requires same-gender and passenger does match', () => {
    expect(checkPreferenceMatch({}, { ...trip, genderPreference: 'SAME_GENDER', genderMatchesHost: true })).toBe(true);
  });
  test('fails when host requires familiar riders only and passenger is not familiar', () => {
    expect(checkPreferenceMatch({}, { ...trip, familiarRidersOnly: true, familiarWithHost: false })).toBe(false);
  });
});

describe('runPSGA', () => {
  const config = { weights: { w1: 0.5, w2: 0.3, w3: 0.2 }, minRouteOverlap: 0.4, corridorMeters: 500 };

  test('returns NO_MATCH when no candidate passes Stage 1', () => {
    const passenger = { origin: { lat: 14.5, lng: 121.0 }, destination: { lat: 14.6, lng: 121.1 }, departureMinutes: 420, flexWindowMinutes: 15 };
    const candidates = [{ id: 't1', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 420, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 }];
    expect(runPSGA(passenger, candidates, config).status).toBe('NO_MATCH');
  });

  test('ranks candidates descending by score', () => {
    const passenger = { origin: { lat: 13.9333, lng: 121.6167 }, destination: { lat: 13.9357, lng: 121.6220 }, departureMinutes: 420, flexWindowMinutes: 15 };
    const candidates = [
      { id: 'close-time', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 420, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 },
      { id: 'far-time', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 435, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 },
    ];
    const result = runPSGA(passenger, candidates, config);
    expect(result.status).toBe('MATCHED');
    expect(result.matches[0].tripId).toBe('close-time');
    expect(result.matches[0].score).toBeGreaterThan(result.matches[1].score);
  });
});
