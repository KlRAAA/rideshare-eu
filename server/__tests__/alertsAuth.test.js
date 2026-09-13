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

describe('GET /api/alerts pagination', () => {
  let carol;
  const startMs = new Date('2026-01-01T00:00:00Z').getTime();

  beforeAll(async () => {
    if (!dbUp) return;
    carol = await makeUser(bag, { fullName: 'Carol C' });
    // 5 notifications, 1 minute apart, so newest-first order is deterministic:
    // note 4, note 3, note 2, note 1, note 0.
    for (let i = 0; i < 5; i++) {
      await makeNotification(bag, carol.id, { message: `note ${i}`, createdAt: new Date(startMs + i * 60000) });
    }
  });

  test('first page respects limit and returns a nextCursor', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts?limit=2`, { headers: bearer(carol.id) });
    const { notifications, nextCursor } = await res.json();
    expect(notifications.map((n) => n.message)).toEqual(['note 4', 'note 3']);
    expect(nextCursor).toBe(notifications[1].id);
  });

  test('second page continues from the cursor with no repeats or gaps', async () => {
    if (guard()) return;
    const first = await (await fetch(`${base}/api/alerts?limit=2`, { headers: bearer(carol.id) })).json();
    const res = await fetch(`${base}/api/alerts?limit=2&cursor=${first.nextCursor}`, { headers: bearer(carol.id) });
    const { notifications, nextCursor } = await res.json();
    expect(notifications.map((n) => n.message)).toEqual(['note 2', 'note 1']);
    expect(nextCursor).toBe(notifications[1].id);
  });

  test('last page has no nextCursor', async () => {
    if (guard()) return;
    let cursor;
    let page;
    do {
      const url = cursor ? `${base}/api/alerts?limit=2&cursor=${cursor}` : `${base}/api/alerts?limit=2`;
      page = await (await fetch(url, { headers: bearer(carol.id) })).json();
      cursor = page.nextCursor;
    } while (cursor);
    expect(page.notifications.map((n) => n.message)).toEqual(['note 0']);
    expect(page.nextCursor).toBeNull();
  });

  test('default limit still applies with no cursor (no unbounded fetch regression)', async () => {
    if (guard()) return;
    const res = await fetch(`${base}/api/alerts`, { headers: bearer(carol.id) });
    const { notifications, nextCursor } = await res.json();
    expect(notifications).toHaveLength(5); // fewer than DEFAULT_NOTIFICATION_LIMIT, so all fit on one page
    expect(nextCursor).toBeNull();
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
