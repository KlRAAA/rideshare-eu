const {
  computeRouteOverlap,
  computeRouteOverlapDetail,
  computeScheduleAlignment,
  checkPreferenceMatch,
  runPSGA,
  runShowAllFallback,
  phDateOnly,
  parseSearchDate,
  tripRunsOnSearchDate,
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

describe('parseSearchDate', () => {
  test('parses a valid "YYYY-MM-DD" string', () => {
    expect(parseSearchDate('2026-09-20').toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  test('rejects malformed or missing input', () => {
    expect(parseSearchDate('2026-9-20')).toBeNull(); // not zero-padded
    expect(parseSearchDate('not-a-date')).toBeNull();
    expect(parseSearchDate(undefined)).toBeNull();
    expect(parseSearchDate(null)).toBeNull();
  });
});

describe('phDateOnly', () => {
  test('a departure well within the PH day stays on the same UTC calendar day', () => {
    const instant = new Date('2026-09-20T10:00:00Z'); // 18:00 PH, same day
    expect(phDateOnly(instant).toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  // The case this whole fix exists for: the thesis's own stated peak commute
  // time, 7:00 AM PH, is stored as 23:00 UTC the PREVIOUS calendar day. A
  // naive UTC-calendar-day comparison would attribute this trip to Sep 19,
  // not the Sep 20 a host or passenger both mean by "7am on the 20th".
  test('a 7:00 AM PH departure (23:00 UTC the previous day) is attributed to the PH day, not the UTC day', () => {
    const instant = new Date('2026-09-19T23:00:00Z'); // 07:00 PH on Sep 20
    expect(phDateOnly(instant).toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  test('a departure exactly at PH midnight (16:00 UTC the previous day) rolls to the new PH day', () => {
    const instant = new Date('2026-09-19T16:00:00Z'); // exactly 00:00 PH on Sep 20
    expect(phDateOnly(instant).toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  test('one minute before PH midnight is still the earlier PH day', () => {
    const instant = new Date('2026-09-19T15:59:00Z'); // 23:59 PH on Sep 19
    expect(phDateOnly(instant).toISOString()).toBe('2026-09-19T00:00:00.000Z');
  });
});

describe('tripRunsOnSearchDate', () => {
  // Departs 2026-09-20T23:00Z = 7:00 AM PH on 2026-09-21 (a Monday). Deliberately
  // straddling the UTC/PH day boundary — the regression case for this fix.
  const oneTimeTrip = { recurrenceType: 'ONE_TIME', customDays: [], departureTime: new Date('2026-09-20T23:00:00Z') };

  test('ONE_TIME matches only its own PH-local date — today, nothing checked this at all', () => {
    expect(tripRunsOnSearchDate(oneTimeTrip, '2026-09-21')).toBe(true);
    expect(tripRunsOnSearchDate(oneTimeTrip, '2026-09-20')).toBe(false); // the raw UTC day — must NOT match
    expect(tripRunsOnSearchDate(oneTimeTrip, '2026-09-22')).toBe(false);
  });

  // Departs 2026-09-01T22:00Z = 6:00 AM PH on 2026-09-02 (a Wednesday).
  const dailyTrip = { recurrenceType: 'DAILY', customDays: [], departureTime: new Date('2026-09-01T22:00:00Z') };

  test('DAILY matches any date on/after the trip\'s own PH-local start date, never before', () => {
    expect(tripRunsOnSearchDate(dailyTrip, '2026-09-02')).toBe(true);
    expect(tripRunsOnSearchDate(dailyTrip, '2026-12-25')).toBe(true); // no recurrence-end concept
    expect(tripRunsOnSearchDate(dailyTrip, '2026-09-01')).toBe(false); // before the PH start date
  });

  const weekdaysTrip = { recurrenceType: 'WEEKDAYS', customDays: [], departureTime: new Date('2026-09-01T22:00:00Z') };

  test('WEEKDAYS matches Mon-Fri, not Sat/Sun', () => {
    expect(tripRunsOnSearchDate(weekdaysTrip, '2026-09-08')).toBe(true); // Tuesday
    expect(tripRunsOnSearchDate(weekdaysTrip, '2026-09-12')).toBe(false); // Saturday
    expect(tripRunsOnSearchDate(weekdaysTrip, '2026-09-13')).toBe(false); // Sunday
  });

  const customTrip = { recurrenceType: 'CUSTOM', customDays: [2, 4], departureTime: new Date('2026-09-01T22:00:00Z') }; // Tue, Thu

  test('CUSTOM matches only its configured days', () => {
    expect(tripRunsOnSearchDate(customTrip, '2026-09-08')).toBe(true); // Tue
    expect(tripRunsOnSearchDate(customTrip, '2026-09-09')).toBe(false); // Wed
    expect(tripRunsOnSearchDate(customTrip, '2026-09-10')).toBe(true); // Thu
  });

  test('rejects a malformed or missing search date rather than matching by default', () => {
    expect(tripRunsOnSearchDate(dailyTrip, 'not-a-date')).toBe(false);
    expect(tripRunsOnSearchDate(dailyTrip, undefined)).toBe(false);
  });
});
