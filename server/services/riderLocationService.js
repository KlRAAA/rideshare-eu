// Riders share their location with the trip's driver before pickup (sub-project G).
const prisma = require('../config/db');
const { decryptUserFields } = require('./encryptionService');
const { phDateOnly } = require('./recurrenceMath');
const { nextDeparture } = require('./tripRunRules');
const { sharingWindow, inWindow, pickupStatus, STALE_MS } = require('./riderLocationRules');

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEARED = { riderLat: null, riderLng: null, riderLocatedAt: null };
const STARTED = ['ONGOING', 'COMPLETED'];
const fail = (status, body) => ({ status, body });

function validPoint(lat, lng) {
  if (lat == null || lng == null) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  const ok = Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  return ok ? point : null;
}

// The departure riders are sharing for now, or why there isn't one.
async function currentDeparture(trip, now) {
  const today = phDateOnly(now);
  const runs = await prisma.tripRun.findMany({
    where: { tripId: trip.id, runDate: { gte: new Date(today.getTime() - DAY_MS) } },
    select: { runDate: true, status: true },
  });
  const closed = new Set(runs.filter((r) => ['SKIPPED', 'NO_SHOW'].includes(r.status)).map((r) => r.runDate.getTime()));
  const next = nextDeparture(trip, now, closed);
  if (!next) return { error: fail(409, { error: 'NOT_IN_WINDOW', opensAt: null }) };
  const day = phDateOnly(next.departure).getTime();
  if (runs.some((r) => r.runDate.getTime() === day && STARTED.includes(r.status))) return { error: fail(409, { error: 'TRIP_STARTED' }) };
  if (!inWindow(next.departure, now)) return { error: fail(409, { error: 'NOT_IN_WINDOW', opensAt: sharingWindow(next.departure).opensAt }) };
  return { departure: next.departure };
}

async function setSharing(matchId, userId, on) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { passengerId: true, status: true } });
  if (!match) return fail(404, { error: 'MATCH_NOT_FOUND' });
  if (match.passengerId !== userId) return fail(403, { error: 'NOT_AUTHORIZED' });
  if (match.status !== 'APPROVED') return fail(409, { error: 'NOT_APPROVED' });
  const sharesLocation = on === true;
  await prisma.match.update({ where: { id: matchId }, data: { sharesLocation, ...(!sharesLocation && CLEARED) } });
  return { status: 200, body: { sharesLocation } };
}

async function saveRiderLocation(tripId, userId, { lat, lng }, now = new Date()) {
  const point = validPoint(lat, lng);
  if (!point) return fail(400, { error: 'INVALID_COORDINATES' });
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { matches: { where: { passengerId: userId, status: 'APPROVED' }, select: { id: true, sharesLocation: true } } },
  });
  if (!trip) return fail(404, { error: 'TRIP_NOT_FOUND' });
  const [match] = trip.matches;
  if (!match) return fail(403, { error: 'NOT_AUTHORIZED' });
  if (!match.sharesLocation) return fail(409, { error: 'NOT_SHARING' });
  const current = await currentDeparture(trip, now);
  if (current.error) return current.error;
  await prisma.match.update({ where: { id: match.id }, data: { riderLat: point.lat, riderLng: point.lng, riderLocatedAt: now } });
  return { status: 200, body: { ok: true } };
}

// The driver's view: every approved rider, and where the sharing ones are.
async function riderLocationsFor(tripId, userId, now = new Date()) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { matches: { where: { status: 'APPROVED' }, include: { passenger: { select: { id: true, fullName: true } } } } },
  });
  if (!trip) return fail(404, { error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== userId) return fail(403, { error: 'NOT_AUTHORIZED' });
  const current = await currentDeparture(trip, now);
  if (current.error?.body.error === 'TRIP_STARTED') return { status: 200, body: { riders: [] } };

  const riders = trip.matches.map((m) => {
    const fresh = m.riderLat != null && m.riderLocatedAt && now - m.riderLocatedAt <= STALE_MS;
    const location = fresh ? { lat: m.riderLat, lng: m.riderLng } : null;
    return {
      matchId: m.id,
      passengerId: m.passengerId,
      fullName: decryptUserFields(m.passenger).fullName,
      sharing: m.sharesLocation,
      location,
      updatedAt: fresh ? m.riderLocatedAt : null,
      ...(location ? pickupStatus(location, trip) : { metersToPickup: null, atPickup: false }),
    };
  });
  return { status: 200, body: { riders } };
}

function clearTripRiderLocations(tripId, db = prisma) {
  return db.match.updateMany({ where: { tripId, riderLat: { not: null } }, data: CLEARED });
}

// The 5-minute job: nothing older than the stale limit, nothing on a request
// that's no longer approved.
function clearStaleRiderLocations(now = new Date()) {
  return prisma.match.updateMany({
    where: {
      riderLat: { not: null },
      OR: [{ riderLocatedAt: { lt: new Date(now.getTime() - STALE_MS) } }, { status: { not: 'APPROVED' } }],
    },
    data: CLEARED,
  });
}

module.exports = { setSharing, saveRiderLocation, riderLocationsFor, clearTripRiderLocations, clearStaleRiderLocations, CLEARED };
