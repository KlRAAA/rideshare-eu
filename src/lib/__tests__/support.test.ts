import { describe, test, expect } from '@jest/globals';
import { supportFormError, campusSecurityPhone, categoryLabel, SUBJECT_MAX, BODY_MAX } from '../support';
import { notificationHref } from '../notificationLink';

const valid = { category: 'SAFETY', subject: 'Driver was speeding', body: 'On the highway this morning.' };

describe('support form', () => {
  test('a complete form has no error', () => {
    expect(supportFormError(valid)).toBeNull();
  });

  test('explains what is missing or too long', () => {
    expect(supportFormError({ ...valid, category: '' })).toBe('Choose what your request is about.');
    expect(supportFormError({ ...valid, subject: '   ' })).toBe('Add a short subject.');
    expect(supportFormError({ ...valid, subject: 'x'.repeat(SUBJECT_MAX + 1) })).toBe('Keep the subject under 120 characters.');
    expect(supportFormError({ ...valid, body: '' })).toBe('Describe what happened.');
    expect(supportFormError({ ...valid, body: 'x'.repeat(BODY_MAX + 1) })).toBe('Keep the message under 2000 characters.');
  });

  test('category labels are readable', () => {
    expect(categoryLabel('FUEL_SHARE')).toBe('Fuel share');
  });
});

describe('campus security number', () => {
  test('hidden unless configured', () => {
    expect(campusSecurityPhone({})).toBeNull();
    expect(campusSecurityPhone({ NEXT_PUBLIC_CAMPUS_SECURITY_PHONE: '  ' })).toBeNull();
    expect(campusSecurityPhone({ NEXT_PUBLIC_CAMPUS_SECURITY_PHONE: '(042) 123 4567' })).toBe('(042) 123 4567');
  });
});

describe('support notifications', () => {
  test('an admin reply opens My requests; an announcement goes nowhere', () => {
    expect(notificationHref({ type: 'SUPPORT_REPLY', relatedTripId: null, relatedMatchId: null })).toBe('/help/requests');
    expect(notificationHref({ type: 'ANNOUNCEMENT', relatedTripId: null, relatedMatchId: null })).toBeNull();
  });
});
