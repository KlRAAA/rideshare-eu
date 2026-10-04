const r = require('../riderRules');

describe('riderRules', () => {
  test('normalizeGender maps legacy and unknown values', () => {
    expect(r.normalizeGender('FEMALE')).toBe('WOMAN');
    expect(r.normalizeGender('MALE')).toBe('MAN');
    expect(r.normalizeGender('UNSPECIFIED')).toBe('PREFER_NOT_TO_SAY');
    expect(r.normalizeGender('NON_BINARY')).toBe('NON_BINARY');
    expect(r.normalizeGender(null)).toBe('PREFER_NOT_TO_SAY');
  });

  test('women and non-binary users are Women+ eligible', () => {
    expect(r.isWomenPlusEligible('WOMAN')).toBe(true);
    expect(r.isWomenPlusEligible('NON_BINARY')).toBe(true);
    expect(r.isWomenPlusEligible('MAN')).toBe(false);
    expect(r.isWomenPlusEligible('PREFER_NOT_TO_SAY')).toBe(false);
    expect(r.canHostWomenPlus({ gender: 'NON_BINARY' })).toBe(true);
    expect(r.canHostWomenPlus({ gender: 'MAN' })).toBe(false);
    expect(r.canHostWomenPlus(null)).toBe(false);
  });

  const open = { genderPreference: 'ANY', familiarRidersOnly: false };
  const wplus = { genderPreference: 'WOMEN_PLUS', familiarRidersOnly: false };
  const familiar = { genderPreference: 'ANY', familiarRidersOnly: true };

  test('S1/S3/S4/S5: Women+ trips only take eligible riders', () => {
    expect(r.joinBlockReason(wplus, { gender: 'MAN', familiarWithHost: false })).toBe('TRIP_WOMEN_PLUS_ONLY');
    expect(r.joinBlockReason(wplus, { gender: 'PREFER_NOT_TO_SAY', familiarWithHost: false })).toBe('TRIP_WOMEN_PLUS_ONLY');
    expect(r.canJoin(wplus, { gender: 'NON_BINARY', familiarWithHost: false })).toBe(true);
    expect(r.canJoin(open, { gender: 'MAN', familiarWithHost: false })).toBe(true);
  });

  test('S10/S11: familiar-riders-only needs a completed ride with the host', () => {
    expect(r.joinBlockReason(familiar, { gender: 'WOMAN', familiarWithHost: false })).toBe('TRIP_FAMILIAR_RIDERS_ONLY');
    expect(r.canJoin(familiar, { gender: 'MAN', familiarWithHost: true })).toBe(true);
  });

  test('S24: unknown or ineligible preferences become ANY', () => {
    expect(r.effectivePreference('SAME_GENDER', 'WOMAN')).toBe('ANY');
    expect(r.effectivePreference('WOMEN_PLUS', 'MAN')).toBe('ANY');
    expect(r.effectivePreference('WOMEN_PLUS', 'WOMAN')).toBe('WOMEN_PLUS');
    expect(r.effectivePreference(undefined, 'WOMAN')).toBe('ANY');
  });
});
