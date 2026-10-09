require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { newBag, makeUser, makeLicense, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');
const { sendLicenseExpiryReminders, notifyLicenseRequired } = require('../services/licenseService');

// License expiry reminders and the one-time upload notice (sub-project E).
// Dates are in 2032 so no other license in a shared database is 30 or 7 days out.

let dbUp = false;
const bag = newBag();
beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});
afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

const NOW = new Date('2032-03-01T00:30:00Z'); // 1 Mar, 8:30 AM PH
const day = (iso) => new Date(`${iso}T00:00:00Z`);
const count = (userId, type) => prisma.notification.count({ where: { userId, type } });

test('reminders go out 30 and 7 days before expiry, once each', async () => {
  if (guard()) return;
  const in30 = await makeUser(bag, { licensed: false });
  await makeLicense(bag, in30.id, { expiresOn: day('2032-03-31') });
  const in29 = await makeUser(bag, { licensed: false });
  await makeLicense(bag, in29.id, { expiresOn: day('2032-03-30') });
  const in7 = await makeUser(bag, { licensed: false });
  await makeLicense(bag, in7.id, { expiresOn: day('2032-03-08') });
  const renewed = await makeUser(bag, { licensed: false });
  await makeLicense(bag, renewed.id, { expiresOn: day('2032-03-31') });
  await makeLicense(bag, renewed.id, { expiresOn: day('2037-03-31') }); // already renewed

  await sendLicenseExpiryReminders(NOW);
  await sendLicenseExpiryReminders(new Date(NOW.getTime() + 60 * 60 * 1000)); // same day, again
  expect(await count(in30.id, 'LICENSE_EXPIRING')).toBe(1);
  expect(await count(in29.id, 'LICENSE_EXPIRING')).toBe(0);
  expect(await count(in7.id, 'LICENSE_EXPIRING')).toBe(1);
  expect(await count(renewed.id, 'LICENSE_EXPIRING')).toBe(0);
  const note = await prisma.notification.findFirst({ where: { userId: in7.id, type: 'LICENSE_EXPIRING' } });
  expect(note.message).toMatch(/in 7 days/);
});

test('hosts without a license are asked to upload, once', async () => {
  if (guard()) return;
  const host = await makeUser(bag, { licensed: false });
  await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id);
  const licensedHost = await makeUser(bag);
  await makeTrip(bag, licensedHost.id, (await makeVehicle(bag, licensedHost.id)).id);
  const rider = await makeUser(bag, { licensed: false });

  const userIds = [host.id, licensedHost.id, rider.id];
  expect(await notifyLicenseRequired({ userIds })).toBe(1);
  expect(await notifyLicenseRequired({ userIds })).toBe(0);
  expect(await count(host.id, 'LICENSE_REQUIRED')).toBe(1);
  expect(await count(licensedHost.id, 'LICENSE_REQUIRED')).toBe(0);
  expect(await count(rider.id, 'LICENSE_REQUIRED')).toBe(0);
});
