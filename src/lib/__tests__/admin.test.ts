import { describe, test, expect } from '@jest/globals';
import { waitingLabel, describeAction, type AdminAction } from '../admin';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600 * 1000).toISOString();

describe('waitingLabel', () => {
  test('describes how long something has waited in plain words', () => {
    expect(waitingLabel(hoursAgo(0.2), NOW)).toBe('waiting under an hour');
    expect(waitingLabel(hoursAgo(1), NOW)).toBe('waiting 1 hour');
    expect(waitingLabel(hoursAgo(5), NOW)).toBe('waiting 5 hours');
    expect(waitingLabel(hoursAgo(30), NOW)).toBe('waiting 1 day');
    expect(waitingLabel(hoursAgo(49), NOW)).toBe('waiting 2 days');
  });
});

describe('describeAction for support and announcements', () => {
  const base: AdminAction = {
    id: 'a1',
    actorId: 'admin',
    actorName: 'Liza Ramos',
    action: 'SUPPORT_REPLIED',
    targetUserId: 'u1',
    targetUserName: 'Maria Santos',
    targetTripId: null,
    targetReportId: null,
    details: null,
    createdAt: hoursAgo(1),
  };

  test('reads like a sentence', () => {
    expect(describeAction(base)).toBe('Liza Ramos replied to a support request from Maria Santos');
    expect(describeAction({ ...base, action: 'SUPPORT_CLOSED' })).toBe('Liza Ramos closed a support request from Maria Santos');
    expect(
      describeAction({ ...base, action: 'ANNOUNCEMENT_POSTED', targetUserId: null, targetUserName: null, details: { title: 'No classes tomorrow' } })
    ).toBe('Liza Ramos posted an announcement: "No classes tomorrow"');
  });
});
