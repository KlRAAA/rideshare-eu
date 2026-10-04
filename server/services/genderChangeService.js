const prisma = require('../config/db');
const { encryptField, decryptUserFields, decryptTripFields } = require('./encryptionService');
const { GENDERS, isWomenPlusEligible, normalizeGender } = require('./riderRules');
const { cancelPassengerMatch } = require('./tripCancellationService');

const OPEN_TRIP_STATUSES = ['OPEN', 'FULL'];

// Checks before leaving Women+ eligibility: a host can't while hosting open
// Women+ trips (D7), and pending requests on Women+ trips need the user's OK
// before they are withdrawn (D8). Returns { refusal } or { pending }.
async function checkLeavingWomenPlus(userId, confirm) {
  const tripCount = await prisma.trip.count({
    where: { hostId: userId, genderPreference: 'WOMEN_PLUS', status: { in: OPEN_TRIP_STATUSES } },
  });
  if (tripCount > 0) return { refusal: { status: 409, body: { error: 'HOSTING_WOMEN_PLUS_TRIPS', tripCount } } };

  const pending = await prisma.match.findMany({
    where: { passengerId: userId, status: 'PENDING', trip: { genderPreference: 'WOMEN_PLUS' } },
    include: { trip: { select: { id: true, hostId: true, destinationAddress: true } } },
  });
  if (pending.length > 0 && !confirm) {
    return { refusal: { status: 409, body: { error: 'CONFIRM_WITHDRAW_PENDING', pendingCount: pending.length } } };
  }
  return { pending };
}

// Self-declared gender, changeable at any time (Women+ spec D2). Approved rides
// stay. Hosts see a withdrawn request exactly like any other withdrawal, so no
// gender is revealed. Deliberately not written to the security log (spec §6):
// that would build a history of gender changes.
async function changeGender(userId, gender, { confirm = false } = {}) {
  if (!GENDERS.includes(gender)) return { ok: false, status: 400, body: { error: 'INVALID_GENDER' } };
  const user = decryptUserFields(
    await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, gender: true } })
  );
  if (normalizeGender(user.gender) === gender) return { ok: true, gender, withdrawn: 0 };

  const leaving = !isWomenPlusEligible(gender);
  let pending = [];
  if (leaving) {
    const check = await checkLeavingWomenPlus(userId, confirm);
    if (check.refusal) return { ok: false, ...check.refusal };
    pending = check.pending;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { gender: encryptField(gender) } });
    if (leaving) {
      await tx.preference.updateMany({ where: { userId, genderPreference: 'WOMEN_PLUS' }, data: { genderPreference: 'ANY' } });
    }
    for (const m of pending) {
      await cancelPassengerMatch(tx, m);
      await tx.notification.create({
        data: {
          userId: m.trip.hostId,
          type: 'CANCELLATION',
          message: `${user.fullName} withdrew their request to join your trip to ${decryptTripFields(m.trip).destinationAddress}.`,
          relatedMatchId: m.id,
          relatedTripId: m.trip.id,
        },
      });
    }
  });
  return { ok: true, gender, withdrawn: pending.length };
}

module.exports = { changeGender };
