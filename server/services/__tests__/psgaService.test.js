const {
  computeRouteOverlap,
  computeRouteOverlapDetail,
  computeScheduleAlignment,
  checkPreferenceMatch,
  runPSGA,
  runShowAllFallback,
} = require('../psgaService');

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

describe('computeRouteOverlapDetail', () => {
  const onRoute = { origin: { lat: 13.9333, lng: 121.6167 }, destination: { lat: 13.9357, lng: 121.622 } };
  const offRoute = { origin: { lat: 14.5, lng: 121.0 }, destination: { lat: 14.6, lng: 121.1 } };
  const host = { waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.622 }] };

  test('fraction matches the scalar computeRouteOverlap for the same inputs', () => {
    for (const p of [onRoute, offRoute]) {
      expect(computeRouteOverlapDetail(p, host, 500).fraction).toBe(computeRouteOverlap(p, host, 500));
    }
  });

  test('returns one sample per interpolation step (default 20 → 21 points)', () => {
    const d = computeRouteOverlapDetail(onRoute, host, 500);
    expect(d.samples).toHaveLength(21);
    expect(d.samples[0]).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number), inside: expect.any(Boolean) });
  });

  test('every sample is inside when the passenger route lies on the host route', () => {
    const d = computeRouteOverlapDetail(onRoute, host, 500);
    expect(d.samples.every((s) => s.inside)).toBe(true);
  });

  test('no sample is inside when the passenger route is far from the corridor', () => {
    const d = computeRouteOverlapDetail(offRoute, host, 500);
    expect(d.samples.some((s) => s.inside)).toBe(false);
  });

  test('echoes the corridor width it was given', () => {
    expect(computeRouteOverlapDetail(onRoute, host, 1500).corridorMeters).toBe(1500);
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

  // Regression: an empty search-form time serialized departureMinutes as null,
  // which `Math.abs(null - n)` silently coerced to a real number and matched
  // every trip against 00:00. A non-numeric departureMinutes must fail the
  // time gate, never coerce.
  test.each([[null], [undefined], [NaN]])('no match (not a coerced 00:00 match) when departureMinutes is %p', (bad) => {
    const passenger = {
      origin: { lat: 13.9333, lng: 121.6167 },
      destination: { lat: 13.9357, lng: 121.622 },
      departureMinutes: bad,
      flexWindowMinutes: 30,
    };
    const candidates = [
      { id: 'perfect-route', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.622 }], departureMinutes: 0, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 },
    ];
    expect(runPSGA(passenger, candidates, config).status).toBe('NO_MATCH');
  });
});

describe('runShowAllFallback', () => {
  const config = {
    weights: { w1: 0.5, w2: 0.3, w3: 0.2 },
    minRouteOverlap: 0.4,
    corridorMeters: 500,
    destinationAnchorMeters: 3000,
  };

  // Passenger origin is deliberately far from any host corridor, and the
  // requested time is hours off — so every candidate below fails BOTH Stage 1
  // gates and runPSGA would return NO_MATCH.
  const passenger = {
    origin: { lat: 14.5, lng: 121.0 },
    destination: { lat: 13.9357, lng: 121.622 },
    departureMinutes: 420,
    flexWindowMinutes: 15,
  };

  const baseTrip = {
    id: 't1',
    waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.622 }],
    destination: { lat: 13.9357, lng: 121.622 }, // same place the passenger is going
    departureMinutes: 600, // 3h off — fails the time window
    genderPreference: 'ANY',
    familiarRidersOnly: false,
    filledSeats: 0,
    totalSeats: 3,
  };

  test('surfaces a trip that fails both the route-overlap and time-window gates', () => {
    expect(runPSGA(passenger, [baseTrip], config).status).toBe('NO_MATCH'); // sanity
    const result = runShowAllFallback(passenger, [baseTrip], config);
    expect(result.status).toBe('MATCHED');
    expect(result.matches.map((m) => m.tripId)).toContain('t1');
  });

  test('excludes a trip whose destination is outside the anchor radius', () => {
    const farDest = { ...baseTrip, id: 'far', destination: { lat: 14.6, lng: 121.1 } };
    expect(runShowAllFallback(passenger, [farDest], config).status).toBe('NO_MATCH');
  });

  test('excludes a trip missing a destination anchor entirely', () => {
    const noDest = { ...baseTrip, id: 'nodest', destination: undefined };
    expect(runShowAllFallback(passenger, [noDest], config).status).toBe('NO_MATCH');
  });

  // The constraint that must NOT be relaxed by the fallback.
  test('still excludes a trip when the host requires same-gender and the passenger does not match', () => {
    const host = { ...baseTrip, id: 'sg', genderPreference: 'SAME_GENDER', genderMatchesHost: false };
    expect(runShowAllFallback(passenger, [host], config).status).toBe('NO_MATCH');
  });

  test('still excludes a trip when the host requires familiar riders only and the passenger is not familiar', () => {
    const host = { ...baseTrip, id: 'fam', familiarRidersOnly: true, familiarWithHost: false };
    expect(runShowAllFallback(passenger, [host], config).status).toBe('NO_MATCH');
  });

  test('keeps a same-gender-required trip when the passenger does match the host', () => {
    const host = { ...baseTrip, id: 'sg-ok', genderPreference: 'SAME_GENDER', genderMatchesHost: true };
    const result = runShowAllFallback(passenger, [host], config);
    expect(result.status).toBe('MATCHED');
    expect(result.matches[0].tripId).toBe('sg-ok');
  });

  test('excludes a full trip', () => {
    const full = { ...baseTrip, id: 'full', filledSeats: 3, totalSeats: 3 };
    expect(runShowAllFallback(passenger, [full], config).status).toBe('NO_MATCH');
  });

  test('ranks kept trips by descending score', () => {
    const near = { ...baseTrip, id: 'near', waypoints: [passenger.origin, passenger.destination], departureMinutes: 420 };
    const far = { ...baseTrip, id: 'far-time', departureMinutes: 900 };
    const result = runShowAllFallback(passenger, [far, near], config);
    expect(result.status).toBe('MATCHED');
    expect(result.matches[0].tripId).toBe('near');
    expect(result.matches[0].score).toBeGreaterThanOrEqual(result.matches[1].score);
  });
});
