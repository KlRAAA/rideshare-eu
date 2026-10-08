const prisma = require('../config/db');
const { recurrenceRunsOnDay, phDateOnly } = require('./recurrenceMath');
const { decryptTripFields } = require('./encryptionService');

const GRACE_BUFFER_MINUTES = 30;

function estimatedCompletionAt(trip) {
  if (trip.durationSeconds == null) return null;
  return new Date(trip.departureTime.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isOverdue(trip) {
  const est = estimatedCompletionAt(trip);
  return est != null && est < new Date();
}

function utcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Does this trip have a scheduled ride on `date` at all, independent of time-
// of-day? The schema has no recurrence end date, so DAILY/WEEKDAYS/CUSTOM
// recur indefinitely from the trip's original departureTime date onward —
// there's no principled point at which they'd stop being "active" on their
// own; only an explicit host cancellation ends a recurring trip.
//
// Philippine-local calendar days (phDateOnly), not raw UTC ones — a trip
// departing 7:00 AM PH is stored as 23:00 UTC the PREVIOUS calendar day, so
// comparing raw UTC days would misjudge day-of-week/date-equality for almost
// every peak-hour morning trip during the UTC 16:00-23:59 window (PH
// midnight-7:59am). This is ONLY about which calendar day a target instant
// counts as — occurrenceCompletionAt below (has the completion timestamp
// actually elapsed) is a separate, still-UTC-internal question and is
// unaffected by this.
function runsOnDate(trip, date) {
  return recurrenceRunsOnDay(trip, phDateOnly(trip.departureTime), phDateOnly(date));
}

// When today's occurrence is considered complete: departureTime's own UTC
// time-of-day, re-anchored to `today`'s date, plus the same duration + grace
// buffer as estimatedCompletionAt. A recurring trip's departureTime is never
// advanced day to day (the matcher only ever compares time-of-day — see
// psgaService.js), so this recomputes "when did today's ride end" instead of
// relying on a stored timestamp that's stuck on the trip's very first day.
function occurrenceCompletionAt(trip, today) {
  if (trip.durationSeconds == null) return null;
  const day = utcDateOnly(today);
  const departure = trip.departureTime;
  const occurrenceDeparture = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      departure.getUTCHours(),
      departure.getUTCMinutes(),
      departure.getUTCSeconds()
    )
  );
  return new Date(occurrenceDeparture.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isRecurringOccurrenceDue(trip, now) {
  if (trip.recurrenceType === 'ONE_TIME') return false;
  if (!runsOnDate(trip, now)) return false;
  const completionAt = occurrenceCompletionAt(trip, now);
  return completionAt != null && completionAt < now;
}

// Shared by both completion paths — the lazy read-time sweep and the host's
// manual "Mark as Completed" button — so a trip completed either way gets
// the exact same downstream effects: approved matches complete, still-open
// requests get declined (a join request never approved before the trip
// already happened can't retroactively become valid), and both sides get a
// RATING_PROMPT notification.
// Returns { trip, matchChanges } — matchChanges is [{id, status}] for every
// match this call touched. Returning this explicitly (rather than just the
// trip) is what lets applyLazyCompletion patch an already-fetched, already-
// included `trip.matches` array in place: re-fetching matches here with our
// own `include`/`select` shape would risk not matching whatever shape the
// caller's original query used (e.g. a `safeUserSelect`-scoped passenger),
// so the caller patches its own array by id instead of trusting a fresh read.
//
// `tripOrId` is either a tripId (string) — the original API, used by
// markCompleted's manual override and by applyLazyCompletion's search/joined-
// trips paths, which don't have `matches` loaded — or an already-fetched raw
// trip row with `matches` included, passed by applyLazyCompletion's My Trips
// and trip-detail paths to skip a redundant re-fetch of data the caller is
// already holding (confirmed via real query-count instrumentation: this was
// 1 avoidable SELECT per overdue trip in a list, on top of this function's
// own transaction).
async function completeTrip(tripOrId) {
  const tripRaw =
    typeof tripOrId === 'string'
      ? await prisma.trip.findUnique({ where: { id: tripOrId }, include: { matches: true } })
      : tripOrId;
  if (!tripRaw) return null;
  const tripId = tripRaw.id;
  const trip = decryptTripFields(tripRaw);
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') return { trip, matchChanges: [] };

  const approvedMatches = trip.matches.filter((m) => m.status === 'APPROVED');
  const pendingMatches = trip.matches.filter((m) => m.status === 'PENDING');

  // Same-status match updates collapse into one updateMany per status instead
  // of one update per match — every approved match gets the identical
  // {status: 'COMPLETED'} write, so there's nothing per-row to vary. Likewise
  // every RATING_PROMPT for an approved passenger shares the same shape
  // (only userId/relatedMatchId differ), so createMany replaces one insert
  // per passenger with a single multi-row insert. Real effect confirmed by
  // query-count instrumentation, not assumed: a trip with M approved + P
  // pending matches used to fire M+P separate match.update statements plus
  // 1+M separate notification.create statements inside the transaction; this
  // fires at most 2 match writes and 2 notification writes total, regardless
  // of M/P.
  const ops = [prisma.trip.update({ where: { id: tripId }, data: { status: 'COMPLETED' } })];
  if (approvedMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: approvedMatches.map((m) => m.id) } },
        data: { status: 'COMPLETED' },
      })
    );
  }
  if (pendingMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: pendingMatches.map((m) => m.id) } },
        data: { status: 'DECLINED' },
      })
    );
  }
  ops.push(
    prisma.notification.create({
      data: {
        userId: trip.hostId,
        type: 'RATING_PROMPT',
        message: `Your trip to ${trip.destinationAddress} is complete. Please rate your passengers.`,
        relatedTripId: tripId,
      },
    })
  );
  if (approvedMatches.length > 0) {
    ops.push(
      prisma.notification.createMany({
        data: approvedMatches.map((m) => ({
          userId: m.passengerId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your host.`,
          relatedMatchId: m.id,
          relatedTripId: tripId,
        })),
      })
    );
  }
  await prisma.$transaction(ops);

  const matchChanges = [
    ...approvedMatches.map((m) => ({ id: m.id, status: 'COMPLETED' })),
    ...pendingMatches.map((m) => ({ id: m.id, status: 'DECLINED' })),
  ];

  return { trip: { ...trip, status: 'COMPLETED' }, matchChanges };
}

// Recurring counterpart to completeTrip. A single recurring Trip row spans
// many rides over time, so an occurrence passing must NOT end the trip or
// any standing APPROVED match on it (a passenger who matched a recurring post
// joins every future occurrence, not just the next one) — only that
// occurrence's still-PENDING requests lapse, same reasoning completeTrip uses
// for a ONE_TIME trip. A RATING_PROMPT fires per occurrence instead of once
// ever, deduped by (user, match, occurrenceDate) exactly like reminderService
// dedupes REMINDERs by (user, trip).
async function completeRecurringOccurrence(tripOrId, occurrenceDate) {
  const tripRaw =
    typeof tripOrId === 'string'
      ? await prisma.trip.findUnique({ where: { id: tripOrId }, include: { matches: true } })
      : tripOrId;
  if (!tripRaw) return null;
  const tripId = tripRaw.id;
  const trip = decryptTripFields(tripRaw);

  const approvedMatches = trip.matches.filter((m) => m.status === 'APPROVED');
  const pendingMatches = trip.matches.filter((m) => m.status === 'PENDING');

  const recipients = [
    { userId: trip.hostId, relatedMatchId: null, ratee: 'passengers' },
    ...approvedMatches.map((m) => ({ userId: m.passengerId, relatedMatchId: m.id, ratee: 'host' })),
  ];

  const alreadyPrompted = await prisma.notification.findMany({
    where: {
      type: 'RATING_PROMPT',
      relatedTripId: tripId,
      occurrenceDate,
      userId: { in: recipients.map((r) => r.userId) },
    },
    select: { userId: true },
  });
  const alreadyPromptedIds = new Set(alreadyPrompted.map((n) => n.userId));
  const toPrompt = recipients.filter((r) => !alreadyPromptedIds.has(r.userId));

  // Same collapse as completeTrip: every pending match gets the identical
  // DECLINED write, and every prompt is one row in a single multi-row insert,
  // instead of one match.update / notification.create per row.
  const ops = [];
  if (pendingMatches.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: { id: { in: pendingMatches.map((m) => m.id) } },
        data: { status: 'DECLINED' },
      })
    );
  }
  if (toPrompt.length > 0) {
    ops.push(
      prisma.notification.createMany({
        data: toPrompt.map((r) => ({
          userId: r.userId,
          type: 'RATING_PROMPT',
          message: `Your trip to ${trip.destinationAddress} is complete. Please rate your ${r.ratee}.`,
          relatedMatchId: r.relatedMatchId,
          relatedTripId: tripId,
          occurrenceDate,
        })),
      })
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);

  return { trip, pendingDeclinedIds: pendingMatches.map((m) => m.id) };
}

// The "lazy check on read": given trips an endpoint already fetched (no
// extra query), complete any that are overdue and mutate them in place so
// the same response reflects the fresh state without a second round-trip —
// including any already-included `matches` array, patched by id rather than
// re-fetched (see completeTrip's comment for why).
//
// ONE_TIME trips take the same isOverdue + completeTrip path they always
// have (response shape unchanged; completeTrip now skips its own re-fetch
// when this function already has `matches` loaded — see its comment).
// Everything else is a recurring
// trip: it never gets marked COMPLETED here (there's no recurrence-end
// concept in the schema — only an explicit host cancellation ends one), and
// its APPROVED matches are never touched; only a due occurrence's PENDING
// matches lapse, mutated in place the same way matchChanges is.
async function applyLazyCompletion(trips, now = new Date()) {
  // A started run ends through End Trip or the overdue-run job, never here:
  // otherwise a trip that left late would complete while still on the road.
  const onRoad = new Set(
    (
      await prisma.tripRun.findMany({
        where: { tripId: { in: trips.map((t) => t.id) }, status: 'ONGOING' },
        select: { tripId: true },
      })
    ).map((r) => r.tripId)
  );
  for (const t of trips) {
    if (onRoad.has(t.id)) continue;
    if (t.status !== 'OPEN' && t.status !== 'FULL') continue;

    // Pass the trip itself, not just its id, when the caller already
    // included `matches` (My Trips / trip-detail) -- completeTrip/
    // completeRecurringOccurrence use it directly instead of re-fetching the
    // same row. Callers whose query doesn't include matches (search
    // candidates, joined trips) fall back to the original id-based path,
    // which still fetches internally exactly as before.
    const preload = Array.isArray(t.matches) ? t : t.id;

    if (t.recurrenceType === 'ONE_TIME') {
      if (!isOverdue(t)) continue;
      const { matchChanges } = await completeTrip(preload);
      t.status = 'COMPLETED';
      if (Array.isArray(t.matches)) {
        for (const change of matchChanges) {
          const m = t.matches.find((match) => match.id === change.id);
          if (m) m.status = change.status;
        }
      }
    } else {
      if (!isRecurringOccurrenceDue(t, now)) continue;
      // Philippine-local day, matching runsOnDate's fix above — this is the
      // dedup key completeRecurringOccurrence uses for its RATING_PROMPT
      // notifications. Leaving it UTC-anchored while runsOnDate became
      // PH-anchored would let the same PH-day's occurrence get keyed under two
      // different UTC-day values across lazy-completion runs straddling the
      // UTC/PH boundary, defeating the notification dedup.
      const occurrenceDate = phDateOnly(now);
      const { pendingDeclinedIds } = await completeRecurringOccurrence(preload, occurrenceDate);
      if (Array.isArray(t.matches)) {
        for (const id of pendingDeclinedIds) {
          const m = t.matches.find((match) => match.id === id);
          if (m) m.status = 'DECLINED';
        }
      }
    }
  }
  return trips;
}

module.exports = {
  estimatedCompletionAt,
  isOverdue,
  completeTrip,
  applyLazyCompletion,
  GRACE_BUFFER_MINUTES,
  utcDateOnly,
  runsOnDate,
  occurrenceCompletionAt,
  isRecurringOccurrenceDue,
  completeRecurringOccurrence,
};
