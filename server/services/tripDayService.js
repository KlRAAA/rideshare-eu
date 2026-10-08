// Trip days (sub-project D): the driver confirms or skips a day ahead of time.
const prisma = require('../config/db');
const { decryptTripFields, decryptUserFields } = require('./encryptionService');
const { departureOnDay, plannedArrival } = require('./tripRunRules');

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

module.exports = { phDay, dayLabel, firstName, confirmDay, skipDay, unskipDay, MAX_SKIP_REASON };
