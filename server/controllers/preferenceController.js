const prisma = require('../config/db');

async function getByUser(req, res) {
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
