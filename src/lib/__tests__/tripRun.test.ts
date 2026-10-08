import { describe, test, expect } from '@jest/globals';
import { elapsedLabel, clockLabel } from '../tripRun';

describe('trip run labels', () => {
  test('elapsed time in minutes, then hours and minutes', () => {
    const start = new Date('2026-06-01T23:00:00Z');
    expect(elapsedLabel(start, new Date('2026-06-01T23:00:20Z'))).toBe('just started');
    expect(elapsedLabel(start, new Date('2026-06-01T23:14:30Z'))).toBe('14 min');
    expect(elapsedLabel(start, new Date('2026-06-02T00:05:00Z'))).toBe('1 h 5 min');
  });
  test('clock times are shown in Philippine time', () => {
    expect(clockLabel('2026-06-01T23:42:00Z')).toBe('7:42 AM');
  });
});

import { notificationHref } from '../notificationLink';

describe('trip started notification', () => {
  test('opens the trip page', () => {
    expect(notificationHref({ type: 'TRIP_STARTED', relatedTripId: 't1', relatedMatchId: null })).toBe('/auth/trips/t1');
  });
});

import { tripStatusBadge } from '../statusBadge';

describe('trip status badge', () => {
  test('a trip on the road reads "In progress" whatever its seat status', () => {
    expect(tripStatusBadge('FULL', true)).toEqual({ label: 'In progress', tone: 'primary' });
    expect(tripStatusBadge('OPEN')).toEqual({ label: 'Open', tone: 'success' });
  });
});
