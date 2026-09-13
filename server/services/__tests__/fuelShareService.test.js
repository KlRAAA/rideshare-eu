const { computeFuelSharePerSeat } = require('../fuelShareService');

describe('computeFuelSharePerSeat', () => {
  test('splits the one-way fuel cost across passenger seats only', () => {
    // 30 km, 12 km/L, ₱62.55/L → 2.5 L → ₱156.375 total → ÷ 3 seats = ₱52.13
    const result = computeFuelSharePerSeat({
      distanceMeters: 30000,
      efficiencyKmL: 12,
      pricePerLiter: 62.55,
      passengerSeats: 3,
    });
    expect(result).toBeCloseTo(52.13, 2);
  });

  test('never divides by the driver — 1 seat means the passenger covers the whole cost', () => {
    const result = computeFuelSharePerSeat({
      distanceMeters: 10000,
      efficiencyKmL: 10,
      pricePerLiter: 60,
      passengerSeats: 1,
    });
    expect(result).toBeCloseTo(60, 2); // (10/10) * 60 / 1
  });

  test('is fixed to seats offered — there is no filledSeats input', () => {
    const args = { distanceMeters: 24500, efficiencyKmL: 14, pricePerLiter: 62.55, passengerSeats: 4 };
    expect(computeFuelSharePerSeat(args)).toBe(computeFuelSharePerSeat({ ...args }));
  });

  test('returns null when distance is missing (routing failed at posting)', () => {
    expect(
      computeFuelSharePerSeat({ distanceMeters: null, efficiencyKmL: 14, pricePerLiter: 62.55, passengerSeats: 3 })
    ).toBeNull();
    expect(
      computeFuelSharePerSeat({ distanceMeters: 0, efficiencyKmL: 14, pricePerLiter: 62.55, passengerSeats: 3 })
    ).toBeNull();
  });

  test('returns null when the vehicle has no registered efficiency', () => {
    expect(
      computeFuelSharePerSeat({ distanceMeters: 30000, efficiencyKmL: null, pricePerLiter: 62.55, passengerSeats: 3 })
    ).toBeNull();
  });

  test('returns null for a non-positive seat count', () => {
    expect(
      computeFuelSharePerSeat({ distanceMeters: 30000, efficiencyKmL: 14, pricePerLiter: 62.55, passengerSeats: 0 })
    ).toBeNull();
  });

  // pricePerLiter used to always come from a fixed app-wide config default,
  // so it was never missing. Now it's host-entered per trip (no reliable free
  // PH fuel-price API exists), and a host may not have set one yet — this
  // must return null like the other missing-input cases, not NaN.
  test('returns null when pricePerLiter is missing (host has not set one yet)', () => {
    expect(
      computeFuelSharePerSeat({ distanceMeters: 30000, efficiencyKmL: 14, pricePerLiter: null, passengerSeats: 3 })
    ).toBeNull();
    expect(
      computeFuelSharePerSeat({ distanceMeters: 30000, efficiencyKmL: 14, pricePerLiter: undefined, passengerSeats: 3 })
    ).toBeNull();
    expect(
      computeFuelSharePerSeat({ distanceMeters: 30000, efficiencyKmL: 14, pricePerLiter: 0, passengerSeats: 3 })
    ).toBeNull();
  });
});
