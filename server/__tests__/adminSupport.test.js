require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { newBag, makeUser, makeAdminUser, makeVehicle, makeTrip, cleanup } = require('../test-helpers/seed');

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

async function openTicket(userId, over = {}) {
  const res = await call('POST', '/api/support', userId, {
    category: 'APP_PROBLEM',
    subject: 'Map does not load',
    body: 'The map stays grey.',
    ...over,
  });
  return (await res.json()).ticket;
}

describe('admin support inbox', () => {
  test('safety tickets come first, then the longest-waiting', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const older = await openTicket(user.id, { subject: 'Older app problem' });
    await prisma.supportTicket.update({ where: { id: older.id }, data: { updatedAt: new Date(Date.now() - 3 * 86400000) } });
    const safety = await openTicket(user.id, { category: 'SAFETY', subject: 'Driver was speeding' });

    const { tickets } = await (await call('GET', '/api/admin/support?status=OPEN', admin.id)).json();
    const ids = tickets.map((t) => t.id);
    expect(ids.indexOf(safety.id)).toBeLessThan(ids.indexOf(older.id));
    expect(tickets.find((t) => t.id === safety.id)).toMatchObject({
      category: 'SAFETY',
      user: { id: user.id, fullName: 'Test User' },
      messageCount: 1,
    });
  });

  test('ticket detail shows the conversation, the user and the linked trip', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag, { fullName: 'Maria Test' });
    const trip = await makeTrip(bag, user.id, (await makeVehicle(bag, user.id)).id, { destinationAddress: 'MSEUF Gate 2' });
    const ticket = await openTicket(user.id, { relatedTripId: trip.id });

    const res = await call('GET', `/api/admin/support/${ticket.id}`, admin.id);
    expect(res.status).toBe(200);
    const detail = (await res.json()).ticket;
    expect(detail.user).toMatchObject({ id: user.id, fullName: 'Maria Test' });
    expect(detail.relatedTrip).toMatchObject({ id: trip.id, destinationAddress: 'MSEUF Gate 2' });
    expect(detail.messages[0]).toMatchObject({ body: 'The map stays grey.', fromAdmin: false, authorName: 'Maria Test' });
  });

  test('an admin reply marks the ticket answered, notifies the user and is audited', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const ticket = await openTicket(user.id);

    const res = await call('POST', `/api/admin/support/${ticket.id}/messages`, admin.id, { body: 'Please refresh the page.' });
    expect(res.status).toBe(201);
    expect((await res.json()).ticket.status).toBe('ANSWERED');

    const note = await prisma.notification.findFirst({ where: { userId: user.id, type: 'SUPPORT_REPLY' } });
    expect(note.message).toContain('Map does not load');
    const audit = await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'SUPPORT_REPLIED' } });
    expect(audit).toMatchObject({ targetUserId: user.id, details: { ticketId: ticket.id } });

    const thread = await (await call('GET', `/api/support/${ticket.id}`, user.id)).json();
    expect(thread.ticket.messages.at(-1)).toMatchObject({ body: 'Please refresh the page.', fromAdmin: true });
  });

  test('closing is audited, and a closed ticket takes no more replies', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const ticket = await openTicket(user.id);

    const closed = await call('PATCH', `/api/admin/support/${ticket.id}/close`, admin.id);
    expect(closed.status).toBe(200);
    expect((await closed.json()).ticket.status).toBe('CLOSED');
    expect(await prisma.adminAction.findFirst({ where: { actorId: admin.id, action: 'SUPPORT_CLOSED' } })).not.toBeNull();

    const late = await call('POST', `/api/admin/support/${ticket.id}/messages`, admin.id, { body: 'Hello?' });
    expect(late.status).toBe(409);
    expect((await late.json()).error).toBe('TICKET_CLOSED');
  });

  test('an empty reply is rejected', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const user = await makeUser(bag);
    const ticket = await openTicket(user.id);
    const res = await call('POST', `/api/admin/support/${ticket.id}/messages`, admin.id, { body: '' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_MESSAGE');
  });

  test('an admin can’t answer or close their own ticket', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    const ticket = await openTicket(admin.id);
    const res = await call('POST', `/api/admin/support/${ticket.id}/messages`, admin.id, { body: 'Self reply' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('CANNOT_TARGET_SELF');
    expect((await call('PATCH', `/api/admin/support/${ticket.id}/close`, admin.id)).status).toBe(400);
  });

  test('regular users can’t use the admin inbox', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    const res = await call('GET', '/api/admin/support', user.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('ADMIN_ONLY');
  });

  test('an unknown ticket is a 404', async () => {
    if (guard()) return;
    const admin = await makeAdminUser(bag);
    expect((await call('GET', '/api/admin/support/does-not-exist', admin.id)).status).toBe(404);
  });
});
