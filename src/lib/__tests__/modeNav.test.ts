import { describe, test, expect } from '@jest/globals';
import { tabsFor, otherMode, conflictMessage } from '../modeNav';

describe('mode navigation', () => {
  test('passenger and driver tabs', () => {
    expect(tabsFor('PASSENGER').map((t) => t.label)).toEqual(['Home', 'Find a Ride', 'My Rides', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER').map((t) => t.label)).toEqual(['Home', 'Post a Trip', 'My Trips', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER')[1].href).toBe('/auth/post');
    expect(otherMode('DRIVER')).toBe('PASSENGER');
  });
  test('a clash names the time of the other trip', () => {
    expect(conflictMessage('2026-06-01T23:00:00Z')).toBe('You already have a trip at 7:00 AM that overlaps this one. Pick a different time or ride.');
  });
});
