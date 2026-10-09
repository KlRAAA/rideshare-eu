require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');
const { LICENSE_DIR } = require('../config/uploads');
const { setOcrReader, idle } = require('../services/licenseOcr');
const { purgeSpotCheckPhotos } = require('../services/licenseService');

// The automatic license check (OCR) and admin spot-checks. A fake reader
// stands in for Tesseract and returns the text "on the photo".

let server;
let base;
let dbUp = false;
const bag = newBag();
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
let photoText = '';

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  setOcrReader(async () => {
    if (photoText === null) throw new Error('unreadable');
    return photoText;
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  setOcrReader(null);
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

const LICENSE_TEXT = `REPUBLIC OF THE PHILIPPINES
LAND TRANSPORTATION OFFICE
NON-PROFESSIONAL DRIVER'S LICENSE
DELA CRUZ, JUAN SANTOS
D01-23-456789 2030/01/31`;

async function upload(driverId) {
  const form = new FormData();
  form.append('licenseNumber', 'D01-23-456789');
  form.append('licenseType', 'NON_PROFESSIONAL');
  form.append('expiresOn', '2030-01-31');
  form.append('photo', new Blob([PNG_1x1], { type: 'image/png' }), 'l.png');
  const res = await fetch(`${base}/api/users/me/license`, { method: 'POST', headers: bearer(driverId), body: form });
  const { license } = await res.json();
  await idle();
  return prisma.driverLicense.findUnique({ where: { id: license.id } });
}
const json = (method, p, userId, body) =>
  fetch(`${base}${p}`, { method, headers: { 'Content-Type': 'application/json', ...bearer(userId) }, body: body === undefined ? undefined : JSON.stringify(body) });

test('a license whose photo matches is approved automatically, and its photo kept 7 days for spot-checks', async () => {
  if (guard()) return;
  photoText = LICENSE_TEXT;
  const driver = await makeUser(bag, { fullName: 'Juan Dela Cruz', licensed: false });
  const row = await upload(driver.id);
  expect(row).toMatchObject({ status: 'APPROVED', autoApproved: true, decidedById: null });
  expect(row.checks).toMatchObject({ isLicense: true, nameMatch: true, numberMatch: true, expiryMatch: true, notStudentPermit: true, passed: true });
  expect(row.photoFile).not.toBeNull();
  expect(row.photoKeepUntil.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  expect(await prisma.notification.count({ where: { userId: driver.id, type: 'LICENSE_APPROVED' } })).toBe(1);
  expect(await prisma.adminAction.count({ where: { action: 'LICENSE_APPROVED', targetUserId: driver.id, actorId: null } })).toBe(1);
  const mine = await (await json('GET', '/api/users/me/license', driver.id)).json();
  expect(mine).toMatchObject({ verified: true, canPost: true });
});

test('a mismatch or an unreadable photo waits for an admin, with the checks shown', async () => {
  if (guard()) return;
  const admin = await makeAdminUser(bag);
  photoText = LICENSE_TEXT;
  const other = await makeUser(bag, { fullName: 'Maria Reyes', licensed: false });
  const mismatch = await upload(other.id);
  expect(mismatch).toMatchObject({ status: 'PENDING', autoApproved: false });
  expect(mismatch.checks).toMatchObject({ nameMatch: false, passed: false });
  expect(mismatch.checkedAt).toBeInstanceOf(Date);

  photoText = null;
  const blurry = await makeUser(bag, { fullName: 'Juan Dela Cruz', licensed: false });
  const unreadable = await upload(blurry.id);
  expect(unreadable).toMatchObject({ status: 'PENDING' });
  expect(unreadable.checks).toMatchObject({ unreadable: true, passed: false });

  const queue = await (await json('GET', '/api/admin/licenses', admin.id)).json();
  expect(queue.licenses.find((l) => l.id === mismatch.id).checks).toMatchObject({ nameMatch: false });
});

test('admins spot-check recent automatic approvals, revoke one, and old photos are purged', async () => {
  if (guard()) return;
  const admin = await makeAdminUser(bag);
  photoText = LICENSE_TEXT;
  const driver = await makeUser(bag, { fullName: 'Juan Dela Cruz', licensed: false });
  const row = await upload(driver.id);

  const recent = await (await json('GET', '/api/admin/licenses/recent-auto', admin.id)).json();
  expect(recent.licenses.some((l) => l.id === row.id && l.user.id === driver.id)).toBe(true);
  expect((await fetch(`${base}/api/admin/licenses/${row.id}/photo`, { headers: bearer(admin.id) })).status).toBe(200);
  expect((await json('GET', '/api/admin/licenses/recent-auto', driver.id)).status).toBe(403);

  const bad = await json('POST', `/api/admin/licenses/${row.id}/revoke`, admin.id, { reason: 'OTHER' });
  expect(bad.status).toBe(400);
  const res = await json('POST', `/api/admin/licenses/${row.id}/revoke`, admin.id, { reason: 'NOT_A_LICENSE', note: 'Photo of a screen.' });
  expect(res.status).toBe(200);
  const after = await prisma.driverLicense.findUnique({ where: { id: row.id } });
  expect(after).toMatchObject({ status: 'REJECTED', rejectReason: 'NOT_A_LICENSE', photoFile: null, numberEnc: null });
  expect(fs.existsSync(path.join(LICENSE_DIR, row.photoFile))).toBe(false);
  expect(await prisma.adminAction.count({ where: { action: 'LICENSE_REVOKED', targetUserId: driver.id } })).toBe(1);
  expect((await json('GET', '/api/users/me/license', driver.id).then((r) => r.json())).canPost).toBe(false);
  expect((await json('POST', `/api/admin/licenses/${row.id}/revoke`, admin.id, { reason: 'UNREADABLE' })).status).toBe(409);

  const kept = await upload((await makeUser(bag, { fullName: 'Juan Dela Cruz', licensed: false })).id);
  await prisma.driverLicense.update({ where: { id: kept.id }, data: { photoKeepUntil: new Date(Date.now() - 1000) } });
  await purgeSpotCheckPhotos();
  const purged = await prisma.driverLicense.findUnique({ where: { id: kept.id } });
  expect(purged).toMatchObject({ status: 'APPROVED', photoFile: null, numberEnc: null, photoKeepUntil: null });
  expect(fs.existsSync(path.join(LICENSE_DIR, kept.photoFile))).toBe(false);
});
