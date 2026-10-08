const prisma = require('../config/db');

// Neither current caller (dashboard, notifications page) passes `limit`, so
// without a default this was an unbounded "every notification a user has
// ever received" query — increasingly expensive once REMINDER notifications
// start accumulating on a schedule rather than only from user actions.
const DEFAULT_NOTIFICATION_LIMIT = 50;

// A user's own notifications, cursor-paginated on `id` (last item of the
// previous page). `createdAt` ties are common — a REMINDER sweep or a trip
// completion can create several notifications in the same millisecond — so
// ordering also breaks ties on `id` to keep cursor seeking deterministic;
// otherwise a page boundary landing mid-tie could skip or repeat a row.
// The owner is the verified req.user.id (phase 2) — the `userId` query param
// the frontend still sends is ignored.
async function list(req, res) {
  const { limit, cursor } = req.query;
  const take = limit ? Number(limit) : DEFAULT_NOTIFICATION_LIMIT;

  // ?mode=driver|passenger (sub-project C): a notification belongs to Driver
  // mode when the user hosts its trip, to Passenger mode when it's about
  // another trip; one without a trip shows in both.
  const mode = req.query.mode === 'driver' || req.query.mode === 'passenger' ? req.query.mode : null;
  let where = { userId: req.user.id };
  let otherModeUnread;
  if (mode) {
    const hosted = (await prisma.trip.findMany({ where: { hostId: req.user.id }, select: { id: true } })).map((t) => t.id);
    const driverSide = { relatedTripId: { in: hosted } };
    const passengerSide = { relatedTripId: { not: null, notIn: hosted } };
    const [mine, other] = mode === 'driver' ? [driverSide, passengerSide] : [passengerSide, driverSide];
    where = { userId: req.user.id, OR: [mine, { relatedTripId: null }] };
    otherModeUnread = await prisma.notification.count({ where: { userId: req.user.id, isRead: false, ...other } });
  }

  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1, // one extra row just to detect whether a next page exists
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const notifications = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? notifications[notifications.length - 1].id : null;

  res.json({ notifications, nextCursor, ...(mode && { otherModeUnread }) });
}

// Mark one of your own notifications read. 404 if it doesn't exist, 403 if it
// belongs to someone else — before phase 2 there was no ownership check at all.
async function markRead(req, res) {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' });
  if (existing.userId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });

  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json({ notification });
}

module.exports = { list, markRead };
