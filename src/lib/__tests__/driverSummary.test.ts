import { describe, test, expect } from '@jest/globals';
import { peso, weekLabel, barHeights, summaryLine } from '../driverSummary';

describe('labels', () => {
  test('pesos without needless decimals', () => {
    expect(peso(1240)).toBe('₱1,240');
    expect(peso(55.5)).toBe('₱55.50');
    expect(peso(0)).toBe('₱0');
  });
  test('a week by its Monday', () => {
    expect(weekLabel('2026-10-05')).toBe('5 Oct');
  });
  test('one line for the dashboard', () => {
    expect(summaryLine({ rides: 6, riders: 14, fuelShare: 1240 })).toBe('6 rides · 14 riders · ₱1,240');
    expect(summaryLine({ rides: 1, riders: 1, fuelShare: 25 })).toBe('1 ride · 1 rider · ₱25');
  });
});

describe('barHeights', () => {
  test('scaled to the busiest week, empty weeks at zero', () => {
    expect(barHeights([{ rides: 2 }, { rides: 0 }, { rides: 4 }])).toEqual([50, 0, 100]);
    expect(barHeights([{ rides: 0 }, { rides: 0 }])).toEqual([0, 0]);
  });
});
