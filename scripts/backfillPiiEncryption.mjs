// One-time backfill: encrypts existing plaintext values in the fields that
// are now AES-256-GCM ciphertext at rest — User.fullName, User.gender, and
// Trip's address fields (originAddress, destinationAddress,
// meetingPointAddress). Safe to re-run: any value that's already in the
// iv:authTag:ciphertext format (3 base64 parts) is left alone rather than
// double-encrypted.
//
//   node scripts/backfillPiiEncryption.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import encryptionService from '../server/services/encryptionService.js';

const { encryptField } = encryptionService;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// A real encrypted value is exactly 3 base64-ish segments joined by ':'.
// Cheap enough to just try/catch a real decrypt, but this avoids spending an
// AES call (and needing the key to already be right) just to check shape.
function looksAlreadyEncrypted(value) {
  return typeof value === 'string' && /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value);
}

async function backfillUsers() {
  const users = await prisma.user.findMany({ select: { id: true, fullName: true, gender: true } });
  let updated = 0;
  for (const u of users) {
    const data = {};
    if (!looksAlreadyEncrypted(u.fullName)) data.fullName = encryptField(u.fullName);
    if (!looksAlreadyEncrypted(u.gender)) data.gender = encryptField(u.gender);
    if (Object.keys(data).length === 0) continue;
    await prisma.user.update({ where: { id: u.id }, data });
    updated++;
  }
  console.log(`User: ${updated}/${users.length} row(s) updated (rest already encrypted).`);
}

async function backfillTrips() {
  const trips = await prisma.trip.findMany({
    select: { id: true, originAddress: true, destinationAddress: true, meetingPointAddress: true },
  });
  let updated = 0;
  for (const t of trips) {
    const data = {};
    if (!looksAlreadyEncrypted(t.originAddress)) data.originAddress = encryptField(t.originAddress);
    if (!looksAlreadyEncrypted(t.destinationAddress)) data.destinationAddress = encryptField(t.destinationAddress);
    if (t.meetingPointAddress != null && !looksAlreadyEncrypted(t.meetingPointAddress)) {
      data.meetingPointAddress = encryptField(t.meetingPointAddress);
    }
    if (Object.keys(data).length === 0) continue;
    await prisma.trip.update({ where: { id: t.id }, data });
    updated++;
  }
  console.log(`Trip: ${updated}/${trips.length} row(s) updated (rest already encrypted).`);
}

await backfillUsers();
await backfillTrips();
await prisma.$disconnect();
console.log('Done.');
