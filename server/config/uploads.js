const path = require('path');

// Where uploaded files live. Locally that is the Next app's public/uploads, so
// `next dev` serves them directly. In production the API runs on its own host:
// UPLOADS_DIR points at a persistent volume (e.g. /data/uploads), the API
// serves /uploads/* itself, and the website forwards /uploads/* to it.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');
const AVATAR_DIR = path.join(UPLOADS_DIR, 'avatars');

module.exports = { UPLOADS_DIR, AVATAR_DIR };
