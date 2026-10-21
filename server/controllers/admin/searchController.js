const prisma = require('../../config/db');
const { decryptField, decryptTripFields } = require('../../services/encryptionService');

// GET /api/admin/search?q= — one box for the admin console: users, open trips,
// reports, support requests and licenses waiting for review, up to 5 of each,
// each linking to the page an admin already uses for it. Nothing an admin
// can't already see there: no chats, no past trips, no released data.
// Names and addresses are encrypted with a random IV, so they're decrypted
// and matched in memory (one university's data keeps this cheap), like the
// existing user search.
const MIN_QUERY = 2;
const MAX_QUERY = 100;
const PER_GROUP = 5;

const has = (q) => (value) => typeof value === 'string' && value.toLowerCase().includes(q);

async function search(req, res) {
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, MAX_QUERY);
  if (q.length < MIN_QUERY) return res.status(400).json({ error: 'QUERY_TOO_SHORT', min: MIN_QUERY });
  const match = has(q);

  const [userRows, tripRows, reportRows, ticketRows, licenseRows] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, universityId: true, fullName: true, role: true, bannedUntil: true },
    }),
    prisma.trip.findMany({
      where: { status: { in: ['OPEN', 'FULL'] } },
      orderBy: { departureTime: 'asc' },
      select: {
        id: true,
        hostId: true,
        originAddress: true,
        destinationAddress: true,
        departureTime: true,
        status: true,
        host: { select: { fullName: true } },
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        category: true,
        status: true,
        createdAt: true,
        reporter: { select: { fullName: true } },
        reportedUser: { select: { fullName: true } },
      },
    }),
    prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: { id: true, subject: true, status: true, updatedAt: true, user: { select: { fullName: true } } },
    }),
    prisma.driverLicense.findMany({
      where: { status: 'PENDING' },
      orderBy: { submittedAt: 'asc' },
      select: { id: true, submittedAt: true, user: { select: { fullName: true } } },
    }),
  ]);

  const now = new Date();
  const users = userRows
    .map((u) => ({ ...u, fullName: decryptField(u.fullName) }))
    .filter((u) => [u.fullName, u.email, u.universityId].some(match))
    .slice(0, PER_GROUP)
    .map((u) => ({ id: u.id, fullName: u.fullName, role: u.role, banned: u.bannedUntil != null && u.bannedUntil > now }));

  const trips = tripRows
    .map((t) => ({ ...decryptTripFields(t), hostName: decryptField(t.host.fullName) }))
    .filter((t) => [t.originAddress, t.destinationAddress, t.hostName].some(match))
    .slice(0, PER_GROUP)
    .map((t) => ({
      id: t.id,
      hostId: t.hostId,
      hostName: t.hostName,
      originAddress: t.originAddress,
      destinationAddress: t.destinationAddress,
      departureTime: t.departureTime,
      status: t.status,
    }));

  const reports = reportRows
    .map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
      createdAt: r.createdAt,
      reporterName: decryptField(r.reporter.fullName),
      reportedName: r.reportedUser ? decryptField(r.reportedUser.fullName) : null,
    }))
    .filter((r) => [r.reporterName, r.reportedName, r.category].some(match))
    .slice(0, PER_GROUP);

  const tickets = ticketRows
    .map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt, userName: decryptField(t.user.fullName) }))
    .filter((t) => [t.subject, t.userName].some(match))
    .slice(0, PER_GROUP);

  const licenses = licenseRows
    .map((l) => ({ id: l.id, submittedAt: l.submittedAt, userName: decryptField(l.user.fullName) }))
    .filter((l) => match(l.userName))
    .slice(0, PER_GROUP);

  res.json({ users, trips, reports, tickets, licenses });
}

module.exports = { search, MIN_QUERY };
