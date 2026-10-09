import { describe, test, expect } from '@jest/globals';
import { isLoud, shouldPopUp, isIosSafari } from '../loudNotifications';

const note = (type: string, relatedTripId: string | null = 't1') => ({ type, relatedTripId });

describe('isLoud', () => {
  test('the events that need attention are loud; the rest stay quiet', () => {
    expect(isLoud('APPROVAL')).toBe(true);
    expect(isLoud('DRIVER_ARRIVING')).toBe(true);
    expect(isLoud('MESSAGE')).toBe(true);
    expect(isLoud('RATING_PROMPT')).toBe(false);
    expect(isLoud('ANNOUNCEMENT')).toBe(false);
  });
});

describe('shouldPopUp', () => {
  test('no chat pop-up on the trip page you are already reading', () => {
    expect(shouldPopUp(note('MESSAGE'), '/auth/trips/t1')).toBe(false);
    expect(shouldPopUp(note('MESSAGE'), '/auth/trips/t2')).toBe(true);
    expect(shouldPopUp(note('MESSAGE'), '/auth/dashboard')).toBe(true);
    expect(shouldPopUp(note('TRIP_STARTED'), '/auth/trips/t1')).toBe(true);
    expect(shouldPopUp(note('REMINDER'), '/auth/dashboard')).toBe(false);
  });
});

describe('isIosSafari', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  test('only an iPhone outside the Home Screen needs the install hint', () => {
    expect(isIosSafari(iphone, false)).toBe(true);
    expect(isIosSafari(iphone, true)).toBe(false);
    expect(isIosSafari(android, false)).toBe(false);
  });
});
