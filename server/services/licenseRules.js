// Driver's license rules (sub-project E). Pure: no database.
const { phDateOnly } = require('./recurrenceMath');

const LICENSE_TYPES = ['NON_PROFESSIONAL', 'PROFESSIONAL', 'STUDENT_PERMIT'];
const REJECT_REASONS = ['UNREADABLE', 'DETAILS_MISMATCH', 'EXPIRED', 'STUDENT_PERMIT', 'NOT_A_LICENSE', 'NAME_MISMATCH', 'OTHER'];
const MAX_REJECT_NOTE = 300;
const NUMBER_PATTERN = /^[A-Z0-9-]{5,20}$/;

// 'YYYY-MM-DD' → that date at 00:00 UTC, or null.
function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(str) ? d : null;
}

function validateLicenseInput({ licenseNumber, licenseType, expiresOn }, now = new Date()) {
  const number = typeof licenseNumber === 'string' ? licenseNumber.trim().toUpperCase() : '';
  if (!NUMBER_PATTERN.test(number)) return { error: 'INVALID_LICENSE', field: 'licenseNumber' };
  if (!LICENSE_TYPES.includes(licenseType)) return { error: 'INVALID_LICENSE', field: 'licenseType' };
  const expires = parseDate(expiresOn);
  if (!expires) return { error: 'INVALID_LICENSE', field: 'expiresOn' };
  if (expires < phDateOnly(now)) return { error: 'LICENSE_EXPIRED' };
  return { value: { number, last4: number.slice(-4), licenseType, expiresOn: expires } };
}

// rows: the user's licenses, newest first. Verified while the newest approved
// one hasn't expired, even if a renewal is pending or was rejected meanwhile.
function licenseStateFrom(rows, now = new Date()) {
  const current = rows[0] ?? null;
  const today = phDateOnly(now);
  const approved = rows.find((r) => r.status === 'APPROVED');
  const verified = Boolean(approved && approved.expiresOn >= today);
  let reason = null;
  if (!verified) {
    if (!current) reason = 'LICENSE_REQUIRED';
    else if (current.status === 'PENDING') reason = 'LICENSE_PENDING';
    else if (current.status === 'REJECTED') reason = 'LICENSE_REJECTED';
    else reason = 'LICENSE_EXPIRED';
  }
  return { verified, status: current?.status ?? null, reason, current };
}

module.exports = { validateLicenseInput, licenseStateFrom, parseDate, LICENSE_TYPES, REJECT_REASONS, MAX_REJECT_NOTE };
