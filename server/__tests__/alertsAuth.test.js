require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeNotification, cleanup } = require('../test-helpers/seed');

// Phase 2: GET /api/alerts returns only the caller's own notifications;
// PATCH /api/alerts/:id/read requires ownership; POST /api/alerts is deleted.

let server;
let base;
let dbUp = false;
const bag = newBag();
let alice;
let bob;
let aliceNote;
let bobNote;

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
  alice = await makeUser(bag, { fullName: 'Alice A' });
  bob = await makeUser(bag, { fullName: 'Bob B' });
  aliceNote = await makeNotification(bag, alice.id, { message: 'for alice' });
  bobNote = await makeNotification(bag, bob.id, { message: 'for bob' });
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[alertsAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('GET /api/alerts', () => {
  test("returns only the caller's notifications, ignoring a spoofed ?userId", async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts?userId=${bob.id}`, { headers: bearer(alice.id) });
    expect(res.status).toBe(200);
    const { notifications } = await res.json();
    expect(notifications.every((n) => n.userId === alice.id)).toBe(true);
    expect(notifications.some((n) => n.id === aliceNote.id)).toBe(true);
    expect(notifications.some((n) => n.id === bobNote.id)).toBe(false);
  });

  test('no token → 401', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/alerts/:id/read', () => {
  test("marking someone else's notification read → 403, stays unread", async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts/${bobNote.id}/read`, { method: 'PATCH', headers: bearer(alice.id) });
    expect(res.status).toBe(403);
    const fresh = await prisma.notification.findUnique({ where: { id: bobNote.id } });
    expect(fresh.isRead).toBe(false);
  });

  test('unknown notification id → 404', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts/no-such-note/read`, { method: 'PATCH', headers: bearer(alice.id) });
    expect(res.status).toBe(404);
  });

  test('marking your own notification read → 200', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts/${aliceNote.id}/read`, { method: 'PATCH', headers: bearer(alice.id) });
    expect(res.status).toBe(200);
    const fresh = await prisma.notification.findUnique({ where: { id: aliceNote.id } });
    expect(fresh.isRead).toBe(true);
  });
});

describe('POST /api/alerts', () => {
  test('is gone → 404 (route deleted), even with a valid token', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(alice.id) },
      body: JSON.stringify({ userId: bob.id, type: 'REMINDER', message: 'forged' }),
    });
    expect(res.status).toBe(404);
    const count = await prisma.notification.count({ where: { message: 'forged' } });
    expect(count).toBe(0);
  });
});
