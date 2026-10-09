// Driver's license verification (sub-project E): uploads, state and decisions.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../config/db');
const { LICENSE_DIR } = require('../config/uploads');
const { encryptBuffer, encryptField, decryptBuffer, decryptField, decryptUserFields } = require('./encryptionService');
const { sniffImageType } = require('./imageType');
const { validateLicenseInput, licenseStateFrom, REJECT_REASONS, MAX_REJECT_NOTE } = require('./licenseRules');
const { record } = require('./adminActionService');
const { sendLicenseDecisionEmail } = require('./emailService');

// What the driver may see of their own license: never the photo or full number.
const PUBLIC_FIELDS = {
  id: true,
  status: true,
  licenseType: true,
  numberLast4: true,
  expiresOn: true,
  submittedAt: true,
  decidedAt: true,
  rejectReason: true,
  rejectNote: true,
};

function licenseRows(userId) {
  return prisma.driverLicense.findMany({ where: { userId }, orderBy: { submittedAt: 'desc' }, select: PUBLIC_FIELDS });
}

async function licenseState(userId, now = new Date()) {
  return licenseStateFrom(await licenseRows(userId), now);
}

async function myLicense(userId, now = new Date()) {
  const state = licenseStateFrom(await licenseRows(userId), now);
  return { license: state.current, verified: state.verified, canPost: state.verified, reason: state.reason };
}

function removeLicenseFile(name) {
  if (name) fs.rmSync(path.join(LICENSE_DIR, path.basename(name)), { force: true });
}

const bad = (status, body) => ({ status, body });

// ponytail: two simultaneous uploads could both pass the pending check; add a
// partial unique index (userId WHERE status = PENDING) with migrations if it matters.
async function submitLicense(userId, file, fields, now = new Date()) {
  if (!file?.buffer?.length || !sniffImageType(file.buffer)) return bad(400, { error: 'INVALID_IMAGE' });
  const checked = validateLicenseInput(fields, now);
  if (checked.error) return bad(400, checked);
  const pending = await prisma.driverLicense.findFirst({ where: { userId, status: 'PENDING' }, select: { id: true } });
  if (pending) return bad(409, { error: 'LICENSE_PENDING' });

  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  const photoFile = `${crypto.randomBytes(16).toString('hex')}.bin`;
  fs.writeFileSync(path.join(LICENSE_DIR, photoFile), encryptBuffer(file.buffer));
  try {
    const { number, last4, licenseType, expiresOn } = checked.value;
    const license = await prisma.driverLicense.create({
      data: { userId, licenseType, expiresOn, numberEnc: encryptField(number), numberLast4: last4, photoFile },
      select: PUBLIC_FIELDS,
    });
    return { status: 201, body: { license } };
  } catch (err) {
    removeLicenseFile(photoFile);
    throw err;
  }
}

// ---- Admin review ----

const REASON_TEXT = {
  UNREADABLE: 'The photo is blurry or unreadable',
  DETAILS_MISMATCH: "The number or expiry date you typed doesn't match the photo",
  EXPIRED: 'The license has expired',
  STUDENT_PERMIT: "A student permit doesn't allow carrying passengers",
  NOT_A_LICENSE: "The photo isn't a driver's license",
  NAME_MISMATCH: "The name on the license doesn't match your account",
  OTHER: 'See the note from the administrator',
};

async function pendingLicenses() {
  const rows = await prisma.driverLicense.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    include: { user: { select: { id: true, fullName: true, universityId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    licenseType: r.licenseType,
    licenseNumber: r.numberEnc ? decryptField(r.numberEnc) : null,
    expiresOn: r.expiresOn,
    submittedAt: r.submittedAt,
    user: decryptUserFields(r.user),
  }));
}

// The decrypted photo of a license still under review, or null.
async function licensePhoto(id) {
  const row = await prisma.driverLicense.findUnique({ where: { id }, select: { status: true, photoFile: true } });
  if (!row || row.status !== 'PENDING' || !row.photoFile) return null;
  const file = path.join(LICENSE_DIR, path.basename(row.photoFile));
  if (!fs.existsSync(file)) return null;
  const image = decryptBuffer(fs.readFileSync(file));
  const kind = sniffImageType(image);
  return kind ? { image, mime: kind.mime } : null;
}

// Approve or reject. The status change, the audit entry and the driver's
// notification commit together; then the photo is deleted and the email sent.
async function decideLicense(id, adminId, { approve, reason, note }, now = new Date()) {
  let cleanNote = null;
  if (!approve) {
    if (!REJECT_REASONS.includes(reason)) return bad(400, { error: 'INVALID_REASON' });
    cleanNote = typeof note === 'string' && note.trim() ? note.trim() : null;
    if (reason === 'OTHER' && !cleanNote) return bad(400, { error: 'NOTE_REQUIRED' });
    if (cleanNote && cleanNote.length > MAX_REJECT_NOTE) return bad(400, { error: 'NOTE_TOO_LONG' });
  }
  const row = await prisma.driverLicense.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!row) return bad(404, { error: 'LICENSE_NOT_FOUND' });
  if (row.userId === adminId) return bad(403, { error: 'CANNOT_TARGET_SELF' });

  const status = approve ? 'APPROVED' : 'REJECTED';
  const message = approve
    ? "Your driver's license is approved. You can post trips."
    : `Your driver's license wasn't approved: ${REASON_TEXT[reason]}.${cleanNote ? ` ${cleanNote}` : ''} You can upload it again.`;
  const decided = await prisma.$transaction(async (tx) => {
    const { count } = await tx.driverLicense.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        decidedAt: now,
        decidedById: adminId,
        numberEnc: null,
        photoFile: null,
        rejectReason: approve ? null : reason,
        rejectNote: cleanNote,
      },
    });
    if (count === 0) return false;
    await tx.notification.create({ data: { userId: row.userId, type: approve ? 'LICENSE_APPROVED' : 'LICENSE_REJECTED', message } });
    await record(tx, {
      actorId: adminId,
      action: approve ? 'LICENSE_APPROVED' : 'LICENSE_REJECTED',
      targetUserId: row.userId,
      details: { licenseId: id, ...(approve ? {} : { reason, note: cleanNote }) },
    });
    return true;
  });
  if (!decided) return bad(409, { error: 'ALREADY_DECIDED' });

  removeLicenseFile(row.photoFile);
  try {
    await sendLicenseDecisionEmail(row.user.email, { approved: approve, reasonLabel: approve ? null : REASON_TEXT[reason], note: cleanNote });
  } catch (err) {
    console.error(`[licenses] decision email failed: ${err.message}`);
  }
  return { status: 200, body: { status } };
}

module.exports = {
  licenseState,
  myLicense,
  submitLicense,
  removeLicenseFile,
  pendingLicenses,
  licensePhoto,
  decideLicense,
  PUBLIC_FIELDS,
  REASON_TEXT,
};
