// Fixed voluntary fuel share per passenger seat.
//
// One-way fuel cost of the trip, split across the seats OFFERED to passengers —
// not the seats currently filled, and never across the driver (it's their car,
// their trip; passengers cover gas between themselves). Computed once at posting
// time and persisted on the trip, so it stays the same number for every viewer
// and doesn't drift as seats fill. Follows BlaBlaCar's fixed-price-per-seat
// model.
//
// Returns null when distance or efficiency is unavailable (routing failed at
// posting, or a vehicle with no registered efficiency) — callers treat null as
// "no suggested share" and hide the figure.
function computeFuelSharePerSeat({ distanceMeters, efficiencyKmL, pricePerLiter, passengerSeats }) {
  if (!distanceMeters || !efficiencyKmL || !passengerSeats || passengerSeats < 1) return null;
  const litres = distanceMeters / 1000 / efficiencyKmL;
  const perSeat = (litres * pricePerLiter) / passengerSeats;
  return Number(perSeat.toFixed(2));
}

module.exports = { computeFuelSharePerSeat };
