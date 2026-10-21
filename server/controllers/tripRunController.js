const prisma = require('../config/db');
const { ongoingRun, startRun, endRun, MAX_END_NOTE_LENGTH } = require('../services/tripRunService');
const { confirmDay, skipDay, unskipDay } = require('../services/tripDayService');
const { isNearPickup } = require('../services/arrivalRules');
const { saveRiderLocation, riderLocationsFor } = require('../services/riderLocationService');
const { isPickedUp } = require('../services/riderLocationRules');

const MAX_ETA_SECONDS = 6 * 60 * 60;
// Older points are still served with their time, so riders see "paused"
// (the driver's phone stops in the background); after this they're dropped.
const PAUSED_LIMIT_MS = 10 * 60 * 1000;
const badEta = (v) => v != null && !(Number.isFinite(v) && v >= 0 && v <= MAX_ETA_SECONDS);

async function updateLocation(req, res) {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { hostId: true } });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (trip.hostId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const run = await ongoingRun(req.params.id);
  if (!run) return res.status(409).json({ error: 'NO_ONGOING_RUN' });

  const { lat, lng, etaSeconds, pickupEtaSeconds } = req.body;
  // Number(null) is 0, so missing values are checked first.
  if (lat == null || lng == null) return res.status(400).json({ error: 'INVALID_COORDINATES' });
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
    return res.status(400).json({ error: 'INVALID_COORDINATES' });
  }
  if (badEta(etaSeconds) || badEta(pickupEtaSeconds)) return res.status(400).json({ error: 'INVALID_ETA' });
  const now = new Date();
  await prisma.tripRun.update({
    where: { id: run.id },
    data: {
      lastKnownLat: latNum,
      lastKnownLng: lngNum,
      lastLocationUpdatedAt: now,
      ...(etaSeconds != null && { etaAt: new Date(now.getTime() + etaSeconds * 1000) }),
      ...(pickupEtaSeconds != null && { pickupEtaAt: new Date(now.getTime() + pickupEtaSeconds * 1000) }),
    },
  });
  try {
    await notifyArrivingOnce(req.params.id, run, { lat: latNum, lng: lngNum });
  } catch (err) {
    // Never fail the location write over this.
    console.error(`[arriving] ${err.message}`);
  }
  res.json({ ok: true });
}

// Sub-project F: once per trip day, approved riders hear the driver is close.
async function notifyArrivingOnce(tripId, run, point) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      originLat: true,
      originLng: true,
      meetingPointLat: true,
      meetingPointLng: true,
      matches: { where: { status: 'APPROVED' }, select: { passengerId: true } },
    },
  });
  if (!trip || trip.matches.length === 0 || !isNearPickup(point, trip)) return;
  const told = await prisma.notification.findFirst({
    where: { type: 'DRIVER_ARRIVING', relatedTripId: tripId, occurrenceDate: run.runDate },
    select: { id: true },
  });
  if (told) return;
  await prisma.notification.createMany({
    data: trip.matches.map((m) => ({
      userId: m.passengerId,
      type: 'DRIVER_ARRIVING',
      message: 'Your driver is almost at the meeting point (about 5 minutes away).',
      relatedTripId: tripId,
      occurrenceDate: run.runDate,
    })),
  });
}

function canViewLocation(trip, userId) {
  return userId === trip.hostId || trip.matches.some((m) => m.passengerId === userId && m.status === 'APPROVED');
}

async function getLocation(req, res) {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    select: { hostId: true, status: true, matches: { select: { passengerId: true, status: true, pickedUpAt: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!canViewLocation(trip, req.user.id)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const run = await ongoingRun(req.params.id);
  if (!run) return res.json({ location: null, etaAt: null, pickupEtaAt: null, pickedUp: false });
  const recent = run.lastLocationUpdatedAt && Date.now() - run.lastLocationUpdatedAt.getTime() <= PAUSED_LIMIT_MS;
  const mine = trip.matches.find((m) => m.passengerId === req.user.id && m.status === 'APPROVED');
  res.json({
    location: recent ? { lat: run.lastKnownLat, lng: run.lastKnownLng, updatedAt: run.lastLocationUpdatedAt } : null,
    etaAt: run.etaAt,
    pickupEtaAt: run.pickupEtaAt,
    pickedUp: isPickedUp(mine?.pickedUpAt, run),
  });
}


const reply = (res, { status, body }) => res.status(status).json(body);

async function start(req, res) {
  return reply(res, await startRun(req.params.id, req.user.id));
}
async function end(req, res) {
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length > MAX_END_NOTE_LENGTH) return res.status(400).json({ error: 'NOTE_TOO_LONG', max: MAX_END_NOTE_LENGTH });
  return reply(res, await endRun(req.params.id, req.user.id, 'DRIVER', new Date(), { note: note || undefined }));
}
// Called by the driver's phone near campus. Only an ongoing run can end this
// way, so it can never complete a trip that hasn't started.
async function arrived(req, res) {
  return reply(res, await endRun(req.params.id, req.user.id, 'ARRIVED'));
}

// Sub-project D: the driver confirms or skips one day (:date is YYYY-MM-DD, Philippine time).
async function confirm(req, res) {
  return reply(res, await confirmDay(req.params.id, req.user.id, req.params.date));
}
async function skip(req, res) {
  return reply(res, await skipDay(req.params.id, req.user.id, req.params.date, req.body?.reason));
}
async function unskip(req, res) {
  return reply(res, await unskipDay(req.params.id, req.user.id, req.params.date));
}

// Sub-project G: an approved rider's position for the driver, before pickup.
async function postRiderLocation(req, res) {
  return reply(res, await saveRiderLocation(req.params.id, req.user.id, req.body || {}));
}
async function getRiderLocations(req, res) {
  return reply(res, await riderLocationsFor(req.params.id, req.user.id));
}

module.exports = { start, end, arrived, updateLocation, getLocation, confirm, skip, unskip, postRiderLocation, getRiderLocations };
