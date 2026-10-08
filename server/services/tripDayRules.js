// When the automatic steps for a trip day happen (sub-project D). Pure: no
// database. A day is a Philippine date as phDateOnly gives it.
const { departureOnDay } = require('./tripRunRules');
const { phDateOnly } = require('./recurrenceMath');

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const UNCONFIRMED_BEFORE_MS = 60 * MIN_MS;
const LATE_AFTER_MS = 15 * MIN_MS;
const NO_SHOW_AFTER_MS = 60 * MIN_MS;
// phDateOnly(day) is midnight UTC = 8 AM in the Philippines; 8 PM the evening
// before is 12 hours earlier.
const ASK_BEFORE_DAY_MS = 12 * HOUR_MS;
const LOOKAHEAD_DAYS = 60;

function askAt(day) {
  return new Date(day.getTime() - ASK_BEFORE_DAY_MS);
}

function dueSteps(departure, now) {
  const t = now.getTime();
  const d = departure.getTime();
  return {
    unconfirmedWarning: t >= d - UNCONFIRMED_BEFORE_MS && t < d,
    lateWarning: t >= d + LATE_AFTER_MS && t < d + NO_SHOW_AFTER_MS,
    noShow: t >= d + NO_SHOW_AFTER_MS,
  };
}

// The next `count` days the trip runs, from today (PH), whose departure is still ahead.
function upcomingDays(trip, now, count) {
  const out = [];
  const today = phDateOnly(now);
  for (let i = 0; out.length < count && i < LOOKAHEAD_DAYS; i++) {
    const day = new Date(today.getTime() + i * DAY_MS);
    const departure = departureOnDay(trip, day);
    if (departure && departure > now) out.push({ day, departure });
  }
  return out;
}

module.exports = { askAt, dueSteps, upcomingDays, DAY_MS, UNCONFIRMED_BEFORE_MS, LATE_AFTER_MS, NO_SHOW_AFTER_MS };
