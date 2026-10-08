// Trip days (sub-project D): the driver confirms or skips a day ahead of time.
const prisma = require('../config/db');
const { decryptTripFields, decryptUserFields } = require('./encryptionService');
const { departureOnDay, plannedArrival } = require('./tripRunRules');
const { askAt, dueSteps, DAY_MS } = require('./tripDayRules');
const { phDateOnly } = require('./recurrenceMath');
const { NO_SHOW_CANCEL_REASON, ACTIVE_MATCH_STATUSES } = require('./tripCancellationService');

const MAX_SKIP_REASON = 200;
const ACTIVE = ['OPEN', 'FULL'];

// 'YYYY-MM-DD' (a Philippine date) → the day as phDateOnly gives it, or null.
function phDay(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const day = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(dateStr) ? day : null;
}

function dayLabel(day) {
  return day.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

function firstName(user) {
  return (decryptUserFields(user).fullName || 'Your driver').split(' ')[0];
}

async function notifyRiders(trip, type, day, message) {
  const riders = trip.matches.filter((m) => m.status === 'APPROVED');
  if (riders.length === 0) return;
  await prisma.notification.createMany({
    data: riders.map((m) => ({ userId: m.passengerId, type, message, relatedTripId: trip.id, occurrenceDate: day })),
  });
}

const conflict = (error) => ({ status: 409, body: { error } });
const takenError = (run) => conflict(run.status === 'SKIPPED' ? 'DAY_SKIPPED' : 'ALREADY_STARTED');

// Shared checks for the three day routes. Returns { error } or the loaded day.
async function loadDay(tripId, userId, dateStr, now) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { host: true, matches: { where: { status: 'APPROVED' } } },
  });
  if (!trip) return { error: { status: 404, body: { error: 'TRIP_NOT_FOUND' } } };
  if (trip.hostId !== userId) return { error: { status: 403, body: { error: 'NOT_AUTHORIZED' } } };
  const day = phDay(dateStr);
  if (!day) return { error: { status: 400, body: { error: 'INVALID_DATE' } } };
  if (!ACTIVE.includes(trip.status)) return { error: conflict('TRIP_NOT_ACTIVE') };
  const departure = departureOnDay(trip, day);
  if (!departure) return { error: conflict('NOT_A_TRIP_DAY') };
  const run = await prisma.tripRun.findUnique({ where: { tripId_runDate: { tripId, runDate: day } } });
  return { trip, day, departure, run, departed: departure <= now };
}

async function confirmDay(tripId, userId, dateStr, now = new Date()) {
  const d = await loadDay(tripId, userId, dateStr, now);
  if (d.error) return d.error;
  if (d.departed) return conflict('DEPARTED');
  if (d.run) return takenError(d.run);
  try {
    const run = await prisma.tripRun.create({
      data: { tripId, runDate: d.day, status: 'CONFIRMED', confirmedAt: now, plannedArrivalAt: plannedArrival(d.trip, d.departure) },
    });
    return { status: 200, body: { run } };
  } catch (err) {
    if (err.code === 'P2002') return conflict('ALREADY_STARTED');
    throw err;
  }
}

async function skipDay(tripId, userId, dateStr, reason, now = new Date()) {
  const d = await loadDay(tripId, userId, dateStr, now);
  if (d.error) return d.error;
  if (d.trip.recurrenceType === 'ONE_TIME') return conflict('ONE_TIME_TRIP');
  if (d.departed) return conflict('DEPARTED');
  if (d.run && d.run.status !== 'CONFIRMED') return takenError(d.run);
  const skipReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  if (skipReason && skipReason.length > MAX_SKIP_REASON) return { status: 400, body: { error: 'REASON_TOO_LONG' } };

  const data = { status: 'SKIPPED', skipReason };
  const run = d.run
    ? await prisma.tripRun.update({ where: { id: d.run.id }, data })
    : await prisma.tripRun.create({ data: { ...data, tripId, runDate: d.day, plannedArrivalAt: plannedArrival(d.trip, d.departure) } });
  const { destinationAddress } = decryptTripFields(d.trip);
  const why = skipReason ? `: ${skipReason}` : '';
  await notifyRiders(d.trip, 'TRIP_SKIPPED', d.day, `${firstName(d.trip.host)} isn't driving to ${destinationAddress} on ${dayLabel(d.day)}${why}.`);
  return { status: 200, body: { run } };
}

