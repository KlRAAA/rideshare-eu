function computeFuelShare({ distanceKm, fuelEfficiencyKmL, fuelPricePerLiter, filledSeats }) {
  return (distanceKm / fuelEfficiencyKmL) * fuelPricePerLiter / (1 + filledSeats);
}

module.exports = { computeFuelShare };
