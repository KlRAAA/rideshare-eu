// When a driver may start a day's run of a trip (sub-project B). Pure: no
// database. A run's day is its departure's Philippine calendar day; later
// departures of a recurring trip are the first departure plus whole days (the
// Philippines has no daylight saving), as in reminderService.
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');

const DAY_MS = 24 * 60 * 60 * 1000;
const START_EARLY_MS = 30 * 60 * 1000;
const START_LATE_MS = 60 * 60 * 1000; // the no-show time (sub-project D)
const AUTO_END_AFTER_ARRIVAL_MS = 60 * 60 * 1000;
const ACTIVE = ['OPEN', 'FULL'];

function departureOnDay(trip, day) {
  const firstDay = phDateOnly(trip.departureTime);
  if (!recurrenceRunsOnDay(trip, firstDay, day)) return null;
  const days = Math.round((day - firstDay) / DAY_MS);
  return new Date(trip.departureTime.getTime() + days * DAY_MS);
}

function startWindow(departure) {
  return { opensAt: new Date(departure - START_EARLY_MS), closesAt: new Date(departure.getTime() + START_LATE_MS) };
}

function plannedArrival(trip, departure) {
  return new Date(departure.getTime() + (trip.durationSeconds ?? 0) * 1000);
}

function startCheck(trip, now, startedDays) {
  if (!ACTIVE.includes(trip.status)) return { error: 'TRIP_NOT_ACTIVE' };
  const today = phDateOnly(now);
  // Yesterday too: a departure just before midnight is still startable after it.
  for (const day of [today, new Date(today - DAY_MS)]) {
    const departure = departureOnDay(trip, day);
    if (!departure) continue;
    const { opensAt, closesAt } = startWindow(departure);
    if (now < opensAt || now > closesAt) continue;
    if (startedDays.has(day.getTime())) return { error: 'ALREADY_STARTED' };
    return { departure, runDate: day };
  }
  const todays = departureOnDay(trip, today);
  if (!todays) return { error: 'NOT_A_TRIP_DAY' };
  const { opensAt } = startWindow(todays);
  return now < opensAt ? { error: 'TOO_EARLY_TO_START', opensAt } : { error: 'TOO_LATE_TO_START' };
}

// For the trip page: the soonest departure that can still be started.
// closedDays: run days (ms) that were skipped or recorded as no-shows.
function nextDeparture(trip, now, closedDays = new Set()) {
  const today = phDateOnly(now);
  for (let i = -1; i <= 7; i++) {
    const day = new Date(today.getTime() + i * DAY_MS);
    const departure = departureOnDay(trip, day);
    if (!departure || closedDays.has(day.getTime())) continue;
    const window = startWindow(departure);
    if (window.closesAt >= now) return { departure, ...window };
  }
  return null;
}

module.exports = { departureOnDay, startWindow, plannedArrival, startCheck, nextDeparture, AUTO_END_AFTER_ARRIVAL_MS };
