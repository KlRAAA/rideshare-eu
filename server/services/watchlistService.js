const prisma = require('../config/db');
const { decryptField } = require('./encryptionService');
const { NO_SHOW_CANCEL_REASON } = require('./tripCancellationService');

// Patterns worth an admin's look. These only flag users; nothing happens
// automatically. Starting values the adviser can tune.
const PASSENGER_CANCEL_MIN = 3; // approved rides later cancelled by the passenger
const HOST_CANCEL_MIN = 2; // trips the host cancelled after approving riders
const REPORTS_MIN = 2; // reports received, any status
const WARNINGS_MIN = 2; // official warnings received
const NO_SHOWS_MIN = 2; // trip days the driver never started, with riders waiting (sub-project D)

// Passenger cancellations: the match was approved (respondedAt set) and later
// cancelled while the trip itself stayed on. Withdrawing a pending request is
// normal and isn't counted.
async function passengerCancellations(since) {
  const rows = await prisma.match.groupBy({
    by: ['passengerId'],
    where: { status: 'CANCELLED', respondedAt: { not: null, gte: since }, trip: { status: { not: 'CANCELLED' } } },
    _count: { _all: true },
  });
  return new Map(rows.filter((r) => r._count._all >= PASSENGER_CANCEL_MIN).map((r) => [r.passengerId, r._count._all]));
}

// Host cancellations: the host cancelled a trip that had approved riders.
// Trips an admin cancelled are excluded, so moderation doesn't count against the host,
// and so are no-show cancellations, which count as no-shows instead.
async function hostCancellations(since) {
  const trips = await prisma.trip.findMany({
    where: {
      status: 'CANCELLED',
      cancelledAt: { gte: since },
      matches: { some: { status: 'CANCELLED', respondedAt: { not: null } } },
    },
    select: { id: true, hostId: true, cancelReason: true },
  });
  if (trips.length === 0) return new Map();
  const adminCancelled = await prisma.adminAction.findMany({
    where: { action: 'TRIP_CANCELLED', targetTripId: { in: trips.map((t) => t.id) } },
    select: { targetTripId: true },
  });
  const byAdmin = new Set(adminCancelled.map((a) => a.targetTripId));
  const counts = new Map();
  for (const t of trips) {
    if (byAdmin.has(t.id) || t.cancelReason === NO_SHOW_CANCEL_REASON) continue;
    counts.set(t.hostId, (counts.get(t.hostId) || 0) + 1);
  }
  return new Map([...counts].filter(([, n]) => n >= HOST_CANCEL_MIN));
}

async function driverNoShows(since) {
  const runs = await prisma.tripRun.findMany({
    where: { status: 'NO_SHOW', endedAt: { gte: since } },
    select: { trip: { select: { hostId: true } } },
  });
  const counts = new Map();
  for (const r of runs) counts.set(r.trip.hostId, (counts.get(r.trip.hostId) || 0) + 1);
  return new Map([...counts].filter(([, n]) => n >= NO_SHOWS_MIN));
}

async function reportsReceived(since) {
  const rows = await prisma.report.groupBy({
    by: ['reportedUserId'],
    where: { reportedUserId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return new Map(rows.filter((r) => r._count._all >= REPORTS_MIN).map((r) => [r.reportedUserId, r._count._all]));
}

async function warningsReceived(since) {
  const rows = await prisma.userWarning.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  return new Map(rows.filter((r) => r._count._all >= WARNINGS_MIN).map((r) => [r.userId, r._count._all]));
}

// [{ userId, fullName, reasons: [plain sentences] }], most reasons first.
async function buildWatchlist(since) {
  const [passenger, host, reports, warnings, noShows] = await Promise.all([
    passengerCancellations(since),
    hostCancellations(since),
    reportsReceived(since),
    warningsReceived(since),
    driverNoShows(since),
  ]);
  const reasonsById = new Map();
  const add = (id, text) => reasonsById.set(id, [...(reasonsById.get(id) || []), text]);
  for (const [id, n] of passenger) add(id, `${n} rides cancelled after approval (as passenger)`);
  for (const [id, n] of host) add(id, `${n} trips cancelled after riders were approved`);
  for (const [id, n] of reports) add(id, `${n} reports received`);
  for (const [id, n] of warnings) add(id, `${n} warnings`);
  for (const [id, n] of noShows) add(id, `${n} no-shows as driver`);
  if (reasonsById.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...reasonsById.keys()] }, deletedAt: null },
    select: { id: true, fullName: true },
  });
  return users
    .map((u) => ({ userId: u.id, fullName: decryptField(u.fullName), reasons: reasonsById.get(u.id) }))
    .sort((a, b) => b.reasons.length - a.reasons.length || a.fullName.localeCompare(b.fullName));
}

module.exports = { buildWatchlist, PASSENGER_CANCEL_MIN, HOST_CANCEL_MIN, REPORTS_MIN, WARNINGS_MIN, NO_SHOWS_MIN };
