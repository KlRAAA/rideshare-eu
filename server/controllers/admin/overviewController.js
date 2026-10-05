const prisma = require('../../config/db');
const { withNames, redactDataActions } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { tripRunsOnSearchDate } = require('../../services/psgaService');
const { securityCounts, accountsWithFailedLogins } = require('../../services/securityEventStore');
const { buildWatchlist } = require('../../services/watchlistService');

const RECENT_ACTIONS = 10;
const ACTIONS_PAGE_SIZE = 25;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PH_OFFSET_MS = 8 * HOUR_MS;
const WATCH_WINDOW_DAYS = 30;

// Today's calendar date in the Philippines, plus that day's start and end as UTC instants.
function phToday(now) {
  const date = new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00+08:00`);
  return { date, start, end: new Date(start.getTime() + DAY_MS) };
}

// Trips with an occurrence today (one-time trips dated today, recurring trips that run today).
async function countRidesToday(now) {
  const { date, start, end } = phToday(now);
  const trips = await prisma.trip.findMany({
    where: {
      status: { in: ['OPEN', 'FULL', 'COMPLETED'] },
      departureTime: { lt: end },
      OR: [{ recurrenceType: { not: 'ONE_TIME' } }, { departureTime: { gte: start } }],
    },
    select: { departureTime: true, recurrenceType: true, customDays: true },
  });
  return trips.filter((t) => tripRunsOnSearchDate(t, date)).length;
}

const AVERAGE_DAYS = 7;
const HIGH_ALERT_CATEGORIES = ['HARASSMENT', 'SAFETY'];

// Average rides per day over the given Philippine dates, to one decimal: gives
// "rides today" a baseline so an admin can tell a quiet day from a normal one.
function averageRidesPerDay(trips, dates) {
  if (dates.length === 0) return 0;
  const total = dates.reduce((sum, date) => sum + trips.filter((t) => tripRunsOnSearchDate(t, date)).length, 0);
  return Math.round((total / dates.length) * 10) / 10;
}

// Rides per day over the 7 days before today (today itself is still in progress).
async function ridesAverage7d(now) {
  const { start } = phToday(now);
  const windowStart = new Date(start.getTime() - AVERAGE_DAYS * DAY_MS);
  const trips = await prisma.trip.findMany({
    where: {
      status: { in: ['OPEN', 'FULL', 'COMPLETED'] },
      departureTime: { lt: start },
      OR: [{ recurrenceType: { not: 'ONE_TIME' } }, { departureTime: { gte: windowStart } }],
    },
    select: { departureTime: true, recurrenceType: true, customDays: true },
  });
  const dates = Array.from({ length: AVERAGE_DAYS }, (_, i) =>
    new Date(windowStart.getTime() + i * DAY_MS + PH_OFFSET_MS).toISOString().slice(0, 10)
  );
  return averageRidesPerDay(trips, dates);
}

async function queues() {
  const [openReports, highAlertReports, oldestReport, openTickets, safetyTickets, oldestTicket] = await Promise.all([
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.report.count({ where: { status: 'OPEN', category: { in: HIGH_ALERT_CATEGORIES } } }),
    prisma.report.findFirst({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN', category: 'SAFETY' } }),
    prisma.supportTicket.findFirst({ where: { status: 'OPEN' }, orderBy: { updatedAt: 'asc' }, select: { updatedAt: true } }),
  ]);
  return {
    openReports,
    highAlertReports,
    oldestReportAt: oldestReport ? oldestReport.createdAt : null,
    openTickets,
    safetyTickets,
    oldestTicketAt: oldestTicket ? oldestTicket.updatedAt : null,
  };
}

async function security(now) {
  const since = new Date(now.getTime() - DAY_MS);
  const [counts, flagged] = await Promise.all([securityCounts(since), accountsWithFailedLogins(since)]);
  const users = flagged.length
    ? await prisma.user.findMany({ where: { id: { in: flagged.map((f) => f.userId) } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, decryptField(u.fullName)]));
  return {
    counts,
    flaggedAccounts: flagged.map((f) => ({ userId: f.userId, fullName: nameById.get(f.userId) ?? null, count: f.count })),
  };
}

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
  const [queueInfo, ridesToday, ridesAvg7d, newUsers24h, securityInfo, watchlist] = await Promise.all([
    queues(),
    countRidesToday(now),
    ridesAverage7d(now),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    security(now),
    buildWatchlist(new Date(now.getTime() - WATCH_WINDOW_DAYS * DAY_MS)),
  ]);
  // Emergency releases still waiting for the written request (superadmin only).
  const overdueDataPaperwork = req.user.isSuperAdmin
    ? await prisma.dataRequest.count({ where: { paperworkReceivedAt: null, paperworkDueAt: { lt: now } } })
    : null;
  res.json({
    counts: { users, admins, openTrips, completedTrips, pendingRequests, openReports, activeBans },
    overdueDataPaperwork,
    queues: queueInfo,
    today: { ridesToday, ridesAvg7d, newUsers24h, activeBans },
    security: securityInfo,
    watchlistCount: watchlist.length,
    errorsUrl: process.env.ADMIN_ERRORS_URL || null,
    recentActions: redactDataActions(await withNames(recent), req.user.isSuperAdmin),
  });
}

// GET /api/admin/nav-counts — the sidebar badges, read on every admin page, so
// it stays to three cheap counts (the full overview is too heavy for that).
async function navCounts(req, res) {
  const now = new Date();
  const [openReports, openTickets, overdueDataPaperwork] = await Promise.all([
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    req.user.isSuperAdmin
      ? prisma.dataRequest.count({ where: { paperworkReceivedAt: null, paperworkDueAt: { lt: now } } })
      : null,
  ]);
  res.json({ openReports, openTickets, overdueDataPaperwork });
}

// GET /api/admin/watchlist
async function watchlist(req, res) {
  const users = await buildWatchlist(new Date(Date.now() - WATCH_WINDOW_DAYS * DAY_MS));
  res.json({ users });
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
  res.json({ actions: redactDataActions(await withNames(page), req.user.isSuperAdmin), nextCursor: hasMore ? page[page.length - 1].id : null });
}

module.exports = { overview, listActions, watchlist, navCounts, averageRidesPerDay };
