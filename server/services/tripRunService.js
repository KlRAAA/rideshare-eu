// Starting and ending a day's run of a trip (sub-project B).
const prisma = require('../config/db');
const { decryptTripFields } = require('./encryptionService');
const { phDateOnly } = require('./recurrenceMath');
const { startCheck, plannedArrival, AUTO_END_AFTER_ARRIVAL_MS } = require('./tripRunRules');
const { completeTrip, completeRecurringOccurrence } = require('./tripCompletionService');
const { clearTripRiderLocations } = require('./riderLocationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_STARTED = ['CONFIRMED', 'SKIPPED'];

function ongoingRun(tripId) {
  return prisma.tripRun.findFirst({ where: { tripId, status: 'ONGOING' } });
}

async function startRun(tripId, userId, now = new Date()) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { matches: { where: { status: 'APPROVED' } } } });
  if (!trip) return { status: 404, body: { error: 'TRIP_NOT_FOUND' } };
  if (trip.hostId !== userId) return { status: 403, body: { error: 'NOT_AUTHORIZED' } };

  const today = phDateOnly(now);
  const existing = await prisma.tripRun.findMany({
    where: { tripId, runDate: { in: [today, new Date(today - DAY_MS)] } },
    select: { id: true, runDate: true, status: true },
  });
  // A confirmed or skipped day hasn't been driven yet; startCheck only needs the others.
  const started = existing.filter((r) => !NOT_STARTED.includes(r.status));
  const check = startCheck(trip, now, new Set(started.map((r) => r.runDate.getTime())));
  if (check.error) return { status: 409, body: check };
  const planned = existing.find((r) => r.runDate.getTime() === check.runDate.getTime());
  if (planned?.status === 'SKIPPED') return { status: 409, body: { error: 'DAY_SKIPPED' } };

  const data = { status: 'ONGOING', startedAt: now, plannedArrivalAt: plannedArrival(trip, check.departure) };
  let run;
  try {
    run = planned
      ? await prisma.tripRun.update({ where: { id: planned.id, status: 'CONFIRMED' }, data })
      : await prisma.tripRun.create({ data: { ...data, tripId, runDate: check.runDate } });
  } catch (err) {
    // P2002: a second Start created the row first; P2025: it already moved the confirmed row on.
    if (err.code === 'P2002' || err.code === 'P2025') return { status: 409, body: { error: 'ALREADY_STARTED' } };
    throw err;
  }
  await clearTripRiderLocations(tripId); // riders' positions are for pickup only (sub-project G)
  const { destinationAddress } = decryptTripFields(trip);
  if (trip.matches.length > 0) {
    await prisma.notification.createMany({
      data: trip.matches.map((m) => ({
        userId: m.passengerId,
        type: 'TRIP_STARTED',
        message: `Your driver has started the trip to ${destinationAddress}.`,
        relatedTripId: tripId,
      })),
    });
  }
  return { status: 201, body: { run } };
}

// Ends the run once (a second caller finds nothing to update), then completes
// the trip as before: the whole trip for one-time trips, that day for
// recurring ones.
async function finishRun(run, reason, now = new Date()) {
  const { count } = await prisma.tripRun.updateMany({
    where: { id: run.id, status: 'ONGOING' },
    data: { status: 'COMPLETED', endedAt: now, endReason: reason },
  });
  if (count === 0) return;
  const trip = await prisma.trip.findUnique({ where: { id: run.tripId }, include: { matches: true } });
  if (!trip) return;
  if (trip.recurrenceType === 'ONE_TIME') await completeTrip(trip);
  else await completeRecurringOccurrence(trip, run.runDate);
}

async function endRun(tripId, userId, reason, now = new Date()) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { hostId: true } });
  if (!trip) return { status: 404, body: { error: 'TRIP_NOT_FOUND' } };
  if (trip.hostId !== userId) return { status: 403, body: { error: 'NOT_AUTHORIZED' } };
  const run = await ongoingRun(tripId);
  if (!run) return { status: 409, body: { error: 'NO_ONGOING_RUN' } };
  await finishRun(run, reason, now);
  return { status: 200, body: { status: 'RUN_ENDED' } };
}

async function endOverdueRuns(now = new Date()) {
  const overdue = await prisma.tripRun.findMany({
    where: { status: 'ONGOING', plannedArrivalAt: { lt: new Date(now - AUTO_END_AFTER_ARRIVAL_MS) } },
  });
  for (const run of overdue) await finishRun(run, 'AUTO', now);
  return overdue.length;
}

module.exports = { ongoingRun, startRun, finishRun, endRun, endOverdueRuns };
