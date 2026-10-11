const { isPickedUp } = require('../services/riderLocationRules');

const start = new Date('2026-10-12T07:00:00+08:00');
const run = { startedAt: start };

test('a rider counts as picked up only when tapped during this run', () => {
  expect(isPickedUp(null, run)).toBe(false);
  expect(isPickedUp(start, run)).toBe(true);
  expect(isPickedUp(new Date(start.getTime() + 60 * 1000), run)).toBe(true);
  // Yesterday's pickup on a recurring trip doesn't count today.
  expect(isPickedUp(new Date(start.getTime() - 24 * 3600 * 1000), run)).toBe(false);
  expect(isPickedUp(new Date(), null)).toBe(false);
  expect(isPickedUp(new Date(), { startedAt: null })).toBe(false);
});
