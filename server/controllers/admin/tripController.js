const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptTripFields } = require('../../services/encryptionService');
const { normalizeNote, sendAdminError } = require('../../services/adminModerationService');
const { cancelWholeTrip } = require('../../services/tripCancellationService');

async function cancelTripAsAdmin(req, res) {
  let reason;
  try {
    reason = normalizeNote(req.body?.reason, { required: true });
  } catch (err) {
    return sendAdminError(res, err);
  }

  const tripRaw = await prisma.trip.findUnique({ where: { id: req.params.id }, include: { matches: true } });
  if (!tripRaw) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (tripRaw.status === 'CANCELLED' || tripRaw.status === 'COMPLETED') {
    return res.status(409).json({ error: 'TRIP_NOT_CANCELLABLE' });
  }
  const trip = decryptTripFields(tripRaw);

  const affectedMatches = await prisma.$transaction(async (tx) => {
    const count = await cancelWholeTrip(tx, trip, { reason, byAdmin: true });
    await tx.notification.create({
      data: {
        userId: trip.hostId,
        type: 'CANCELLATION',
        message: `An administrator cancelled your trip to ${trip.destinationAddress}: ${reason}`,
        relatedTripId: trip.id,
      },
    });
    await record(tx, {
      actorId: req.user.id,
      action: 'TRIP_CANCELLED',
      targetUserId: trip.hostId,
      targetTripId: trip.id,
      details: { reason, affectedMatches: count },
    });
    return count;
  });
  res.json({ status: 'TRIP_CANCELLED', affectedMatches });
}

module.exports = { cancelTripAsAdmin };
