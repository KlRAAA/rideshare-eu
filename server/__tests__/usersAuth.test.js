require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

// Phase 2: GET /api/users/:id only returns `email` on your own record;
// POST /api/users/me/avatar targets the verified caller, not a body field.

let server;
let base;
let dbUp = false;
const bag = newBag();
let alice;
let bob;

// 1x1 transparent PNG — enough bytes for the magic-byte sniffer to accept.
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
  if (!dbUp) return;
  alice = await makeUser(bag, { fullName: 'Alice Ableton' });
  bob = await makeUser(bag, { fullName: 'Bob Barker' });
});

afterAll(async () => {
  if (dbUp) {
    const fresh = await prisma.user.findMany({
      where: { id: { in: bag.userIds } },
      select: { avatarUrl: true },
    });
    for (const u of fresh) {
      if (u.avatarUrl && u.avatarUrl.startsWith('/uploads/avatars/')) {
        fs.promises
          .rm(path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars', path.basename(u.avatarUrl)), { force: true })
          .catch(() => {});
      }
    }
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[usersAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('GET /api/users/:id — email visibility', () => {
  test('fetching your own record includes email', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/users/${alice.id}`, { headers: bearer(alice.id) });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.email).toBe(alice.email);
  });

  test("fetching someone else's record omits email but keeps every other field", async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/users/${bob.id}`, { headers: bearer(alice.id) });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.email).toBeUndefined();
    expect(user.fullName).toBe('Bob Barker');
    expect(user.trustScore).toBeDefined();
    expect(user.role).toBe('STUDENT');
    expect(user).toHaveProperty('tripsHosted');
    expect(user).toHaveProperty('tripsJoined');
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/users/${alice.id}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/me/avatar — targets the verified caller', () => {
  test("a body userId claiming someone else is ignored; the token's user gets the avatar", async () => {
    if (guard()) return;
    const form = new FormData();
    form.append('userId', bob.id); // spoof attempt
    form.append('avatar', new Blob([PNG_1x1], { type: 'image/png' }), 'a.png');

    const res = await fetch(`${base}/api/users/me/avatar`, {
      method: 'POST',
      headers: bearer(alice.id),
      body: form,
    });
    expect(res.status).toBe(200);

    const [freshAlice, freshBob] = await Promise.all([
      prisma.user.findUnique({ where: { id: alice.id }, select: { avatarUrl: true } }),
      prisma.user.findUnique({ where: { id: bob.id }, select: { avatarUrl: true } }),
    ]);
    expect(freshAlice.avatarUrl).toMatch(/^\/uploads\/avatars\//);
    expect(freshBob.avatarUrl).toBeNull();
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const form = new FormData();
    form.append('avatar', new Blob([PNG_1x1], { type: 'image/png' }), 'a.png');
    const res = await fetch(`${base}/api/users/me/avatar`, { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });
});
