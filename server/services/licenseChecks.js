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

function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const hasWord = (photoWords, word) => photoWords.some((w) => (word.length <= 3 ? w === word : withinOneEdit(w, word)));

// Every name part of the account (2+ letters) appears on the license.
function nameMatches(photoWords, fullName) {
  const parts = words(fullName);
  return parts.length > 0 && parts.every((p) => hasWord(photoWords, p));
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
  const checks = {
    isLicense: /LICEN[SC]E/.test(flat) && /(TRANSPORTATION|TRANSPORTAT|LTO)/.test(flat.replace(/[1]/g, 'I')),
    nameMatch: nameMatches(photoWords, fullName),
    numberMatch: numberMatches(text, number),
    expiryMatch: expiryMatches(text, expiresOn),
    notStudentPermit: licenseType !== 'STUDENT_PERMIT' && !/STUDENTPERMIT/.test(flat),
  };
  return { ...checks, passed: Object.values(checks).every(Boolean) };
}

module.exports = { licenseChecks };
