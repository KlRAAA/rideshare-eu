require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { decryptField } = require('../services/encryptionService');
const { migrateWomenPlus } = require('../scripts/migrateWomenPlus');
const { newBag, makeUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

// Women+ spec §4: the one-time move off "same-gender only". The trip and
// preference cases need the old SAME_GENDER enum value, which `prisma db push`
// removes once the migration has run, so those cases only run on a database
// that still has it. The gender mapping is checked every run.

let dbUp = false;
let hasSameGender = false;
const bag = newBag();

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    return;
  }
  const values = await prisma.$queryRawUnsafe(`SELECT unnest(enum_range(NULL::"GenderPreference"))::text AS v`);
  hasSameGender = values.some((r) => r.v === 'SAME_GENDER');
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});

const genderOf = async (id) => decryptField((await prisma.user.findUnique({ where: { id }, select: { gender: true } })).gender);

test('maps legacy genders and is idempotent', async () => {
  if (!dbUp) return;
  const woman = await makeUser(bag, { gender: 'FEMALE' });
  const man = await makeUser(bag, { gender: 'MALE' });
  const unspecified = await makeUser(bag, { gender: 'UNSPECIFIED' });
  const already = await makeUser(bag, { gender: 'NON_BINARY' });

  await migrateWomenPlus(prisma);

  expect(await genderOf(woman.id)).toBe('WOMAN');
  expect(await genderOf(man.id)).toBe('MAN');
  expect(await genderOf(unspecified.id)).toBe('PREFER_NOT_TO_SAY');
  expect(await genderOf(already.id)).toBe('NON_BINARY');

  const second = await migrateWomenPlus(prisma);
  expect(second).toEqual({ users: 0, tripsWomenPlus: 0, tripsOpened: 0, prefsWomenPlus: 0, prefsAny: 0 });
});

test('converts same-gender trips and preferences', async () => {
  if (!dbUp) return;
  if (!hasSameGender) {
    console.warn('[migrateWomenPlus.test] SAME_GENDER already removed from the enum; trip/preference cases skipped');
    return;
  }
  const womanHost = await makeUser(bag, { fullName: 'Ana', gender: 'FEMALE' });
  const manHost = await makeUser(bag, { fullName: 'Juan', gender: 'MALE' });
  const wTrip = await makeTrip(bag, womanHost.id, (await makeVehicle(bag, womanHost.id)).id);
  const mTrip = await makeTrip(bag, manHost.id, (await makeVehicle(bag, manHost.id)).id, { destinationAddress: 'Lucena' });
  for (const id of [wTrip.id, mTrip.id]) {
    await prisma.$executeRawUnsafe(`UPDATE "Trip" SET "genderPreference" = 'SAME_GENDER' WHERE id = $1`, id);
  }
  for (const u of [womanHost, manHost]) {
    await prisma.preference.create({ data: { userId: u.id } });
    await prisma.$executeRawUnsafe(`UPDATE "Preference" SET "genderPreference" = 'SAME_GENDER' WHERE "userId" = $1`, u.id);
  }

  await migrateWomenPlus(prisma);

  const pref = async (table, col, id) =>
    (await prisma.$queryRawUnsafe(`SELECT "genderPreference"::text AS v FROM "${table}" WHERE "${col}" = $1`, id))[0].v;
  expect(await pref('Trip', 'id', wTrip.id)).toBe('WOMEN_PLUS');
  expect(await pref('Trip', 'id', mTrip.id)).toBe('ANY');
  expect(await pref('Preference', 'userId', womanHost.id)).toBe('WOMEN_PLUS');
  expect(await pref('Preference', 'userId', manHost.id)).toBe('ANY');

  const notes = await prisma.notification.findMany({ where: { userId: manHost.id } });
  expect(notes).toHaveLength(1);
  expect(notes[0].type).toBe('TRIP_UPDATED');
  expect(notes[0].message).toBe(
    'Same-gender trips are now Women+ trips. Your trip to Lucena is open to everyone; edit it if you want to change who can join.'
  );
  expect(await prisma.notification.count({ where: { userId: womanHost.id } })).toBe(0);
});
