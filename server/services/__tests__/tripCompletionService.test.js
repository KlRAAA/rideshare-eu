const { utcDateOnly } = require('../tripCompletionService');

describe('utcDateOnly', () => {
  test('truncates to the UTC calendar date at midnight', () => {
    expect(utcDateOnly(new Date('2026-06-10T23:59:59Z')).toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });
});
