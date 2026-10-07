import { describe, test, expect } from '@jest/globals';
import { moveHighlight, suggestionAnnouncement } from '../addressSuggest';

describe('moveHighlight', () => {
  test('down from nothing highlights the first, then steps and wraps to the top', () => {
    expect(moveHighlight(-1, 'ArrowDown', 3)).toBe(0);
    expect(moveHighlight(0, 'ArrowDown', 3)).toBe(1);
    expect(moveHighlight(2, 'ArrowDown', 3)).toBe(0);
  });

  test('up from nothing or the first wraps to the last', () => {
    expect(moveHighlight(-1, 'ArrowUp', 3)).toBe(2);
    expect(moveHighlight(0, 'ArrowUp', 3)).toBe(2);
    expect(moveHighlight(2, 'ArrowUp', 3)).toBe(1);
  });

  test('an empty list highlights nothing', () => {
    expect(moveHighlight(0, 'ArrowDown', 0)).toBe(-1);
    expect(moveHighlight(-1, 'ArrowUp', 0)).toBe(-1);
  });
});

describe('suggestionAnnouncement', () => {
  test('counts the suggestions and says how to choose', () => {
    expect(suggestionAnnouncement(5)).toBe('5 suggestions. Use the up and down arrows to choose, then press Enter.');
    expect(suggestionAnnouncement(1)).toMatch(/^1 suggestion\./);
  });

  test('says what to do when nothing matches', () => {
    expect(suggestionAnnouncement(0)).toBe('No matching places. Keep typing, or set the spot on the map.');
  });
});
