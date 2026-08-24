const { updateTrustScore } = require('../trustScoreService');

test('running average matches the thesis formula', () => {
  expect(updateTrustScore(4.8, 14, 5)).toBeCloseTo((4.8 * 14 + 5) / 15, 4);
});

test('first-ever rating with tripCount 0 returns the rating itself', () => {
  expect(updateTrustScore(0, 0, 4)).toBe(4);
});
