const { computeFuelSharePerSeat } = require('./fuelShareService');

// Categories the host can change. The four "structural" ones need host
// confirmation + a passenger notification once the trip has an approved
// passenger; the rest are cosmetic and save freely at any time.
const STRUCTURAL = ['route', 'schedule', 'seats', 'vehicle'];

const CATEGORY_LABEL = {
  route: 'the route',
  schedule: 'the schedule',
  seats: 'the seat count',
  vehicle: 'the vehicle',
  notes: 'the driver notes',
  meetingPoint: 'the meeting point',
  plate: 'the plate number',
  preferences: 'the ride preferences',
};

const has = (obj, key) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;

const num = (v) => (v == null || v === '' ? null : Number(v));
const eqNum = (a, b, eps = 1e-6) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < eps);
const eqStr = (a, b) => (a ?? '') === (b ?? '');
const eqBool = (a, b) => Boolean(a) === Boolean(b);
const eqArr = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const eqDate = (a, b) => new Date(a).toISOString() === new Date(b).toISOString();

// `current` is the trip row with `current.vehicle`. `incoming` is the PATCH body:
// only keys the host actually submitted are compared (an absent key = no change).
// Vehicle fields arrive nested as `incoming.vehicle`.
function classifyTripChanges(current, incoming) {
  const v = incoming.vehicle || {};
  const changed = new Set();

  if (
    (has(incoming, 'originAddress') && !eqStr(current.originAddress, incoming.originAddress)) ||
    (has(incoming, 'originLat') && !eqNum(current.originLat, num(incoming.originLat))) ||
    (has(incoming, 'originLng') && !eqNum(current.originLng, num(incoming.originLng))) ||
    (has(incoming, 'destinationAddress') && !eqStr(current.destinationAddress, incoming.destinationAddress)) ||
    (has(incoming, 'destinationLat') && !eqNum(current.destinationLat, num(incoming.destinationLat))) ||
    (has(incoming, 'destinationLng') && !eqNum(current.destinationLng, num(incoming.destinationLng))) ||
    (has(incoming, 'distanceMeters') && !eqNum(current.distanceMeters, num(incoming.distanceMeters)))
  ) {
    changed.add('route');
  }

  if (
    (has(incoming, 'departureTime') && !eqDate(current.departureTime, incoming.departureTime)) ||
    (has(incoming, 'recurrenceType') && !eqStr(current.recurrenceType, incoming.recurrenceType)) ||
    (has(incoming, 'customDays') && !eqArr(current.customDays, incoming.customDays))
  ) {
    changed.add('schedule');
  }

  if (has(incoming, 'totalSeats') && num(current.totalSeats) !== num(incoming.totalSeats)) {
    changed.add('seats');
  }

  if (
    (has(v, 'make') && !eqStr(current.vehicle.make, v.make)) ||
    (has(v, 'model') && !eqStr(current.vehicle.model, v.model)) ||
    (has(v, 'color') && !eqStr(current.vehicle.color, v.color)) ||
    (has(v, 'fuelEfficiencyKmL') && !eqNum(current.vehicle.fuelEfficiencyKmL, num(v.fuelEfficiencyKmL)))
  ) {
    changed.add('vehicle');
  }

  if (has(incoming, 'driverNotes') && !eqStr(current.driverNotes, incoming.driverNotes)) {
    changed.add('notes');
  }
  if (
    (has(incoming, 'meetingPointAddress') && !eqStr(current.meetingPointAddress, incoming.meetingPointAddress)) ||
    (has(incoming, 'meetingPointLat') && !eqNum(current.meetingPointLat, num(incoming.meetingPointLat))) ||
    (has(incoming, 'meetingPointLng') && !eqNum(current.meetingPointLng, num(incoming.meetingPointLng)))
  ) {
    changed.add('meetingPoint');
  }
  if (has(v, 'plate') && !eqStr(current.vehicle.plate, v.plate)) {
    changed.add('plate');
  }
  if (
    (has(incoming, 'genderPreference') && !eqStr(current.genderPreference, incoming.genderPreference)) ||
    (has(incoming, 'flexibleDeparture') && !eqBool(current.flexibleDeparture, incoming.flexibleDeparture)) ||
    (has(incoming, 'flexWindowMinutes') && num(current.flexWindowMinutes) !== num(incoming.flexWindowMinutes)) ||
    (has(incoming, 'familiarRidersOnly') && !eqBool(current.familiarRidersOnly, incoming.familiarRidersOnly))
  ) {
    changed.add('preferences');
  }

  const all = [...changed];
  return {
    changed: all,
    structural: all.filter((c) => STRUCTURAL.includes(c)),
    cosmetic: all.filter((c) => !STRUCTURAL.includes(c)),
  };
}

// "the route and the seat count" — for the confirm dialog and notification.
function describeCategories(cats) {
  const labels = cats.map((c) => CATEGORY_LABEL[c] || c);
  if (labels.length <= 1) return labels[0] || '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

// What fuelSharePerSeat WOULD become under the proposed route/vehicle/seats.
// Only meaningful for warning the host when the value is locked — the caller
// never actually writes this once a passenger has matched.
function fuelShareWouldChange({ current, incoming, pricePerLiter }) {
  const v = incoming.vehicle || {};
  const newSeats = has(incoming, 'totalSeats') ? Number(incoming.totalSeats) : current.totalSeats;
  const newEff = has(v, 'fuelEfficiencyKmL') ? Number(v.fuelEfficiencyKmL) : current.vehicle.fuelEfficiencyKmL;
  const newDist =
    has(incoming, 'distanceMeters') && incoming.distanceMeters != null
      ? Number(incoming.distanceMeters)
      : current.distanceMeters;

  const would = computeFuelSharePerSeat({
    distanceMeters: newDist,
    efficiencyKmL: newEff,
    pricePerLiter,
    passengerSeats: newSeats,
  });
  const cur = current.fuelSharePerSeat;
  if (would == null || cur == null || Math.abs(would - cur) < 0.01) return null;
  return { from: cur, to: would };
}

module.exports = { classifyTripChanges, describeCategories, fuelShareWouldChange, STRUCTURAL };
