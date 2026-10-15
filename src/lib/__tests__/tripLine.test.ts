import { describe, test, expect } from '@jest/globals';
import { seatsLeft, tripRoute, tripWhen } from '../tripLine';

describe('tripLine', () => {
  test('route uses short place names', () => {
    expect(
      tripRoute({ originAddress: 'Sariaya Town Plaza, Sariaya, Quezon', destinationAddress: 'Manuel S. Enverga University Foundation, Lucena City' })
    ).toBe('Sariaya Town Plaza → MSEUF');
  });

  test('a repeating trip says how it repeats, not its first date', () => {
    expect(tripWhen({ departureTime: '2026-10-12T22:45:00.000Z', recurrenceType: 'WEEKDAYS' })).toBe('Weekdays');
    expect(tripWhen({ departureTime: '2026-10-12T22:45:00.000Z', recurrenceType: 'ONE_TIME' })).toMatch(/Oct/);
  });

  test('seats left, or Full', () => {
    expect(seatsLeft({ totalSeats: 3, filledSeats: 1 })).toBe('2 of 3 seats left');
    expect(seatsLeft({ totalSeats: 3, filledSeats: 3 })).toBe('Full');
  });
});
