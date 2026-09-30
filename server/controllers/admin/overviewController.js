const prisma = require('../../config/db');
const { withNames } = require('../../services/adminActionService');

const RECENT_ACTIONS = 10;
const ACTIONS_PAGE_SIZE = 25;

async function overview(req, res) {
  const now = new Date();
  const [users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.trip.count({ where: { status: { in: ['OPEN', 'FULL'] } } }),
    prisma.trip.count({ where: { status: 'COMPLETED' } }),
    prisma.match.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.user.count({ where: { bannedUntil: { gt: now } } }),
    prisma.adminAction.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: RECENT_ACTIONS }),
  ]);
  res.json({
    counts: { users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans },
    recentActions: await withNames(recent),
  });
}

async function listActions(req, res) {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const rows = await prisma.adminAction.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: ACTIONS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > ACTIONS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ACTIONS_PAGE_SIZE) : rows;
  res.json({ actions: await withNames(page), nextCursor: hasMore ? page[page.length - 1].id : null });
}

module.exports = { overview, listActions };
