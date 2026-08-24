const prisma = require('../config/db');

async function list(req, res) {
  const { userId, limit } = req.query;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit ? Number(limit) : undefined,
  });
  res.json({ notifications });
}

async function markRead(req, res) {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json({ notification });
}

async function create(req, res) {
  const notification = await prisma.notification.create({ data: req.body });
  res.status(201).json({ notification });
}

module.exports = { list, markRead, create };
