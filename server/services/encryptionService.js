const crypto = require('crypto');

// Field-level AES-256-GCM for the genuinely sensitive PII fields that are
// only ever read back for display (User.fullName, User.gender, Trip's
// address strings) — never filtered or sorted on in a Prisma `where`/
// `orderBy`, which a random-IV scheme would silently break (identical
// plaintexts never produce identical ciphertext, so equality/sorting on the
// encrypted column stops meaning anything). Confirmed by inspection before
// picking this field set — see the migration's own comment for the fields
// deliberately left alone and why (institutional email/universityId used in
// login lookups; departureTime used in ORDER BY; lat/lng used in the PSGA's
// route-overlap arithmetic).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV, the size GCM is designed around

function loadKey() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'PII_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to .env.'
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(`PII_ENCRYPTION_KEY must decode to 32 bytes (64 hex characters) for AES-256 — got ${key.length}.`);
  }
  return key;
}

// A fresh random IV per call, so encrypting the same plaintext twice (e.g.
// two users both leaving gender UNSPECIFIED) never produces the same
// ciphertext — required for GCM's security guarantees, and incidentally
// means the ciphertext itself leaks nothing about repeated values either.
// Stored as one delimited string so a single TEXT column holds everything
// decrypt needs: iv:authTag:ciphertext, each base64.
function encryptField(plaintext) {
  if (plaintext == null) return null;
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptField(stored) {
  if (stored == null) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Stored value is not in the expected iv:authTag:ciphertext format — was it ever encrypted?');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = loadKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

// Applied at each Prisma call site that fetches a User row touching
// fullName/gender, right after the query returns — downstream code then
// works with plain strings exactly as it did before encryption existed.
// Only touches keys actually present, so a `select` that omits fullName/
// gender (e.g. `select: { id: true }`) is left alone rather than throwing on
// a field that was never fetched.
function decryptUserFields(user) {
  if (!user) return user;
  const out = { ...user };
  if ('fullName' in out) out.fullName = decryptField(out.fullName);
  if ('gender' in out) out.gender = decryptField(out.gender);
  return out;
}

// Same idea for Trip's address fields.
function decryptTripFields(trip) {
  if (!trip) return trip;
  const out = { ...trip };
  if ('originAddress' in out) out.originAddress = decryptField(out.originAddress);
  if ('destinationAddress' in out) out.destinationAddress = decryptField(out.destinationAddress);
  if ('meetingPointAddress' in out) out.meetingPointAddress = decryptField(out.meetingPointAddress);
  return out;
}

module.exports = { encryptField, decryptField, decryptUserFields, decryptTripFields };
