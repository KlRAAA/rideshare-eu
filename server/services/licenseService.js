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
const { phDateOnly } = require('./recurrenceMath');
const { licenseChecks } = require('./licenseChecks');
const { readText, ocrEnabled, enqueue } = require('./licenseOcr');

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
  checkedAt: true,
  autoApproved: true,
  // yes/no results, plus which parts of the account's own name weren't found
  checks: true,
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
    scheduleLicenseCheck(license.id);
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
    checks: r.checks,
    user: decryptUserFields(r.user),
  }));
}

// The decrypted photo of a license still under review, or null.
async function licensePhoto(id) {
  const row = await prisma.driverLicense.findUnique({ where: { id }, select: { status: true, photoFile: true, autoApproved: true } });
  const viewable = row && row.photoFile && (row.status === 'PENDING' || (row.status === 'APPROVED' && row.autoApproved));
  if (!viewable) return null;
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

// ---- Jobs ----

const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_DAYS_BEFORE = [30, 7];

function dayLabel(day) {
  return day.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

// Daily: remind drivers 30 and 7 days before their current license expires.
async function sendLicenseExpiryReminders(now = new Date()) {
  const today = phDateOnly(now);
  const targets = REMIND_DAYS_BEFORE.map((d) => new Date(today.getTime() + d * DAY_MS));
  const due = await prisma.driverLicense.findMany({
    where: { status: 'APPROVED', expiresOn: { in: targets } },
    select: { userId: true, expiresOn: true },
  });
  if (due.length === 0) return 0;
  const userIds = [...new Set(due.map((l) => l.userId))];
  // A driver whose renewal is already approved has a later expiry: no reminder.
  const latest = await prisma.driverLicense.groupBy({
    by: ['userId'],
    where: { status: 'APPROVED', userId: { in: userIds } },
    _max: { expiresOn: true },
  });
  const latestBy = new Map(latest.map((l) => [l.userId, l._max.expiresOn.getTime()]));
  const sent = new Set(
    (
      await prisma.notification.findMany({
        where: { type: 'LICENSE_EXPIRING', userId: { in: userIds }, occurrenceDate: today },
        select: { userId: true },
      })
    ).map((n) => n.userId)
  );
  const data = due
    .filter((l) => latestBy.get(l.userId) === l.expiresOn.getTime() && !sent.has(l.userId))
    .map((l) => ({
      userId: l.userId,
      type: 'LICENSE_EXPIRING',
      occurrenceDate: today,
      message: `Your driver's license expires on ${dayLabel(l.expiresOn)} (in ${Math.round((l.expiresOn - today) / DAY_MS)} days). Upload your renewed license so you can keep posting trips.`,
    }));
  if (data.length > 0) await prisma.notification.createMany({ data });
  return data.length;
}

// One-time after the gate ships: everyone who has hosted a trip but has no
// license on file is asked to upload one. Rerunnable; `userIds` narrows it (tests).
async function notifyLicenseRequired({ userIds } = {}) {
  const users = await prisma.user.findMany({
    where: {
      ...(userIds && { id: { in: userIds } }),
      deletedAt: null,
      hostedTrips: { some: {} },
      licenses: { none: {} },
      notifications: { none: { type: 'LICENSE_REQUIRED' } },
    },
    select: { id: true },
  });
  if (users.length === 0) return 0;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'LICENSE_REQUIRED',
      message: "To post new trips, upload your driver's license for an admin to check. Your current trips keep running.",
    })),
  });
  return users.length;
}

// ---- Automatic check (OCR) ----

const SPOT_CHECK_MS = 7 * DAY_MS;

function scheduleLicenseCheck(id) {
  if (!ocrEnabled()) return;
  enqueue(() => checkLicense(id)).catch((err) => console.error(`[licenses] check failed: ${err.message}`));
}

// Reads the photo, compares it with what the driver typed, and approves the
// license when every check passes. Only the yes/no results are stored, never
// the text read from the photo.
async function checkLicense(id, now = new Date()) {
  const row = await prisma.driverLicense.findUnique({
    where: { id },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (!row || row.status !== 'PENDING' || !row.photoFile || !row.numberEnc) return;
  let checks;
  try {
    const image = decryptBuffer(fs.readFileSync(path.join(LICENSE_DIR, path.basename(row.photoFile))));
    const text = await readText(image);
    checks = licenseChecks(text, {
      fullName: decryptField(row.user.fullName),
      number: decryptField(row.numberEnc),
      expiresOn: row.expiresOn,
      licenseType: row.licenseType,
    });
  } catch {
    checks = { unreadable: true, passed: false };
  }
  if (!checks.passed) {
    await prisma.driverLicense.updateMany({ where: { id, status: 'PENDING' }, data: { checks, checkedAt: now } });
    return;
  }
  const approved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.driverLicense.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        decidedAt: now,
        decidedById: null,
        autoApproved: true,
        checks,
        checkedAt: now,
        photoKeepUntil: new Date(now.getTime() + SPOT_CHECK_MS),
      },
    });
    if (count === 0) return false;
    await tx.notification.create({
      data: { userId: row.userId, type: 'LICENSE_APPROVED', message: "Your driver's license is approved. You can post trips." },
    });
    await record(tx, { actorId: null, action: 'LICENSE_APPROVED', targetUserId: row.userId, details: { licenseId: id, automatic: true } });
    return true;
  });
  if (!approved) return;
  try {
    await sendLicenseDecisionEmail(row.user.email, { approved: true });
  } catch (err) {
    console.error(`[licenses] approval email failed: ${err.message}`);
  }
}

