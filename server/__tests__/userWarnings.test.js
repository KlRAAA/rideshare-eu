require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { buildWatchlist } = require('../services/watchlistService');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

// Official warnings (docs/superpowers/specs/2026-10-06-user-warnings-design.md), scenarios W-1 to W-9.

let server;
let base;
let dbUp = false;
const bag = newBag();
let admin;

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const warn = (target, body) => call('POST', `/api/admin/users/${target.id}/warnings`, admin.id, body);

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  if (dbUp) admin = await makeAdminUser(bag, { fullName: 'Warning Admin' });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.supportMessage.deleteMany({ where: { ticket: { userId: { in: bag.userIds } } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: bag.userIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;

describe('issuing a warning', () => {
  test('W-1/W-8: notification, audit entry and banner, never naming the reporter', async () => {
    if (guard()) return;
    const driver = await makeUser(bag, { fullName: 'Warned Driver' });
    const res = await warn(driver, { reason: 'SMOKING', note: 'Please keep the car smoke-free.' });
    expect(res.status).toBe(201);
    const { warning } = await res.json();
    expect(warning).toMatchObject({ userId: driver.id, reason: 'SMOKING', acknowledgedAt: null });

    const note = await prisma.notification.findFirst({ where: { userId: driver.id, type: 'WARNING' } });
    expect(note.message).toMatch(/official warning/i);
    expect(note.message).toMatch(/smoking/i);
    expect(await prisma.adminAction.count({ where: { action: 'WARNING_ISSUED', targetUserId: driver.id } })).toBe(1);

    const active = await (await call('GET', '/api/warnings/active', driver.id)).json();
    expect(active.warnings).toEqual([
      expect.objectContaining({ id: warning.id, reasonLabel: expect.any(String), note: 'Please keep the car smoke-free.' }),
    ]);
    expect(JSON.stringify(active)).not.toMatch(/issuedById|reportId|ticketId/);
  });

  test('W-3: OTHER needs a note; unknown reasons are refused', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    expect(await (await warn(user, { reason: 'OTHER' })).json()).toEqual({ error: 'NOTE_REQUIRED' });
    expect(await (await warn(user, { reason: 'RUDE' })).json()).toEqual({ error: 'INVALID_REASON' });
  });

  test('W-4: you cannot warn yourself; unknown users are 404', async () => {
    if (guard()) return;
    expect(await (await warn(admin, { reason: 'SMOKING' })).json()).toEqual({ error: 'CANNOT_TARGET_SELF' });
    expect((await warn({ id: 'does-not-exist' }, { reason: 'SMOKING' })).status).toBe(404);
  });

  test('non-admins cannot warn', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const other = await makeUser(bag);
    expect((await call('POST', `/api/admin/users/${other.id}/warnings`, user.id, { reason: 'SMOKING' })).status).toBe(403);
  });
});

describe('acknowledging', () => {
  test('W-2: the owner acknowledges; nobody else can; the banner list empties', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const stranger = await makeUser(bag);
    const { warning } = await (await warn(user, { reason: 'LATE_OR_NO_SHOW' })).json();

    expect((await call('PATCH', `/api/warnings/${warning.id}/acknowledge`, stranger.id)).status).toBe(403);
    expect((await call('PATCH', '/api/warnings/does-not-exist/acknowledge', user.id)).status).toBe(404);
    const ok = await call('PATCH', `/api/warnings/${warning.id}/acknowledge`, user.id);
    expect(ok.status).toBe(200);
    expect((await ok.json()).warning.acknowledgedAt).toEqual(expect.any(String));
    expect((await (await call('GET', '/api/warnings/active', user.id)).json()).warnings).toEqual([]);
  });
});

describe('from a support request and a report', () => {
  test('W-5: a ticket warning must target the linked trip’s driver', async () => {
    if (guard()) return;
    const rider = await makeUser(bag, { fullName: 'Ticket Rider' });
    const driver = await makeUser(bag, { fullName: 'Ticket Driver' });
    const trip = await makeTrip(bag, driver.id, (await makeVehicle(bag, driver.id)).id);
    const ticket = await prisma.supportTicket.create({
      data: { userId: rider.id, category: 'SAFETY', subject: 'Smoke in the car', relatedTripId: trip.id },
    });

    const detail = await (await call('GET', `/api/admin/support/${ticket.id}`, admin.id)).json();
    expect(detail.ticket.relatedTrip).toMatchObject({ hostId: driver.id, hostName: 'Ticket Driver' });

    expect(await (await warn(rider, { reason: 'SMOKING', ticketId: ticket.id })).json()).toEqual({
      error: 'WARNING_TARGET_MISMATCH',
    });
    const res = await warn(driver, { reason: 'SMOKING', ticketId: ticket.id });
    expect(res.status).toBe(201);
    expect((await res.json()).warning).toMatchObject({ ticketId: ticket.id, tripId: trip.id });
  });

  test('W-6: reviewing a report can send a warning, but not a warning and a ban', async () => {
    if (guard()) return;
    const reporter = await makeUser(bag);
    const reported = await makeUser(bag);
    const report = await prisma.report.create({
      data: { reporterId: reporter.id, reportedUserId: reported.id, category: 'INAPPROPRIATE_BEHAVIOR' },
    });
    const both = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, {
      status: 'REVIEWED', note: 'Rude to riders.', ban: { duration: '24H' }, warn: { reason: 'DISRESPECTFUL' },
    });
    expect(await both.json()).toEqual({ error: 'WARN_OR_BAN' });

    const res = await call('PATCH', `/api/admin/reports/${report.id}`, admin.id, {
      status: 'REVIEWED', note: 'Rude to riders.', warn: { reason: 'DISRESPECTFUL' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'REVIEWED', warned: true, banned: false });
    expect(await prisma.userWarning.findFirst({ where: { userId: reported.id, reportId: report.id } })).not.toBeNull();
    expect((await prisma.report.findUnique({ where: { id: report.id } })).status).toBe('REVIEWED');
  });
});

describe('history and the watch list', () => {
  test('W-7/W-9: two warnings flag the user; the admin page lists them', async () => {
    if (guard()) return;
    const user = await makeUser(bag, { fullName: 'Twice Warned' });
    await warn(user, { reason: 'SMOKING' });
    const { warning } = await (await warn(user, { reason: 'UNSAFE_DRIVING' })).json();
    await call('PATCH', `/api/warnings/${warning.id}/acknowledge`, user.id);

    const flag = (await buildWatchlist(new Date(Date.now() - 30 * 86400000))).find((u) => u.userId === user.id);
    expect(flag.reasons).toContain('2 warnings');

    const detail = await (await call('GET', `/api/admin/users/${user.id}`, admin.id)).json();
    expect(detail.warnings).toHaveLength(2);
    expect(detail.warnings[0]).toMatchObject({ reason: 'UNSAFE_DRIVING', issuedByName: 'Warning Admin' });
    expect(detail.warnings[0].acknowledgedAt).toEqual(expect.any(String));
    expect(detail.warnings[1].acknowledgedAt).toBeNull();
  });
});
