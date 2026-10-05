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
  if (!dbUp) console.warn('[superadminRole.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

// An in-memory stand-in for the two tables the script touches, so this test
// doesn't race other suites that create superadmins in the shared dev DB.
function fakeDb(users) {
  const actions = [];
  const byEmail = (email) => users.find((u) => u.email === email) ?? null;
  const tx = {
    user: {
      update: async ({ where, data }) => Object.assign(users.find((u) => u.id === where.id), data),
    },
    adminAction: { create: async ({ data }) => actions.push(data) },
  };
  return {
    actions,
    user: {
      findUnique: async ({ where }) => byEmail(where.email),
      findFirst: async () => users.find((u) => u.isSuperAdmin) ?? null,
    },
    $transaction: (fn) => fn(tx),
  };
}

describe('npm run make-superadmin', () => {
  test('H1/H2: sets one superadmin, refuses a second, hands over with --replace', async () => {
    const users = [
      { id: 'a', email: 'a@test.local', isAdmin: false, isSuperAdmin: false, deletedAt: null },
      { id: 'b', email: 'b@test.local', isAdmin: true, isSuperAdmin: false, deletedAt: null },
      { id: 'gone', email: 'gone@test.local', isAdmin: false, isSuperAdmin: false, deletedAt: new Date() },
    ];
    const db = fakeDb(users);

    expect(await makeSuperAdmin('a@test.local', { db })).toEqual({ already: false, replacedId: null });
    expect(users[0]).toMatchObject({ isAdmin: true, isSuperAdmin: true });
    expect(db.actions).toEqual([
      expect.objectContaining({ action: 'SUPERADMIN_SET', targetUserId: 'a', details: { via: 'make-superadmin script', replacedId: null } }),
    ]);

    await expect(makeSuperAdmin('b@test.local', { db })).rejects.toThrow('SUPERADMIN_EXISTS');
    expect(await makeSuperAdmin('b@test.local', { db, replace: true })).toEqual({ already: false, replacedId: 'a' });
    expect(users[0]).toMatchObject({ isAdmin: true, isSuperAdmin: false });
    expect(users.filter((u) => u.isSuperAdmin).map((u) => u.id)).toEqual(['b']);
    expect(await makeSuperAdmin('b@test.local', { db })).toEqual({ already: true, replacedId: null });
    await expect(makeSuperAdmin('nobody@test.local', { db })).rejects.toThrow('USER_NOT_FOUND');
    await expect(makeSuperAdmin('gone@test.local', { db })).rejects.toThrow('USER_NOT_FOUND');
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
