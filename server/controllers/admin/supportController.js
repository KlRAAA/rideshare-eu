const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { validateMessageBody } = require('../../services/supportService');

const STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'];
const INBOX_LIMIT = 100;

const nameOf = (user) => (user ? decryptField(user.fullName) : null);

// Safety requests first, then whoever has waited longest.
function inboxOrder(a, b) {
  const safety = Number(b.category === 'SAFETY') - Number(a.category === 'SAFETY');
  return safety || new Date(a.updatedAt) - new Date(b.updatedAt);
}

// GET /api/admin/support?status=OPEN
async function listTickets(req, res) {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'OPEN';
  const rows = await prisma.supportTicket.findMany({
    where: { status },
    take: INBOX_LIMIT,
    orderBy: { updatedAt: 'asc' },
    include: { user: { select: { id: true, fullName: true } }, _count: { select: { messages: true } } },
  });
  const tickets = rows
    .map(({ user, _count, ...t }) => ({ ...t, user: { id: user.id, fullName: nameOf(user) }, messageCount: _count.messages }))
    .sort(inboxOrder);
  res.json({ tickets });
}

// GET /api/admin/support/:id
async function getTicket(req, res) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { fullName: true } } } },
    },
  });
  if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });

  const trip = ticket.relatedTripId
    ? await prisma.trip.findUnique({
        where: { id: ticket.relatedTripId },
        select: { id: true, destinationAddress: true, departureTime: true, status: true, hostId: true, host: { select: { fullName: true } } },
      })
    : null;

  res.json({
    ticket: {
      ...ticket,
      user: { ...ticket.user, fullName: nameOf(ticket.user) },
      messages: ticket.messages.map(({ author, ...m }) => ({ ...m, authorName: nameOf(author) })),
      relatedTrip: trip
        ? (({ host, ...t }) => ({ ...t, destinationAddress: decryptField(t.destinationAddress), hostName: nameOf(host) }))(trip)
        : null,
    },
  });
}

// Loads a ticket an admin may act on, or sends the error and returns null.
async function actionableTicket(req, res) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    return null;
  }
  // Same conflict-of-interest rule as reports: another admin handles it.
  if (ticket.userId === req.user.id) {
    res.status(400).json({ error: 'CANNOT_TARGET_SELF' });
    return null;
  }
  if (ticket.status === 'CLOSED') {
    res.status(409).json({ error: 'TICKET_CLOSED' });
    return null;
  }
  return ticket;
}

// POST /api/admin/support/:id/messages
async function replyToTicket(req, res) {
  const body = validateMessageBody(req.body?.body);
  if (!body) return res.status(400).json({ error: 'INVALID_MESSAGE' });
  const ticket = await actionableTicket(req, res);
  if (!ticket) return;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: req.user.id, fromAdmin: true, body } });
    const next = await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: 'ANSWERED' } });
    await tx.notification.create({
      data: { userId: ticket.userId, type: 'SUPPORT_REPLY', message: `An admin replied to your request "${ticket.subject}".` },
    });
    await record(tx, {
      actorId: req.user.id,
      action: 'SUPPORT_REPLIED',
      targetUserId: ticket.userId,
      details: { ticketId: ticket.id },
    });
    return next;
  });
  res.status(201).json({ ticket: updated });
}

// PATCH /api/admin/support/:id/close
async function closeTicket(req, res) {
  const ticket = await actionableTicket(req, res);
  if (!ticket) return;
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await record(tx, {
      actorId: req.user.id,
      action: 'SUPPORT_CLOSED',
      targetUserId: ticket.userId,
      details: { ticketId: ticket.id },
    });
    return next;
  });
  res.json({ ticket: updated });
}

module.exports = { listTickets, getTicket, replyToTicket, closeTicket };
