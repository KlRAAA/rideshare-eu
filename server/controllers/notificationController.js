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

  const rows = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1, // one extra row just to detect whether a next page exists
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const notifications = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? notifications[notifications.length - 1].id : null;

  res.json({ notifications, nextCursor });
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
