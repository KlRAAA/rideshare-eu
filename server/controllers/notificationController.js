const prisma = require('../config/db');

// A user's own notifications. The owner is the verified req.user.id (phase 2) —
// the `userId` query param the frontend still sends is ignored.
async function list(req, res) {
  const { limit } = req.query;
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit ? Number(limit) : undefined,
  });
  res.json({ notifications });
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
