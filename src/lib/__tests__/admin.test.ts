import { describe, test, expect } from '@jest/globals';
import { waitingLabel, describeAction, queueTone, adminNavGroups, type AdminAction } from '../admin';

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

describe('describeAction for data requests and the superadmin', () => {
  const base: AdminAction = {
    id: 'a2',
    actorId: 'sa',
    actorName: 'Liza Ramos',
    action: 'DATA_RELEASED',
    targetUserId: null,
    targetUserName: null,
    targetTripId: null,
    targetReportId: null,
    details: { agency: 'PNP Lucena', referenceNumber: 'BLT-1', legalBasis: 'WARRANT' },
    createdAt: hoursAgo(1),
  };

  test('reads like a sentence and leaves the person out when hidden', () => {
    expect(describeAction(base)).toBe(
      'Liza Ramos released records for data request BLT-1 (PNP Lucena, Warrant to Disclose Computer Data)'
    );
    expect(describeAction({ ...base, targetUserName: 'Maria Santos' })).toBe(
      'Liza Ramos released records about Maria Santos for data request BLT-1 (PNP Lucena, Warrant to Disclose Computer Data)'
    );
    expect(describeAction({ ...base, action: 'DATA_RELEASE_VIEWED' })).toBe('Liza Ramos reopened the release for data request BLT-1');
    expect(describeAction({ ...base, action: 'DATA_PAPERWORK_RECEIVED' })).toBe(
      'Liza Ramos recorded the written request for data request BLT-1'
    );
    expect(
      describeAction({ ...base, actorName: null, action: 'SUPERADMIN_SET', targetUserName: 'Maria Santos', details: { via: 'make-superadmin script' } })
    ).toBe('Server command made Maria Santos the superadmin');
  });
});

describe('queueTone', () => {
  test('urgent items are red, other waiting items amber, nothing waiting is clear', () => {
    expect(queueTone(2, 1)).toBe('danger');
    expect(queueTone(2, 0)).toBe('warning');
    expect(queueTone(0, 0)).toBe('clear');
  });
});

describe('adminNavGroups', () => {
  test('groups the sections; Data requests only for the superadmin', () => {
    const labels = (sa: boolean) => adminNavGroups(sa).flatMap((g) => g.items.map((i) => i.label));
    expect(adminNavGroups(false).map((g) => g.label)).toEqual(['Moderation', 'People', 'Platform', 'Records']);
    expect(labels(false)).not.toContain('Data requests');
    expect(labels(true)).toContain('Data requests');
    expect(labels(false)).toEqual(['Overview', 'Reports', 'Support', 'Watch list', 'Users', 'Driver licenses', 'Announcements', 'Fuel price', 'Activity']);
  });
});

describe('describeAction for DOE fuel prices', () => {
  const base: AdminAction = {
    id: 'a2',
    actorId: null,
    actorName: null,
    action: 'FUEL_PRICE_SET',
    targetUserId: null,
    targetUserName: null,
    targetTripId: null,
    targetReportId: null,
    details: { fuelType: 'DIESEL', from: 90, to: 98.13, source: 'DOE', period: 'September 29-October 5, 2026' },
    createdAt: hoursAgo(1),
  };

  test('names the DOE file as the source of an automatic or tapped update', () => {
    expect(describeAction(base)).toBe('DOE update set the official Diesel price to ₱98.13/L (September 29-October 5, 2026)');
    expect(describeAction({ ...base, actorId: 'admin', actorName: 'Carlo Reyes' })).toBe(
      'Carlo Reyes set the official Diesel price to ₱98.13/L from the DOE file (September 29-October 5, 2026)'
    );
  });

  test('says when an admin kept the current prices', () => {
    expect(
      describeAction({ ...base, actorId: 'admin', actorName: 'Carlo Reyes', action: 'DOE_PRICES_DISMISSED', details: { period: 'October 6-12, 2026' } })
    ).toBe('Carlo Reyes kept the current fuel prices instead of the DOE prices (October 6-12, 2026)');
  });
});
