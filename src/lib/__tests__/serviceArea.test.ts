import { describe, test, expect } from '@jest/globals';
import { inLuzon, OUTSIDE_LUZON_MESSAGE } from '../serviceArea';

describe('serviceArea (UI mirror of server/config/serviceArea.js)', () => {
  test('places in Luzon and its nearby islands are inside', () => {
    expect(inLuzon({ lat: 13.94, lng: 121.62 })).toBe(true); // Lucena
    expect(inLuzon({ lat: 14.6, lng: 120.98 })).toBe(true); // Manila
    expect(inLuzon({ lat: 13.4, lng: 121.0 })).toBe(true); // Calapan, Mindoro
    expect(inLuzon({ lat: 20.45, lng: 121.97 })).toBe(true); // Basco, Batanes
  });

  test('the Visayas, Mindanao, Palawan and other countries are outside', () => {
    expect(inLuzon({ lat: 10.31, lng: 123.89 })).toBe(false); // Cebu
    expect(inLuzon({ lat: 7.07, lng: 125.61 })).toBe(false); // Davao
    expect(inLuzon({ lat: 9.74, lng: 118.73 })).toBe(false); // Puerto Princesa
    expect(inLuzon({ lat: 35.68, lng: 139.69 })).toBe(false); // Tokyo
  });

  test('has a message to show when a place is outside', () => {
    expect(OUTSIDE_LUZON_MESSAGE).toMatch(/Luzon/);
  });
});
