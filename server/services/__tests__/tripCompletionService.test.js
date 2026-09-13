const {
  estimatedCompletionAt,
  isOverdue,
  GRACE_BUFFER_MINUTES,
  utcDateOnly,
  runsOnDate,
  occurrenceCompletionAt,
  isRecurringOccurrenceDue,
} = require('../tripCompletionService');

describe('estimatedCompletionAt', () => {
  test('returns null when durationSeconds is missing (routing failed at creation)', () => {
    const trip = { departureTime: new Date('2026-01-01T07:00:00Z'), durationSeconds: null };
    expect(estimatedCompletionAt(trip)).toBeNull();
  });

  test('adds duration plus the grace buffer to departure time', () => {
    const trip = { departureTime: new Date('2026-01-01T07:00:00Z'), durationSeconds: 1800 }; // 30 min drive
    const expected = new Date('2026-01-01T07:00:00Z').getTime() + 1800 * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000;
    expect(estimatedCompletionAt(trip).getTime()).toBe(expected);
  });
});

describe('isOverdue', () => {
  test('false when durationSeconds is missing', () => {
    const trip = { departureTime: new Date(), durationSeconds: null };
    expect(isOverdue(trip)).toBe(false);
  });

  test('false when estimated completion is still in the future', () => {
    const trip = { departureTime: new Date(Date.now() + 60 * 60 * 1000), durationSeconds: 1800 }; // departs in 1hr
    expect(isOverdue(trip)).toBe(false);
  });

  test('true when estimated completion (departure + duration + grace) is in the past', () => {
    const trip = { departureTime: new Date(Date.now() - 3 * 60 * 60 * 1000), durationSeconds: 1800 }; // departed 3hrs ago, 30min drive
    expect(isOverdue(trip)).toBe(true);
  });

  test('false right at the boundary minus a second (grace buffer not yet elapsed)', () => {
    const departureTime = new Date(Date.now() - (GRACE_BUFFER_MINUTES * 60 * 1000 + 1800 * 1000 - 5000));
    const trip = { departureTime, durationSeconds: 1800 };
    expect(isOverdue(trip)).toBe(false);
  });
});

describe('runsOnDate', () => {
  const departureTime = new Date('2026-06-01T06:00:00Z'); // a Monday

  test('ONE_TIME only runs on its own departure date', () => {
    const trip = { recurrenceType: 'ONE_TIME', departureTime, customDays: [] };
    // 2026-06-01T23:00:00Z is PH-local 2026-06-02T07:00 — the NEXT PH day, not
    // the start day — so this must be false. Under the old UTC-anchored bug
    // this instant's raw UTC calendar day (June 1) matched the start day and
    // wrongly returned true.
    expect(runsOnDate(trip, new Date('2026-06-01T23:00:00Z'))).toBe(false);
    expect(runsOnDate(trip, new Date('2026-06-02T00:00:00Z'))).toBe(false);
  });

  test('a target instant exactly at PH midnight (UTC 16:00 the previous day) is attributed to the NEW, later PH day', () => {
    const trip = { recurrenceType: 'WEEKDAYS', departureTime, customDays: [] };
    // UTC 2026-06-07T16:00:00Z = exactly PH 2026-06-08T00:00:00 (Monday PH).
    // The raw UTC calendar day is still June 7 (a Sunday) — under the old bug
    // this would have wrongly excluded a real Monday occurrence.
    expect(runsOnDate(trip, new Date('2026-06-07T16:00:00Z'))).toBe(true);
  });

  test('a target instant at PH 7:59 AM (UTC 23:59 the previous day) is still attributed to the later PH day', () => {
    const trip = { recurrenceType: 'WEEKDAYS', departureTime, customDays: [] };
    // UTC 2026-06-05T23:59:00Z = PH 2026-06-06T07:59 — a Saturday in PH terms,
    // even though the raw UTC calendar day is still June 5 (a Friday). Under
    // the old bug this would have wrongly included a Saturday as a weekday.
    expect(runsOnDate(trip, new Date('2026-06-05T23:59:00Z'))).toBe(false);
  });

  test('DAILY runs every day from the start date onward, never before it', () => {
    const trip = { recurrenceType: 'DAILY', departureTime, customDays: [] };
    expect(runsOnDate(trip, new Date('2026-05-31T06:00:00Z'))).toBe(false); // before start
    expect(runsOnDate(trip, new Date('2026-06-01T06:00:00Z'))).toBe(true); // start day
    expect(runsOnDate(trip, new Date('2026-12-25T06:00:00Z'))).toBe(true); // no recurrence-end concept
  });

  test('WEEKDAYS runs Mon-Fri only', () => {
    const trip = { recurrenceType: 'WEEKDAYS', departureTime, customDays: [] };
    expect(runsOnDate(trip, new Date('2026-06-02T00:00:00Z'))).toBe(true); // Tuesday
    expect(runsOnDate(trip, new Date('2026-06-06T00:00:00Z'))).toBe(false); // Saturday
    expect(runsOnDate(trip, new Date('2026-06-07T00:00:00Z'))).toBe(false); // Sunday
  });

  test('CUSTOM runs only on the configured days (0=Sun..6=Sat)', () => {
    const trip = { recurrenceType: 'CUSTOM', departureTime, customDays: [2, 4] }; // Tue, Thu
    expect(runsOnDate(trip, new Date('2026-06-02T00:00:00Z'))).toBe(true); // Tue
    expect(runsOnDate(trip, new Date('2026-06-03T00:00:00Z'))).toBe(false); // Wed
    expect(runsOnDate(trip, new Date('2026-06-04T00:00:00Z'))).toBe(true); // Thu
  });
});

