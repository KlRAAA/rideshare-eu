import { describe, test, expect } from '@jest/globals';
import { basisLabel, allowsContent, dataRequestFormError, paperworkStatus, RELEASE_FOOTER } from '../dataRequests';

const valid = {
  subjectUserId: 'u1',
  agency: 'PNP Lucena',
  officerName: 'PCPT Cruz',
  officerContact: '0917',
  referenceNumber: 'BLT-1',
  legalBasis: 'WARRANT',
  fromDate: '2026-09-01',
  toDate: '2026-09-30',
  includeChats: false,
  includeSupport: false,
  verificationNote: 'Called the station.',
  password: 'x',
};

describe('data requests', () => {
  test('labels', () => {
    expect(basisLabel('WARRANT')).toBe('Warrant to Disclose Computer Data');
    expect(basisLabel('EMERGENCY')).toBe('Emergency (risk to life)');
    expect(allowsContent('COURT_ORDER')).toBe(true);
    expect(allowsContent('SUBPOENA')).toBe(false);
    expect(RELEASE_FOOTER).toBe('Confidential: released under RA 10173');
  });

  test('form errors explain what is missing', () => {
    expect(dataRequestFormError(valid)).toBeNull();
    expect(dataRequestFormError({ ...valid, subjectUserId: '' })).toBe('Choose the person the request is about.');
    expect(dataRequestFormError({ ...valid, referenceNumber: ' ' })).toBe('Add the case, blotter or docket number.');
    expect(dataRequestFormError({ ...valid, toDate: '2026-08-01' })).toBe('The end date must be on or after the start date.');
    expect(dataRequestFormError({ ...valid, legalBasis: 'EMERGENCY', fromDate: '', toDate: '' })).toBeNull();
    expect(dataRequestFormError({ ...valid, legalBasis: 'SUBPOENA', includeChats: true })).toBe(
      'Chat messages and support requests need a warrant or court order that names them.'
    );
    expect(dataRequestFormError({ ...valid, password: '' })).toBe('Enter your password to release records.');
  });

  test('paperwork status', () => {
    const now = Date.parse('2026-10-05T00:00:00Z');
    expect(paperworkStatus({ paperworkDueAt: null, paperworkReceivedAt: null }, now)).toBeNull();
    expect(paperworkStatus({ paperworkDueAt: '2026-10-06T00:00:00Z', paperworkReceivedAt: null }, now)).toBe('due');
    expect(paperworkStatus({ paperworkDueAt: '2026-10-04T00:00:00Z', paperworkReceivedAt: null }, now)).toBe('overdue');
    expect(paperworkStatus({ paperworkDueAt: '2026-10-04T00:00:00Z', paperworkReceivedAt: '2026-10-04T12:00:00Z' }, now)).toBe('received');
  });
});
