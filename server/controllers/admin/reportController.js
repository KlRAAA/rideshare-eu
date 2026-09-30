const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { AdminError, normalizeNote, banUser, notifyBan, sendAdminError } = require('../../services/adminModerationService');

const PAGE_SIZE = 20;
const STATUSES = ['OPEN', 'REVIEWED', 'DISMISSED'];
const PERSON = { id: true, fullName: true, email: true, trustScore: true, bannedUntil: true };

const person = (p) => (p ? { ...p, fullName: decryptField(p.fullName) } : null);

async function listReports(req, res) {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'OPEN';
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const rows = await prisma.report.findMany({
    where: { status },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      reporter: { select: PERSON },
      reportedUser: { select: PERSON },
      reviewedBy: { select: { id: true, fullName: true } },
      reportedMatch: { select: { trip: { select: { id: true, destinationAddress: true, departureTime: true } } } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const reports = page.map(({ reportedMatch, reporter, reportedUser, reviewedBy, ...r }) => {
    const trip = reportedMatch?.trip;
    return {
      ...r,
      reporter: person(reporter),
      reportedUser: person(reportedUser),
      reviewedBy: person(reviewedBy),
      trip: trip ? { ...trip, destinationAddress: decryptField(trip.destinationAddress) } : null,
    };
  });
  res.json({ reports, nextCursor: hasMore ? page[page.length - 1].id : null });
}

async function reviewReport(req, res) {
  const { status, note, ban } = req.body || {};
  if (status !== 'REVIEWED' && status !== 'DISMISSED') return res.status(400).json({ error: 'INVALID_STATUS' });
  if (ban && status !== 'REVIEWED') return res.status(400).json({ error: 'BAN_REQUIRES_REVIEWED' });

  try {
    const reviewNote = normalizeNote(note, { required: true });
    const banResult = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id: req.params.id } });
      if (!report) throw new AdminError(404, 'REPORT_NOT_FOUND');
      // Conflict of interest: a report about an admin is decided by another admin.
      if (report.reportedUserId === req.user.id) throw new AdminError(400, 'CANNOT_TARGET_SELF');
      // Conditional write, so two admins resolving the same report can't both win.
      const { count } = await tx.report.updateMany({
        where: { id: report.id, status: 'OPEN' },
        data: { status, reviewedById: req.user.id, reviewedAt: new Date(), reviewNote },
      });
      if (count === 0) throw new AdminError(409, 'REPORT_ALREADY_RESOLVED');
      await record(tx, {
        actorId: req.user.id,
        action: status === 'REVIEWED' ? 'REPORT_REVIEWED' : 'REPORT_DISMISSED',
        targetUserId: report.reportedUserId,
        targetReportId: report.id,
        details: { note: reviewNote },
      });
      if (!ban) return null;
      if (!report.reportedUserId) throw new AdminError(400, 'NO_REPORTED_USER');
      return banUser(tx, {
        actorId: req.user.id,
        targetId: report.reportedUserId,
        duration: ban.duration,
        reason: report.category,
        note: reviewNote,
        reportId: report.id,
      });
    });
    if (banResult) await notifyBan(banResult);
    return res.json({ status, banned: Boolean(banResult) });
  } catch (err) {
    return sendAdminError(res, err);
  }
}

module.exports = { listReports, reviewReport };
