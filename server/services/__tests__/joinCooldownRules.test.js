const { joinCooldown, hasBurst } = require('../joinCooldownRules');

const NOW = new Date('2026-10-21T10:00:00Z');
const minsAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000);

describe('joinCooldown', () => {
  test('no cancellations: no pause', () => {
    expect(joinCooldown([], 't1', NOW)).toBeNull();
  });

  test('the same trip can be requested again 2 hours after cancelling it', () => {
    const cancels = [{ tripId: 't1', at: minsAgo(30) }];
    expect(joinCooldown(cancels, 't1', NOW)).toEqual({ status: 409, body: { error: 'REJOIN_COOLDOWN', retryAt: minsAgo(30 - 120).toISOString() } });
    expect(joinCooldown(cancels, 't2', NOW)).toBeNull();
    expect(joinCooldown([{ tripId: 't1', at: minsAgo(121) }], 't1', NOW)).toBeNull();
  });

  test('three cancellations in 24 hours pause new requests for an hour after the latest', () => {
    const cancels = [
      { tripId: 'a', at: minsAgo(600) },
      { tripId: 'b', at: minsAgo(300) },
      { tripId: 'c', at: minsAgo(20) },
    ];
    expect(joinCooldown(cancels, 'd', NOW)).toEqual({ status: 429, body: { error: 'JOIN_COOLDOWN', retryAt: minsAgo(20 - 60).toISOString() } });
    expect(joinCooldown(cancels, 'd', new Date(NOW.getTime() + 41 * 60 * 1000))).toBeNull();
  });

  test('cancellations older than 24 hours do not count', () => {
    const cancels = [
      { tripId: 'a', at: minsAgo(25 * 60) },
      { tripId: 'b', at: minsAgo(300) },
      { tripId: 'c', at: minsAgo(20) },
    ];
    expect(joinCooldown(cancels, 'd', NOW)).toBeNull();
  });
});

describe('hasBurst', () => {
  test('three inside one 24-hour stretch', () => {
    expect(hasBurst([minsAgo(0), minsAgo(60), minsAgo(23 * 60)])).toBe(true);
    expect(hasBurst([minsAgo(0), minsAgo(60), minsAgo(25 * 60)])).toBe(false);
    expect(hasBurst([minsAgo(0), minsAgo(60)])).toBe(false);
  });
});
