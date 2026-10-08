// Driver's license verification (sub-project E): uploads, state and decisions.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../config/db');
const { LICENSE_DIR } = require('../config/uploads');
const { encryptBuffer, encryptField } = require('./encryptionService');
const { sniffImageType } = require('./imageType');
const { validateLicenseInput, licenseStateFrom } = require('./licenseRules');

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

module.exports = { licenseState, myLicense, submitLicense, removeLicenseFile, PUBLIC_FIELDS };
