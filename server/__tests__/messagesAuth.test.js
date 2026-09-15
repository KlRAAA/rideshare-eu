require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');

// Trip group chat: one shared thread per trip (host + every APPROVED
// passenger), open only while the trip is OPEN/FULL and permanently closed
// once it's COMPLETED/CANCELLED — a hard cutoff, not a read-only archive, so
// this covers the full auth matrix for both endpoints plus the new
// closed-trip case that doesn't exist anywhere else in the codebase yet.

let server;
let base;
let dbUp = false;
const bag = newBag();

const req = (method, path, token, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? bearer(token) : {}) },
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
    await prisma.message.deleteMany({ where: { tripId: { in: bag.tripIds } } });
    await cleanup(bag);
  }
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect().catch(() => {});
});

const guard = () => {
  if (!dbUp) console.warn('[messagesAuth.test] DB unavailable — assertion not exercised this run');
  return !dbUp;
};

describe('Trip group chat auth matrix', () => {
  test('the host can post and list messages on their own active trip', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    const post = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: 'Leaving in 5' });
    expect(post.status).toBe(201);
    const { message } = await post.json();
    expect(message.body).toBe('Leaving in 5');
    expect(message.senderId).toBe(host.id);

    const list = await req('GET', `/api/trips/${trip.id}/messages`, host.id);
    expect(list.status).toBe(200);
    const { messages } = await list.json();
    expect(messages.map((m) => m.id)).toContain(message.id);
  });

  test('an APPROVED passenger can post and list messages on the trip', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const passenger = await makeUser(bag, { fullName: 'Approved Passenger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
    await makeMatch(bag, trip.id, passenger.id, { status: 'APPROVED' });

    const post = await req('POST', `/api/trips/${trip.id}/messages`, passenger.id, { body: 'On my way' });
    expect(post.status).toBe(201);

    const list = await req('GET', `/api/trips/${trip.id}/messages`, passenger.id);
    expect(list.status).toBe(200);
  });

  test('a still-PENDING passenger → 403 on both post and list', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const passenger = await makeUser(bag, { fullName: 'Pending Passenger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
    await makeMatch(bag, trip.id, passenger.id, { status: 'PENDING' });

    expect((await req('POST', `/api/trips/${trip.id}/messages`, passenger.id, { body: 'hi' })).status).toBe(403);
    expect((await req('GET', `/api/trips/${trip.id}/messages`, passenger.id)).status).toBe(403);
  });

  test('a passenger APPROVED on a different trip → 403 on this trip\'s chat', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const outsiderPassenger = await makeUser(bag, { fullName: 'Elsewhere Passenger' });
    const otherHost = await makeUser(bag, { fullName: 'Other Host' });
    const vehicle = await makeVehicle(bag, host.id);
    const otherVehicle = await makeVehicle(bag, otherHost.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
    const otherTrip = await makeTrip(bag, otherHost.id, otherVehicle.id, { status: 'OPEN' });
    await makeMatch(bag, otherTrip.id, outsiderPassenger.id, { status: 'APPROVED' });

    expect((await req('POST', `/api/trips/${trip.id}/messages`, outsiderPassenger.id, { body: 'hi' })).status).toBe(403);
    expect((await req('GET', `/api/trips/${trip.id}/messages`, outsiderPassenger.id)).status).toBe(403);
  });

  test('an unrelated authenticated user (never matched) → 403', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const stranger = await makeUser(bag, { fullName: 'Total Stranger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    expect((await req('POST', `/api/trips/${trip.id}/messages`, stranger.id, { body: 'hi' })).status).toBe(403);
    expect((await req('GET', `/api/trips/${trip.id}/messages`, stranger.id)).status).toBe(403);
  });

  test('no token → 401 on both endpoints', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    expect((await req('POST', `/api/trips/${trip.id}/messages`, null, { body: 'hi' })).status).toBe(401);
    expect((await req('GET', `/api/trips/${trip.id}/messages`, null)).status).toBe(401);
  });

  test('a COMPLETED trip → 409 CHAT_CLOSED for both the host and a formerly-approved passenger', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const passenger = await makeUser(bag, { fullName: 'Former Passenger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'COMPLETED' });
    await makeMatch(bag, trip.id, passenger.id, { status: 'COMPLETED' });

    const hostPost = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: 'too late' });
    expect(hostPost.status).toBe(409);
    expect((await hostPost.json()).error).toBe('CHAT_CLOSED');
    expect((await req('GET', `/api/trips/${trip.id}/messages`, host.id)).status).toBe(409);

    // The passenger's own match also transitions to COMPLETED alongside the
    // trip (see tripCompletionService), so this exercises the same "was a
    // real participant, chat is closed anyway" case from the other side.
    const passengerGet = await req('GET', `/api/trips/${trip.id}/messages`, passenger.id);
    expect(passengerGet.status).toBe(409);
    expect((await passengerGet.json()).error).toBe('CHAT_CLOSED');
  });

  test('the closure is blanket, not participant-scoped: a total stranger also gets CHAT_CLOSED (409), not NOT_AUTHORIZED (403)', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const stranger = await makeUser(bag, { fullName: 'Never Matched Stranger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'COMPLETED' });

    const res = await req('GET', `/api/trips/${trip.id}/messages`, stranger.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('CHAT_CLOSED');
  });

  test('a CANCELLED trip → 409 CHAT_CLOSED for both the host and a formerly-approved passenger', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const passenger = await makeUser(bag, { fullName: 'Cancelled-Trip Passenger' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'CANCELLED' });
    await makeMatch(bag, trip.id, passenger.id, { status: 'CANCELLED' });

    const hostPost = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: 'too late' });
    expect(hostPost.status).toBe(409);
    expect((await hostPost.json()).error).toBe('CHAT_CLOSED');

    const passengerList = await req('GET', `/api/trips/${trip.id}/messages`, passenger.id);
    expect(passengerList.status).toBe(409);
    expect((await passengerList.json()).error).toBe('CHAT_CLOSED');
  });
});

