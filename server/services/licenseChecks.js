// Automatic license check (E, follow-up): does the text read from the photo
// (OCR) agree with what the driver typed? Pure. It checks consistency, not
// authenticity: there's no free LTO service to confirm a license is real.

// Letters OCR often mistakes for digits, and the reverse.
const TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };

const letters = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const digitsOnly = (s) => s.replace(/\D/g, '');
// Read every character as the digit it might be (for numbers and dates).
const asDigits = (s) => letters(s).replace(/[A-Z]/g, (c) => TO_DIGIT[c] ?? c);

// Words of the photo text, normalised; and a one-edit tolerance per word.
function words(text) {
  return text
    .toUpperCase()
    .replace(/0/g, 'O')
    .split(/[^A-Z]+/)
    .filter((w) => w.length >= 2);
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// OCR slips allowed in a name part: none in short ones (too easy to match by
// chance), one from 4 letters, two from 8.
const allowedSlips = (part) => (part.length >= 8 ? 2 : part.length >= 4 ? 1 : 0);

// A name part is on the photo as a word, as two words run together or split
// ("DELACRUZ" / "DELA CRUZ"), or inside a longer word.
function onPhoto(photoWords, part) {
  const slips = allowedSlips(part);
  const joined = photoWords.slice(1).map((w, i) => photoWords[i] + w);
  return (
    [...photoWords, ...joined].some((w) => Math.abs(w.length - part.length) <= slips && editDistance(w, part) <= slips) ||
    (part.length >= 4 && photoWords.some((w) => w.includes(part)))
  );
}

// The account's name, minus initials ("M."), must all be on the license, and
// have at least a first and a last name: a first name alone matches too many
// licenses, so it waits for an admin. Also says which parts weren't found
// (the account's own name, never the text read from the photo).
function nameCheck(photoWords, fullName) {
  const parts = words(fullName);
  if (parts.length < 2) return { nameMatch: false, nameTooShort: true };
  const missing = parts.filter((p) => !onPhoto(photoWords, p));
  return missing.length === 0 ? { nameMatch: true } : { nameMatch: false, nameMissing: missing };
}

// The typed number, read as digits, appears in the photo text read as digits.
function numberMatches(text, number) {
  const want = asDigits(number);
  return want.length >= 5 && asDigits(text).includes(want);
}

// The expiry in any common layout: 2030/01/31, 01/31/2030, 31/01/2030, 2030-01-31.
function expiryMatches(text, expiresOn) {
  const d = expiresOn.toISOString().slice(0, 10); // YYYY-MM-DD
  const [y, m, day] = d.split('-');
  const layouts = [`${y}${m}${day}`, `${m}${day}${y}`, `${day}${m}${y}`];
  const photo = digitsOnly(text.replace(/[OoQ]/g, '0'));
  return layouts.some((l) => photo.includes(l));
}

function licenseChecks(text, { fullName, number, expiresOn, licenseType }) {
  const flat = letters(text.replace(/0/g, 'O'));
  const photoWords = words(text);
  const { nameMatch, ...nameDetails } = nameCheck(photoWords, fullName);
  const checks = {
    isLicense: /LICEN[SC]E/.test(flat) && /(TRANSPORTATION|TRANSPORTAT|LTO)/.test(flat.replace(/[1]/g, 'I')),
    nameMatch,
    numberMatch: numberMatches(text, number),
    expiryMatch: expiryMatches(text, expiresOn),
    notStudentPermit: licenseType !== 'STUDENT_PERMIT' && !/STUDENTPERMIT/.test(flat),
  };
  return { ...checks, ...nameDetails, passed: Object.values(checks).every(Boolean) };
}

module.exports = { licenseChecks };
