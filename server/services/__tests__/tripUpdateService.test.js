const {
  classifyTripChanges,
  describeCategories,
  fuelShareWouldChange,
} = require('../tripUpdateService');

const current = {
  originAddress: 'Lucban',
  originLat: 14.113,
  originLng: 121.556,
  destinationAddress: 'MSEUF Lucena',
  destinationLat: 13.949,
  destinationLng: 121.62,
  distanceMeters: 30000,
  departureTime: new Date('2026-09-01T23:00:00.000Z'),
  recurrenceType: 'ONE_TIME',
  customDays: [],
  totalSeats: 4,
  driverNotes: 'Bring exact cash',
  genderPreference: 'ANY',
  flexibleDeparture: false,
  flexWindowMinutes: 15,
  familiarRidersOnly: false,
  meetingPointAddress: 'Petron Lucban',
  meetingPointLat: null,
  meetingPointLng: null,
  fuelSharePerSeat: 39.09, // (30/12)*62.55/4
  vehicle: { make: 'Toyota', model: 'Vios', color: 'White', plate: 'ABC 123', fuelEfficiencyKmL: 12 },
};

describe('classifyTripChanges', () => {
  test('no changes when the body matches current values', () => {
    const r = classifyTripChanges(current, {
      driverNotes: 'Bring exact cash',
      totalSeats: 4,
      departureTime: '2026-09-01T23:00:00.000Z',
      vehicle: { make: 'Toyota', fuelEfficiencyKmL: 12 },
    });
    expect(r.changed).toEqual([]);
  });

  test('driver notes edit is cosmetic', () => {
    const r = classifyTripChanges(current, { driverNotes: 'Meet by the flagpole' });
    expect(r.cosmetic).toContain('notes');
    expect(r.structural).toEqual([]);
  });

  test('plate change is cosmetic, not vehicle-structural', () => {
    const r = classifyTripChanges(current, { vehicle: { plate: 'XYZ 999' } });
    expect(r.cosmetic).toContain('plate');
    expect(r.structural).toEqual([]);
  });

  test('origin change is structural (route)', () => {
    const r = classifyTripChanges(current, { originAddress: 'Tayabas', originLat: 14.02, originLng: 121.59 });
    expect(r.structural).toEqual(['route']);
  });

  test('departure time change is structural (schedule)', () => {
    const r = classifyTripChanges(current, { departureTime: '2026-09-02T23:00:00.000Z' });
    expect(r.structural).toEqual(['schedule']);
  });

  test('recurrence change is structural (schedule)', () => {
    const r = classifyTripChanges(current, { recurrenceType: 'DAILY' });
    expect(r.structural).toEqual(['schedule']);
  });

  test('seat count change is structural (seats)', () => {
    const r = classifyTripChanges(current, { totalSeats: 3 });
    expect(r.structural).toEqual(['seats']);
  });

  test('vehicle make / efficiency change is structural (vehicle)', () => {
    expect(classifyTripChanges(current, { vehicle: { make: 'Honda' } }).structural).toEqual(['vehicle']);
    expect(classifyTripChanges(current, { vehicle: { fuelEfficiencyKmL: 9 } }).structural).toEqual(['vehicle']);
  });

  test('multiple structural changes are all reported', () => {
    const r = classifyTripChanges(current, { totalSeats: 3, departureTime: '2026-09-05T23:00:00.000Z' });
    expect(r.structural.sort()).toEqual(['schedule', 'seats']);
  });

  test('preferences change is cosmetic', () => {
    const r = classifyTripChanges(current, { genderPreference: 'SAME_GENDER', flexibleDeparture: true });
    expect(r.cosmetic).toEqual(['preferences']);
    expect(r.structural).toEqual([]);
  });

  test('equal departure time across timezone representations is not a change', () => {
    const r = classifyTripChanges(current, { departureTime: '2026-09-02T07:00:00+08:00' });
    expect(r.changed).toEqual([]); // same instant as the stored 2026-09-01T23:00:00Z
  });
});

describe('describeCategories', () => {
  test('joins with commas and a trailing "and"', () => {
    expect(describeCategories(['route'])).toBe('the route');
    expect(describeCategories(['route', 'seats'])).toBe('the route and the seat count');
    expect(describeCategories(['route', 'schedule', 'seats'])).toBe('the route, the schedule and the seat count');
  });
});

describe('fuelShareWouldChange', () => {
  const price = 62.55;

  test('null when nothing that affects the price changed', () => {
    expect(fuelShareWouldChange({ current, incoming: { driverNotes: 'x' }, pricePerLiter: price })).toBeNull();
  });

  test('reports from/to when seat count drops', () => {
    const r = fuelShareWouldChange({ current, incoming: { totalSeats: 2 }, pricePerLiter: price });
    expect(r.from).toBeCloseTo(39.09, 2);
    expect(r.to).toBeCloseTo(78.19, 2); // (30/12)*62.55/2
  });

  test('reports from/to when vehicle efficiency drops', () => {
    const r = fuelShareWouldChange({ current, incoming: { vehicle: { fuelEfficiencyKmL: 8 } }, pricePerLiter: price });
    expect(r.to).toBeGreaterThan(r.from);
  });

  test('null when the trip has no locked price to compare against', () => {
    const noDist = { ...current, distanceMeters: null, fuelSharePerSeat: null };
    expect(fuelShareWouldChange({ current: noDist, incoming: { totalSeats: 2 }, pricePerLiter: price })).toBeNull();
  });
});
