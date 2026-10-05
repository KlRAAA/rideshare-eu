const { record } = require('./adminActionService');
const { AdminError, normalizeNote } = require('./adminModerationService');
const { sendWarningEmail } = require('./emailService');

// Official warnings: the step before a suspension (docs/superpowers/specs/2026-10-06-user-warnings-design.md).
// What the warned user sees names the reason and the admin's note, never the reporter.
const REASON_TEXT = {
  SMOKING: 'Smoking in the car during a shared ride',
  UNSAFE_DRIVING: 'Unsafe driving (speeding or reckless driving)',
  LATE_OR_NO_SHOW: 'Arriving very late or not showing up for a ride',
  DISRESPECTFUL: 'Disrespectful behaviour toward other riders',
  OTHER: 'Behaviour that goes against the community rules',
};

const reasonLabel = (reason) => REASON_TEXT[reason] ?? REASON_TEXT.OTHER;

// A warning from a support request must be about that request's trip driver,
// and one from a report about the reported user (spec W7).
async function linkedContext(tx, targetId, { ticketId, reportId }) {
  if (ticketId) {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId }, select: { relatedTripId: true } });
    const trip = ticket?.relatedTripId
      ? await tx.trip.findUnique({ where: { id: ticket.relatedTripId }, select: { id: true, hostId: true } })
      : null;
    if (!trip || trip.hostId !== targetId) throw new AdminError(400, 'WARNING_TARGET_MISMATCH');
    return { ticketId, tripId: trip.id };
  }
  if (reportId) {
    const report = await tx.report.findUnique({ where: { id: reportId }, select: { reportedUserId: true } });
    if (!report || report.reportedUserId !== targetId) throw new AdminError(400, 'WARNING_TARGET_MISMATCH');
    return { reportId };
  }
  return {};
}

// Writes the warning, the user's notification and the audit entry in the caller's
// transaction. Returns what notifyWarning needs to email the user after commit.
async function issueWarning(tx, { actorId, targetId, reason, note, ticketId = null, reportId = null }) {
  if (!REASON_TEXT[reason]) throw new AdminError(400, 'INVALID_REASON');
  const cleanNote = normalizeNote(note, { required: reason === 'OTHER' });
  if (actorId === targetId) throw new AdminError(400, 'CANNOT_TARGET_SELF');
  const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, deletedAt: true } });
  if (!target || target.deletedAt) throw new AdminError(404, 'USER_NOT_FOUND');
  const context = await linkedContext(tx, targetId, { ticketId, reportId });

  const warning = await tx.userWarning.create({
    data: { userId: targetId, issuedById: actorId, reason, note: cleanNote, ...context },
  });
  await tx.notification.create({
    data: {
      userId: targetId,
      type: 'WARNING',
      message: `Official warning from RideShareEU: ${reasonLabel(reason)}. Repeated issues can lead to a suspension.`,
      relatedTripId: context.tripId ?? null,
    },
  });
  await record(tx, {
    actorId,
    action: 'WARNING_ISSUED',
    targetUserId: targetId,
    targetTripId: context.tripId ?? null,
    targetReportId: context.reportId ?? null,
    details: { reason, note: cleanNote, ticketId: context.ticketId ?? null },
  });
  return { warning, email: target.email, reason, note: cleanNote };
}

// Sent after the transaction commits, so a rolled-back warning never emails anyone.
function notifyWarning({ email, reason, note }) {
  return sendWarningEmail(email, { reasonLabel: reasonLabel(reason), note });
}

// What the warned user is shown: no issuer, report or ticket ids.
function forUser(w) {
  return { id: w.id, reason: w.reason, reasonLabel: reasonLabel(w.reason), note: w.note, createdAt: w.createdAt, acknowledgedAt: w.acknowledgedAt };
}

module.exports = { REASON_TEXT, reasonLabel, issueWarning, notifyWarning, forUser };
