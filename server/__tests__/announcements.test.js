require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

let server;
let base;
let dbUp = false;
const bag = newBag();
// Posting notifies every user in the database, not just this file's users,
// so every title here carries this tag and afterAll removes those notifications.
const TAG = `[test-${Date.now()}]`;

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
  if (dbUp) {
    await prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT', message: { startsWith: TAG } } });
    await cleanup(bag);
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;
const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const inOneHour = () => new Date(Date.now() + 3600 * 1000).toISOString();

describe('announcements', () => {
  test('posting notifies every user, shows as active and is audited', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const a = await makeUser(bag);
    const b = await makeUser(bag);
    const title = `${TAG} No classes tomorrow`;

    const res = await call('POST', '/api/admin/announcements', admin.id, {
      title,
      body: 'Typhoon signal no. 2. Stay safe.',
      endsAt: inOneHour(),
    });
    expect(res.status).toBe(201);
    const { announcement } = await res.json();

    for (const user of [a, b]) {
      const note = await prisma.notification.findFirst({ where: { userId: user.id, type: 'ANNOUNCEMENT' } });
      expect(note.message).toBe(`${title}: Typhoon signal no. 2. Stay safe.`);
    }
    const { announcements } = await (await call('GET', '/api/announcements/active', a.id)).json();
    expect(announcements.map((x) => x.id)).toContain(announcement.id);
    expect(await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'ANNOUNCEMENT_POSTED' } })).not.toBeNull();
  });

  test.each([
    [{ title: '', body: 'x' }, 'title'],
    [{ title: 'x'.repeat(101), body: 'x' }, 'title'],
    [{ title: 'Hi', body: '' }, 'body'],
    [{ title: 'Hi', body: 'x'.repeat(1001) }, 'body'],
    [{ title: 'Hi', body: 'x', endsAt: '2020-01-01T00:00:00Z' }, 'endsAt'],
    [{ title: 'Hi', body: 'x', endsAt: 'not a date' }, 'endsAt'],
  ])('rejects %j on field %s', async (body, field) => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const res = await call('POST', '/api/admin/announcements', admin.id, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_ANNOUNCEMENT', field });
  });

  test('an announcement past its end date or ended early is no longer active', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const { announcement } = await (
      await call('POST', '/api/admin/announcements', admin.id, { title: `${TAG} Ends early`, body: 'x' })
    ).json();

    const ended = await call('PATCH', `/api/admin/announcements/${announcement.id}/end`, admin.id);
    expect(ended.status).toBe(200);
    let active = (await (await call('GET', '/api/announcements/active', user.id)).json()).announcements;
    expect(active.map((x) => x.id)).not.toContain(announcement.id);

    const expired = await prisma.announcement.create({
      data: { title: `${TAG} Expired`, body: 'x', createdById: admin.id, endsAt: new Date(Date.now() - 60000) },
    });
    active = (await (await call('GET', '/api/announcements/active', user.id)).json()).announcements;
    expect(active.map((x) => x.id)).not.toContain(expired.id);
  });

  test('admins see the full list; regular users can’t post', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const list = await call('GET', '/api/admin/announcements', admin.id);
    expect(list.status).toBe(200);
    expect(Array.isArray((await list.json()).announcements)).toBe(true);
    const res = await call('POST', '/api/admin/announcements', user.id, { title: `${TAG} Nope`, body: 'x' });
    expect(res.status).toBe(403);
  });
});
