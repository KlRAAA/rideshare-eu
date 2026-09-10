const prisma = require('../config/db');

// Minimal DB seeding for the phase-2 auth-behavior integration tests. Each
// helper records its row id on the passed `bag` so a test's afterAll can tear
// everything down in FK-safe order via `cleanup(bag)`.

async function makeUser(bag, { fullName = 'Test User', gender = 'MALE' } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      fullName,
      universityId: `AUTH-${suffix}`,
      email: `auth-${suffix}@test.local`,
      passwordHash: 'x',
      role: 'STUDENT',
      gender,
      verified: true,
    },
  });
  bag.userIds.push(user.id);
  return user;
}

async function makeVehicle(bag, ownerId) {
  const vehicle = await prisma.vehicle.create({
    data: { ownerId, make: 'Test', model: 'Car', color: 'Blue', fuelEfficiencyKmL: 12 },
  });
  bag.vehicleIds.push(vehicle.id);
  return vehicle;
}

async function makeTrip(bag, hostId, vehicleId, overrides = {}) {
  const trip = await prisma.trip.create({
    data: {
      hostId,
      vehicleId,
      originAddress: 'Origin',
      originLat: 13.9,
      originLng: 121.6,
      destinationAddress: 'Enverga University',
      destinationLat: 13.95,
      destinationLng: 121.62,
      departureTime: new Date('2026-09-20T00:00:00Z'),
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
    },
  });
  bag.tripIds.push(trip.id);
  return trip;
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
  await prisma.rating.deleteMany({ where: { matchId: { in: bag.matchIds } } });
  await prisma.notification.deleteMany({
    where: { OR: [{ id: { in: bag.notificationIds } }, { relatedTripId: { in: bag.tripIds } }] },
  });
  await prisma.match.deleteMany({ where: { id: { in: bag.matchIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: bag.tripIds } } });
  await prisma.preference.deleteMany({ where: { userId: { in: [...bag.userIds, ...bag.preferenceUserIds] } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: bag.vehicleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: bag.userIds } } });
}

module.exports = { newBag, makeUser, makeVehicle, makeTrip, makeMatch, makeNotification, cleanup };
