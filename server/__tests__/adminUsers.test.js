require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
// Bans send the ban-notification email; without SMTP_HOST the email service
// logs instead of mailing @test.local addresses (same as reports.test.js).
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

describe('user search and detail', () => {
  test('finds a user by name (decrypted) and by email', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag, { fullName: 'Zyxwv Searchable' });
    const byName = await (await call('GET', '/api/admin/users?q=zyxwv', admin.id)).json();
    expect(byName.users.map((u) => u.id)).toContain(target.id);
    const byEmail = await (await call('GET', `/api/admin/users?q=${encodeURIComponent(target.email)}`, admin.id)).json();
    expect(byEmail.users[0]).toMatchObject({ id: target.id, fullName: 'Zyxwv Searchable', isBanned: false });
  });

  test('detail returns the profile and its activity; unknown id → 404', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag, { fullName: 'Detail Target' });
    const res = await call('GET', `/api/admin/users/${target.id}`, admin.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: target.id, fullName: 'Detail Target', isAdmin: false });
    expect(body.user).not.toHaveProperty('passwordHash');
    for (const key of ['hostedTrips', 'joinedMatches', 'ratings', 'reportsReceived', 'banHistory']) {
      expect(Array.isArray(body[key])).toBe(true);
    }
    expect((await call('GET', '/api/admin/users/does-not-exist', admin.id)).status).toBe(404);
  });
});

describe('ban and unban', () => {
  test('ban locks the user out, is audited, and unban restores access', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);

    const ban = await call('POST', `/api/admin/users/${target.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER', note: 'Test' });
    expect(ban.status).toBe(200);
    const blocked = await call('GET', '/api/trips/mine', target.id);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toBe('ACCOUNT_SUSPENDED');
    const saved = await prisma.user.findUnique({ where: { id: target.id }, select: { banReason: true, banSeverity: true } });
    expect(saved).toEqual({ banReason: 'OTHER', banSeverity: 'STANDARD' });
    expect(await prisma.adminAction.count({ where: { actorId: admin.id, targetUserId: target.id, action: 'BAN' } })).toBe(1);

    expect((await call('POST', `/api/admin/users/${target.id}/unban`, admin.id, { note: 'Appeal accepted' })).status).toBe(200);
    expect((await call('GET', '/api/trips/mine', target.id)).status).toBe(200);
    expect(await prisma.adminAction.count({ where: { targetUserId: target.id, action: 'UNBAN' } })).toBe(1);
  });

  test.each([
    [{ duration: '2Y', reason: 'OTHER' }, 400, 'INVALID_DURATION'],
    [{ duration: '24H', reason: 'BAD' }, 400, 'INVALID_REASON'],
    [{ duration: '24H', reason: 'OTHER', note: 'x'.repeat(501) }, 400, 'NOTE_TOO_LONG'],
  ])('rejects %p', async (body, status, code) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const target = await makeUser(bag);
    const res = await call('POST', `/api/admin/users/${target.id}/ban`, admin.id, body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  });

  test('cannot ban yourself or another admin', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const other = await makeAdminUser(bag);
    const self = await call('POST', `/api/admin/users/${admin.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER' });
    expect(self.status).toBe(400);
    expect((await self.json()).error).toBe('CANNOT_TARGET_SELF');
    const peer = await call('POST', `/api/admin/users/${other.id}/ban`, admin.id, { duration: '24H', reason: 'OTHER' });
    expect(peer.status).toBe(409);
    expect((await peer.json()).error).toBe('TARGET_IS_ADMIN');
  });
});

describe('promote and demote', () => {
  test('promote grants admin access; demote removes it on the next request', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);

    expect((await call('POST', `/api/admin/users/${user.id}/promote`, admin.id)).status).toBe(200);
    expect((await call('GET', '/api/admin/overview', user.id)).status).toBe(200);
    const again = await call('POST', `/api/admin/users/${user.id}/promote`, admin.id);
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe('ALREADY_ADMIN');

    expect((await call('POST', `/api/admin/users/${user.id}/demote`, admin.id)).status).toBe(200);
    expect((await call('GET', '/api/admin/overview', user.id)).status).toBe(403);
    expect(await prisma.adminAction.count({ where: { targetUserId: user.id, action: { in: ['PROMOTE', 'DEMOTE'] } } })).toBe(2);
  });

  test('cannot demote yourself', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('POST', `/api/admin/users/${admin.id}/demote`, admin.id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
  });
});
