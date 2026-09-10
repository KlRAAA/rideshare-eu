const prisma = require('../config/db');

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
      liveLocationSharing: false,
    };
  }
  res.json({ preference });
}

async function upsert(req, res) {
  if (!requireSelf(req, res)) return;
  const { userId } = req.params;
  const { genderPreference, flexWindowMinutes, familiarRidersOnly, liveLocationSharing } = req.body;

  const preference = await prisma.preference.upsert({
    where: { userId },
    update: { genderPreference, flexWindowMinutes, familiarRidersOnly, liveLocationSharing },
    create: { userId, genderPreference, flexWindowMinutes, familiarRidersOnly, liveLocationSharing },
  });

  res.json({ preference });
}

module.exports = { getByUser, upsert };