async function unskipDay(tripId, userId, dateStr, now = new Date()) {
  const d = await loadDay(tripId, userId, dateStr, now);
  if (d.error) return d.error;
  if (d.departed) return conflict('TOO_LATE');
  if (d.run?.status !== 'SKIPPED') return conflict('NOT_SKIPPED');
  await prisma.tripRun.delete({ where: { id: d.run.id } });
  const { destinationAddress } = decryptTripFields(d.trip);
  await notifyRiders(d.trip, 'TRIP_SKIPPED', d.day, `${firstName(d.trip.host)} is driving to ${destinationAddress} again on ${dayLabel(d.day)}.`);
  return { status: 200, body: { status: 'DAY_RESTORED' } };
}

// ---- Automatic steps: the 5-minute job and every read of a trip ----

const STEP_TYPES = ['CONFIRM_REQUEST', 'DRIVER_UNCONFIRMED', 'DRIVER_LATE', 'DRIVER_NO_SHOW'];
// A one-time trip left unstarted for longer than this (e.g. from before trip
// days existed) closes quietly instead of being recorded as a no-show.
const NO_SHOW_LOOKBACK_MS = 2 * DAY_MS;

function timeLabel(departure) {
  return departure.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}

// One-time trips: their own day, however long ago. Recurring: yesterday,
// today and tomorrow (a departure just before midnight belongs to yesterday).
function candidateDays(trip, now) {
  if (trip.recurrenceType === 'ONE_TIME') return [phDateOnly(trip.departureTime)];
  const today = phDateOnly(now);
  return [-1, 0, 1].map((i) => new Date(today.getTime() + i * DAY_MS));
}

// Which steps are due for one day. `asked`: the driver already got this day's question.
function stepsFor({ trip, createdAt, day, departure, run, now, approved, pending, asked }) {
  if (run && run.status !== 'CONFIRMED') return [];
  const due = dueSteps(departure, now);
  if (due.noShow) {
    if (approved > 0 && now - departure < NO_SHOW_LOOKBACK_MS) return ['NO_SHOW'];
    return trip.recurrenceType === 'ONE_TIME' ? ['CLOSE'] : [];
  }
  if (due.lateWarning) return approved > 0 ? ['LATE'] : [];
  if (run || now >= departure) return [];
  const steps = [];
  const ask = askAt(day);
  if (now >= ask && createdAt < ask && approved + pending > 0) steps.push('ASK');
  if (due.unconfirmedWarning && approved > 0 && asked) steps.push('UNCONFIRMED');
  return steps;
}

const sentKey = (type, userId, tripId, day) => `${type}:${userId}:${tripId}:${day.getTime()}`;

async function notifyOnce(sent, type, userIds, tripId, day, message) {
  const fresh = userIds.filter((id) => !sent.has(sentKey(type, id, tripId, day)));
  if (fresh.length === 0) return;
  await prisma.notification.createMany({
    data: fresh.map((userId) => ({ userId, type, message, relatedTripId: tripId, occurrenceDate: day })),
  });
  for (const id of fresh) sent.add(sentKey(type, id, tripId, day));
}

