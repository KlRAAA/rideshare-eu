import { describe, test, expect } from '@jest/globals';
import { stalePriceReminder, daysSince, isFuelType, STALE_PRICE_DAYS } from '../fuelTypes';

const NOW = Date.parse('2026-10-12T08:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('fuel types', () => {
  test('recognizes the three pump grades only', () => {
    expect(['REGULAR', 'PREMIUM', 'DIESEL'].every(isFuelType)).toBe(true);
    expect(isFuelType('diesel')).toBe(false);
    expect(isFuelType('LPG')).toBe(false);
    expect(isFuelType(undefined)).toBe(false);
  });

  test('counts whole days since an update', () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(daysAgo(9), NOW)).toBe(9);
  });
});

describe('stale-price reminder', () => {
  test('stays quiet while a price is less than a week old', () => {
    expect(stalePriceReminder('DIESEL', { pricePerLiter: 60, updatedAt: daysAgo(STALE_PRICE_DAYS - 1) }, NOW)).toBeNull();
  });

  test('reminds the admin once a price is a week old or more', () => {
    expect(stalePriceReminder('DIESEL', { pricePerLiter: 60, updatedAt: daysAgo(9) }, NOW)).toBe(
      'Diesel price last updated 9 days ago. Check the DOE weekly advisory.'
    );
  });

  test('asks for a first price when none has been set', () => {
    expect(stalePriceReminder('PREMIUM', null, NOW)).toBe('No official Premium price yet. Check the DOE weekly advisory and set one.');
  });
});
