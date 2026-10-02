import { describe, test, expect } from '@jest/globals';
import { searchFlexWindow, DEFAULT_FLEX_WINDOW_MINUTES, WIDE_FLEX_WINDOW_MINUTES } from '../searchWindow';

describe('search departure window', () => {
  test('with Flexible Time off, rides within 15 minutes still match', () => {
    expect(searchFlexWindow(false)).toBe(15);
    expect(DEFAULT_FLEX_WINDOW_MINUTES).toBe(15);
  });

  test('with Flexible Time on, the window widens to 30 minutes', () => {
    expect(searchFlexWindow(true)).toBe(30);
    expect(WIDE_FLEX_WINDOW_MINUTES).toBe(30);
  });

  test('never sends a zero window, which would only match the exact minute', () => {
    expect(searchFlexWindow(false)).toBeGreaterThan(0);
  });
});
