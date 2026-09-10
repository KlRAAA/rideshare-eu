const prisma = require('../config/db');
const { updateTrustScore } = require('../services/trustScoreService');

const MIN_SCORE = 1;
const MAX_SCORE = 5;

// POST /api/matches/:id/ratings — one party of a completed match rates the other
// 1–5, which updates the ratee's running-average trust score.
//
// Every gate here is server-enforced, not just hidden in the UI:
//   - the rater is the verified req.user.id (phase 2), never a client field
//   - the match must exist and be COMPLETED
//   - the rater and rateeId must be the two real people on that match
//   - score must be an integer 1–5
//   - one rating per (match, rater) — the DB @@unique([matchId, raterId])
//     backstops this; a repeat submit comes back as 409 ALREADY_RATED
async function submitRating(req, res) {
  const { id: matchId } = req.params;
  const raterId = req.user.id;
  const { rateeId, score, comment, anonymous } = req.body;

  if (!rateeId) {
    return res.status(400).json({ error: 'MISSING_RATEE' });
  }
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    return res.status(400).json({ error: 'INVALID_SCORE' });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { trip: { select: { hostId: true } } },
  });
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  if (match.status !== 'COMPLETED') {
    return res.status(409).json({ error: 'TRIP_NOT_COMPLETED' });
  }

  // Participant check. raterId is the verified caller (req.user.id), so this
  // now genuinely enforces "only a party to this completed ride may rate the
  // other" — an authenticated non-participant hits NOT_A_PARTICIPANT here.
  const participants = [match.trip.hostId, match.passengerId];
  if (raterId === rateeId || !participants.includes(raterId) || !participants.includes(rateeId)) {
    return res.status(403).json({ error: 'NOT_A_PARTICIPANT' });
  }

  try {
    const { rating, newTrustScore } = await prisma.$transaction(async (tx) => {
      const ratee = await tx.user.findUnique({
        where: { id: rateeId },
        select: { trustScore: true, tripCount: true },
      });
      const updatedScore = updateTrustScore(ratee.trustScore, ratee.tripCount, score);
      const created = await tx.rating.create({
        // anonymous only stores true for a literal `true` — any missing/other
        // value falls back to false (the schema default).
        data: { matchId, raterId, rateeId, score, comment: comment ?? null, anonymous: anonymous === true },
      });
      await tx.user.update({
        where: { id: rateeId },
        data: { trustScore: updatedScore, tripCount: { increment: 1 } },
      });
      return { rating: created, newTrustScore: updatedScore };
    });

    return res.status(201).json({ rating, updatedTrustScore: newTrustScore });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'ALREADY_RATED' });
    }
    throw err;
  }
}

module.exports = { submitRating };
