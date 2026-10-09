require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { newBag, makeUser, makeVehicle, makeTrip, makeNotification, cleanup } = require('../test-helpers/seed');
const { sendPendingPushes } = require('../services/pushService');

// The push outbox (sub-project F): loud, recent notifications go to each of the
// user's phones once. A fake sender stands in for web-push.

let dbUp = false;
const bag = newBag();
beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});
afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});
const guard = () => !dbUp;

let n = 0;
const subscribe = (userId) =>
  prisma.pushSubscription.create({
    data: { userId, endpoint: `https://push.example.test/${Date.now()}-${n++}`, p256dh: 'p', auth: 'a' },
  });
function fakeSender(failFor = new Set()) {
  const calls = [];
  const send = async (sub, payload) => {
    calls.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    if (failFor.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
  };
  return { calls, send };
}

test('a loud notification reaches every phone once, with a title and a link', async () => {
  if (guard()) return;
  const rider = await makeUser(bag);
  const host = await makeUser(bag);
  const trip = await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id);
  await subscribe(rider.id);
  await subscribe(rider.id);
  const note = await makeNotification(bag, rider.id, {
    type: 'APPROVAL',
    message: 'Your request to join the trip to MSEUF has been approved.',
    relatedTripId: trip.id,
  });

  const fake = fakeSender();
  expect(await sendPendingPushes({ send: fake.send, userIds: [rider.id] })).toBe(2);
  expect(fake.calls).toHaveLength(2);
  expect(fake.calls[0].payload).toEqual({
    title: 'Request approved',
    body: 'Your request to join the trip to MSEUF has been approved.',
    url: `/auth/trips/${trip.id}`,
    tag: note.id,
  });
  expect((await prisma.notification.findUnique({ where: { id: note.id } })).pushedAt).toBeInstanceOf(Date);

  const again = fakeSender();
  await sendPendingPushes({ send: again.send, userIds: [rider.id] });
  expect(again.calls).toHaveLength(0);
});

test('quiet and old notifications are never pushed; chat is grouped per trip', async () => {
  if (guard()) return;
  const user = await makeUser(bag);
  const host = await makeUser(bag);
  const trip = await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id);
  await subscribe(user.id);
  const quiet = await makeNotification(bag, user.id, { type: 'RATING_PROMPT', relatedTripId: trip.id });
  const old = await makeNotification(bag, user.id, { type: 'TRIP_STARTED', relatedTripId: trip.id });
  await prisma.notification.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } });
  await makeNotification(bag, user.id, { type: 'MESSAGE', message: 'Juan: see you at 7', relatedTripId: trip.id });

  const fake = fakeSender();
  await sendPendingPushes({ send: fake.send, userIds: [user.id] });
  expect(fake.calls.map((c) => c.payload.tag)).toEqual([`chat-${trip.id}`]);
  expect(fake.calls[0].payload.title).toBe('New message');
  expect((await prisma.notification.findUnique({ where: { id: quiet.id } })).pushedAt).toBeNull();
});

test('a phone the push service says is gone is removed; users without phones are marked done', async () => {
  if (guard()) return;
  const user = await makeUser(bag);
  const gone = await subscribe(user.id);
  const kept = await subscribe(user.id);
  await makeNotification(bag, user.id, { type: 'DRIVER_LATE', message: 'Juan hasn’t started yet.' });
  const lonely = await makeUser(bag);
  const unsent = await makeNotification(bag, lonely.id, { type: 'TRIP_STARTED' });

  const fake = fakeSender(new Set([gone.endpoint]));
  await sendPendingPushes({ send: fake.send, userIds: [user.id, lonely.id] });
  expect(await prisma.pushSubscription.findUnique({ where: { id: gone.id } })).toBeNull();
  expect((await prisma.pushSubscription.findUnique({ where: { id: kept.id } })).lastUsedAt).toBeInstanceOf(Date);
  expect((await prisma.notification.findUnique({ where: { id: unsent.id } })).pushedAt).toBeInstanceOf(Date);
});
