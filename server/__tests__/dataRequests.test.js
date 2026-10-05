require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeSuperAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Superadmin spec §6 and A4, S1–S7: only the superadmin releases records,
// after a password re-check, and every release and reopening is recorded.

let server;
let base;
let dbUp = false;
const bag = newBag();
let sa;
let admin;
let subject;

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const body = (over = {}) => ({
  subjectUserId: subject.id,
  agency: 'PNP Lucena',
  officerName: 'PCPT Cruz',
  officerContact: '0917',
  referenceNumber: 'BLT-1',
  legalBasis: 'WARRANT',
  fromDate: '2026-09-01',
  toDate: '2026-09-30',
  verificationNote: 'Called the station.',
  password: 'Right-Pass-1',
  ...over,
});

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (!dbUp) return;
  sa = await makeSuperAdminUser(bag, { fullName: 'Data Officer' });
  await prisma.user.update({ where: { id: sa.id }, data: { passwordHash: await bcrypt.hash('Right-Pass-1', 4) } });
  admin = await makeAdminUser(bag, { fullName: 'Plain Admin' });
  subject = await makeUser(bag, { fullName: 'Release Subject' });
  const host = await makeUser(bag, { fullName: 'Release Host' });
  const car = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, car.id, { departureTime: new Date('2026-09-10T07:00:00+08:00'), status: 'COMPLETED' });
  await makeMatch(bag, trip.id, subject.id, { status: 'COMPLETED' });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.user.updateMany({ where: { id: { in: bag.userIds } }, data: { isSuperAdmin: false } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[dataRequests.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const create = (over) => call('POST', '/api/admin/data-requests', sa.id, body(over));

test('A4: admins cannot use data requests', async () => {
  if (guard()) return;
  const list = await call('GET', '/api/admin/data-requests', admin.id);
  expect(list.status).toBe(403);
  expect((await list.json()).error).toBe('SUPERADMIN_ONLY');
  const post = await call('POST', '/api/admin/data-requests', admin.id, body());
  expect(post.status).toBe(403);
  expect((await post.json()).error).toBe('SUPERADMIN_ONLY');
});

test('S3: a wrong or missing password releases nothing', async () => {
  if (guard()) return;
  const wrong = await create({ password: 'nope' });
  expect(wrong.status).toBe(403);
  expect((await wrong.json()).error).toBe('INVALID_PASSWORD');
  const missing = await create({ password: '' });
  expect(missing.status).toBe(400);
  expect((await missing.json()).error).toBe('PASSWORD_REQUIRED');
  expect(await prisma.dataRequest.count({ where: { createdById: sa.id } })).toBe(0);
});

test('S7: the superadmin cannot request their own records', async () => {
  if (guard()) return;
  const res = await create({ subjectUserId: sa.id });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
});

test('S2 over HTTP: chats under a subpoena are refused', async () => {
  if (guard()) return;
  const res = await create({ legalBasis: 'SUBPOENA', includeChats: true });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'INVALID_DATA_REQUEST', field: 'includeChats' });
});

test('an unknown person → 404', async () => {
  if (guard()) return;
  const res = await create({ subjectUserId: 'does-not-exist' });
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBe('USER_NOT_FOUND');
});

test('S1/S6: the release is returned and recorded; reopening is recorded too', async () => {
  if (guard()) return;
  const res = await create();
  expect(res.status).toBe(201);
  const { request, release } = await res.json();
  expect(release.trips).toHaveLength(1);
  expect(release.trips[0]).toMatchObject({ driver: 'Release Host', subjectRole: 'PASSENGER' });
  const released = await prisma.adminAction.findFirst({ where: { action: 'DATA_RELEASED', targetUserId: subject.id } });
  expect(released).toMatchObject({ actorId: sa.id, details: expect.objectContaining({ dataRequestId: request.id, referenceNumber: 'BLT-1' }) });

  const reopened = await call('GET', `/api/admin/data-requests/${request.id}`, sa.id);
  expect(reopened.status).toBe(200);
  expect((await reopened.json()).release.trips).toHaveLength(1);
  expect(await prisma.adminAction.count({ where: { action: 'DATA_RELEASE_VIEWED', targetUserId: subject.id } })).toBe(1);

  const list = await (await call('GET', '/api/admin/data-requests', sa.id)).json();
  expect(list.requests.find((r) => r.id === request.id)).toMatchObject({ subjectName: 'Release Subject', overdue: false });
});

test('S4/S5: emergency paperwork is tracked, flagged when overdue, and can be marked received', async () => {
  if (guard()) return;
  const res = await create({ legalBasis: 'EMERGENCY', fromDate: undefined, toDate: undefined });
  expect(res.status).toBe(201);
  const { request } = await res.json();
  expect(request.paperworkDueAt).toBeTruthy();

  await prisma.dataRequest.update({ where: { id: request.id }, data: { paperworkDueAt: new Date(Date.now() - 1000) } });
  const list = await (await call('GET', '/api/admin/data-requests', sa.id)).json();
  expect(list.requests.find((r) => r.id === request.id).overdue).toBe(true);
  expect((await (await call('GET', '/api/admin/overview', sa.id)).json()).overdueDataPaperwork).toBeGreaterThanOrEqual(1);
  expect((await (await call('GET', '/api/admin/overview', admin.id)).json()).overdueDataPaperwork).toBeNull();

  const done = await call('PATCH', `/api/admin/data-requests/${request.id}/paperwork`, sa.id);
  expect(done.status).toBe(200);
  expect((await prisma.dataRequest.findUnique({ where: { id: request.id } })).paperworkReceivedAt).not.toBeNull();
  expect(await prisma.adminAction.count({ where: { action: 'DATA_PAPERWORK_RECEIVED', targetUserId: subject.id } })).toBe(1);
});
