require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, cleanup } = require('../test-helpers/seed');
const { LICENSE_DIR, UPLOADS_DIR } = require('../config/uploads');
const { deleteAccount } = require('../services/accountDeletionService');

// Drivers upload a license; only verified drivers post trips (sub-project E).

let server;
let base;
let dbUp = false;
const bag = newBag();

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const FIELDS = { licenseNumber: 'N01-23-456789', licenseType: 'NON_PROFESSIONAL', expiresOn: '2030-01-31' };

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

function upload(userId, { fields = FIELDS, file = PNG_1x1, type = 'image/png' } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append('photo', new Blob([file], { type }), 'license.png');
  return fetch(`${base}/api/users/me/license`, { method: 'POST', headers: bearer(userId), body: form });
}
const getMine = (userId) => fetch(`${base}/api/users/me/license`, { headers: bearer(userId) }).then((r) => r.json());

async function postTrip(userId) {
  const vehicle = await makeVehicle(bag, userId);
  const res = await fetch(`${base}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: JSON.stringify({
      vehicleId: vehicle.id,
      originAddress: 'Sariaya', originLat: 13.96, originLng: 121.52,
      destinationAddress: 'MSEUF', destinationLat: 13.95, destinationLng: 121.62,
      departureTime: new Date(Date.now() + 3 * 86400000).toISOString(),
      recurrenceType: 'ONE_TIME', totalSeats: 3, fuelPricePerLiter: 60,
    }),
  });
  const body = await res.json();
  if (body.trip) bag.tripIds.push(body.trip.id);
  return { status: res.status, body };
}

test('without a license a driver cannot post; after uploading it is under review', async () => {
  if (guard()) return;
  const driver = await makeUser(bag, { licensed: false });
  let posted = await postTrip(driver.id);
  expect(posted.status).toBe(403);
  expect(posted.body.error).toBe('LICENSE_REQUIRED');

  const res = await upload(driver.id);
  expect(res.status).toBe(201);
  const { license } = await res.json();
  expect(license).toMatchObject({ status: 'PENDING', numberLast4: '6789', licenseType: 'NON_PROFESSIONAL' });
  expect(license.photoFile).toBeUndefined();
  expect(license.numberEnc).toBeUndefined();

  const row = await prisma.driverLicense.findFirst({ where: { userId: driver.id } });
  const stored = path.join(LICENSE_DIR, row.photoFile);
  expect(fs.existsSync(stored)).toBe(true);
  expect(path.resolve(stored).startsWith(path.resolve(UPLOADS_DIR))).toBe(false);
  expect(fs.readFileSync(stored).subarray(0, 8).equals(PNG_1x1.subarray(0, 8))).toBe(false);

  const mine = await getMine(driver.id);
  expect(mine).toMatchObject({ verified: false, canPost: false, license: { status: 'PENDING' } });
  expect(JSON.stringify(mine)).not.toContain(row.photoFile);

  posted = await postTrip(driver.id);
  expect(posted.status).toBe(403);
  expect(posted.body.error).toBe('LICENSE_PENDING');

  const again = await upload(driver.id);
  expect(again.status).toBe(409);
  expect((await again.json()).error).toBe('LICENSE_PENDING');
});

test('bad uploads are refused', async () => {
  if (guard()) return;
  const driver = await makeUser(bag, { licensed: false });
  const err = async (res, status, code, field) => {
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.error).toBe(code);
    if (field) expect(body.field).toBe(field);
  };
  await err(await upload(driver.id, { file: Buffer.from('not an image at all'), type: 'text/plain' }), 400, 'INVALID_IMAGE');
  await err(await upload(driver.id, { file: null }), 400, 'INVALID_IMAGE');
  await err(await upload(driver.id, { fields: { ...FIELDS, expiresOn: '2020-01-01' } }), 400, 'LICENSE_EXPIRED');
  await err(await upload(driver.id, { fields: { ...FIELDS, licenseType: 'PILOT' } }), 400, 'INVALID_LICENSE', 'licenseType');
  expect(await prisma.driverLicense.count({ where: { userId: driver.id } })).toBe(0);
});

test('a verified driver posts', async () => {
  if (guard()) return;
  const driver = await makeUser(bag);
  expect((await postTrip(driver.id)).status).toBe(201);
  expect(await getMine(driver.id)).toMatchObject({ verified: true, canPost: true });
});

test('deleting the account removes the license and its photo', async () => {
  if (guard()) return;
  const driver = await makeUser(bag, { licensed: false });
  expect((await upload(driver.id)).status).toBe(201);
  const row = await prisma.driverLicense.findFirst({ where: { userId: driver.id } });
  await deleteAccount(driver.id);
  expect(await prisma.driverLicense.count({ where: { userId: driver.id } })).toBe(0);
  expect(fs.existsSync(path.join(LICENSE_DIR, row.photoFile))).toBe(false);
});
