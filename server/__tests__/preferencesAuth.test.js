require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

// Phase 2: /api/preferences/:userId is a resource-ownership case — the :userId
// in the path must equal req.user.id, else 403 (not a silent redirect).

let server;
let base;
let dbUp = false;
const bag = newBag();
let alice;
let bob;

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
  alice = await makeUser(bag, { fullName: 'Alice P' });
  bob = await makeUser(bag, { fullName: 'Bob P' });
  bag.preferenceUserIds.push(alice.id, bob.id);
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[preferencesAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

const pref = (method, userId, token, body) =>
  fetch(`${base}/api/preferences/${userId}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? bearer(token) : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('GET /api/preferences/:userId', () => {
  test('your own → 200', async () => {
    if (guard()) return;
    const res = await pref('GET', alice.id, alice.id);
    expect(res.status).toBe(200);
    expect((await res.json()).preference).toBeTruthy();
  });

  test("someone else's → 403 NOT_AUTHORIZED (not redirected to your own)", async () => {
    if (guard()) return;
    const res = await pref('GET', bob.id, alice.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('NOT_AUTHORIZED');
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await pref('GET', alice.id, null);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/preferences/:userId', () => {
  test('your own → 200 and persists', async () => {
    if (guard()) return;
    const res = await pref('PATCH', alice.id, alice.id, {
      genderPreference: 'SAME_GENDER',
      flexWindowMinutes: 30,
      familiarRidersOnly: true,
      liveLocationSharing: false,
    });
    expect(res.status).toBe(200);
    const fresh = await prisma.preference.findUnique({ where: { userId: alice.id } });
    expect(fresh.genderPreference).toBe('SAME_GENDER');
  });

  test("writing someone else's → 403, their prefs untouched", async () => {
    if (guard()) return;
    const res = await pref('PATCH', bob.id, alice.id, {
      genderPreference: 'SAME_GENDER',
      flexWindowMinutes: 60,
      familiarRidersOnly: true,
      liveLocationSharing: true,
    });
    expect(res.status).toBe(403);
    const bobPref = await prisma.preference.findUnique({ where: { userId: bob.id } });
    expect(bobPref).toBeNull(); // never created
  });
});
