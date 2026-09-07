const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const prisma = require('../config/db');
const safeUserSelect = require('../config/safeUserSelect');
const { sniffImageType } = require('../services/imageType');

const AVATAR_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
const AVATAR_URL_PREFIX = '/uploads/avatars';

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

// "First L." from a full name, for showing who left a (non-anonymous) review
// without publishing the whole name. A single-word name is shown as-is — no
// fabricated initial.
function shortRaterName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

// GET /api/users/:id/ratings — public rating summary + the reviews this user has
// received, newest first. `raterDisplayName` is derived here, never on the
// client. For an anonymous rating the response carries NO rater-identifying
// field at all (no id, no name) — the anonymity holds even when the ratee
// themselves fetches their own profile, since this endpoint takes no viewer.
async function getRatings(req, res) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id }, select: { trustScore: true } });
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const rows = await prisma.rating.findMany({
    where: { rateeId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      score: true,
      comment: true,
      createdAt: true,
      anonymous: true,
      rater: { select: { fullName: true } },
    },
  });

  const ratings = rows.map((r) => ({
    score: r.score,
    comment: r.comment,
    createdAt: r.createdAt,
    raterDisplayName: r.anonymous ? null : shortRaterName(r.rater.fullName),
  }));

  res.json({ trustScore: user.trustScore, count: ratings.length, ratings });
}

// Sets a user's profile photo. `userId` comes from the multipart form — the same
// client-asserted identity model as every other mutation in this backend (the
// frontend only ever sends the session user's own id). The file is validated by
// its real bytes (not the extension), renamed to a server-generated UUID so a
// client filename can never cause traversal or overwrite, and the previous
// avatar file is best-effort deleted.
async function uploadAvatar(req, res) {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'MISSING_USER_ID' });
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ error: 'NO_FILE' });
  }

  const kind = sniffImageType(req.file.buffer);
  if (!kind) return res.status(400).json({ error: 'UNSUPPORTED_IMAGE_TYPE' });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, avatarUrl: true } });
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const filename = `${randomUUID()}.${kind.ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), req.file.buffer);
  const avatarUrl = `${AVATAR_URL_PREFIX}/${filename}`;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: safeUserSelect,
  });

  // Remove the file the previous avatar pointed at. A lingering old file is
  // harmless, so a failure here never fails the request.
  if (user.avatarUrl && user.avatarUrl.startsWith(`${AVATAR_URL_PREFIX}/`)) {
    try {
      await fs.promises.rm(path.join(AVATAR_DIR, path.basename(user.avatarUrl)), { force: true });
    } catch {
      /* ignore */
    }
  }

  res.json({ user: updated });
}

module.exports = { getById, getRatings, uploadAvatar };
