const { computeFuelShare } = require('../fuelShareService');

test('matches the thesis formula exactly', () => {
  const result = computeFuelShare({ distanceKm: 24.5, fuelEfficiencyKmL: 14, fuelPricePerLiter: 65, filledSeats: 1 });
  const expected = (24.5 / 14) * 65 / (1 + 1);
  expect(result).toBeCloseTo(expected, 4);
});

test('divides by 1 + filledSeats, not filledSeats alone', () => {
  const result = computeFuelShare({ distanceKm: 10, fuelEfficiencyKmL: 10, fuelPricePerLiter: 60, filledSeats: 0 });
  expect(result).toBeCloseTo(60, 4); // (10/10)*60 / (1+0) = 60
});
