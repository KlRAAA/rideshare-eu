const { timeSpan, sharesADay, overlaps, findConflict } = require('../scheduleRules');

// 2026-06-01T23:00Z = Tuesday 2 June, 7:00 AM Philippine time.
const trip = (over = {}) => ({
  id: 't', recurrenceType: 'ONE_TIME', customDays: [], durationSeconds: 1800,
  departureTime: new Date('2026-06-01T23:00:00Z'), ...over,
});

describe('timeSpan', () => {
  test('departure time of day in Philippine time, plus the route time', () => {
    expect(timeSpan(trip())).toEqual({ start: 420, end: 450 });
  });
  test('an unknown route time counts as 60 minutes', () => {
    expect(timeSpan(trip({ durationSeconds: null }))).toEqual({ start: 420, end: 480 });
  });
});

describe('sharesADay', () => {
  test('one-time trips on different dates never clash', () => {
    expect(sharesADay(trip(), trip({ departureTime: new Date('2026-06-02T23:00:00Z') }))).toBe(false);
  });
  test('a one-time trip and a weekday trip clash on a weekday, not on a Saturday', () => {
    const weekdays = trip({ recurrenceType: 'WEEKDAYS', departureTime: new Date('2026-05-31T23:00:00Z') });
    expect(sharesADay(trip(), weekdays)).toBe(true); // Tuesday
    expect(sharesADay(trip({ departureTime: new Date('2026-06-05T23:00:00Z') }), weekdays)).toBe(false); // Saturday
  });
  test('recurring trips clash when they share a weekday', () => {
    const daily = trip({ recurrenceType: 'DAILY' });
    expect(sharesADay(daily, trip({ recurrenceType: 'CUSTOM', customDays: [6] }))).toBe(true);
    expect(sharesADay(trip({ recurrenceType: 'WEEKDAYS' }), trip({ recurrenceType: 'CUSTOM', customDays: [0, 6] }))).toBe(false);
  });
});

describe('overlaps and findConflict', () => {
  test('back-to-back trips do not overlap; a 15-minute overlap does', () => {
    const at730 = trip({ id: 'b', departureTime: new Date('2026-06-01T23:30:00Z') });
    const at715 = trip({ id: 'c', departureTime: new Date('2026-06-01T23:15:00Z') });
    expect(overlaps(trip(), at730)).toBe(false);
    expect(overlaps(trip(), at715)).toBe(true);
    expect(findConflict(trip(), [at730, at715])).toBe(at715);
    expect(findConflict(trip(), [at730])).toBeNull();
  });
  test('a span past midnight overlaps an early-morning trip the next day only if it is the same run day', () => {
    const late = trip({ recurrenceType: 'DAILY', departureTime: new Date('2026-06-01T15:30:00Z'), durationSeconds: 3600 }); // 11:30 PM–12:30 AM
    const early = trip({ recurrenceType: 'DAILY', departureTime: new Date('2026-06-01T16:15:00Z') }); // 12:15 AM
    expect(overlaps(late, early)).toBe(true);
  });
});
