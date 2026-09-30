const { record } = require('./adminActionService');
const { PERMANENT_BAN_UNTIL, CATEGORY_LABELS } = require('./reportEnforcementService');
const { sendBanNotificationEmail } = require('./emailService');

const HOUR_MS = 60 * 60 * 1000;
const BAN_DURATION_HOURS = { '24H': 24, '7D': 24 * 7, '30D': 24 * 30 };
const MAX_NOTE_LENGTH = 500;

class AdminError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function normalizeNote(note, { required = false } = {}) {
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) {
    if (required) throw new AdminError(400, 'NOTE_REQUIRED');
    return null;
  }
  if (text.length > MAX_NOTE_LENGTH) throw new AdminError(400, 'NOTE_TOO_LONG');
  return text;
}

function banUntilFor(duration, now = new Date()) {
  if (duration === 'PERMANENT') return PERMANENT_BAN_UNTIL;
  const hours = BAN_DURATION_HOURS[duration];
  return hours ? new Date(now.getTime() + hours * HOUR_MS) : null;
}

async function loadTarget(tx, actorId, targetId) {
  if (actorId === targetId) throw new AdminError(400, 'CANNOT_TARGET_SELF');
  const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, isAdmin: true } });
  if (!target) throw new AdminError(404, 'USER_NOT_FOUND');
  return target;
}

async function banUser(tx, { actorId, targetId, duration, reason, note = null, reportId = null }) {
  const bannedUntil = banUntilFor(duration);
  if (!bannedUntil) throw new AdminError(400, 'INVALID_DURATION');
  if (!CATEGORY_LABELS[reason]) throw new AdminError(400, 'INVALID_REASON');
  const cleanNote = normalizeNote(note);
  const target = await loadTarget(tx, actorId, targetId);
  if (target.isAdmin) throw new AdminError(409, 'TARGET_IS_ADMIN');

  const permanent = duration === 'PERMANENT';
  await tx.user.update({
    where: { id: targetId },
    data: { bannedUntil, banReason: reason, banSeverity: permanent ? 'HIGH_ALERT' : 'STANDARD' },
  });
  await record(tx, {
    actorId,
    action: 'BAN',
    targetUserId: targetId,
    targetReportId: reportId,
    details: { duration, reason, note: cleanNote, bannedUntil: bannedUntil.toISOString() },
  });
  return { email: target.email, bannedUntil, permanent, reason };
}

// Sent after the transaction commits, so a rolled-back ban never emails anyone.
function notifyBan({ email, bannedUntil, permanent, reason }) {
  return sendBanNotificationEmail(email, { categoryLabel: CATEGORY_LABELS[reason], permanent, bannedUntil, byAdmin: true });
}

async function unbanUser(tx, { actorId, targetId, note = null }) {
  const cleanNote = normalizeNote(note);
  await loadTarget(tx, actorId, targetId);
  await tx.user.update({ where: { id: targetId }, data: { bannedUntil: null, banReason: null, banSeverity: null } });
  await record(tx, { actorId, action: 'UNBAN', targetUserId: targetId, details: { note: cleanNote } });
}

async function setAdmin(tx, { actorId, targetId, makeAdmin }) {
  const target = await loadTarget(tx, actorId, targetId);
  if (target.isAdmin === makeAdmin) throw new AdminError(409, makeAdmin ? 'ALREADY_ADMIN' : 'NOT_ADMIN');
  await tx.user.update({ where: { id: targetId }, data: { isAdmin: makeAdmin } });
  await record(tx, { actorId, action: makeAdmin ? 'PROMOTE' : 'DEMOTE', targetUserId: targetId });
}

function sendAdminError(res, err) {
  if (err instanceof AdminError) return res.status(err.status).json({ error: err.code });
  throw err;
}

module.exports = { AdminError, normalizeNote, banUser, notifyBan, unbanUser, setAdmin, sendAdminError };
