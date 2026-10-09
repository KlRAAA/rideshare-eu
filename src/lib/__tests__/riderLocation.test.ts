import { describe, test, expect } from '@jest/globals';
import { riderStatusLine, sharingState, type RiderLocation } from '../riderLocation';

const NOW = new Date('2026-10-12T22:40:00Z');
const rider = (over: Partial<RiderLocation>): RiderLocation => ({
  matchId: 'm1',
  passengerId: 'p1',
  fullName: 'Maria Santos',
  sharing: true,
  location: { lat: 13.95, lng: 121.6 },
  updatedAt: '2026-10-12T22:39:00Z',
  metersToPickup: 40,
  atPickup: true,
  ...over,
});

describe('riderStatusLine', () => {
  test('one plain line per rider', () => {
    expect(riderStatusLine(rider({}), NOW)).toBe('Maria · at the meeting point · 1 min ago');
    expect(riderStatusLine(rider({ atPickup: false, metersToPickup: 350, updatedAt: '2026-10-12T22:39:50Z' }), NOW)).toBe('Maria · 350 m away · just now');
    expect(riderStatusLine(rider({ atPickup: false, metersToPickup: 1240, updatedAt: '2026-10-12T22:37:00Z' }), NOW)).toBe('Maria · 1.2 km away · 3 min ago');
    expect(riderStatusLine(rider({ sharing: false, location: null, updatedAt: null, metersToPickup: null, atPickup: false }), NOW)).toBe('Maria · not sharing');
    expect(riderStatusLine(rider({ location: null, updatedAt: null, metersToPickup: null, atPickup: false }), NOW)).toBe('Maria · sharing, no position yet');
  });
});

describe('sharingState', () => {
  const dep = '2026-10-12T22:45:00Z';
  test('before, open and closed around the departure', () => {
    expect(sharingState(dep, new Date('2026-10-12T22:00:00Z'))).toEqual({ state: 'before', opensAt: new Date('2026-10-12T22:30:00Z') });
    expect(sharingState(dep, NOW).state).toBe('open');
    expect(sharingState(dep, new Date('2026-10-12T23:46:00Z')).state).toBe('closed');
    expect(sharingState(null, NOW).state).toBe('closed');
  });
});
