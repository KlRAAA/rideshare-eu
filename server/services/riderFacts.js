const { decryptField } = require('./encryptionService');
const { normalizeGender } = require('./riderRules');

// The facts riderRules needs about one rider and one host, read from the DB —
// never from the client. Returns null if the rider doesn't exist.
async function riderFacts(db, riderId, hostId) {
  const raw = await db.user.findUnique({ where: { id: riderId }, select: { gender: true } });
  if (!raw) return null;
  const prior =
    riderId === hostId
      ? null
      : await db.match.findFirst({
          where: { passengerId: riderId, status: 'COMPLETED', trip: { hostId } },
          select: { id: true },
        });
  return { gender: normalizeGender(decryptField(raw.gender)), familiarWithHost: prior != null };
}

module.exports = { riderFacts };
