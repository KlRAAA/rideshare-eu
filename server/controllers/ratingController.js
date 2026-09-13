const prisma = require('../config/db');
const { updateTrustScore } = require('../services/trustScoreService');
const { utcDateOnly } = require('../services/tripCompletionService');

const MIN_SCORE = 1;
const MAX_SCORE = 5;

// POST /api/matches/:id/ratings — one party of a completed match rates the other
// 1–5, which updates the ratee's running-average trust score.
//
// Every gate here is server-enforced, not just hidden in the UI:
//   - the rater is the verified req.user.id (phase 2), never a client field
//   - the rater and rateeId must be the two real people on that match
//   - score must be an integer 1–5
//   - one rating per (match, rater, occurrenceDate) — the DB
//     @@unique([matchId, raterId, occurrenceDate]) backstops this; a repeat
//     submit for the same occurrence comes back as 409 ALREADY_RATED
//
// "Which occurrence" is the fork: a ONE_TIME trip's match reaches COMPLETED
// exactly once, so the occurrence is just its departure date and the gate is
// unchanged from before this ever supported recurrence. A recurring trip's
// APPROVED match never becomes COMPLETED — it's a standing rider across every
// occurrence — so "ratable" instead means the server itself already sent this
// rater a RATING_PROMPT for this match on the occurrenceDate they're
// submitting, which also stops a forged/arbitrary date from being accepted.
async function submitRating(req, res) {
  const { id: matchId } = req.params;
  const raterId = req.user.id;
  const { rateeId, score, comment, anonymous, occurrenceDate } = req.body;

  if (!rateeId) {
    return res.status(400).json({ error: 'MISSING_RATEE' });
  }
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    return res.status(400).json({ error: 'INVALID_SCORE' });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { trip: { select: { hostId: true, recurrenceType: true, departureTime: true } } },
  });
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

  // Participant check. raterId is the verified caller (req.user.id), so this
  // now genuinely enforces "only a party to this ride may rate the other" —
  // an authenticated non-participant hits NOT_A_PARTICIPANT here.
  const participants = [match.trip.hostId, match.passengerId];
  if (raterId === rateeId || !participants.includes(raterId) || !participants.includes(rateeId)) {
    return res.status(403).json({ error: 'NOT_A_PARTICIPANT' });
  }

  let ratingOccurrenceDate;
  if (match.trip.recurrenceType === 'ONE_TIME') {
    if (match.status !== 'COMPLETED') {
      return res.status(409).json({ error: 'TRIP_NOT_COMPLETED' });
    }
    ratingOccurrenceDate = utcDateOnly(match.trip.departureTime);
  } else {
    if (!occurrenceDate) return res.status(400).json({ error: 'MISSING_OCCURRENCE_DATE' });
    const parsed = new Date(occurrenceDate);
    if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'INVALID_OCCURRENCE_DATE' });
    ratingOccurrenceDate = utcDateOnly(parsed);

    const prompted = await prisma.notification.findFirst({
      where: {
        type: 'RATING_PROMPT',
        relatedMatchId: matchId,
        userId: raterId,
        occurrenceDate: ratingOccurrenceDate,
      },
    });
    if (!prompted) return res.status(409).json({ error: 'OCCURRENCE_NOT_RATABLE' });
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
        data: {
          matchId,
          raterId,
          rateeId,
          score,
          comment: comment ?? null,
          anonymous: anonymous === true,
          occurrenceDate: ratingOccurrenceDate,
        },
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