describe('Message body validation', () => {
  test('empty (or whitespace-only) body → 400 EMPTY_MESSAGE', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    const empty = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: '' });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toBe('EMPTY_MESSAGE');

    const whitespace = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: '   ' });
    expect(whitespace.status).toBe(400);
    expect((await whitespace.json()).error).toBe('EMPTY_MESSAGE');
  });

  test('a body over the max length → 400 MESSAGE_TOO_LONG', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    const res = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('MESSAGE_TOO_LONG');
  });

  test('a body at exactly the max length is accepted', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Host User' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });

    const res = await req('POST', `/api/trips/${trip.id}/messages`, host.id, { body: 'x'.repeat(2000) });
    expect(res.status).toBe(201);
  });
});

describe('MESSAGE notifications', () => {
  test('posting a message notifies every other participant, not the sender', async () => {
    if (guard()) return;
    const host = await makeUser(bag, { fullName: 'Notify Host' });
    const passengerA = await makeUser(bag, { fullName: 'Notify Passenger A' });
    const passengerB = await makeUser(bag, { fullName: 'Notify Passenger B' });
    const vehicle = await makeVehicle(bag, host.id);
    const trip = await makeTrip(bag, host.id, vehicle.id, { status: 'OPEN' });
    await makeMatch(bag, trip.id, passengerA.id, { status: 'APPROVED' });
    await makeMatch(bag, trip.id, passengerB.id, { status: 'APPROVED' });

    const res = await req('POST', `/api/trips/${trip.id}/messages`, passengerA.id, { body: 'Running late' });
    expect(res.status).toBe(201);

    const notifications = await prisma.notification.findMany({
      where: { type: 'MESSAGE', relatedTripId: trip.id },
    });
    const notifiedUserIds = notifications.map((n) => n.userId).sort();
    expect(notifiedUserIds).toEqual([host.id, passengerB.id].sort());
    expect(notifiedUserIds).not.toContain(passengerA.id);
    expect(notifications[0].message).toContain('Running late');
  });
});
