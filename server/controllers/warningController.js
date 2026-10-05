const prisma = require('../config/db');
const { forUser } = require('../services/warningService');

// GET /api/warnings/active: your warnings you haven't acknowledged yet (the dashboard banner).
async function active(req, res) {
  const rows = await prisma.userWarning.findMany({
    where: { userId: req.user.id, acknowledgedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ warnings: rows.map(forUser) });
}

// PATCH /api/warnings/:id/acknowledge: the warned user confirms they've read it.
async function acknowledge(req, res) {
  const warning = await prisma.userWarning.findUnique({ where: { id: req.params.id } });
  if (!warning) return res.status(404).json({ error: 'WARNING_NOT_FOUND' });
  if (warning.userId !== req.user.id) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
  const updated = warning.acknowledgedAt
    ? warning
    : await prisma.userWarning.update({ where: { id: warning.id }, data: { acknowledgedAt: new Date() } });
  res.json({ warning: forUser(updated) });
}

module.exports = { active, acknowledge };
