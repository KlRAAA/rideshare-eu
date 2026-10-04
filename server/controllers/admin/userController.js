const prisma = require('../../config/db');
const safeUserSelect = require('../../config/safeUserSelect');
const { decryptField, decryptUserFields, decryptTripFields } = require('../../services/encryptionService');
const { banUser, notifyBan, unbanUser, setAdmin, sendAdminError } = require('../../services/adminModerationService');

const { securityCounts } = require('../../services/securityEventStore');
const { normalizeGender } = require('../../services/riderRules');

const SEARCH_LIMIT = 50;
const DETAIL_LIMIT = 20;
const SECURITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const userSecurityCounts = (userId) => securityCounts(new Date(Date.now() - SECURITY_WINDOW_MS), userId);

// Names are AES-GCM with a random IV, so SQL can't match them — decrypt and
// filter in memory. One university's user count keeps this cheap.
async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, universityId: true, fullName: true, role: true, isAdmin: true, bannedUntil: true, avatarUrl: true, trustScore: true },
  });
  const now = new Date();
  const users = rows
    .map((u) => ({ ...u, fullName: decryptField(u.fullName), isBanned: u.bannedUntil != null && u.bannedUntil > now }))
    .filter((u) => !q || [u.email, u.universityId, u.fullName].some((field) => field.toLowerCase().includes(q)))
    .slice(0, SEARCH_LIMIT);
  res.json({ users });
}

async function getUserDetail(req, res) {
  const { id } = req.params;
  const userRaw = await prisma.user.findUnique({
    where: { id },
    select: { ...safeUserSelect, gender: true, isAdmin: true, bannedUntil: true, banReason: true, banSeverity: true, createdAt: true },
  });
  if (!userRaw) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const tripSelect = { id: true, destinationAddress: true, departureTime: true, status: true, filledSeats: true, totalSeats: true };
  const [hostedTrips, joinedMatches, ratings, reportsFiledCount, reportsReceived, banHistory, supportTickets, securityCounts30d] = await Promise.all([
    prisma.trip.findMany({ where: { hostId: id }, orderBy: { departureTime: 'desc' }, take: DETAIL_LIMIT, select: tripSelect }),
    prisma.match.findMany({
      where: { passengerId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, status: true, createdAt: true, trip: { select: tripSelect } },
    }),
    prisma.rating.findMany({
      where: { rateeId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, score: true, comment: true, createdAt: true },
    }),
    prisma.report.count({ where: { reporterId: id } }),
    prisma.report.findMany({
      where: { reportedUserId: id },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, category: true, status: true, description: true, createdAt: true },
    }),
    prisma.adminAction.findMany({
      where: { targetUserId: id, action: { in: ['BAN', 'UNBAN'] } },
      orderBy: { createdAt: 'desc' },
      take: DETAIL_LIMIT,
    }),
    prisma.supportTicket.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      take: DETAIL_LIMIT,
      select: { id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true },
    }),
    userSecurityCounts(id),
  ]);

  // Declared gender is shown to admins only, for reviewing Women+ reports (D10).
  const user = decryptUserFields(userRaw);
  res.json({
    user: { ...user, gender: normalizeGender(user.gender) },
    hostedTrips: hostedTrips.map(decryptTripFields),
    joinedMatches: joinedMatches.map((m) => ({ ...m, trip: decryptTripFields(m.trip) })),
    ratings,
    reportsFiledCount,
    reportsReceived,
    banHistory,
    supportTickets,
    securityCounts30d,
  });
}

async function ban(req, res) {
  const { duration, reason, note } = req.body || {};
  try {
    const result = await prisma.$transaction((tx) =>
      banUser(tx, { actorId: req.user.id, targetId: req.params.id, duration, reason, note })
    );
    await notifyBan(result);
    return res.json({ status: 'BANNED', bannedUntil: result.bannedUntil });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

async function unban(req, res) {
  try {
    await prisma.$transaction((tx) => unbanUser(tx, { actorId: req.user.id, targetId: req.params.id, note: req.body?.note }));
    return res.json({ status: 'UNBANNED' });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

function adminToggle(makeAdmin) {
  return async (req, res) => {
    try {
      await prisma.$transaction((tx) => setAdmin(tx, { actorId: req.user.id, targetId: req.params.id, makeAdmin }));
      return res.json({ isAdmin: makeAdmin });
    } catch (err) {
      return sendAdminError(res, err);
    }
  };
}

module.exports = { searchUsers, getUserDetail, ban, unban, promote: adminToggle(true), demote: adminToggle(false) };
