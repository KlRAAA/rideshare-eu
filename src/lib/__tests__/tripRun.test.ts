import { describe, test, expect } from '@jest/globals';
import { elapsedLabel, clockLabel } from '../tripRun';

describe('trip run labels', () => {
  test('elapsed time in minutes, then hours and minutes', () => {
    const start = new Date('2026-06-01T23:00:00Z');
    expect(elapsedLabel(start, new Date('2026-06-01T23:00:20Z'))).toBe('just started');
    expect(elapsedLabel(start, new Date('2026-06-01T23:14:30Z'))).toBe('14 min');
    expect(elapsedLabel(start, new Date('2026-06-02T00:05:00Z'))).toBe('1 h 5 min');
  });
  test('clock times are shown in Philippine time', () => {
    expect(clockLabel('2026-06-01T23:42:00Z')).toBe('7:42 AM');
  });
});
