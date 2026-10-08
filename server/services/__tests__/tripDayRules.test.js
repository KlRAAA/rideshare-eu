const { askAt, dueSteps, upcomingDays } = require('../tripDayRules');
const { phDateOnly } = require('../recurrenceMath');

const at = (iso) => new Date(iso);
// 2026-06-02T23:00Z = Wednesday 3 June, 7:00 AM Philippine time.
const DEP = at('2026-06-02T23:00:00Z');

test('the driver is asked at 8 PM Philippine time the evening before', () => {
  expect(askAt(phDateOnly(DEP))).toEqual(at('2026-06-02T12:00:00Z')); // Tue 8 PM PH
});

test('each step starts exactly on its minute', () => {
  expect(dueSteps(DEP, at('2026-06-02T21:59:59Z')).unconfirmedWarning).toBe(false);
  expect(dueSteps(DEP, at('2026-06-02T22:00:00Z')).unconfirmedWarning).toBe(true);
  expect(dueSteps(DEP, at('2026-06-02T23:00:00Z')).unconfirmedWarning).toBe(false); // departed
  expect(dueSteps(DEP, at('2026-06-02T23:14:59Z')).lateWarning).toBe(false);
  expect(dueSteps(DEP, at('2026-06-02T23:15:00Z')).lateWarning).toBe(true);
  expect(dueSteps(DEP, at('2026-06-02T23:59:59Z')).noShow).toBe(false);
  expect(dueSteps(DEP, at('2026-06-03T00:00:00Z'))).toEqual({ unconfirmedWarning: false, lateWarning: false, noShow: true });
});

test('upcoming run days of a weekday trip skip the weekend', () => {
  const trip = { recurrenceType: 'WEEKDAYS', customDays: [], departureTime: at('2026-06-01T23:00:00Z') }; // from Tue 2 June
  const days = upcomingDays(trip, at('2026-06-04T05:00:00Z'), 3); // Thu afternoon PH
  expect(days.map((d) => d.departure.toISOString())).toEqual([
    '2026-06-04T23:00:00.000Z', // Fri
    '2026-06-07T23:00:00.000Z', // Mon
    '2026-06-08T23:00:00.000Z', // Tue
  ]);
  expect(days[0].day).toEqual(phDateOnly(at('2026-06-04T23:00:00Z')));
});
