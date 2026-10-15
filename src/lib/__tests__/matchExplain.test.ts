import { describe, test, expect } from '@jest/globals';
import { timeGapLabel, matchPercent, matchReasons } from '../matchExplain';

// 6:24 AM and 7:45 AM Philippine time (UTC+8).
const AT_6_24 = '2026-10-16T22:24:00.000Z';
const AT_7_45 = '2026-10-16T23:45:00.000Z';

describe('timeGapLabel', () => {
  test('says how far the trip leaves from the rider’s time, in Philippine time', () => {
    expect(timeGapLabel('06:15', AT_6_24)).toBe('Leaves 9 min after your 6:15 AM');
    expect(timeGapLabel('06:30', AT_6_24)).toBe('Leaves 6 min before your 6:30 AM');
    expect(timeGapLabel('06:24', AT_6_24)).toBe('Leaves at your time, 6:24 AM');
    expect(timeGapLabel('06:45', AT_7_45)).toBe('Leaves 1 h after your 6:45 AM');
    expect(timeGapLabel('06:15', AT_7_45)).toBe('Leaves 1 h 30 min after your 6:15 AM');
  });
});

describe('matchReasons', () => {
  const parts = { score: 0.7, routeOverlap: 0.8, scheduleAlignment: 0.4, preferenceMatch: true };

  test('the percentage is the score, rounded', () => {
    expect(matchPercent(parts)).toBe(70);
  });

  test('explains each part of the score in plain words', () => {
    expect(matchReasons(parts, '06:15', AT_6_24, 15)).toEqual([
      { label: 'Route, half the score', detail: '80% of your way is along the driver’s route.' },
      { label: 'Time, 30%', detail: 'Leaves 9 min after your 6:15 AM. Full marks at your exact time, none at ±15 min.' },
      { label: 'Seats and rules, 20%', detail: 'There’s a free seat and you meet the trip’s rules.' },
    ]);
  });

  test('says when the time earns full marks or none', () => {
    expect(matchReasons({ ...parts, scheduleAlignment: 1 }, '06:24', AT_6_24, 15)[1].detail).toBe('Leaves at your time, 6:24 AM: full marks.');
    expect(matchReasons({ ...parts, scheduleAlignment: 0 }, '06:15', AT_7_45, 15)[1].detail).toBe(
      'Leaves 1 h 30 min after your 6:15 AM: outside your ±15 min window, no marks.'
    );
  });
});
