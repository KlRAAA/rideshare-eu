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

module.exports = { record, withNames };
