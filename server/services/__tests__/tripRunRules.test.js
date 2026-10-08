const { departureOnDay, startWindow, plannedArrival, startCheck, nextDeparture } = require('../tripRunRules');
const { phDateOnly } = require('../recurrenceMath');

// 2026-06-01T23:00Z is Tuesday 2 June, 7:00 AM in the Philippines.
const FIRST = new Date('2026-06-01T23:00:00Z');
const trip = (over = {}) => ({ status: 'OPEN', recurrenceType: 'ONE_TIME', customDays: [], departureTime: FIRST, durationSeconds: 1800, ...over });
const at = (iso) => new Date(iso);
const none = new Set();

describe('departureOnDay', () => {
  test('a one-time trip departs only on its own Philippine day', () => {
    expect(departureOnDay(trip(), phDateOnly(FIRST))).toEqual(FIRST);
    expect(departureOnDay(trip(), phDateOnly(at('2026-06-03T00:00:00Z')))).toBeNull();
  });
  test('a weekday trip departs at the same time on later weekdays, not on Saturday', () => {
    const t = trip({ recurrenceType: 'WEEKDAYS' });
    expect(departureOnDay(t, phDateOnly(at('2026-06-04T00:00:00Z')))).toEqual(at('2026-06-03T23:00:00Z')); // Thu 7 AM PH
    expect(departureOnDay(t, phDateOnly(at('2026-06-06T00:00:00Z')))).toBeNull(); // Saturday
  });
});

describe('startCheck', () => {
  test('opens 30 minutes before departure and closes 60 minutes after', () => {
    expect(startCheck(trip(), at('2026-06-01T22:29:59Z'), none)).toMatchObject({ error: 'TOO_EARLY_TO_START', opensAt: at('2026-06-01T22:30:00Z') });
    expect(startCheck(trip(), at('2026-06-01T22:30:00Z'), none)).toEqual({ departure: FIRST, runDate: phDateOnly(FIRST) });
    expect(startCheck(trip(), at('2026-06-02T00:00:00Z'), none)).toEqual({ departure: FIRST, runDate: phDateOnly(FIRST) });
    expect(startCheck(trip(), at('2026-06-02T00:00:01Z'), none)).toEqual({ error: 'TOO_LATE_TO_START' });
  });
  test('refuses a day the trip does not run, a second start, and a trip that is not active', () => {
    expect(startCheck(trip(), at('2026-06-05T23:00:00Z'), none)).toEqual({ error: 'NOT_A_TRIP_DAY' });
    expect(startCheck(trip(), at('2026-06-01T23:00:00Z'), new Set([phDateOnly(FIRST).getTime()]))).toEqual({ error: 'ALREADY_STARTED' });
    expect(startCheck(trip({ status: 'CANCELLED' }), at('2026-06-01T23:00:00Z'), none)).toEqual({ error: 'TRIP_NOT_ACTIVE' });
  });
  test('a trip leaving at 11:50 PM can still be started at 12:30 AM, for the day it left', () => {
    const late = trip({ recurrenceType: 'DAILY', departureTime: at('2026-06-01T15:50:00Z') }); // 11:50 PM PH, 1 June
    expect(startCheck(late, at('2026-06-01T16:30:00Z'), none)).toEqual({
      departure: at('2026-06-01T15:50:00Z'),
      runDate: phDateOnly(at('2026-06-01T15:50:00Z')),
    });
  });
});

describe('plannedArrival and nextDeparture', () => {
  test('arrival is departure plus the route time, or departure when unknown', () => {
    expect(plannedArrival(trip(), FIRST)).toEqual(at('2026-06-01T23:30:00Z'));
    expect(plannedArrival(trip({ durationSeconds: null }), FIRST)).toEqual(FIRST);
  });
  test('the next departure whose start window has not closed', () => {
    const t = trip({ recurrenceType: 'DAILY' });
    expect(nextDeparture(t, at('2026-06-02T05:00:00Z'))).toEqual({
      departure: at('2026-06-02T23:00:00Z'),
      opensAt: at('2026-06-02T22:30:00Z'),
      closesAt: at('2026-06-03T00:00:00Z'),
    });
    expect(nextDeparture(trip(), at('2026-06-02T00:00:01Z'))).toBeNull();
  });
  test('startWindow is −30 min / +60 min', () => {
    expect(startWindow(FIRST)).toEqual({ opensAt: at('2026-06-01T22:30:00Z'), closesAt: at('2026-06-02T00:00:00Z') });
  });
});
