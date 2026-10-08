const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');
const { encryptField } = require('../services/encryptionService');
const { LICENSE_DIR } = require('../config/uploads');

// Minimal DB seeding for the phase-2 auth-behavior integration tests. Each
// helper records its row id on the passed `bag` so a test's afterAll can tear
// everything down in FK-safe order via `cleanup(bag)`.

// fullName/gender are AES-256-GCM ciphertext at rest (see encryptionService.js)
// — encrypted here too, mirroring what completeRegistration now does, so a
// controller that decrypts a seeded row back out doesn't throw on plaintext
// that was never actually encrypted.
// Every test user may post trips (an approved driver's license, sub-project E)
// unless created with `licensed: false`.
async function makeUser(bag, { fullName = 'Test User', gender = 'MAN', licensed = true } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      fullName: encryptField(fullName),
      universityId: `AUTH-${suffix}`,
      email: `auth-${suffix}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender: encryptField(gender),
      verified: true,
    },
  });
  bag.userIds.push(user.id);
  if (licensed) await makeLicense(bag, user.id);
  return { ...user, fullName, gender };
}

async function makeLicense(bag, userId, overrides = {}) {
  return prisma.driverLicense.create({
    data: {
      userId,
      status: 'APPROVED',
      licenseType: 'NON_PROFESSIONAL',
      numberLast4: '0000',
      expiresOn: new Date('2030-12-31T00:00:00Z'),
      decidedAt: new Date(),
      ...overrides,
    },
  });
}

async function makeAdminUser(bag, opts) {
  const user = await makeUser(bag, opts);
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  return { ...user, isAdmin: true };
}

async function makeSuperAdminUser(bag, opts) {
  const user = await makeAdminUser(bag, opts);
  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  return { ...user, isSuperAdmin: true };
}

async function makeVehicle(bag, ownerId, { fuelType = 'REGULAR' } = {}) {
  const vehicle = await prisma.vehicle.create({
    data: { ownerId, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12, fuelType },
  });
  bag.vehicleIds.push(vehicle.id);
  return vehicle;
}

// originAddress/destinationAddress/meetingPointAddress are ciphertext at rest
// too — same reasoning as makeUser above. `overrides` can still pass a
// plaintext address override; it's encrypted here rather than trusted as-is.
async function makeTrip(bag, hostId, vehicleId, overrides = {}) {
  const originAddress = overrides.originAddress ?? 'Origin';
  const destinationAddress = overrides.destinationAddress ?? 'Enverga University';
  const meetingPointAddress = 'meetingPointAddress' in overrides ? overrides.meetingPointAddress : undefined;
  const trip = await prisma.trip.create({
    data: {
      hostId,
      vehicleId,
      originLat: 13.9,
      originLng: 121.6,
      destinationLat: 13.95,
      destinationLng: 121.62,
      // In the future: a search anywhere settles past trips, which would close
      // another test file's fixtures mid-test (sub-project D).
      departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      recurrenceType: 'ONE_TIME',
      customDays: [],
      totalSeats: 3,
      genderPreference: 'ANY',
      flexibleDeparture: false,
      flexWindowMinutes: 15,
      familiarRidersOnly: false,
      fuelSharePerSeat: 25,
      status: 'OPEN',
      ...overrides,
      originAddress: encryptField(originAddress),
      destinationAddress: encryptField(destinationAddress),
      ...(meetingPointAddress !== undefined ? { meetingPointAddress: encryptField(meetingPointAddress) } : {}),
    },
  });
  bag.tripIds.push(trip.id);
  return { ...trip, originAddress, destinationAddress, ...(meetingPointAddress !== undefined ? { meetingPointAddress } : {}) };
}

async function makeMatch(bag, tripId, passengerId, overrides = {}) {
  const match = await prisma.match.create({
    data: {
      tripId,
      passengerId,
      score: 0.9,
      routeOverlap: 0.9,
      scheduleAlignment: 0.9,
      preferenceMatch: true,
      status: 'PENDING',
      ...overrides,
    },
  });
  bag.matchIds.push(match.id);
  return match;
}

async function makeNotification(bag, userId, overrides = {}) {
  const notification = await prisma.notification.create({
    data: { userId, type: 'REMINDER', message: 'test', ...overrides },
  });
  bag.notificationIds.push(notification.id);
  return notification;
}

function newBag() {
  return { userIds: [], vehicleIds: [], tripIds: [], matchIds: [], notificationIds: [], preferenceUserIds: [] };
}

async function cleanup(bag) {
  // Must run before matches/users are deleted below — Report.reporterId,
  // reportedUserId and reportedMatchId all FK into rows this bag owns.
  await prisma.report.deleteMany({
    where: {
      OR: [
        { reporterId: { in: bag.userIds } },
        { reportedUserId: { in: bag.userIds } },
        { reportedMatchId: { in: bag.matchIds } },
        { reviewedById: { in: bag.userIds } },
      ],
    },
  });
  await prisma.rating.deleteMany({ where: { matchId: { in: bag.matchIds } } });
  await prisma.notification.deleteMany({
    where: { OR: [{ id: { in: bag.notificationIds } }, { relatedTripId: { in: bag.tripIds } }] },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: bag.userIds } } });
  await prisma.message.deleteMany({
    where: { OR: [{ tripId: { in: bag.tripIds } }, { senderId: { in: bag.userIds } }] },
  });
  await prisma.match.deleteMany({ where: { id: { in: bag.matchIds } } });
  await prisma.tripRun.deleteMany({ where: { tripId: { in: bag.tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: bag.tripIds } } });
  await prisma.preference.deleteMany({ where: { userId: { in: [...bag.userIds, ...bag.preferenceUserIds] } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: bag.vehicleIds } } });
  await prisma.adminAction.deleteMany({
    where: { OR: [{ actorId: { in: bag.userIds } }, { targetUserId: { in: bag.userIds } }] },
  });
  await prisma.fuelPrice.deleteMany({ where: { setById: { in: bag.userIds } } });
  await prisma.savedVehicle.deleteMany({ where: { ownerId: { in: bag.userIds } } });
  await prisma.supportMessage.deleteMany({
    where: { OR: [{ authorId: { in: bag.userIds } }, { ticket: { userId: { in: bag.userIds } } }] },
  });
  await prisma.supportTicket.deleteMany({ where: { userId: { in: bag.userIds } } });
  await prisma.announcement.deleteMany({ where: { createdById: { in: bag.userIds } } });
  await prisma.securityEvent.deleteMany({ where: { userId: { in: bag.userIds } } });
  await prisma.userWarning.deleteMany({
    where: { OR: [{ userId: { in: bag.userIds } }, { issuedById: { in: bag.userIds } }] },
  });
  await prisma.dataRequest.deleteMany({
    where: { OR: [{ createdById: { in: bag.userIds } }, { subjectUserId: { in: bag.userIds } }] },
  });
  const licenses = await prisma.driverLicense.findMany({
    where: { OR: [{ userId: { in: bag.userIds } }, { decidedById: { in: bag.userIds } }] },
    select: { id: true, photoFile: true },
  });
  for (const l of licenses) if (l.photoFile) fs.rmSync(path.join(LICENSE_DIR, l.photoFile), { force: true });
  await prisma.driverLicense.deleteMany({ where: { id: { in: licenses.map((l) => l.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: bag.userIds } } });
}

module.exports = { newBag, makeUser, makeLicense, makeAdminUser, makeSuperAdminUser, makeVehicle, makeTrip, makeMatch, makeNotification, cleanup };
