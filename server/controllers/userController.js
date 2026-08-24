const prisma = require('../config/db');
const safeUserSelect = require('../config/safeUserSelect');

async function getById(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: safeUserSelect,
  });
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const [tripsHosted, tripsJoined] = await Promise.all([
    prisma.trip.count({ where: { hostId: user.id } }),
    prisma.match.count({ where: { passengerId: user.id, status: { in: ['APPROVED', 'COMPLETED'] } } }),
  ]);

  res.json({ user: { ...user, tripsHosted, tripsJoined } });
}

module.exports = { getById };
