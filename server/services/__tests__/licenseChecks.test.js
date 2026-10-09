const { licenseChecks } = require('../licenseChecks');

const CLEAN = `REPUBLIC OF THE PHILIPPINES
LAND TRANSPORTATION OFFICE
NON-PROFESSIONAL DRIVER'S LICENSE
Last Name, First Name, Middle Name
DELA CRUZ, JUAN SANTOS
License No. Expiration Date
D01-23-456789 2030/01/31`;
const typed = {
  fullName: 'Juan Dela Cruz',
  number: 'D01-23-456789',
  expiresOn: new Date('2030-01-31T00:00:00Z'),
  licenseType: 'NON_PROFESSIONAL',
};

test('a clean read passes every check', () => {
  expect(licenseChecks(CLEAN, typed)).toEqual({
    isLicense: true,
    nameMatch: true,
    numberMatch: true,
    expiryMatch: true,
    notStudentPermit: true,
    passed: true,
  });
});

test('typical OCR mistakes still match: O for 0, missing dashes, a one-letter slip, other date layouts', () => {
  const noisy = `REPUBLIC 0F THE PHILIPPINES
  LAND TRANSP0RTATI0N OFFlCE
  DRIVERS LICENSE
  DELA CRUZ. JUAM SANTOS
  DO1 23 4S6789   01/31/2030`;
  expect(licenseChecks(noisy, typed)).toMatchObject({ isLicense: true, nameMatch: true, numberMatch: true, expiryMatch: true, passed: true });
});

test('each mismatch fails its own check', () => {
  expect(licenseChecks(CLEAN, { ...typed, fullName: 'Maria Santos Reyes' })).toMatchObject({ nameMatch: false, passed: false });
  expect(licenseChecks(CLEAN, { ...typed, number: 'D01-99-000000' })).toMatchObject({ numberMatch: false, passed: false });
  expect(licenseChecks(CLEAN, { ...typed, expiresOn: new Date('2031-01-31T00:00:00Z') })).toMatchObject({ expiryMatch: false, passed: false });
  expect(licenseChecks('A grocery receipt\nTOTAL 250.00', typed)).toMatchObject({ isLicense: false, passed: false });
});

test('a student permit never passes', () => {
  expect(licenseChecks(CLEAN.replace("NON-PROFESSIONAL DRIVER'S LICENSE", 'STUDENT PERMIT'), typed)).toMatchObject({ notStudentPermit: false, passed: false });
  expect(licenseChecks(CLEAN, { ...typed, licenseType: 'STUDENT_PERMIT' })).toMatchObject({ notStudentPermit: false, passed: false });
});

describe('name on the account vs the name on the license', () => {
  const FULL = CLEAN.replace('DELA CRUZ, JUAN SANTOS', 'DELA CRUZ, JUAN MARTINEZ SANTOS');
  const nameCheck = (fullName, text = FULL) => {
    const { nameMatch, nameMissing, nameTooShort } = licenseChecks(text, { ...typed, fullName });
    return { nameMatch, nameMissing, nameTooShort };
  };

  test.each([
    ['the full name', 'Juan Martinez Santos Dela Cruz'],
    ['a middle initial for a full middle name', 'Juan M. Dela Cruz'],
    ['an initial without a dot', 'Juan M Dela Cruz'],
    ['no middle name', 'Juan Dela Cruz'],
    ['a surname typed as one word', 'Juan DelaCruz'],
  ])('passes with %s', (_, fullName) => {
    expect(nameCheck(fullName)).toEqual({ nameMatch: true, nameMissing: undefined, nameTooShort: undefined });
  });

  test('a long name may have two OCR slips, a short one none', () => {
    const slips = FULL.replace('MARTINEZ', 'MARTlNES').replace('JUAN', 'JUAM');
    expect(nameCheck('Juan Martinez Dela Cruz', slips).nameMatch).toBe(true);
    expect(nameCheck('Jon Dela Cruz').nameMatch).toBe(false);
  });

  test('a first name alone waits for an admin, and says why', () => {
    expect(nameCheck('Juan')).toEqual({ nameMatch: false, nameMissing: undefined, nameTooShort: true });
  });

  test('a different surname fails and names the part that wasn’t found', () => {
    expect(nameCheck('Juan Dela Krus')).toEqual({ nameMatch: false, nameMissing: ['KRUS'], nameTooShort: undefined });
  });
});
