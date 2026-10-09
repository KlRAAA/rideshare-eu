import { describe, test, expect } from '@jest/globals';
import { tabsFor, otherMode, conflictMessage } from '../modeNav';

describe('mode navigation', () => {
  test('passenger and driver tabs', () => {
    // The main action sits in the middle, where the thumb rests.
    expect(tabsFor('PASSENGER').map((t) => t.label)).toEqual(['Home', 'My Rides', 'Find a Ride', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER').map((t) => t.label)).toEqual(['Home', 'My Trips', 'Post a Trip', 'Alerts', 'Profile']);
    expect(tabsFor('DRIVER')[2]).toMatchObject({ href: '/auth/post', primary: true });
    expect(tabsFor('PASSENGER').filter((t) => t.primary).map((t) => t.key)).toEqual(['search']);
    expect(otherMode('DRIVER')).toBe('PASSENGER');
  });
  test('a clash names the time of the other trip', () => {
    expect(conflictMessage('2026-06-01T23:00:00Z')).toBe('You already have a trip at 7:00 AM that overlaps this one. Pick a different time or ride.');
  });
});
