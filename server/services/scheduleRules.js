// When two trips would need the same person at the same time (sub-project C):
// they share a Philippine day and their time spans come closer than
// TRIP_BUFFER_MIN. A span is the departure's time of day plus the route time
// (an hour when unknown), so a 20-minute trip at 7:00 keeps 6:50–7:30 free.
// The buffer gives the person time to get from one trip to the next.
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

const PH_OFFSET_MIN = 8 * 60;
const DAY_MIN = 24 * 60;
const UNKNOWN_DURATION_S = 3600;
const TRIP_BUFFER_MIN = 10;
const WEEKDAYS = { DAILY: [0, 1, 2, 3, 4, 5, 6], WEEKDAYS: [1, 2, 3, 4, 5] };

function timeSpan(trip) {
  const d = trip.departureTime instanceof Date ? trip.departureTime : new Date(trip.departureTime);
  const start = (d.getUTCHours() * 60 + d.getUTCMinutes() + PH_OFFSET_MIN) % DAY_MIN;
  return { start, end: start + Math.round((trip.durationSeconds ?? UNKNOWN_DURATION_S) / 60) };
}

function weekdaysOf(trip) {
  return trip.recurrenceType === 'CUSTOM' ? trip.customDays : WEEKDAYS[trip.recurrenceType];
}

function sharesADay(a, b) {
  const aOnce = a.recurrenceType === 'ONE_TIME';
  const bOnce = b.recurrenceType === 'ONE_TIME';
  const day = (t) => phDateOnly(t.departureTime instanceof Date ? t.departureTime : new Date(t.departureTime));
  if (aOnce && bOnce) return day(a).getTime() === day(b).getTime();
  if (aOnce) return recurrenceRunsOnDay(b, day(b), day(a));
  if (bOnce) return recurrenceRunsOnDay(a, day(a), day(b));
  const bDays = new Set(weekdaysOf(b));
  return weekdaysOf(a).some((d) => bDays.has(d));
}

// Spans can run past midnight; compare them on the same 24-hour clock.
// Less than TRIP_BUFFER_MIN between the end of one and the start of the other
// counts as a clash; exactly the buffer is fine.
function spansIntersect(a, b) {
  const x = timeSpan(a);
  const y = timeSpan(b);
  const B = TRIP_BUFFER_MIN;
  return [0, DAY_MIN, -DAY_MIN].some((shift) => x.start < y.end + shift + B && y.start + shift < x.end + B);
}

function overlaps(a, b) {
  return sharesADay(a, b) && spansIntersect(a, b);
}

function findConflict(candidate, trips) {
  return trips.find((t) => t.id !== candidate.id && overlaps(candidate, t)) ?? null;
}

module.exports = { timeSpan, sharesADay, overlaps, findConflict, TRIP_BUFFER_MIN };
