const { REMINDER_LEAD_MINUTES, reminderWindowEnd, reminderRecipients } = require('../reminderService');

describe('reminderWindowEnd', () => {
  test('adds the default lead time to now', () => {
    const now = new Date('2026-01-01T06:00:00Z');
    const expected = now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000;
    expect(reminderWindowEnd(now).getTime()).toBe(expected);
  });

  test('accepts a custom lead time', () => {
    const now = new Date('2026-01-01T06:00:00Z');
    expect(reminderWindowEnd(now, 30).getTime()).toBe(now.getTime() + 30 * 60 * 1000);
  });
});

describe('reminderRecipients', () => {
  test('includes the host and every approved passenger', () => {
    const trip = {
      hostId: 'host1',
      matches: [
        { passengerId: 'p1', status: 'APPROVED' },
        { passengerId: 'p2', status: 'APPROVED' },
      ],
    };
    expect(reminderRecipients(trip)).toEqual(['host1', 'p1', 'p2']);
  });

  test('excludes pending and declined passengers', () => {
    const trip = {
      hostId: 'host1',
      matches: [
        { passengerId: 'p1', status: 'PENDING' },
        { passengerId: 'p2', status: 'DECLINED' },
      ],
    };
    expect(reminderRecipients(trip)).toEqual(['host1']);
  });

  test('host only, when the trip has no approved passengers yet', () => {
    expect(reminderRecipients({ hostId: 'host1', matches: [] })).toEqual(['host1']);
  });
});