describe('occurrenceCompletionAt', () => {
  test('null when durationSeconds is missing', () => {
    const trip = { departureTime: new Date('2026-06-01T06:00:00Z'), durationSeconds: null };
    expect(occurrenceCompletionAt(trip, new Date('2026-06-10T00:00:00Z'))).toBeNull();
  });

  test('re-anchors departureTime\'s time-of-day onto the given day, then adds duration + grace', () => {
    const trip = { departureTime: new Date('2026-01-01T06:00:00Z'), durationSeconds: 1800 }; // 06:00 UTC, 30min drive
    const completion = occurrenceCompletionAt(trip, new Date('2026-06-10T12:00:00Z'));
    // 2026-06-10 06:00 UTC + 30min drive + 30min grace = 2026-06-10 07:00 UTC
    expect(completion.toISOString()).toBe(new Date('2026-06-10T07:00:00Z').toISOString());
  });
});

describe('isRecurringOccurrenceDue', () => {
  const departureTime = new Date('2026-01-01T06:00:00Z');

  test('false for ONE_TIME (that path is isOverdue/completeTrip, not this)', () => {
    const trip = { recurrenceType: 'ONE_TIME', departureTime, durationSeconds: 1800, customDays: [] };
    expect(isRecurringOccurrenceDue(trip, new Date('2026-06-10T08:00:00Z'))).toBe(false);
  });

  test('false when the trip does not run on this date (WEEKDAYS, a Sunday in PH-local terms)', () => {
    const trip = { recurrenceType: 'WEEKDAYS', departureTime, durationSeconds: 1800, customDays: [] };
    // 2026-06-06T23:00:00Z is PH-local 2026-06-07T07:00 — a Sunday, not the
    // Saturday its raw UTC calendar day would suggest — but still excluded
    // from WEEKDAYS either way, so the expected value is unchanged.
    expect(isRecurringOccurrenceDue(trip, new Date('2026-06-06T23:00:00Z'))).toBe(false);
  });

  test('the PH-boundary fix propagates end-to-end: a WEEKDAYS occurrence due right at PH midnight is correctly detected', () => {
    const trip = { recurrenceType: 'WEEKDAYS', departureTime, durationSeconds: 1800, customDays: [] };
    // now = 2026-06-07T16:00:00Z = PH 2026-06-08T00:00 (Monday). Completion
    // time (re-anchored onto UTC day June 7: 06:00+1800s+1800s=07:00 UTC) has
    // already passed by 16:00 UTC the same day. Under the old bug, runsOnDate
    // would have used UTC day June 7 (Sunday) and excluded this WEEKDAYS trip
    // entirely, never detecting the occurrence as due.
    expect(isRecurringOccurrenceDue(trip, new Date('2026-06-07T16:00:00Z'))).toBe(true);
  });

  test('false when it runs today but has not completed yet', () => {
    const trip = { recurrenceType: 'DAILY', departureTime, durationSeconds: 1800, customDays: [] };
    expect(isRecurringOccurrenceDue(trip, new Date('2026-06-10T06:30:00Z'))).toBe(false); // before 07:00 completion
  });

  test('true once today\'s occurrence has completed', () => {
    const trip = { recurrenceType: 'DAILY', departureTime, durationSeconds: 1800, customDays: [] };
    expect(isRecurringOccurrenceDue(trip, new Date('2026-06-10T07:00:01Z'))).toBe(true);
  });
});

describe('utcDateOnly', () => {
  test('truncates to the UTC calendar date at midnight', () => {
    expect(utcDateOnly(new Date('2026-06-10T23:59:59Z')).toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });
});
