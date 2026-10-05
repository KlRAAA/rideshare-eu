const { validateDataRequest } = require('../dataRequestValidation');
const { paperworkDueAt, isOverdue } = require('../dataRequestService');

// Superadmin spec §6 and S2, S5, S10.
const ok = {
  subjectUserId: 'u1',
  agency: 'PNP Lucena City Police Station',
  officerName: 'PCPT Juan Cruz',
  officerContact: '0917 000 0000',
  referenceNumber: 'BLT-2026-0042',
  legalBasis: 'WARRANT',
  fromDate: '2026-09-01',
  toDate: '2026-09-30',
  verificationNote: 'Called the station on its listed number.',
};

test('a complete request is cleaned and dates become Philippine-day bounds', () => {
  const { value } = validateDataRequest({ ...ok, agency: '  PNP Lucena City Police Station ' });
  expect(value.agency).toBe('PNP Lucena City Police Station');
  expect(value.fromDate.toISOString()).toBe('2026-08-31T16:00:00.000Z');
  expect(value.toDate.toISOString()).toBe('2026-09-30T15:59:59.999Z');
  expect(value).toMatchObject({ includeChats: false, includeSupport: false });
});

test.each([
  ['agency', { agency: '' }],
  ['officerName', { officerName: ' ' }],
  ['officerContact', { officerContact: undefined }],
  ['referenceNumber', { referenceNumber: '' }],
  ['verificationNote', { verificationNote: '' }],
  ['legalBasis', { legalBasis: 'HUNCH' }],
  ['subjectUserId', { subjectUserId: '' }],
  ['fromDate', { fromDate: '2026-9-1' }],
  ['toDate', { toDate: '2026-08-01' }], // S10 reversed
  ['toDate', { toDate: '2027-10-01' }], // S10 longer than a year
  ['includeChats', { legalBasis: 'SUBPOENA', includeChats: true }], // S2
  ['includeSupport', { legalBasis: 'EMERGENCY', includeSupport: true }],
])('rejects a bad %s', (field, over) => {
  expect(validateDataRequest({ ...ok, ...over })).toEqual({ field });
});

test('an emergency needs no dates', () => {
  const { value } = validateDataRequest({ ...ok, legalBasis: 'EMERGENCY', fromDate: undefined, toDate: undefined });
  expect(value).toMatchObject({ fromDate: null, toDate: null });
});

test('S5: emergency paperwork is due in 72 hours and then overdue', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const due = paperworkDueAt('EMERGENCY', now);
  expect(due.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  expect(paperworkDueAt('WARRANT', now)).toBeNull();
  expect(isOverdue({ paperworkDueAt: due, paperworkReceivedAt: null }, new Date('2026-10-08T00:00:01Z'))).toBe(true);
  expect(isOverdue({ paperworkDueAt: due, paperworkReceivedAt: now }, new Date('2026-10-09T00:00:00Z'))).toBe(false);
  expect(isOverdue({ paperworkDueAt: null, paperworkReceivedAt: null }, now)).toBe(false);
});
