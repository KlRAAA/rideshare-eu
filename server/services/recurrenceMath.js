// Pure recurrence-membership math, shared by trip lifecycle
// (tripCompletionService's "has today's occurrence happened" check) and
// search eligibility (psgaService's "does this trip run on the date the
// passenger picked" check). The underlying question — does `trip` run on
// `targetDay`, given `startDay` (its own first-occurrence day) — is
// identical in both places; only the calendar FRAME the caller computes
// startDay/targetDay in differs (UTC calendar days for the server-clock-
// relative lifecycle check; Philippine-local calendar days for a
// passenger-facing date picker, since that's what a date picked by a human
// actually means). Both callers must pass startDay/targetDay as
// already-normalized Date objects in the SAME frame as each other — this
// function is frame-agnostic and just compares the values it's given.
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

module.exports = { recurrenceRunsOnDay };
