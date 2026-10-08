const prisma = require('../config/db');
const { decryptField } = require('../services/encryptionService');
const { GENDER_PREFERENCES, effectivePreference, isWomenPlusEligible } = require('../services/riderRules');

async function genderOf(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { gender: true } });
  return user ? decryptField(user.gender) : null;
}

// Preferences are a resource owned by a specific user: the :userId in the path
// must be the verified caller (phase 2). A request for someone else's :userId
// fails loudly with 403 — it is not silently redirected to the caller's own.
function requireSelf(req, res) {
  if (req.user.id !== req.params.userId) {
    res.status(403).json({ error: 'NOT_AUTHORIZED' });
    return false;
  }
  return true;
}

async function getByUser(req, res) {
  if (!requireSelf(req, res)) return;
  const { userId } = req.params;

  let preference = await prisma.preference.findUnique({ where: { userId } });
  if (!preference) {
    // Defaults match the thesis's own defaults (Profile screen, flex window 15).
    preference = {
      userId,
      genderPreference: 'ANY',
      flexWindowMinutes: 15,
      familiarRidersOnly: false,
    };
  }
  // A stale or ineligible "Trips I see" value reads as All trips (Women+ spec S24).
  const genderPreference = effectivePreference(preference.genderPreference, await genderOf(userId));
  res.json({ preference: { ...preference, genderPreference } });
}

async function upsert(req, res) {
  if (!requireSelf(req, res)) return;
  const { userId } = req.params;
  const { genderPreference, flexWindowMinutes, familiarRidersOnly } = req.body;
  if (genderPreference !== undefined && !GENDER_PREFERENCES.includes(genderPreference)) {
    return res.status(400).json({ error: 'INVALID_PREFERENCE' });
  }
  if (genderPreference === 'WOMEN_PLUS' && !isWomenPlusEligible(await genderOf(userId))) {
    return res.status(403).json({ error: 'WOMEN_PLUS_NOT_ELIGIBLE' });
  }

  const preference = await prisma.preference.upsert({
    where: { userId },
    update: { genderPreference, flexWindowMinutes, familiarRidersOnly },
    create: { userId, genderPreference, flexWindowMinutes, familiarRidersOnly },
  });

  res.json({ preference });
}

module.exports = { getByUser, upsert };
