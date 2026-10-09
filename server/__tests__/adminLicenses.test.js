require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, cleanup } = require('../test-helpers/seed');
const { LICENSE_DIR } = require('../config/uploads');

// Admins approve or reject driver licenses (sub-project E).

let server;
let base;
let dbUp = false;
const bag = newBag();
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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

const json = (method, p, userId, body) =>
  fetch(`${base}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function pendingDriver(name = 'License Driver') {
  const driver = await makeUser(bag, { fullName: name, licensed: false });
  const form = new FormData();
  form.append('licenseNumber', 'D12-34-567890');
  form.append('licenseType', 'NON_PROFESSIONAL');
  form.append('expiresOn', '2031-05-01');
  form.append('photo', new Blob([PNG_1x1], { type: 'image/png' }), 'l.png');
  const res = await fetch(`${base}/api/users/me/license`, { method: 'POST', headers: bearer(driver.id), body: form });
  const { license } = await res.json();
  const row = await prisma.driverLicense.findUnique({ where: { id: license.id } });
  return { driver, license, row };
}

async function postTrip(userId) {
  const vehicle = await makeVehicle(bag, userId);
  const res = await json('POST', '/api/trips', userId, {
    vehicleId: vehicle.id,
    originAddress: 'Sariaya', originLat: 13.96, originLng: 121.52,
    destinationAddress: 'MSEUF', destinationLat: 13.95, destinationLng: 121.62,
    departureTime: new Date(Date.now() + 3 * 86400000).toISOString(),
    recurrenceType: 'ONE_TIME', totalSeats: 3, fuelPricePerLiter: 60,
  });
  const body = await res.json();
  if (body.trip) bag.tripIds.push(body.trip.id);
  return res.status;
}

test('an admin sees the queue and the photo; others cannot', async () => {
  if (guard()) return;
  const admin = await makeAdminUser(bag);
  const { driver, license } = await pendingDriver('Queue Driver');

  const list = await (await json('GET', '/api/admin/licenses', admin.id)).json();
  const item = list.licenses.find((l) => l.id === license.id);
  expect(item).toMatchObject({ licenseNumber: 'D12-34-567890', licenseType: 'NON_PROFESSIONAL', user: { id: driver.id, fullName: 'Queue Driver' } });

  const photo = await fetch(`${base}/api/admin/licenses/${license.id}/photo`, { headers: bearer(admin.id) });
  expect(photo.status).toBe(200);
  expect(photo.headers.get('content-type')).toBe('image/png');
  expect(photo.headers.get('cache-control')).toBe('no-store');
  expect(photo.headers.get('cross-origin-resource-policy')).toBe('same-site');
  expect(Buffer.from(await photo.arrayBuffer()).equals(PNG_1x1)).toBe(true);

  expect((await fetch(`${base}/api/admin/licenses/${license.id}/photo`, { headers: bearer(driver.id) })).status).toBe(403);
  expect((await json('GET', '/api/admin/licenses', driver.id)).status).toBe(403);

  const counts = await (await json('GET', '/api/admin/nav-counts', admin.id)).json();
  expect(counts.pendingLicenses).toBeGreaterThanOrEqual(1);
});

test('approving erases the photo and number, records it, tells the driver, and unlocks posting', async () => {
  if (guard()) return;
  const admin = await makeAdminUser(bag);
  const { driver, license, row } = await pendingDriver();
  expect(await postTrip(driver.id)).toBe(403);

  const res = await json('POST', `/api/admin/licenses/${license.id}/approve`, admin.id, {});
  expect(res.status).toBe(200);
  const after = await prisma.driverLicense.findUnique({ where: { id: license.id } });
  expect(after).toMatchObject({ status: 'APPROVED', decidedById: admin.id, numberEnc: null, photoFile: null });
  expect(fs.existsSync(path.join(LICENSE_DIR, row.photoFile))).toBe(false);
  expect(await prisma.adminAction.count({ where: { action: 'LICENSE_APPROVED', targetUserId: driver.id } })).toBe(1);
  expect(await prisma.notification.count({ where: { userId: driver.id, type: 'LICENSE_APPROVED' } })).toBe(1);

  expect((await fetch(`${base}/api/admin/licenses/${license.id}/photo`, { headers: bearer(admin.id) })).status).toBe(404);
  const twice = await json('POST', `/api/admin/licenses/${license.id}/approve`, admin.id, {});
  expect(twice.status).toBe(409);
  expect((await twice.json()).error).toBe('ALREADY_DECIDED');
  expect(await postTrip(driver.id)).toBe(201);
});

test('rejecting needs a valid reason (and a note for Other), and the driver sees why', async () => {
  if (guard()) return;
  const admin = await makeAdminUser(bag);
  const { driver, license } = await pendingDriver();
  const reject = (body) => json('POST', `/api/admin/licenses/${license.id}/reject`, admin.id, body);

  let res = await reject({ reason: 'OTHER' });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('NOTE_REQUIRED');
  res = await reject({ reason: 'BORED' });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('INVALID_REASON');

  res = await reject({ reason: 'UNREADABLE', note: 'Glare over the number.' });
  expect(res.status).toBe(200);
  const mine = await (await json('GET', '/api/users/me/license', driver.id)).json();
  expect(mine.license).toMatchObject({ status: 'REJECTED', rejectReason: 'UNREADABLE', rejectNote: 'Glare over the number.' });
  const note = await prisma.notification.findFirst({ where: { userId: driver.id, type: 'LICENSE_REJECTED' } });
  expect(note.message).toMatch(/blurry or unreadable/i);
  expect(await prisma.adminAction.count({ where: { action: 'LICENSE_REJECTED', targetUserId: driver.id } })).toBe(1);
});

test('an admin cannot review their own license', async () => {
  if (guard()) return;
  const { driver, license } = await pendingDriver();
  await prisma.user.update({ where: { id: driver.id }, data: { isAdmin: true } });
  const res = await json('POST', `/api/admin/licenses/${license.id}/approve`, driver.id, {});
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
});
