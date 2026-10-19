import { describe, test, expect } from '@jest/globals';
import { newestFirst, withinSpan } from '../tripSpans';

const NOW = new Date('2026-10-19T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe('tripSpans', () => {
  test('a trip 3 days ago is in the last 7 days; 10 days ago only in the last 30', () => {
    expect(withinSpan(daysAgo(3), '7d', NOW)).toBe(true);
    expect(withinSpan(daysAgo(10), '7d', NOW)).toBe(false);
    expect(withinSpan(daysAgo(10), '30d', NOW)).toBe(true);
    expect(withinSpan(daysAgo(45), '30d', NOW)).toBe(false);
    expect(withinSpan(daysAgo(400), 'all', NOW)).toBe(true);
  });

  test('newest first', () => {
    const trips = [{ id: 'a', lastActiveAt: daysAgo(9) }, { id: 'b', lastActiveAt: daysAgo(1) }, { id: 'c', lastActiveAt: daysAgo(4) }];
    expect(newestFirst(trips).map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });
});
