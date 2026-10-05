const prisma = require('../config/db');
const { decryptField } = require('./encryptionService');

// Pass the transaction client so an admin change and its audit row commit or
// roll back together.
function record(tx, { actorId = null, action, targetUserId = null, targetTripId = null, targetReportId = null, details }) {
  return tx.adminAction.create({
    data: { actorId, action, targetUserId, targetTripId, targetReportId, details: details ?? undefined },
  });
}

async function withNames(actions) {
  const ids = [...new Set(actions.flatMap((a) => [a.actorId, a.targetUserId]).filter(Boolean))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, decryptField(u.fullName)]));
  return actions.map((a) => ({
    ...a,
    actorName: a.actorId ? nameById.get(a.actorId) ?? null : null,
    targetUserName: a.targetUserId ? nameById.get(a.targetUserId) ?? null : null,
  }));
}

// Data-request entries name the person a release was about. Only the
// superadmin sees that; other admins see that a release happened (agency,
// reference, legal basis) and nothing else (superadmin spec D11).
const DATA_ACTIONS = new Set(['DATA_RELEASED', 'DATA_RELEASE_VIEWED', 'DATA_PAPERWORK_RECEIVED']);
const VISIBLE_DATA_DETAILS = ['agency', 'referenceNumber', 'legalBasis'];

function redactDataActions(actions, isSuperAdmin) {
  if (isSuperAdmin) return actions;
  return actions.map((a) => {
    if (!DATA_ACTIONS.has(a.action)) return a;
    const details = Object.fromEntries(
      VISIBLE_DATA_DETAILS.filter((k) => a.details?.[k] != null).map((k) => [k, a.details[k]])
    );
    return { ...a, targetUserId: null, targetUserName: null, details };
  });
}

module.exports = { record, withNames, redactDataActions, DATA_ACTIONS };
