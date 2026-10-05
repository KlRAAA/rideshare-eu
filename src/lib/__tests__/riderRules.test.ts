import { describe, test, expect } from '@jest/globals';
import {
  isWomenPlusEligible, needsOpenTripWarning, ruleBadges, genderChangeMessage, isGender, GENDER_OPTIONS, GENDER_HELP,
} from '../riderRules';

describe('riderRules (UI)', () => {
  test('eligibility', () => {
    expect(isWomenPlusEligible('WOMAN')).toBe(true);
    expect(isWomenPlusEligible('NON_BINARY')).toBe(true);
    expect(isWomenPlusEligible('MAN')).toBe(false);
    expect(isWomenPlusEligible(undefined)).toBe(false);
  });

  test('S7/S8/S9: warn only a Women+-only rider joining an open trip', () => {
    expect(needsOpenTripWarning('ANY', 'WOMEN_PLUS')).toBe(true);
    expect(needsOpenTripWarning('ANY', 'ANY')).toBe(false);
    expect(needsOpenTripWarning('WOMEN_PLUS', 'WOMEN_PLUS')).toBe(false);
  });

  test('S27: badges describe the rule, never a person', () => {
    expect(ruleBadges({ genderPreference: 'WOMEN_PLUS', familiarRidersOnly: true })).toEqual(['Women+ trip', 'Familiar riders only']);
    expect(ruleBadges({ genderPreference: 'ANY', familiarRidersOnly: false })).toEqual([]);
  });

  test('gender options and help text', () => {
    expect(GENDER_OPTIONS.map((o) => o.label)).toEqual(['Woman', 'Man', 'Non-binary', 'Prefer not to say']);
    expect(GENDER_HELP).toBe('Used only for Women+ trips. Never shown to other users. You can change it anytime.');
    expect(isGender('FEMALE')).toBe(false);
    expect(isGender('NON_BINARY')).toBe(true);
  });

  test('gender change messages', () => {
    expect(genderChangeMessage('CONFIRM_WITHDRAW_PENDING', { pendingCount: 2 })).toBe(
      'Changing this will withdraw your 2 pending requests on Women+ trips. Continue?'
    );
    expect(genderChangeMessage('CONFIRM_WITHDRAW_PENDING', { pendingCount: 1 })).toBe(
      'Changing this will withdraw your 1 pending request on a Women+ trip. Continue?'
    );
    expect(genderChangeMessage('HOSTING_WOMEN_PLUS_TRIPS', {})).toBe("You're hosting Women+ trips. Finish or cancel them first.");
    expect(genderChangeMessage('SOMETHING_ELSE', {})).toBeNull();
  });
});
