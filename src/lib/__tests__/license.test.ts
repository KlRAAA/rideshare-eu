import { describe, test, expect } from '@jest/globals';
import { licenseStatusText, licenseErrorMessage, rejectReasonLabel, checkRows, checkProblem, type MyLicense } from '../license';

const base: MyLicense = { license: null, verified: false, canPost: false, reason: 'LICENSE_REQUIRED' };
const lic = (over: Partial<NonNullable<MyLicense['license']>>) => ({
  id: 'l1',
  status: 'PENDING' as const,
  licenseType: 'NON_PROFESSIONAL' as const,
  numberLast4: '6789',
  expiresOn: '2030-01-31T00:00:00.000Z',
  submittedAt: '2026-10-09T00:00:00.000Z',
  decidedAt: null,
  rejectReason: null,
  rejectNote: null,
  ...over,
});

describe('licenseStatusText', () => {
  test('one plain sentence per state', () => {
    expect(licenseStatusText(base)).toMatchObject({ title: 'Upload your driver’s license', tone: 'neutral' });
    expect(licenseStatusText({ ...base, reason: 'LICENSE_PENDING', license: lic({}) })).toMatchObject({ title: 'Checking your license…', tone: 'warn' });
    expect(licenseStatusText({ ...base, reason: 'LICENSE_PENDING', license: lic({ checkedAt: '2026-10-09T00:00:05.000Z' }) })).toMatchObject({ title: 'Your license is under review' });
    expect(licenseStatusText({ ...base, verified: true, canPost: true, reason: null, license: lic({ status: 'APPROVED' }) })).toMatchObject({
      title: 'License approved',
      detail: 'Valid until 31 January 2030 · ending 6789',
      tone: 'ok',
    });
    const rejected = licenseStatusText({ ...base, reason: 'LICENSE_REJECTED', license: lic({ status: 'REJECTED', rejectReason: 'UNREADABLE', rejectNote: 'Glare.' }) });
    expect(rejected).toMatchObject({ title: 'Your license wasn’t approved', tone: 'bad' });
    expect(rejected.detail).toBe('The photo is blurry or unreadable. Glare.');
    expect(licenseStatusText({ ...base, reason: 'LICENSE_EXPIRED', license: lic({ status: 'APPROVED', expiresOn: '2026-01-01T00:00:00.000Z' }) })).toMatchObject({
      title: 'Your license has expired',
      tone: 'bad',
    });
  });
});

describe('messages', () => {
  test('reason labels and error messages are plain', () => {
    expect(rejectReasonLabel('STUDENT_PERMIT')).toBe('A student permit doesn’t allow carrying passengers');
    expect(licenseErrorMessage('LICENSE_PENDING')).toBe('Your license is already under review.');
    expect(licenseErrorMessage('INVALID_LICENSE', 'licenseNumber')).toBe('Check the license number: 5–20 letters, digits or dashes.');
    expect(licenseErrorMessage('SOMETHING_ELSE')).toBe('That didn’t work. Try again in a moment.');
  });
});

describe('checkRows', () => {
  test('five labelled results, or one line when unreadable, or nothing before the check', () => {
    const rows = checkRows({ isLicense: true, nameMatch: false, numberMatch: true, expiryMatch: true, notStudentPermit: true, passed: false });
    expect(rows).toHaveLength(5);
    expect(rows?.[1]).toEqual({ label: 'Name matches the account', ok: false });
    expect(checkRows({ unreadable: true, passed: false })).toEqual([{ label: 'The photo couldn’t be read', ok: false }]);
    expect(checkRows(null)).toBeNull();
  });
});

describe('why the name check failed', () => {
  test('names the parts of the account name that weren’t on the photo', () => {
    const checks = { isLicense: true, nameMatch: false, nameMissing: ['DIMACALI'], numberMatch: true, expiryMatch: true, notStudentPermit: true };
    expect(checkProblem(checks)).toBe('The automatic check couldn’t find “Dimacali” from your account name on the photo.');
    expect(checkRows(checks)?.[1]).toEqual({ label: 'Name matches the account', ok: false, note: '“Dimacali” from the account name isn’t on the photo' });
  });

  test('explains a first-name-only account', () => {
    expect(checkProblem({ nameMatch: false, nameTooShort: true })).toBe(
      'Your account name is only a first name, so the automatic check can’t match it to the license.'
    );
  });

  test('falls back to the general sentence', () => {
    expect(checkProblem(null)).toBe('The automatic check couldn’t confirm it.');
    expect(checkRows({ nameMatch: true })?.[1]).toEqual({ label: 'Name matches the account', ok: true });
  });
});
