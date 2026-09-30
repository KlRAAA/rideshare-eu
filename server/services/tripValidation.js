// Validates a new trip's fields before anything is written. Returns the first
// bad field's name, or null when the trip is valid. Without this, a missing
// or mistyped field reached Prisma and surfaced as a generic 500.

const MAX_ADDRESS_LENGTH = 200;
const MAX_NOTES_LENGTH = 500;
const MIN_SEATS = 1;
const MAX_SEATS = 6;
const MAX_FLEX_WINDOW_MINUTES = 120;
const RECURRENCE_TYPES = ['ONE_TIME', 'DAILY', 'WEEKDAYS', 'CUSTOM'];
const GENDER_PREFERENCES = ['ANY', 'SAME_GENDER'];

const isText = (v, max) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const isLat = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 90;
const isLng = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 180;
const isIntIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function validateNewTrip(body, now = new Date()) {
  if (!isText(body.originAddress, MAX_ADDRESS_LENGTH)) return 'originAddress';
  if (!isLat(body.originLat)) return 'originLat';
  if (!isLng(body.originLng)) return 'originLng';
  if (!isText(body.destinationAddress, MAX_ADDRESS_LENGTH)) return 'destinationAddress';
  if (!isLat(body.destinationLat)) return 'destinationLat';
  if (!isLng(body.destinationLng)) return 'destinationLng';

  const departure = typeof body.departureTime === 'string' ? new Date(body.departureTime) : null;
  if (!departure || Number.isNaN(departure.getTime()) || departure <= now) return 'departureTime';

  if (!RECURRENCE_TYPES.includes(body.recurrenceType)) return 'recurrenceType';
  if (body.recurrenceType === 'CUSTOM') {
    const days = body.customDays;
    const valid =
      Array.isArray(days) && days.length > 0 && days.every((d) => isIntIn(d, 0, 6)) && new Set(days).size === days.length;
    if (!valid) return 'customDays';
  }

  if (!isIntIn(body.totalSeats, MIN_SEATS, MAX_SEATS)) return 'totalSeats';

  if ('genderPreference' in body && !GENDER_PREFERENCES.includes(body.genderPreference)) return 'genderPreference';
  if ('flexWindowMinutes' in body && !isIntIn(body.flexWindowMinutes, 0, MAX_FLEX_WINDOW_MINUTES)) return 'flexWindowMinutes';
  for (const flag of ['flexibleDeparture', 'familiarRidersOnly']) {
    if (flag in body && typeof body[flag] !== 'boolean') return flag;
  }
  if (body.driverNotes != null && (typeof body.driverNotes !== 'string' || body.driverNotes.length > MAX_NOTES_LENGTH)) {
    return 'driverNotes';
  }

  // A meeting point is optional, but if any part is sent it must be complete.
  const hasMeeting = ['meetingPointLat', 'meetingPointLng'].some((k) => body[k] != null);
  if (hasMeeting) {
    if (!isLat(body.meetingPointLat)) return 'meetingPointLat';
    if (!isLng(body.meetingPointLng)) return 'meetingPointLng';
  }
  if (body.meetingPointAddress != null && (typeof body.meetingPointAddress !== 'string' || body.meetingPointAddress.length > MAX_ADDRESS_LENGTH)) {
    return 'meetingPointAddress';
  }

  return null;
}

module.exports = { validateNewTrip, MAX_SEATS };
