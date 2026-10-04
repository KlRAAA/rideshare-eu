const prisma = require('../config/db');
const { validateTicketInput, validateMessageBody, isOwnTrip, overTicketLimit } = require('../services/supportService');

const WITH_MESSAGES = { messages: { orderBy: { createdAt: 'asc' } } };

// The caller's own ticket, or null (another user's ticket looks like a missing one).
function findOwnTicket(id, userId, include) {
  return prisma.supportTicket.findFirst({ where: { id, userId }, ...(include ? { include } : {}) });
}

// POST /api/support
async function createTicket(req, res) {
  const { data, field } = validateTicketInput(req.body);
  if (field) return res.status(400).json({ error: 'INVALID_TICKET', field });
  if (data.relatedTripId && !(await isOwnTrip(data.relatedTripId, req.user.id))) {
    return res.status(403).json({ error: 'TRIP_NOT_YOURS' });
  }
  if (await overTicketLimit(req.user.id)) return res.status(429).json({ error: 'TOO_MANY_TICKETS' });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      category: data.category,
      subject: data.subject,
      relatedTripId: data.relatedTripId,
      messages: { create: { authorId: req.user.id, fromAdmin: false, body: data.body } },
    },
    include: WITH_MESSAGES,
  });
  res.status(201).json({ ticket });
}

// GET /api/support
async function listMyTickets(req, res) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  res.json({ tickets });
}

// GET /api/support/:id
async function getMyTicket(req, res) {
  const ticket = await findOwnTicket(req.params.id, req.user.id, WITH_MESSAGES);
  if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
  res.json({ ticket });
}

// POST /api/support/:id/messages — a reply reopens an answered ticket.
async function replyToMyTicket(req, res) {
  const body = validateMessageBody(req.body?.body);
  if (!body) return res.status(400).json({ error: 'INVALID_MESSAGE' });
  const ticket = await findOwnTicket(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
  if (ticket.status === 'CLOSED') return res.status(409).json({ error: 'TICKET_CLOSED' });

  const [message, updated] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: ticket.id, authorId: req.user.id, fromAdmin: false, body } }),
    prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'OPEN' } }),
  ]);
  res.status(201).json({ message, ticket: updated });
}

// PATCH /api/support/:id/close
async function closeMyTicket(req, res) {
  const ticket = await findOwnTicket(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
  if (ticket.status === 'CLOSED') return res.status(409).json({ error: 'TICKET_CLOSED' });
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  res.json({ ticket: updated });
}

module.exports = { createTicket, listMyTickets, getMyTicket, replyToMyTicket, closeMyTicket };
