import { expect, test } from '@jest/globals';
import { arrowFor, distanceLabel, googleMapsUrl, isOffRoute, nextManeuver, parseNavRoute, wazeUrl } from '@/lib/navigation';

// An L-shaped drive: east ~1.08 km along Quezon Ave, left, north ~1.1 km.
// The pickup is at the corner (end of leg 1).
const MAPBOX = {
  routes: [
    {
      distance: 2185,
      duration: 300,
      geometry: { coordinates: [[121.6, 13.9], [121.61, 13.9], [121.61, 13.91]] },
      legs: [
        {
          duration: 120,
          steps: [
            { name: 'Quezon Ave', maneuver: { type: 'depart', location: [121.6, 13.9], instruction: 'Head east on Quezon Ave' } },
            { name: '', maneuver: { type: 'arrive', location: [121.61, 13.9], instruction: 'You have arrived at your 1st destination' } },
          ],
        },
        {
          duration: 180,
          steps: [
            { name: 'Rizal St', maneuver: { type: 'turn', modifier: 'left', location: [121.61, 13.9], instruction: 'Turn left onto Rizal St' } },
            { name: '', maneuver: { type: 'arrive', location: [121.61, 13.91], instruction: 'You have arrived at your destination' } },
          ],
        },
      ],
    },
  ],
};

const route = parseNavRoute(MAPBOX, true)!;

test('parses the line, the steps (without departures) and both durations', () => {
  expect(route.line).toEqual([
    { lat: 13.9, lng: 121.6 },
    { lat: 13.9, lng: 121.61 },
    { lat: 13.91, lng: 121.61 },
  ]);
  expect(route.steps.map((s) => s.type)).toEqual(['arrive', 'turn', 'arrive']);
  expect(route.steps[1]).toMatchObject({ modifier: 'left', name: 'Rizal St', instruction: 'Turn left onto Rizal St' });
  expect(route).toMatchObject({ durationSeconds: 300, distanceMeters: 2185, pickupSeconds: 120 });
  expect(parseNavRoute(MAPBOX, false)!.pickupSeconds).toBeNull();
  expect(parseNavRoute({ routes: [] }, false)).toBeNull();
  expect(parseNavRoute(null, false)).toBeNull();
});

test('the next maneuver is the first one ahead of the car, with the distance along the road', () => {
  const before = nextManeuver(route, { lat: 13.9, lng: 121.605 })!;
  expect(before.step.type).toBe('arrive'); // the pickup at the corner
  expect(before.meters).toBeGreaterThan(500);
  expect(before.meters).toBeLessThan(580);
  const after = nextManeuver(route, { lat: 13.905, lng: 121.61 })!;
  expect(after.step.instruction).toBe('You have arrived at your destination');
  expect(after.meters).toBeGreaterThan(520);
  expect(after.meters).toBeLessThan(590);
  expect(nextManeuver(route, { lat: 13.91, lng: 121.61 })).toBeNull();
});

test('off route only beyond 50 m from the line', () => {
  expect(isOffRoute(route.line, { lat: 13.9, lng: 121.605 })).toBe(false);
  expect(isOffRoute(route.line, { lat: 13.9003, lng: 121.605 })).toBe(false); // ~33 m
  expect(isOffRoute(route.line, { lat: 13.902, lng: 121.605 })).toBe(true); // ~221 m
});

test('arrows, distances and hand-off links', () => {
  expect(arrowFor('turn', 'left')).toBe('left');
  expect(arrowFor('turn', 'slight right')).toBe('slight-right');
  expect(arrowFor('turn', 'sharp left')).toBe('sharp-left');
  expect(arrowFor('continue', 'uturn')).toBe('uturn');
  expect(arrowFor('roundabout', 'right')).toBe('roundabout');
  expect(arrowFor('rotary', null)).toBe('roundabout');
  expect(arrowFor('arrive', null)).toBe('arrive');
  expect(arrowFor('new name', 'straight')).toBe('straight');
  expect(arrowFor('merge', null)).toBe('straight');
  expect(distanceLabel(40)).toBe('40 m');
  expect(distanceLabel(287)).toBe('290 m');
  expect(distanceLabel(1234)).toBe('1.2 km');
  expect(googleMapsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=1,2&waypoints=3,4&travelmode=driving'
  );
  expect(googleMapsUrl({ lat: 1, lng: 2 })).toBe('https://www.google.com/maps/dir/?api=1&destination=1,2&travelmode=driving');
  expect(wazeUrl({ lat: 1, lng: 2 })).toBe('https://waze.com/ul?ll=1,2&navigate=yes');
});
