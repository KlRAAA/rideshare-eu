// One-time move from "same-gender only" to Women+ trips (Women+ spec §4).
// Idempotent: rows already on the new values are left alone. Order:
//   node scripts/backup-db.mjs
//   npm run migrate-women-plus
//   npx prisma db push        (drops the old SAME_GENDER enum value)
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { encryptField, decryptField } = require('../services/encryptionService');
const { normalizeGender, isWomenPlusEligible } = require('../services/riderRules');

async function genderOf(db, userId) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { gender: true } });
  return u ? normalizeGender(decryptField(u.gender)) : 'PREFER_NOT_TO_SAY';
}

async function migrateGenders(db) {
  let changed = 0;
  const users = await db.user.findMany({ select: { id: true, gender: true } });
  for (const u of users) {
    let old;
    try {
      old = decryptField(u.gender);
    } catch {
      continue; // not valid ciphertext (e.g. a half-written test row): leave it alone
    }
    const next = normalizeGender(old);
    if (old !== next) {
      await db.user.update({ where: { id: u.id }, data: { gender: encryptField(next) } });
      changed += 1;
    }
  }
  return changed;
}

// Raw SQL throughout: the generated client no longer knows SAME_GENDER.
async function migrateTrips(db, counts) {
  const trips = await db.$queryRawUnsafe(
    `SELECT id, "hostId", "destinationAddress" FROM "Trip" WHERE "genderPreference"::text = 'SAME_GENDER'`
  );
  for (const t of trips) {
    const womenPlus = isWomenPlusEligible(await genderOf(db, t.hostId));
    await db.$executeRawUnsafe(
      `UPDATE "Trip" SET "genderPreference" = $1::"GenderPreference" WHERE id = $2`,
      womenPlus ? 'WOMEN_PLUS' : 'ANY',
      t.id
    );
    if (womenPlus) {
      counts.tripsWomenPlus += 1;
      continue;
    }
    counts.tripsOpened += 1;
    await db.notification.create({
      data: {
        userId: t.hostId,
        type: 'TRIP_UPDATED',
        relatedTripId: t.id,
        message: `Same-gender trips are now Women+ trips. Your trip to ${decryptField(t.destinationAddress)} is open to everyone; edit it if you want to change who can join.`,
      },
    });
  }
}

async function migratePreferences(db, counts) {
  const prefs = await db.$queryRawUnsafe(
    `SELECT "userId" FROM "Preference" WHERE "genderPreference"::text = 'SAME_GENDER'`
  );
  for (const p of prefs) {
    const womenPlus = isWomenPlusEligible(await genderOf(db, p.userId));
    await db.$executeRawUnsafe(
      `UPDATE "Preference" SET "genderPreference" = $1::"GenderPreference" WHERE "userId" = $2`,
      womenPlus ? 'WOMEN_PLUS' : 'ANY',
      p.userId
    );
    counts[womenPlus ? 'prefsWomenPlus' : 'prefsAny'] += 1;
  }
}

async function migrateWomenPlus(db) {
  const counts = { users: 0, tripsWomenPlus: 0, tripsOpened: 0, prefsWomenPlus: 0, prefsAny: 0 };
  // Postgres can't use a new enum value in the transaction that adds it, so
  // this runs on its own before anything writes WOMEN_PLUS.
  await db.$executeRawUnsafe(`ALTER TYPE "GenderPreference" ADD VALUE IF NOT EXISTS 'WOMEN_PLUS'`);
  counts.users = await migrateGenders(db);
  await migrateTrips(db, counts);
  await migratePreferences(db, counts);
  return counts;
}

if (require.main === module) {
  migrateWomenPlus(prisma)
    .then(async (counts) => {
      console.log(JSON.stringify(counts));
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { migrateWomenPlus };
