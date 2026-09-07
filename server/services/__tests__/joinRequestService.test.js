const { checkJoinEligibility } = require('../joinRequestService');

const openTrip = { id: 't1', hostId: 'host1', status: 'OPEN', filledSeats: 1, totalSeats: 3 };

describe('checkJoinEligibility', () => {
  test('allows a fresh request on an open trip with seats left', () => {
    expect(checkJoinEligibility({ trip: openTrip, passengerId: 'p1', existingMatches: [] })).toEqual({ ok: true });
  });

  test('rejects when the trip does not exist', () => {
    expect(checkJoinEligibility({ trip: null, passengerId: 'p1' })).toEqual({
      ok: false,
      error: 'TRIP_NOT_FOUND',
      status: 404,
    });
  });

  test('rejects the host joining their own trip', () => {
    expect(checkJoinEligibility({ trip: openTrip, passengerId: 'host1', existingMatches: [] })).toEqual({
      ok: false,
      error: 'CANNOT_JOIN_OWN_TRIP',
      status: 400,
    });
  });

  test('rejects a passenger who already has a pending request on this trip', () => {
    const existingMatches = [{ passengerId: 'p1', status: 'PENDING' }];
    expect(checkJoinEligibility({ trip: openTrip, passengerId: 'p1', existingMatches })).toEqual({
      ok: false,
      error: 'ALREADY_REQUESTED',
      status: 409,
    });
  });

  test('rejects a passenger who is already an approved co-rider', () => {
    const existingMatches = [{ passengerId: 'p1', status: 'APPROVED' }];
    expect(checkJoinEligibility({ trip: openTrip, passengerId: 'p1', existingMatches })).toEqual({
      ok: false,
      error: 'ALREADY_REQUESTED',
      status: 409,
    });
  });

  test('allows a re-request after a previous request was declined', () => {
    const existingMatches = [{ passengerId: 'p1', status: 'DECLINED' }];
    expect(checkJoinEligibility({ trip: openTrip, passengerId: 'p1', existingMatches })).toEqual({ ok: true });
  });

  test('rejects when every seat is filled', () => {
    const fullBySeats = { ...openTrip, filledSeats: 3, totalSeats: 3 };
    expect(checkJoinEligibility({ trip: fullBySeats, passengerId: 'p1', existingMatches: [] })).toEqual({
      ok: false,
      error: 'TRIP_FULL',
      status: 409,
    });
  });

  test('rejects when the trip status is FULL even if a seat count looks open', () => {
    const fullByStatus = { ...openTrip, status: 'FULL', filledSeats: 2, totalSeats: 3 };
    expect(checkJoinEligibility({ trip: fullByStatus, passengerId: 'p1', existingMatches: [] })).toEqual({
      ok: false,
      error: 'TRIP_FULL',
      status: 409,
    });
  });

  test('rejects a cancelled or completed trip', () => {
    for (const status of ['CANCELLED', 'COMPLETED']) {
      expect(checkJoinEligibility({ trip: { ...openTrip, status }, passengerId: 'p1', existingMatches: [] })).toEqual({
        ok: false,
        error: 'TRIP_NOT_OPEN',
        status: 409,
      });
    }
  });
});
