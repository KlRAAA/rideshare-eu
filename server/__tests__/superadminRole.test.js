require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { makeSuperAdmin } = require('../scripts/makeSuperAdmin');
const { newBag, makeUser, makeAdminUser, cleanup } = require('../test-helpers/seed');

// Superadmin spec D4, D7 and H1–H3: one superadmin, set only by the script,
// who can't be lost by deleting the account.

let server;
let base;
let dbUp = false;
const bag = newBag();
let previous; // the dev DB's real superadmin, put back afterwards

const call = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...bearer(userId) },
    body: body === undefined ? undefined : JSON.stringify(body),
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
  if (dbUp) previous = await prisma.user.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
});

afterAll(async () => {
  if (dbUp) {
    await prisma.user.updateMany({ where: { id: { in: bag.userIds } }, data: { isSuperAdmin: false } });
    if (previous) await prisma.user.update({ where: { id: previous.id }, data: { isSuperAdmin: true } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[superadminRole.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('npm run make-superadmin', () => {
  test('H1/H2: sets one superadmin, refuses a second, hands over with --replace', async () => {
    if (guard()) return;
    if (previous) await prisma.user.update({ where: { id: previous.id }, data: { isSuperAdmin: false } });
    const first = await makeUser(bag);
    const second = await makeUser(bag);

    expect(await makeSuperAdmin(first.email)).toEqual({ already: false, replacedId: null });
    expect(await prisma.user.findUnique({ where: { id: first.id } })).toMatchObject({ isAdmin: true, isSuperAdmin: true });
    expect(await prisma.adminAction.count({ where: { action: 'SUPERADMIN_SET', targetUserId: first.id } })).toBe(1);

    await expect(makeSuperAdmin(second.email)).rejects.toThrow('SUPERADMIN_EXISTS');
    expect(await makeSuperAdmin(second.email, { replace: true })).toEqual({ already: false, replacedId: first.id });
    expect(await prisma.user.findUnique({ where: { id: first.id } })).toMatchObject({ isAdmin: true, isSuperAdmin: false });
    expect(await prisma.user.count({ where: { isSuperAdmin: true } })).toBe(1);
    expect(await makeSuperAdmin(second.email)).toEqual({ already: true, replacedId: null });
    await expect(makeSuperAdmin('nobody@test.local')).rejects.toThrow('USER_NOT_FOUND');

    await prisma.user.update({ where: { id: second.id }, data: { isSuperAdmin: false } });
  });
});

describe('the role', () => {
  test('your own profile says whether you are the superadmin; others never see it', async () => {
    if (guard()) return;
    const sa = await makeAdminUser(bag);
    await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: true } });
    const other = await makeUser(bag);
    try {
      expect((await (await call('GET', `/api/users/${sa.id}`, sa.id)).json()).user.isSuperAdmin).toBe(true);
      expect((await (await call('GET', `/api/users/${sa.id}`, other.id)).json()).user).not.toHaveProperty('isSuperAdmin');
    } finally {
      await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: false } });
    }
  });

  test('H3: the superadmin cannot delete their account', async () => {
    if (guard()) return;
    const sa = await makeAdminUser(bag);
    await prisma.user.update({
      where: { id: sa.id },
      data: { isSuperAdmin: true, passwordHash: await bcrypt.hash('Right-Pass-1', 4) },
    });
    try {
      const res = await call('DELETE', '/api/users/me', sa.id, { password: 'Right-Pass-1' });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('LAST_SUPERADMIN');
    } finally {
      await prisma.user.update({ where: { id: sa.id }, data: { isSuperAdmin: false } });
    }
  });
});
