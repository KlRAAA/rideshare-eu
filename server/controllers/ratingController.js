const prisma = require('../config/db');
const { updateTrustScore } = require('../services/trustScoreService');

async function submitRating(req, res) {
  const { id: matchId } = req.params;
  const { raterId, rateeId, score, comment } = req.body;

  const rating = await prisma.rating.create({
    data: { matchId, raterId, rateeId, score, comment },
  });

  const ratee = await prisma.user.findUnique({ where: { id: rateeId } });
  const newTrustScore = updateTrustScore(ratee.trustScore, ratee.tripCount, score);
  await prisma.user.update({
    where: { id: rateeId },
    data: { trustScore: newTrustScore, tripCount: ratee.tripCount + 1 },
  });

  res.status(201).json({ rating, updatedTrustScore: newTrustScore });
}

module.exports = { submitRating };
