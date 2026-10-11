import { describe, test, expect } from '@jest/globals';
import { riderStatusLine, riderTripLine, sharingState, type RiderLocation } from '../riderLocation';
import { clockLabel } from '../tripRun';

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

describe('riderTripLine', () => {
  const now = new Date('2026-10-12T07:00:00+08:00');
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const here = { lat: 13.9, lng: 121.6 };

  test('before pickup: minutes to the meeting point', () => {
    const feed = { location: { ...here, updatedAt: at(-5000) }, etaAt: at(20 * 60000), pickupEtaAt: at(6 * 60000), pickedUp: false };
    expect(riderTripLine(feed, now)).toBe('Driver is about 6 min from the meeting point');
    expect(riderTripLine({ ...feed, pickupEtaAt: at(30000) }, now)).toBe('Driver is almost at the meeting point');
  });

  test('after pickup: arrival at campus', () => {
    const feed = { location: { ...here, updatedAt: at(-5000) }, etaAt: at(20 * 60000), pickupEtaAt: at(6 * 60000), pickedUp: true };
    expect(riderTripLine(feed, now)).toBe(`On the way · arrive about ${clockLabel(at(20 * 60000))}`);
  });

  test('paused or missing driver location', () => {
    const feed = { location: { ...here, updatedAt: at(-2 * 60000) }, etaAt: null, pickupEtaAt: null, pickedUp: false };
    expect(riderTripLine(feed, now)).toBe('Driver’s location paused · last seen 2 min ago');
    expect(riderTripLine({ ...feed, location: null }, now)).toBe('Waiting for the driver’s location…');
  });
});

test('a picked-up rider reads as picked up', () => {
  const r = { matchId: 'm', passengerId: 'p', fullName: 'Maria Reyes', sharing: true, pickedUp: true, location: null, updatedAt: null, metersToPickup: null, atPickup: false };
  expect(riderStatusLine(r, new Date())).toBe('Maria · picked up');
});
