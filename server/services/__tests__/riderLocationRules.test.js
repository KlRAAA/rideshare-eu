const { sharingWindow, inWindow, pickupStatus } = require('../riderLocationRules');

const DEP = new Date('2026-10-12T22:45:00Z'); // 6:45 AM PH
const at = (iso) => new Date(iso);

test('sharing opens 15 minutes before departure and closes 60 minutes after', () => {
  expect(sharingWindow(DEP)).toEqual({ opensAt: at('2026-10-12T22:30:00Z'), closesAt: at('2026-10-12T23:45:00Z') });
  expect(inWindow(DEP, at('2026-10-12T22:29:59Z'))).toBe(false);
  expect(inWindow(DEP, at('2026-10-12T22:30:00Z'))).toBe(true);
  expect(inWindow(DEP, at('2026-10-12T23:45:00Z'))).toBe(true);
  expect(inWindow(DEP, at('2026-10-12T23:45:01Z'))).toBe(false);
});

test('distance to the meeting point, else the origin; within 100 m counts as there', () => {
  const meet = { meetingPointLat: 13.95, meetingPointLng: 121.6, originLat: 14.5, originLng: 121.0 };
  // 0.0009° of latitude ≈ 100 m.
  expect(pickupStatus({ lat: 13.95072, lng: 121.6 }, meet)).toMatchObject({ atPickup: true });
  const far = pickupStatus({ lat: 13.95315, lng: 121.6 }, meet);
  expect(far.atPickup).toBe(false);
  expect(far.metersToPickup).toBeGreaterThan(330);
  expect(far.metersToPickup).toBeLessThan(370);
  const noMeet = { meetingPointLat: null, meetingPointLng: null, originLat: 13.95, originLng: 121.6 };
  expect(pickupStatus({ lat: 13.95, lng: 121.6 }, noMeet)).toEqual({ metersToPickup: 0, atPickup: true });
});
