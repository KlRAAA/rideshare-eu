// "Your driver is almost here" (sub-project F). Pure: no database.
const { haversineMeters } = require('./psgaService');

const ARRIVING_RADIUS_M = 1000; // about 5 minutes away in town traffic

// Where riders wait: the meeting point, else the trip's starting point.
function pickupPoint(trip) {
  return trip.meetingPointLat != null && trip.meetingPointLng != null
    ? { lat: trip.meetingPointLat, lng: trip.meetingPointLng }
    : { lat: trip.originLat, lng: trip.originLng };
}

function isNearPickup(point, trip) {
  return haversineMeters(point, pickupPoint(trip)) <= ARRIVING_RADIUS_M;
}

module.exports = { isNearPickup, pickupPoint, ARRIVING_RADIUS_M };
