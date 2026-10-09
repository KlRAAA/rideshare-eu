require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeNotification, cleanup } = require('../test-helpers/seed');

// Push subscriptions and the live notification feed (sub-project F).

let server;
let base;
let dbUp = false;
const bag = newBag();
const req = (method, path, userId, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? bearer(userId) : {}) },
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
  if (dbUp) await cleanup(bag);
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

let n = 0;
const sub = (over = {}) => ({
  endpoint: `https://fcm.example.test/send/${Date.now()}-${n++}`,
  expirationTime: null,
  keys: { p256dh: 'BPublicKey', auth: 'authSecret' },
  ...over,
});

test('the public key is offered (or null when push is off)', async () => {
  if (guard()) return;
  const me = await makeUser(bag);
  const body = await (await req('GET', '/api/push/key', me.id)).json();
  expect(body).toHaveProperty('publicKey');
  expect(body.publicKey === null || typeof body.publicKey === 'string').toBe(true);
});

test('subscribing stores the phone; the same phone moves to the newest account; bad ones are refused', async () => {
  if (guard()) return;
  const a = await makeUser(bag);
  const b = await makeUser(bag);
  const phone = sub();
  expect((await req('POST', '/api/push/subscriptions', a.id, phone)).status).toBe(201);
  expect(await prisma.pushSubscription.findUnique({ where: { endpoint: phone.endpoint } })).toMatchObject({ userId: a.id });
  expect((await req('POST', '/api/push/subscriptions', b.id, phone)).status).toBe(201);
  expect(await prisma.pushSubscription.findUnique({ where: { endpoint: phone.endpoint } })).toMatchObject({ userId: b.id });

  for (const bad of [sub({ endpoint: 'http://insecure.example.test/x' }), sub({ keys: { p256dh: 'x' } }), { endpoint: 'https://x.test/1' }]) {
    const res = await req('POST', '/api/push/subscriptions', a.id, bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_SUBSCRIPTION');
  }
});

test('at most 10 phones each: the oldest is dropped', async () => {
  if (guard()) return;
  const me = await makeUser(bag);
  const first = sub();
  await req('POST', '/api/push/subscriptions', me.id, first);
  for (let i = 0; i < 10; i++) await req('POST', '/api/push/subscriptions', me.id, sub());
  expect(await prisma.pushSubscription.count({ where: { userId: me.id } })).toBe(10);
  expect(await prisma.pushSubscription.findUnique({ where: { endpoint: first.endpoint } })).toBeNull();
});

test('only the owner can remove a phone', async () => {
  if (guard()) return;
  const a = await makeUser(bag);
  const b = await makeUser(bag);
  const phone = sub();
  await req('POST', '/api/push/subscriptions', a.id, phone);
  expect((await req('DELETE', '/api/push/subscriptions', b.id, { endpoint: phone.endpoint })).status).toBe(204);
  expect(await prisma.pushSubscription.count({ where: { endpoint: phone.endpoint } })).toBe(1);
  expect((await req('DELETE', '/api/push/subscriptions', a.id, { endpoint: phone.endpoint })).status).toBe(204);
  expect(await prisma.pushSubscription.count({ where: { endpoint: phone.endpoint } })).toBe(0);
});

test('the feed returns what is newer than the cursor, by mode, with the unread count', async () => {
  if (guard()) return;
  const me = await makeUser(bag);
  const other = await makeUser(bag);
  const hosted = await makeTrip(bag, me.id, (await makeVehicle(bag, me.id)).id);
  const riding = await makeTrip(bag, other.id, (await makeVehicle(bag, other.id)).id);

  const first = await (await req('GET', '/api/alerts/feed?mode=passenger', me.id)).json();
  expect(first).toEqual({ notifications: [], unreadCount: 0 });
  const cursor = new Date(Date.now() - 1000).toISOString();

  const approval = await makeNotification(bag, me.id, { type: 'APPROVAL', relatedTripId: riding.id });
  await makeNotification(bag, me.id, { type: 'MATCH_REQUEST', relatedTripId: hosted.id });
  const passenger = await (await req('GET', `/api/alerts/feed?mode=passenger&after=${encodeURIComponent(cursor)}`, me.id)).json();
  expect(passenger.notifications.map((x) => x.id)).toEqual([approval.id]);
  expect(passenger.unreadCount).toBe(1);
  const all = await (await req('GET', `/api/alerts/feed?after=${encodeURIComponent(cursor)}`, me.id)).json();
  expect(all.notifications).toHaveLength(2);
  expect(all.unreadCount).toBe(2);

  const bad = await req('GET', '/api/alerts/feed?after=yesterday', me.id);
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toBe('INVALID_CURSOR');
});
