const { overlaps, TRIP_BUFFER_MIN } = require('../services/scheduleRules');

// Pure overlap rule: same Philippine day, and less than TRIP_BUFFER_MIN between
// one trip's end and the other's start. Departures are given in PH time.
const ph = (date, hh, mm = 0) => new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`);
const trip = (id, departureTime, minutes = 20, over = {}) => ({
  id,
  departureTime,
  durationSeconds: minutes * 60,
  recurrenceType: 'ONE_TIME',
  customDays: [],
  ...over,
});

// 2026-10-26 is a Monday.
const MON = '2026-10-26';
const TUE = '2026-10-27';

describe('overlap rule with a 10-minute buffer', () => {
  test('the buffer is 10 minutes', () => {
    expect(TRIP_BUFFER_MIN).toBe(10);
  });

  test('a 20-minute trip at 7:00 keeps 6:50–7:30 free', () => {
    const a = trip('a', ph(MON, 7));
    expect(overlaps(a, trip('b', ph(MON, 7, 10)))).toBe(true); // inside
    expect(overlaps(a, trip('b', ph(MON, 7, 25)))).toBe(true); // 5 min after it ends
    expect(overlaps(a, trip('b', ph(MON, 7, 30)))).toBe(false); // exactly 10 min after
    expect(overlaps(a, trip('b', ph(MON, 6, 35), 20))).toBe(true); // ends 6:55, 5 min before
    expect(overlaps(a, trip('b', ph(MON, 6, 30), 20))).toBe(false); // ends 6:50, exactly 10 min before
  });

  test('the same time on another day is fine', () => {
    expect(overlaps(trip('a', ph(MON, 7)), trip('b', ph(TUE, 7)))).toBe(false);
  });

  test('an unknown route time counts as an hour', () => {
    const a = trip('a', ph(MON, 7), undefined, { durationSeconds: null });
    expect(overlaps(a, trip('b', ph(MON, 8, 5)))).toBe(true);
    expect(overlaps(a, trip('b', ph(MON, 8, 10)))).toBe(false);
  });

  test('a weekday trip clashes with a one-time trip on a weekday, not on Sunday', () => {
    const weekdays = trip('a', ph(MON, 7), 20, { recurrenceType: 'WEEKDAYS' });
    expect(overlaps(weekdays, trip('b', ph('2026-10-28', 7, 15)))).toBe(true); // Wednesday
    expect(overlaps(weekdays, trip('b', ph('2026-11-01', 7, 15)))).toBe(false); // Sunday
  });

  test('two repeating trips clash only when they share a weekday', () => {
    const monWed = trip('a', ph(MON, 7), 20, { recurrenceType: 'CUSTOM', customDays: [1, 3] });
    expect(overlaps(monWed, trip('b', ph(TUE, 7), 20, { recurrenceType: 'CUSTOM', customDays: [2, 4] }))).toBe(false);
    expect(overlaps(monWed, trip('b', ph(TUE, 7), 20, { recurrenceType: 'CUSTOM', customDays: [3] }))).toBe(true);
  });

  test('spans past midnight are compared on one clock', () => {
    const late = trip('a', ph(MON, 23, 50), 30); // until 00:20
    expect(overlaps(late, trip('b', ph(MON, 0, 25), 20, { recurrenceType: 'DAILY' }))).toBe(true);
  });
});
