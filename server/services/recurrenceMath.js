const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no DST

// Which Philippine-local calendar day a UTC instant falls on, as a
// UTC-midnight Date usable as a frame-agnostic comparison key for
// recurrenceRunsOnDay below. PH has a fixed offset, so shifting the instant
// forward by it and reading the shifted instant's own UTC calendar-day
// components gives exactly the PH wall-clock day — no Intl/timezone-database
// lookup needed.
//
// This matters more than it looks: a trip departing 7:00 AM PH — the
// thesis's own stated peak commute time — is stored as 23:00 UTC the
// PREVIOUS calendar day. Comparing raw UTC calendar days for a morning PH
// departure (or for "now" during a lazy lifecycle check that happens to run
// between PH midnight and ~8am) silently picks the wrong day for both what a
// recurring trip's day-of-week membership means and which calendar day is
// having its occurrence completed. Used by both psgaService's search
// eligibility check and tripCompletionService's day-of-week (not elapsed-
// time) lifecycle check — the two places "which calendar day is this"
// actually needs to mean the same thing a human means by it.
function phDateOnly(instant) {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

// Pure recurrence-membership math, shared by trip lifecycle
// (tripCompletionService's "has today's occurrence happened" check) and
// search eligibility (psgaService's "does this trip run on the date the
// passenger picked" check). The underlying question — does `trip` run on
// `targetDay`, given `startDay` (its own first-occurrence day) — is
// identical in both places; both now compute startDay/targetDay via
// phDateOnly above (Philippine-local calendar days), since that's what a
// passenger's date picker and a host/passenger's own sense of "which day"
// both actually mean — not raw UTC calendar days. This function itself is
// frame-agnostic and just compares the values it's given.
function recurrenceRunsOnDay(trip, startDay, targetDay) {
  if (targetDay.getTime() < startDay.getTime()) return false;

  switch (trip.recurrenceType) {
    case 'ONE_TIME':
      return targetDay.getTime() === startDay.getTime();
    case 'DAILY':
      return true;
    case 'WEEKDAYS': {
      const dow = targetDay.getUTCDay();
      return dow >= 1 && dow <= 5;
    }
    case 'CUSTOM':
      return trip.customDays.includes(targetDay.getUTCDay());
    default:
      return false;
  }
}

module.exports = { recurrenceRunsOnDay, phDateOnly };
