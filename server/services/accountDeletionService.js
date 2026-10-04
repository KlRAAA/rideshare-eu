const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { encryptField, decryptTripFields } = require('./encryptionService');
const { cancelWholeTrip, cancelPassengerMatch, ACTIVE_MATCH_STATUSES } = require('./tripCancellationService');

const AVATAR_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
const ACTIVE_TRIP_STATUSES = ['OPEN', 'FULL'];
const DELETED_NAME = 'Deleted user';
const REMOVED_ADDRESS = 'Removed';

class AccountDeletionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// Anonymizes rather than hard-deletes: the user row stays (as "Deleted user")
// so other people's trip history, the ratings that shaped their trust scores,
// and safety reports keep resolving. Everything that identifies the person or
// where they live is erased, and their upcoming rides are cancelled with the
// other riders notified.
async function deleteAccount(userId) {
  const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 4);

  const avatarUrl = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true, avatarUrl: true, email: true } });
    if (!user) throw new AccountDeletionError(404, 'USER_NOT_FOUND');
    if (user.isAdmin) {
      const admins = await tx.user.count({ where: { isAdmin: true, deletedAt: null } });
      if (admins <= 1) throw new AccountDeletionError(409, 'LAST_ADMIN');
    }

    // Upcoming trips this user hosts: cancel, notifying every passenger.
    const hosted = await tx.trip.findMany({
      where: { hostId: userId, status: { in: ACTIVE_TRIP_STATUSES } },
      include: { matches: true },
    });
    for (const tripRaw of hosted) {
      await cancelWholeTrip(tx, decryptTripFields(tripRaw), { reason: 'the host deleted their account' });
    }

    // Seats this user holds on other people's trips: give them back.
    const joined = await tx.match.findMany({
      where: { passengerId: userId, status: { in: ACTIVE_MATCH_STATUSES } },
      include: { trip: { select: { id: true, hostId: true, destinationAddress: true } } },
    });
    for (const match of joined) {
      await cancelPassengerMatch(tx, match);
      await tx.notification.create({
        data: {
          userId: match.trip.hostId,
          type: 'CANCELLATION',
          message: `A passenger left your trip to ${decryptTripFields(match.trip).destinationAddress} because they deleted their account.`,
          relatedMatchId: match.id,
          relatedTripId: match.trip.id,
        },
      });
    }

    // Erase where they live from every trip they ever hosted.
    const allHosted = await tx.trip.findMany({
      where: { hostId: userId },
      select: { id: true, destinationLat: true, destinationLng: true },
    });
    for (const t of allHosted) {
      await tx.trip.update({
        where: { id: t.id },
        data: {
          originAddress: encryptField(REMOVED_ADDRESS),
          originLat: t.destinationLat,
          originLng: t.destinationLng,
          routeWaypoints: null,
          meetingPointAddress: null,
          meetingPointLat: null,
          meetingPointLng: null,
          driverNotes: null,
          lastKnownLat: null,
          lastKnownLng: null,
          lastLocationUpdatedAt: null,
        },
      });
    }

    await tx.vehicle.updateMany({ where: { ownerId: userId }, data: { plate: null } });
    await tx.savedVehicle.deleteMany({ where: { ownerId: userId } });
    await tx.preference.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { senderId: userId } });
    // Support requests often contain personal details and aren't needed for
    // anyone else's records; their messages cascade with the ticket. An admin's
    // replies on other people's tickets stay, credited to "Deleted user".
    await tx.supportTicket.deleteMany({ where: { userId } });
    await tx.emailVerification.deleteMany({ where: { email: user.email } });

    await tx.user.update({
      where: { id: userId },
      data: {
        fullName: encryptField(DELETED_NAME),
        gender: encryptField('PREFER_NOT_TO_SAY'),
        email: `deleted-${userId}@deleted.invalid`,
        universityId: `deleted-${userId}`,
        passwordHash: unusablePasswordHash,
        avatarUrl: null,
        isAdmin: false,
        deletedAt: new Date(),
      },
    });

    return user.avatarUrl;
  });

  if (avatarUrl) fs.rmSync(path.join(AVATAR_DIR, path.basename(avatarUrl)), { force: true });
}

module.exports = { deleteAccount, AccountDeletionError };
