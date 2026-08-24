const { estimatedCompletionAt, isOverdue, GRACE_BUFFER_MINUTES } = require('../tripCompletionService');

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
