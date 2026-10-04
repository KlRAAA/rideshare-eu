const prisma = require('../config/db');

// Help & support: a signed-in user's request to the admins.
const SUPPORT_CATEGORIES = ['APP_PROBLEM', 'ACCOUNT', 'SAFETY', 'FUEL_SHARE', 'OTHER'];
const SUBJECT_MAX = 120;
const BODY_MAX = 2000;
// Keeps one user from flooding the inbox.
const MAX_OPEN_TICKETS = 5;
const MAX_TICKETS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function trimmedText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function validateMessageBody(body) {
  return trimmedText(body, BODY_MAX);
}

// Returns { data } or { field } naming the first bad field.
function validateTicketInput(input) {
  const src = input || {};
  if (!SUPPORT_CATEGORIES.includes(src.category)) return { field: 'category' };
  const subject = trimmedText(src.subject, SUBJECT_MAX);
  if (!subject) return { field: 'subject' };
  const body = validateMessageBody(src.body);
  if (!body) return { field: 'body' };
  if (src.relatedTripId != null && typeof src.relatedTripId !== 'string') return { field: 'relatedTripId' };
  return { data: { category: src.category, subject, body, relatedTripId: src.relatedTripId || null } };
}

// A ticket may only point at a trip the user hosts or rides on.
async function isOwnTrip(tripId, userId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { hostId: true } });
  if (!trip) return false;
  if (trip.hostId === userId) return true;
  const match = await prisma.match.findFirst({
    where: { tripId, passengerId: userId, status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] } },
    select: { id: true },
  });
  return Boolean(match);
}

async function overTicketLimit(userId, now = Date.now()) {
  const [open, today] = await Promise.all([
    prisma.supportTicket.count({ where: { userId, status: { in: ['OPEN', 'ANSWERED'] } } }),
    prisma.supportTicket.count({ where: { userId, createdAt: { gte: new Date(now - DAY_MS) } } }),
  ]);
  return open >= MAX_OPEN_TICKETS || today >= MAX_TICKETS_PER_DAY;
}

module.exports = {
  SUPPORT_CATEGORIES,
  SUBJECT_MAX,
  BODY_MAX,
  MAX_OPEN_TICKETS,
  MAX_TICKETS_PER_DAY,
  validateTicketInput,
  validateMessageBody,
  isOwnTrip,
  overTicketLimit,
};
