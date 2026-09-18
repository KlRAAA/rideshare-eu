const prisma = require('../config/db');
const { applyBanIfWarranted } = require('../services/reportEnforcementService');

const REPORT_CATEGORIES = new Set(['SPAM', 'NO_SHOW', 'INAPPROPRIATE_BEHAVIOR', 'HARASSMENT', 'SAFETY', 'OTHER']);
const DESCRIPTION_MAX_LENGTH = 500;

// Flag, don't block — full anti-spam is out of scope. A legitimate reporter
// filing several real reports in a short window is rare enough that this just
// needs to leave a trail to notice a pattern, since there's no admin to
// review it as it happens.
const ABUSE_GUARD_WINDOW_MINUTES = 15;
const ABUSE_GUARD_THRESHOLD = 5;

// POST /api/reports — both submission flows share this endpoint:
//   - "Report a user" (from a matched user's profile): body has reportedUserId,
//     no matchId.
//   - "Report a trip/ride issue" (from a specific trip/match): body has
//     matchId; reportedUserId is derived here server-side as the other party
//     on that match, never trusted from the client.
// Response is deliberately minimal either way — no report id, no outcome —
// since the reported user must never learn a report exists, and nothing here
// is reviewed for the reporter to be told an outcome of.
async function createReport(req, res) {
  const reporterId = req.user.id;
  const { reportedUserId: bodyReportedUserId, matchId, category, description } = req.body;

  if (!REPORT_CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'INVALID_CATEGORY' });
  }
  if (description != null && (typeof description !== 'string' || description.length > DESCRIPTION_MAX_LENGTH)) {
    return res.status(400).json({ error: 'DESCRIPTION_TOO_LONG' });
  }

  let reportedUserId;
  let reportedMatchId = null;

  if (matchId) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { passengerId: true, trip: { select: { hostId: true } } },
    });
    if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
    if (reporterId !== match.trip.hostId && reporterId !== match.passengerId) {
      return res.status(403).json({ error: 'NOT_A_PARTICIPANT' });
    }
    reportedUserId = reporterId === match.trip.hostId ? match.passengerId : match.trip.hostId;
    reportedMatchId = matchId;
  } else {
    if (!bodyReportedUserId) return res.status(400).json({ error: 'MISSING_REPORTED_USER' });
    if (bodyReportedUserId === reporterId) return res.status(400).json({ error: 'CANNOT_REPORT_SELF' });

    // Same "post-match" visibility rule the rest of the app already applies to
    // sensitive matched-context info (canViewPlate/canViewLocation in
    // tripController.js) — a report requires an actual relationship, in
    // either direction, on any trip. A nonexistent target id naturally falls
    // through to NOT_MATCHED here too, with no separate existence check needed.
    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { passengerId: reporterId, trip: { hostId: bodyReportedUserId } },
          { passengerId: bodyReportedUserId, trip: { hostId: reporterId } },
        ],
      },
      select: { id: true },
    });
    if (!existingMatch) return res.status(403).json({ error: 'NOT_MATCHED' });
    reportedUserId = bodyReportedUserId;
  }

  await prisma.report.create({
    data: { reporterId, reportedUserId, reportedMatchId, category, description: description?.trim() || null },
  });

  const recentCount = await prisma.report.count({
    where: { reporterId, createdAt: { gte: new Date(Date.now() - ABUSE_GUARD_WINDOW_MINUTES * 60 * 1000) } },
  });
  if (recentCount > ABUSE_GUARD_THRESHOLD) {
    console.warn(
      `[reportController] possible report abuse: reporter ${reporterId} has filed ${recentCount} reports in the last ${ABUSE_GUARD_WINDOW_MINUTES} minutes`
    );
  }

  await applyBanIfWarranted(reportedUserId, reporterId, category);

  return res.status(201).json({ status: 'REPORT_SUBMITTED' });
}

module.exports = { createReport };