// Uploads the server never got to check (a restart, the demo seed): check them now.
async function checkUncheckedLicenses() {
  if (!ocrEnabled()) return 0;
  const rows = await prisma.driverLicense.findMany({
    where: { status: 'PENDING', checkedAt: null, photoFile: { not: null } },
    select: { id: true },
  });
  for (const { id } of rows) scheduleLicenseCheck(id);
  return rows.length;
}

// Automatic approvals of the last 7 days, newest first, for admin spot-checks.
async function recentAutoApproved() {
  const rows = await prisma.driverLicense.findMany({
    where: { status: 'APPROVED', autoApproved: true, photoFile: { not: null } },
    orderBy: { decidedAt: 'desc' },
    include: { user: { select: { id: true, fullName: true, universityId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    licenseType: r.licenseType,
    licenseNumber: r.numberEnc ? decryptField(r.numberEnc) : null,
    expiresOn: r.expiresOn,
    decidedAt: r.decidedAt,
    photoKeepUntil: r.photoKeepUntil,
    checks: r.checks,
    user: decryptUserFields(r.user),
  }));
}

// Withdraws an approval (a spot-check found a problem). The driver must upload again.
async function revokeLicense(id, adminId, { reason, note }, now = new Date()) {
  if (!REJECT_REASONS.includes(reason)) return bad(400, { error: 'INVALID_REASON' });
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  if (reason === 'OTHER' && !cleanNote) return bad(400, { error: 'NOTE_REQUIRED' });
  if (cleanNote && cleanNote.length > MAX_REJECT_NOTE) return bad(400, { error: 'NOTE_TOO_LONG' });
  const row = await prisma.driverLicense.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!row) return bad(404, { error: 'LICENSE_NOT_FOUND' });
  if (row.userId === adminId) return bad(403, { error: 'CANNOT_TARGET_SELF' });
  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.driverLicense.updateMany({
      where: { id, status: 'APPROVED' },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        rejectNote: cleanNote,
        decidedAt: now,
        decidedById: adminId,
        photoFile: null,
        numberEnc: null,
        photoKeepUntil: null,
      },
    });
    if (count === 0) return false;
    await tx.notification.create({
      data: {
        userId: row.userId,
        type: 'LICENSE_REJECTED',
        message: `Your driver's license approval was withdrawn: ${REASON_TEXT[reason]}.${cleanNote ? ` ${cleanNote}` : ''} Upload it again to post trips.`,
      },
    });
    await record(tx, { actorId: adminId, action: 'LICENSE_REVOKED', targetUserId: row.userId, details: { licenseId: id, reason, note: cleanNote } });
    return true;
  });
  if (!done) return bad(409, { error: 'NOT_APPROVED' });
  removeLicenseFile(row.photoFile);
  try {
    await sendLicenseDecisionEmail(row.user.email, { approved: false, reasonLabel: REASON_TEXT[reason], note: cleanNote });
  } catch (err) {
    console.error(`[licenses] revoke email failed: ${err.message}`);
  }
  return { status: 200, body: { status: 'REJECTED' } };
}

// Daily: spot-check photos older than 7 days are deleted, with the full number.
async function purgeSpotCheckPhotos(now = new Date()) {
  const rows = await prisma.driverLicense.findMany({
    where: { photoKeepUntil: { lt: now } },
    select: { id: true, photoFile: true },
  });
  for (const r of rows) removeLicenseFile(r.photoFile);
  if (rows.length) {
    await prisma.driverLicense.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { photoFile: null, numberEnc: null, photoKeepUntil: null },
    });
  }
  return rows.length;
}

module.exports = {
  scheduleLicenseCheck,
  checkLicense,
  checkUncheckedLicenses,
  recentAutoApproved,
  revokeLicense,
  purgeSpotCheckPhotos,
  sendLicenseExpiryReminders,
  notifyLicenseRequired,
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
