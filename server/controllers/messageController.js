const prisma = require('../config/db');
const { decryptUserFields, decryptTripFields } = require('../services/encryptionService');

const ACTIVE_STATUSES = ['OPEN', 'FULL'];
const DEFAULT_MESSAGE_LIMIT = 50;
// Generous for a coordination message ("I'm at the gate, running 5 min
// late") while still bounded — this is a group chat, not a document editor.
const MAX_MESSAGE_LENGTH = 2000;
// How much of the message body shows up in the MESSAGE notification preview —
// a notification list row, not the chat itself, so it only needs enough to
// recognize what the message was about before opening the trip.
const NOTIFICATION_PREVIEW_LENGTH = 80;

async function loadTripForChat(tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      hostId: true,
      status: true,
      destinationAddress: true,
      matches: { select: { passengerId: true, status: true } },
    },
  });
  return trip ? decryptTripFields(trip) : trip;
}

// The chat's participant set: host + every APPROVED passenger — same
// recipient definition as reminderService's reminderRecipients and
// tripCompletionService's RATING_PROMPT recipients (host + APPROVED riders,
// never a still-PENDING requester). A passenger approved on a DIFFERENT trip
// never appears in `trip.matches` here at all, so they're excluded for free —
// no separate check needed for that case.
function isParticipant(trip, userId) {
  if (trip.hostId === userId) return true;
  return trip.matches.some((m) => m.passengerId === userId && m.status === 'APPROVED');
}

function participantIds(trip) {
  const approvedPassengerIds = trip.matches.filter((m) => m.status === 'APPROVED').map((m) => m.passengerId);
  return [trip.hostId, ...approvedPassengerIds];
}

// POST /api/trips/:id/messages — host or an APPROVED passenger, only while
// the trip is still active. Trip-state is checked BEFORE authorization,
// deliberately: this is a blanket closure ("no access ... for anyone, host
// included," not just a rule for people who used to have access), so once a
// trip is COMPLETED/CANCELLED, every caller gets the same CHAT_CLOSED —
// including a former APPROVED passenger, even though completing/cancelling a
// trip also flips their own match off APPROVED (to COMPLETED or CANCELLED),
// which would otherwise make them indistinguishable from someone who was
// merely PENDING and never actually had a seat. Checking status first avoids
// needing to reconstruct "was this really an approved rider" from a match
// status that no longer reliably encodes it.
async function postMessage(req, res) {
  const { id: tripId } = req.params;
  const userId = req.user.id;

  const trip = await loadTripForChat(tripId);
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!ACTIVE_STATUSES.includes(trip.status)) return res.status(409).json({ error: 'CHAT_CLOSED' });
  if (!isParticipant(trip, userId)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
  if (body.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });

  const messageRaw = await prisma.message.create({
    data: { tripId, senderId: userId, body },
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
  });
  const message = { ...messageRaw, sender: decryptUserFields(messageRaw.sender) };

  // Every other chat participant gets notified — the sender doesn't need a
  // notification about their own message.
  const recipientIds = participantIds(trip).filter((id) => id !== userId);
  if (recipientIds.length > 0) {
    const preview = body.length > NOTIFICATION_PREVIEW_LENGTH ? `${body.slice(0, NOTIFICATION_PREVIEW_LENGTH)}…` : body;
    await prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        userId: recipientId,
        type: 'MESSAGE',
        message: `${message.sender.fullName} in the trip to ${trip.destinationAddress}: "${preview}"`,
        relatedTripId: tripId,
      })),
    });
  }

  res.status(201).json({ message });
}

// GET /api/trips/:id/messages — same participant + active-trip checks as
// posting: once a trip is COMPLETED/CANCELLED this refuses everyone, not just
// new posts, matching the hard-cutoff access window (no read-only history).
// Cursor-paginated on `id`, same shape as notificationController.list.
async function listMessages(req, res) {
  const { id: tripId } = req.params;
  const userId = req.user.id;
  const { limit, cursor } = req.query;
  const take = limit ? Number(limit) : DEFAULT_MESSAGE_LIMIT;

  const trip = await loadTripForChat(tripId);
  if (!trip) return res.status(404).json({ error: 'TRIP_NOT_FOUND' });
  if (!ACTIVE_STATUSES.includes(trip.status)) return res.status(409).json({ error: 'CHAT_CLOSED' });
  if (!isParticipant(trip, userId)) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const rows = await prisma.message.findMany({
    where: { tripId },
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1, // one extra row just to detect whether a next (older) page exists
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const messages = (hasMore ? rows.slice(0, take) : rows).map((m) => ({ ...m, sender: decryptUserFields(m.sender) }));
  const nextCursor = hasMore ? messages[messages.length - 1].id : null;

  res.json({ messages, nextCursor });
}

module.exports = { postMessage, listMessages };