// Records the no-show once (a second caller finds the day already settled).
async function recordNoShow(trip, day, departure, run, now, pendingIds) {
  try {
    return await prisma.$transaction(async (tx) => {
      if (run) {
        const { count } = await tx.tripRun.updateMany({
          where: { id: run.id, status: 'CONFIRMED' },
          data: { status: 'NO_SHOW', endedAt: now },
        });
        if (count === 0) return false;
      } else {
        await tx.tripRun.create({
          data: { tripId: trip.id, runDate: day, status: 'NO_SHOW', endedAt: now, plannedArrivalAt: plannedArrival(trip, departure) },
        });
      }
      if (trip.recurrenceType === 'ONE_TIME') {
        await tx.trip.updateMany({
          where: { id: trip.id, status: { in: ACTIVE } },
          data: { status: 'CANCELLED', cancelledAt: now, cancelReason: NO_SHOW_CANCEL_REASON },
        });
        await tx.match.updateMany({ where: { tripId: trip.id, status: { in: ACTIVE_MATCH_STATUSES } }, data: { status: 'CANCELLED' } });
      } else if (pendingIds.length > 0) {
        await tx.match.updateMany({ where: { id: { in: pendingIds }, status: 'PENDING' }, data: { status: 'DECLINED' } });
      }
      return true;
    });
  } catch (err) {
    if (err.code === 'P2002') return false;
    throw err;
  }
}

// Mirrors a change onto the caller's already-loaded trip, so the response shows it.
function patchMatches(target, from, to) {
  if (!Array.isArray(target.matches)) return;
  for (const m of target.matches) if (from.includes(m.status)) m.status = to;
}

// CLOSE: a one-time trip that never ran, with nobody waiting. No prompts.
async function closeQuietly(trip) {
  const { count } = await prisma.trip.updateMany({ where: { id: trip.id, status: { in: ACTIVE } }, data: { status: 'COMPLETED' } });
  if (count === 0) return;
  await prisma.match.updateMany({ where: { tripId: trip.id, status: 'APPROVED' }, data: { status: 'COMPLETED' } });
  await prisma.match.updateMany({ where: { tripId: trip.id, status: 'PENDING' }, data: { status: 'DECLINED' } });
  trip.status = 'COMPLETED';
  patchMatches(trip, ['APPROVED'], 'COMPLETED');
  patchMatches(trip, ['PENDING'], 'DECLINED');
}

async function applyStep(step, c) {
  const { trip, info, day, departure, run, now, sent, approvedIds, pendingIds } = c;
  if (step === 'CLOSE') return closeQuietly(trip);
  const driver = firstName(info.host);
  const dest = decryptTripFields({ destinationAddress: info.destinationAddress }).destinationAddress;
  const time = timeLabel(departure);
  const oneTime = trip.recurrenceType === 'ONE_TIME';

  if (step === 'ASK') {
    const when = day > phDateOnly(now) ? 'tomorrow' : 'today';
    const choice = oneTime ? 'Confirm, or cancel the trip.' : 'Confirm or skip this day.';
    return notifyOnce(sent, 'CONFIRM_REQUEST', [trip.hostId], trip.id, day, `Still driving to ${dest} ${when} at ${time}? ${choice}`);
  }
  if (step === 'UNCONFIRMED') {
    const msg = `${driver} hasn't confirmed the ${time} trip to ${dest} yet. Have a backup ride in mind.`;
    return notifyOnce(sent, 'DRIVER_UNCONFIRMED', approvedIds, trip.id, day, msg);
  }
  if (step === 'LATE') {
    return notifyOnce(sent, 'DRIVER_LATE', approvedIds, trip.id, day, `${driver} hasn't started the ${time} trip to ${dest} yet.`);
  }
  // NO_SHOW
  if (!(await recordNoShow(trip, day, departure, run, now, pendingIds))) return;
  const after = oneTime ? 'The trip is cancelled.' : 'Find another ride for today.';
  await notifyOnce(sent, 'DRIVER_NO_SHOW', approvedIds, trip.id, day, `${driver} didn't start the ${time} trip to ${dest}. ${after}`);
  if (oneTime) {
    Object.assign(trip, { status: 'CANCELLED', cancelledAt: now, cancelReason: NO_SHOW_CANCEL_REASON });
    patchMatches(trip, ACTIVE_MATCH_STATUSES, 'CANCELLED');
  } else {
    patchMatches(trip, ['PENDING'], 'DECLINED');
  }
}

