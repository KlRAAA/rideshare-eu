require('dotenv').config({ quiet: true });
const { validateLicenseInput, licenseStateFrom } = require('../licenseRules');
const { encryptBuffer, decryptBuffer } = require('../encryptionService');

const NOW = new Date('2026-10-09T04:00:00Z'); // 9 Oct, noon PH
const ok = { licenseNumber: 'n01-23-456789', licenseType: 'NON_PROFESSIONAL', expiresOn: '2030-01-31' };

test('a valid license is normalised', () => {
  expect(validateLicenseInput(ok, NOW).value).toEqual({
    number: 'N01-23-456789',
    last4: '6789',
    licenseType: 'NON_PROFESSIONAL',
    expiresOn: new Date('2030-01-31T00:00:00Z'),
  });
});

test('each field is checked', () => {
  expect(validateLicenseInput({ ...ok, licenseNumber: 'ab' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseNumber' });
  expect(validateLicenseInput({ ...ok, licenseNumber: 'N01 23' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseNumber' });
  expect(validateLicenseInput({ ...ok, licenseNumber: undefined }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseNumber' });
  expect(validateLicenseInput({ ...ok, licenseType: 'PILOT' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseType' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2030-02-30' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'expiresOn' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2026-10-08' }, NOW)).toEqual({ error: 'LICENSE_EXPIRED' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2026-10-09' }, NOW).value).toBeDefined(); // valid through today
});

test('state follows the newest row; an earlier valid approval still counts', () => {
  const row = (status, expiresOn = '2030-01-31') => ({ status, expiresOn: new Date(`${expiresOn}T00:00:00Z`) });
  expect(licenseStateFrom([], NOW)).toMatchObject({ verified: false, status: null, reason: 'LICENSE_REQUIRED' });
  expect(licenseStateFrom([row('PENDING')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_PENDING' });
  expect(licenseStateFrom([row('REJECTED')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_REJECTED' });
  expect(licenseStateFrom([row('APPROVED', '2026-10-09')], NOW)).toMatchObject({ verified: true, reason: null });
  expect(licenseStateFrom([row('APPROVED', '2026-10-08')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_EXPIRED' });
  expect(licenseStateFrom([row('PENDING'), row('APPROVED')], NOW)).toMatchObject({ verified: true, status: 'PENDING', reason: null });
});

test('file encryption round-trips and hides the bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const stored = encryptBuffer(png);
  expect(stored.includes(Buffer.from('PNG'))).toBe(false);
  expect(decryptBuffer(stored)).toEqual(png);
});
