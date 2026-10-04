// Resets the three fixed accounts (host, passenger, admin) the Postman
// "Automated" folder logs in as, so every newman run starts from the same
// state: no trips, vehicles, matches, ratings, reports, bans, fuel prices or
// admin actions left over from the previous run.
//
// Credentials live in postman/local.postman_environment.json (test-only
// accounts on a @test.local address that can never receive mail) and are read
// from there, so the collection and this script can't drift apart.
//
// The passenger is created with tripCount 0 on purpose: a report only counts
// toward a ban when the reporter has tripCount >= 1
// (reportEnforcementService.isQualifyingReporter), so the collection's report
// request never bans the host and never sends a ban email.
//
// Usage: npm run seed:postman
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { encryptField } = require('../services/encryptionService');

const ENV_FILE = path.join(__dirname, '..', '..', 'postman', 'local.postman_environment.json');
const AVATAR_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
const BCRYPT_ROUNDS = 10;

function readEnvironment() {
  const { values } = JSON.parse(fs.readFileSync(ENV_FILE, 'utf8'));
  return Object.fromEntries(values.map((v) => [v.key, v.value]));
}

async function removeExisting(emails) {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, avatarUrl: true },
  });
  if (users.length === 0) return;

  const userIds = users.map((u) => u.id);
  const trips = await prisma.trip.findMany({ where: { hostId: { in: userIds } }, select: { id: true } });
  const tripIds = trips.map((t) => t.id);
  const matches = await prisma.match.findMany({
    where: { OR: [{ tripId: { in: tripIds } }, { passengerId: { in: userIds } }] },
    select: { id: true },
  });
  const matchIds = matches.map((m) => m.id);

  await prisma.report.deleteMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { reportedUserId: { in: userIds } },
        { reportedMatchId: { in: matchIds } },
        { reviewedById: { in: userIds } },
      ],
    },
  });
  await prisma.rating.deleteMany({
    where: { OR: [{ matchId: { in: matchIds } }, { raterId: { in: userIds } }, { rateeId: { in: userIds } }] },
  });
  await prisma.notification.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { relatedTripId: { in: tripIds } }, { relatedMatchId: { in: matchIds } }],
    },
  });
  await prisma.message.deleteMany({ where: { OR: [{ tripId: { in: tripIds } }, { senderId: { in: userIds } }] } });
  await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.preference.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.vehicle.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.adminAction.deleteMany({
    where: { OR: [{ actorId: { in: userIds } }, { targetUserId: { in: userIds } }] },
  });
  await prisma.fuelPrice.deleteMany({ where: { setById: { in: userIds } } });
  await prisma.savedVehicle.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.supportMessage.deleteMany({ where: { authorId: { in: userIds } } });
  // The Postman admin's announcements notified every user; remove those copies too.
  const announcements = await prisma.announcement.findMany({ where: { createdById: { in: userIds } }, select: { title: true } });
  for (const { title } of announcements) {
    await prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT', message: { startsWith: `${title}: ` } } });
  }
  await prisma.announcement.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.securityEvent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  for (const { avatarUrl } of users) {
    if (avatarUrl) fs.rmSync(path.join(AVATAR_DIR, path.basename(avatarUrl)), { force: true });
  }
}

async function createUser({ email, password, fullName, universityId }) {
  return prisma.user.create({
    data: {
      email,
      universityId,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      fullName: encryptField(fullName),
      gender: encryptField('MAN'),
      role: 'STUDENT',
      verified: true,
      tripCount: 0,
      hasSeenOnboarding: false,
      termsAcceptedAt: new Date(),
      termsVersion: 'postman-seed',
    },
    select: { id: true, email: true },
  });
}

async function main() {
  const env = readEnvironment();
  await removeExisting([env.hostEmail, env.passengerEmail, env.adminEmail]);

  const host = await createUser({
    email: env.hostEmail,
    password: env.hostPassword,
    fullName: 'Postman Host',
    universityId: 'POSTMAN-HOST',
  });
  const passenger = await createUser({
    email: env.passengerEmail,
    password: env.passengerPassword,
    fullName: 'Postman Passenger',
    universityId: 'POSTMAN-PASSENGER',
  });
  const admin = await createUser({
    email: env.adminEmail,
    password: env.adminPassword,
    fullName: 'Postman Admin',
    universityId: 'POSTMAN-ADMIN',
  });
  await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });

  console.log(`Seeded Postman accounts: host ${host.email}, passenger ${passenger.email}, admin ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