// What the steps need that a caller's query may have left out (search
// candidates select only a few columns).
async function loadInfo(trips) {
  const complete = (t) => 'createdAt' in t && 'destinationAddress' in t && t.host?.fullName && Array.isArray(t.matches);
  const missing = trips.filter((t) => !complete(t));
  const rows = missing.length
    ? await prisma.trip.findMany({
        where: { id: { in: missing.map((t) => t.id) } },
        select: {
          id: true,
          createdAt: true,
          destinationAddress: true,
          host: { select: { fullName: true } },
          matches: { select: { id: true, passengerId: true, status: true } },
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return new Map(trips.map((t) => [t.id, complete(t) ? t : byId.get(t.id)]));
}

// Applies every due step to these trips, mutating them like the old lazy
// completion did so a page shows fresh state. Safe to repeat: each step
// happens once per trip and day.
async function settleTrips(trips, now = new Date()) {
  const active = trips.filter((t) => ACTIVE.includes(t.status));
  if (active.length === 0) return trips;
  const ids = active.map((t) => t.id);
  const allDays = [...new Set(active.flatMap((t) => candidateDays(t, now).map((d) => d.getTime())))].map((ms) => new Date(ms));
  const [runs, sentRows, infos] = await Promise.all([
    prisma.tripRun.findMany({ where: { tripId: { in: ids }, runDate: { in: allDays } } }),
    prisma.notification.findMany({
      where: { relatedTripId: { in: ids }, type: { in: STEP_TYPES }, occurrenceDate: { in: allDays } },
      select: { type: true, userId: true, relatedTripId: true, occurrenceDate: true },
    }),
    loadInfo(active),
  ]);
  const runOf = new Map(runs.map((r) => [`${r.tripId}:${r.runDate.getTime()}`, r]));
  const sent = new Set(sentRows.map((n) => sentKey(n.type, n.userId, n.relatedTripId, n.occurrenceDate)));

  for (const trip of active) {
    const info = infos.get(trip.id);
    if (!info) continue; // deleted meanwhile
    for (const day of candidateDays(trip, now)) {
      if (!ACTIVE.includes(trip.status)) break;
      const departure = departureOnDay(trip, day);
      if (!departure) continue;
      const approvedIds = info.matches.filter((m) => m.status === 'APPROVED').map((m) => m.passengerId);
      const pendingIds = info.matches.filter((m) => m.status === 'PENDING').map((m) => m.id);
      const run = runOf.get(`${trip.id}:${day.getTime()}`) ?? null;
      const asked = sent.has(sentKey('CONFIRM_REQUEST', trip.hostId, trip.id, day));
      const steps = stepsFor({
        trip, createdAt: info.createdAt, day, departure, run, now, approved: approvedIds.length, pending: pendingIds.length, asked,
      });
      for (const step of steps) await applyStep(step, { trip, info, day, departure, run, now, sent, approvedIds, pendingIds });
    }
  }
  return trips;
}

// The 5-minute job.
// ponytail: loads every open trip; narrow by departure if trip counts grow (sub-project J).
async function runDaySteps(now = new Date()) {
  const trips = await prisma.trip.findMany({
    where: { status: { in: ACTIVE } },
    include: { host: { select: { fullName: true } }, matches: { select: { id: true, passengerId: true, status: true } } },
  });
  await settleTrips(trips, now);
  return trips.length;
}

module.exports = { phDay, dayLabel, firstName, confirmDay, skipDay, unskipDay, settleTrips, runDaySteps, MAX_SKIP_REASON };
