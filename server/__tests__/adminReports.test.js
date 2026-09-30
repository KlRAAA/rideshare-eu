require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  delete process.env.SMTP_HOST;
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function makeReport({ reportedIsAdmin = false } = {}) {
  const host = reportedIsAdmin
    ? await makeAdminUser(bag, { fullName: 'Reported Host' })
    : await makeUser(bag, { fullName: 'Reported Host' });
  const passenger = await makeUser(bag, { fullName: 'Reporting Rider' });
  const vehicle = await makeVehicle(bag, host.id);
  const trip = await makeTrip(bag, host.id, vehicle.id);
  const match = await makeMatch(bag, trip.id, passenger.id);
  const report = await prisma.report.create({
    data: { reporterId: passenger.id, reportedUserId: host.id, reportedMatchId: match.id, category: 'NO_SHOW', description: 'Never came' },
  });
  return { host, passenger, report };
}

describe('GET /api/admin/reports', () => {
  test('lists open reports with decrypted names and the trip', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const { reports } = await (await call('GET', '/api/admin/reports?status=OPEN', admin.id)).json();
    const mine = reports.find((r) => r.id === report.id);
    expect(mine).toMatchObject({
      category: 'NO_SHOW',
      status: 'OPEN',
      reporter: { fullName: 'Reporting Rider' },
      reportedUser: { fullName: 'Reported Host' },
    });
    expect(mine.trip.destinationAddress).toBe('Enverga University');
  });
});

describe('PATCH /api/admin/reports/:id', () => {
  test('dismiss records the reviewer and note; a second review → 409', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'DISMISSED', note: 'Not enough detail' });
    expect(res.status).toBe(200);
    const saved = await prisma.report.findUnique({ where: { id: report.id } });
    expect(saved).toMatchObject({ status: 'DISMISSED', reviewedById: admin.id, reviewNote: 'Not enough detail' });
    expect(await prisma.adminAction.count({ where: { targetReportId: report.id, action: 'REPORT_DISMISSED' } })).toBe(1);

    const again = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'x' });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe('REPORT_ALREADY_RESOLVED');
  });

  test('review with a ban bans the reported user in the same step', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { host, report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'Confirmed', ban: { duration: '7D' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'REVIEWED', banned: true });
    const banned = await prisma.user.findUnique({ where: { id: host.id }, select: { banReason: true, bannedUntil: true } });
    expect(banned.banReason).toBe('NO_SHOW');
    expect(banned.bannedUntil > new Date()).toBe(true);
  });

  test('a failed ban rolls back the review', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport({ reportedIsAdmin: true });
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, { status: 'REVIEWED', note: 'x', ban: { duration: '24H' } });
    expect(res.status).toBe(409);
    expect((await prisma.report.findUnique({ where: { id: report.id } })).status).toBe('OPEN');
  });

  test.each([
    [{ status: 'DONE', note: 'x' }, 400, 'INVALID_STATUS'],
    [{ status: 'REVIEWED' }, 400, 'NOTE_REQUIRED'],
    [{ status: 'DISMISSED', note: 'x', ban: { duration: '24H' } }, 400, 'BAN_REQUIRES_REVIEWED'],
  ])('rejects %p', async (body, status, code) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const { report } = await makeReport();
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  });

  test('an admin cannot resolve a report about themselves', async () => {
    if (guard()) return;
    const { host, report } = await makeReport({ reportedIsAdmin: true });
    const res = await call('PATCH', `/api/admin/reports/${report.id}`, host.id, { status: 'DISMISSED', note: 'Not me' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
    expect((await prisma.report.findUnique({ where: { id: report.id } })).status).toBe('OPEN');
  });

  test('unknown report → 404', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('PATCH', '/api/admin/reports/nope', admin.id, { status: 'DISMISSED', note: 'x' });
    expect(res.status).toBe(404);
  });
});
