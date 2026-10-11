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

// Out and back: east to a dead-end pickup, back west over the same road, then north.
const OUT_AND_BACK = {
  routes: [
    {
      distance: 3267,
      duration: 400,
      geometry: {
        coordinates: [
          [121.6, 13.9],
          [121.61, 13.9],
          [121.6, 13.9],
          [121.6, 13.91],
        ],
      },
      legs: [
        {
          duration: 200,
          steps: [
            { name: 'Quezon Ave', maneuver: { type: 'depart', location: [121.6, 13.9], instruction: 'Head east on Quezon Ave' } },
            { name: '', maneuver: { type: 'arrive', location: [121.61, 13.9], instruction: 'You have arrived at your 1st destination' } },
            { name: 'Quezon Ave', maneuver: { type: 'continue', modifier: 'uturn', location: [121.61, 13.9], instruction: 'Make a U-turn onto Quezon Ave' } },
            { name: 'Rizal St', maneuver: { type: 'turn', modifier: 'right', location: [121.6, 13.9], instruction: 'Turn right onto Rizal St' } },
            { name: '', maneuver: { type: 'arrive', location: [121.6, 13.91], instruction: 'You have arrived at your destination' } },
          ],
        },
      ],
    },
  ],
};

test('a road driven twice: the return pass is not matched to the outbound pass', () => {
  const out = parseNavRoute(OUT_AND_BACK, true)!;
  // Outbound, halfway to the pickup: the pickup is next, about 540 m away.
  const outbound = nextManeuver(out, { lat: 13.9, lng: 121.605 })!;
  expect(outbound.step.type).toBe('arrive');
  expect(outbound.meters).toBeGreaterThan(520);
  expect(outbound.meters).toBeLessThan(560);
  // Back on the return pass, about 215 m west of the pickup. The hint is where the car was matched there.
  const hint = nextManeuver(out, { lat: 13.9, lng: 121.608 }, 1080)!.along;
  expect(hint).toBeGreaterThan(1250);
  expect(hint).toBeLessThan(1340);
  // The same point as the outbound check, now on the way back: the next step is the right turn onto Rizal St.
  const back = nextManeuver(out, { lat: 13.9, lng: 121.605 }, hint)!;
  expect(back.step.type).toBe('turn');
  expect(back.step.name).toBe('Rizal St');
  expect(back.meters).toBeGreaterThan(500);
  expect(back.meters).toBeLessThan(580);
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
