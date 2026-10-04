const prisma = require('../config/db');
const { record } = require('../services/adminActionService');
const { validateAnnouncement, announcementNotificationText } = require('../services/announcementService');

const ACTIVE_LIMIT = 3;
const ADMIN_LIST_LIMIT = 50;

const activeWhere = (now) => ({ OR: [{ endsAt: null }, { endsAt: { gt: now } }] });

// GET /api/announcements/active (any signed-in user) — newest first.
async function listActive(req, res) {
  const announcements = await prisma.announcement.findMany({
    where: activeWhere(new Date()),
    orderBy: { createdAt: 'desc' },
    take: ACTIVE_LIMIT,
    select: { id: true, title: true, body: true, createdAt: true, endsAt: true },
  });
  res.json({ announcements });
}

// GET /api/admin/announcements
async function listAll(req, res) {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: ADMIN_LIST_LIMIT,
  });
  res.json({ announcements });
}

// POST /api/admin/announcements — also notifies every account that hasn't been deleted.
async function post(req, res) {
  const { data, field } = validateAnnouncement(req.body);
  if (field) return res.status(400).json({ error: 'INVALID_ANNOUNCEMENT', field });

  const announcement = await prisma.$transaction(async (tx) => {
    const created = await tx.announcement.create({ data: { ...data, createdById: req.user.id } });
    const users = await tx.user.findMany({ where: { deletedAt: null }, select: { id: true } });
    const message = announcementNotificationText(data);
    await tx.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type: 'ANNOUNCEMENT', message })),
    });
    await record(tx, {
      actorId: req.user.id,
      action: 'ANNOUNCEMENT_POSTED',
      details: { announcementId: created.id, title: data.title, recipients: users.length },
    });
    return created;
  });
  res.status(201).json({ announcement });
}

// PATCH /api/admin/announcements/:id/end
async function end(req, res) {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'ANNOUNCEMENT_NOT_FOUND' });
  const announcement = await prisma.announcement.update({ where: { id: existing.id }, data: { endsAt: new Date() } });
  res.json({ announcement });
}

module.exports = { listActive, listAll, post, end };
