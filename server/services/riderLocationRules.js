// When a rider may share their location with the driver, and how far they
// are from pickup (sub-project G). Pure: no database.
const { haversineMeters } = require('./psgaService');
const { pickupPoint } = require('./arrivalRules');

const MIN_MS = 60 * 1000;
const SHARE_BEFORE_MS = 15 * MIN_MS;
const SHARE_UNTIL_MS = 60 * MIN_MS; // the start window closes then (tripRunRules)
const STALE_MS = 30 * MIN_MS;
const AT_PICKUP_M = 100;

function sharingWindow(departure) {
  return { opensAt: new Date(departure.getTime() - SHARE_BEFORE_MS), closesAt: new Date(departure.getTime() + SHARE_UNTIL_MS) };
}

function inWindow(departure, now) {
  const { opensAt, closesAt } = sharingWindow(departure);
  return now >= opensAt && now <= closesAt;
}

function pickupStatus(point, trip) {
  const metersToPickup = Math.round(haversineMeters(point, pickupPoint(trip)));
  return { metersToPickup, atPickup: metersToPickup <= AT_PICKUP_M };
}

module.exports = { sharingWindow, inWindow, pickupStatus, SHARE_BEFORE_MS, STALE_MS, AT_PICKUP_M };
