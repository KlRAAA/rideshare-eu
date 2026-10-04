require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeVehicle, makeTrip, makeMatch, cleanup } = require('../test-helpers/seed');
const { MAX_OPEN_TICKETS } = require('../services/supportService');

let server;
let base;
let dbUp = false;
const bag = newBag();

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
const ticketBody = (over = {}) => ({ category: 'APP_PROBLEM', subject: 'Map does not load', body: 'The map stays grey.', ...over });

describe('support tickets (user side)', () => {
  test('creating a ticket stores it as OPEN with the first message', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('POST', '/api/support', user.id, ticketBody());
    expect(res.status).toBe(201);
    const { ticket } = await res.json();
    expect(ticket).toMatchObject({ status: 'OPEN', category: 'APP_PROBLEM', subject: 'Map does not load', userId: user.id });
    expect(ticket.messages).toEqual([expect.objectContaining({ body: 'The map stays grey.', fromAdmin: false })]);
  });

  test('invalid input is rejected with the field name', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('POST', '/api/support', user.id, ticketBody({ category: 'URGENT' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_TICKET', field: 'category' });
  });

  test('a ticket can link the user’s own trip (hosted or joined) but not someone else’s', async () => {
    if (guard()) return;
    const host = await makeUser(bag);
    const rider = await makeUser(bag);
    const stranger = await makeUser(bag);
    const trip = await makeTrip(bag, host.id, (await makeVehicle(bag, host.id)).id);
    await makeMatch(bag, trip.id, rider.id, { status: 'APPROVED' });

    expect((await call('POST', '/api/support', host.id, ticketBody({ relatedTripId: trip.id }))).status).toBe(201);
    expect((await call('POST', '/api/support', rider.id, ticketBody({ relatedTripId: trip.id }))).status).toBe(201);
    const denied = await call('POST', '/api/support', stranger.id, ticketBody({ relatedTripId: trip.id }));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe('TRIP_NOT_YOURS');
  });

  test(`a user with ${MAX_OPEN_TICKETS} open tickets can't open another`, async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    for (let i = 0; i < MAX_OPEN_TICKETS; i++) {
      expect((await call('POST', '/api/support', user.id, ticketBody({ subject: `Issue ${i}` }))).status).toBe(201);
    }
    const res = await call('POST', '/api/support', user.id, ticketBody());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('TOO_MANY_TICKETS');
  });

  test('users only see their own tickets', async () => {
    if (guard()) return;
    const a = await makeUser(bag);
    const b = await makeUser(bag);
    const { ticket } = await (await call('POST', '/api/support', a.id, ticketBody())).json();

    const { tickets } = await (await call('GET', '/api/support', b.id)).json();
    expect(tickets.find((t) => t.id === ticket.id)).toBeUndefined();
    expect((await call('GET', `/api/support/${ticket.id}`, b.id)).status).toBe(404);

    const mine = await (await call('GET', '/api/support', a.id)).json();
    expect(mine.tickets.map((t) => t.id)).toContain(ticket.id);
    const one = await (await call('GET', `/api/support/${ticket.id}`, a.id)).json();
    expect(one.ticket.messages).toHaveLength(1);
  });

  test('replying to an answered ticket reopens it; a closed ticket takes no replies', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const { ticket } = await (await call('POST', '/api/support', user.id, ticketBody())).json();
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'ANSWERED' } });

    const reply = await call('POST', `/api/support/${ticket.id}/messages`, user.id, { body: 'Still broken.' });
    expect(reply.status).toBe(201);
    expect((await reply.json()).ticket.status).toBe('OPEN');

    const closed = await call('PATCH', `/api/support/${ticket.id}/close`, user.id);
    expect(closed.status).toBe(200);
    const closedTicket = (await closed.json()).ticket;
    expect(closedTicket.status).toBe('CLOSED');
    expect(closedTicket.closedAt).toEqual(expect.any(String));

    const late = await call('POST', `/api/support/${ticket.id}/messages`, user.id, { body: 'One more thing' });
    expect(late.status).toBe(409);
    expect((await late.json()).error).toBe('TICKET_CLOSED');
    expect((await call('PATCH', `/api/support/${ticket.id}/close`, user.id)).status).toBe(409);
  });

  test('an empty reply is rejected', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const { ticket } = await (await call('POST', '/api/support', user.id, ticketBody())).json();
    const res = await call('POST', `/api/support/${ticket.id}/messages`, user.id, { body: '  ' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_MESSAGE');
  });

  test('signed-out requests are refused', async () => {
    if (guard()) return;
    expect((await call('GET', '/api/support')).status).toBe(401);
  });
});
