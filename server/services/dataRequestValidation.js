// Checks a data request before anything is released (superadmin spec §6).
// Returns { field } for the first problem, or { value } with cleaned values.
const BASES = ['WARRANT', 'COURT_ORDER', 'SUBPOENA', 'EMERGENCY'];
// Chat messages and support requests are released only when a warrant or
// court order names them (data request policy §5).
const CONTENT_BASES = ['WARRANT', 'COURT_ORDER'];
const TEXT_MAX = 200;
const NOTE_MAX = 1000;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

// A Philippine calendar day (UTC+8, no daylight saving) to its first or last instant.
function phDay(day, time) {
  if (typeof day !== 'string' || !DATE_RE.test(day)) return null;
  const date = new Date(`${day}T${time}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateDates(body, value) {
  if (value.legalBasis === 'EMERGENCY') {
    value.fromDate = null;
    value.toDate = null;
    return null;
  }
  value.fromDate = phDay(body.fromDate, '00:00:00.000');
  if (!value.fromDate) return 'fromDate';
  value.toDate = phDay(body.toDate, '23:59:59.999');
  if (!value.toDate || value.toDate < value.fromDate || value.toDate - value.fromDate > MAX_RANGE_MS) return 'toDate';
  return null;
}

function validateDataRequest(body = {}) {
  const value = {};
  for (const field of ['subjectUserId', 'agency', 'officerName', 'officerContact', 'referenceNumber']) {
    value[field] = text(body[field], TEXT_MAX);
    if (!value[field]) return { field };
  }
  if (!BASES.includes(body.legalBasis)) return { field: 'legalBasis' };
  value.legalBasis = body.legalBasis;
  value.verificationNote = text(body.verificationNote, NOTE_MAX);
  if (!value.verificationNote) return { field: 'verificationNote' };

  const badDate = validateDates(body, value);
  if (badDate) return { field: badDate };

  for (const flag of ['includeChats', 'includeSupport']) {
    value[flag] = body[flag] === true;
    if (value[flag] && !CONTENT_BASES.includes(value.legalBasis)) return { field: flag };
  }
  return { value };
}

module.exports = { validateDataRequest, BASES };
