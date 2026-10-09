// The driver's rides, riders carried and fuel share from riders (sub-project H).
// The app never handles money: fuel share is what the app showed riders.
const prisma = require('../config/db');
const { decryptField } = require('./encryptionService');
const { phDateOnly } = require('./recurrenceMath');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 12;
const RECENT = 20;
const PERIODS = ['week', 'month', 'all'];

const round2 = (n) => Math.round(n * 100) / 100;
const shareOf = (m, trip) => m.fuelShareAmount ?? trip.fuelSharePerSeat ?? 0;

// Monday of the Philippine week containing `day` (a phDateOnly value).
function weekStart(day) {
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
}

// Every ride the user drove, newest first. One-time: a completed trip with
// completed riders. Recurring: each completed day; days from before the counts
// were saved use the riders approved now and are marked estimated.
async function driverRides(userId) {
  const trips = await prisma.trip.findMany({
    where: { hostId: userId },
    select: {
      id: true,
      recurrenceType: true,
      status: true,
      departureTime: true,
      destinationAddress: true,
      fuelSharePerSeat: true,
      matches: { where: { status: { in: ['COMPLETED', 'APPROVED'] } }, select: { status: true, fuelShareAmount: true } },
      runs: { where: { status: 'COMPLETED' }, select: { runDate: true, endedAt: true, riderCount: true, fuelShareTotal: true } },
    },
  });
  const rides = [];
  for (const trip of trips) {
    const destination = decryptField(trip.destinationAddress);
    if (trip.recurrenceType === 'ONE_TIME') {
      const carried = trip.matches.filter((m) => m.status === 'COMPLETED');
      if (trip.status !== 'COMPLETED' || carried.length === 0) continue;
      rides.push({
        tripId: trip.id,
        destination,
        date: trip.runs[0]?.endedAt ?? trip.departureTime,
        riders: carried.length,
        fuelShare: round2(carried.reduce((s, m) => s + shareOf(m, trip), 0)),
        estimated: false,
      });
      continue;
    }
    const approved = trip.matches.filter((m) => m.status === 'APPROVED');
    for (const run of trip.runs) {
      const estimated = run.riderCount == null;
      const riders = estimated ? approved.length : run.riderCount;
      if (riders === 0) continue;
      const fuelShare = estimated ? approved.reduce((s, m) => s + shareOf(m, trip), 0) : run.fuelShareTotal ?? 0;
      rides.push({ tripId: trip.id, destination, date: run.endedAt ?? run.runDate, riders, fuelShare: round2(fuelShare), estimated });
    }
  }
  return rides.sort((a, b) => b.date - a.date);
}

function totalsOf(rides) {
  return {
    rides: rides.length,
    riders: rides.reduce((n, r) => n + r.riders, 0),
    fuelShare: round2(rides.reduce((n, r) => n + r.fuelShare, 0)),
  };
}

async function driverSummary(userId, period, now = new Date()) {
  if (!PERIODS.includes(period)) return { status: 400, body: { error: 'INVALID_PERIOD' } };
  const rides = await driverRides(userId);
  const today = phDateOnly(now);
  const since =
    period === 'week' ? weekStart(today) : period === 'month' ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) : null;
  const inPeriod = since ? rides.filter((r) => phDateOnly(r.date) >= since) : rides;

  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const those = rides.filter((r) => {
      const d = phDateOnly(r.date);
      return d >= start && d < end;
    });
    return { weekStart: start.toISOString().slice(0, 10), ...totalsOf(those) };
  });

  return {
    status: 200,
    body: { period, totals: totalsOf(inPeriod), weeks, recent: rides.slice(0, RECENT) },
  };
}

module.exports = { driverSummary, driverRides };
