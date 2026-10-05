import { describe, test, expect } from '@jest/globals';
import { WARNING_REASONS, warningFormError, warningReasonLabel } from '../warnings';
import { notificationHref } from '../notificationLink';
import { describeAction, type AdminAction } from '../admin';

describe('warnings', () => {
  test('reasons and labels', () => {
    expect(WARNING_REASONS.map((r) => r.value)).toEqual(['SMOKING', 'UNSAFE_DRIVING', 'LATE_OR_NO_SHOW', 'DISRESPECTFUL', 'OTHER']);
    expect(warningReasonLabel('UNSAFE_DRIVING')).toBe('Unsafe driving');
  });

  test('form errors', () => {
    expect(warningFormError('', '')).toBe('Choose a reason.');
    expect(warningFormError('OTHER', '  ')).toBe('Add a note explaining the warning.');
    expect(warningFormError('SMOKING', 'x'.repeat(501))).toBe('Keep the note under 500 characters.');
    expect(warningFormError('SMOKING', '')).toBeNull();
  });

  test('a warning notification opens the dashboard, where the banner is', () => {
    expect(notificationHref({ type: 'WARNING', relatedTripId: 't1', relatedMatchId: null })).toBe('/auth/dashboard');
  });

  test('the activity log describes it', () => {
    const a: AdminAction = {
      id: 'w', actorId: 'a', actorName: 'Liza Ramos', action: 'WARNING_ISSUED', targetUserId: 'u', targetUserName: 'Ana Reyes',
      targetTripId: null, targetReportId: null, details: { reason: 'SMOKING' }, createdAt: '2026-10-06T00:00:00Z',
    };
    expect(describeAction(a)).toBe('Liza Ramos warned Ana Reyes (Smoking in the car)');
  });
});
