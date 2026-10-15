import { describe, test, expect } from '@jest/globals';
import { shortPlace, placeName } from '../places';

describe('shortPlace', () => {
  test('writes the campus as MSEUF inside any sentence', () => {
    expect(shortPlace('Miguel hasn’t started the 9:54 PM trip to Manuel S. Enverga University Foundation, Lucena City yet.')).toBe(
      'Miguel hasn’t started the 9:54 PM trip to MSEUF yet.'
    );
    expect(shortPlace('Your trip to Enverga University, Lucena City departs soon.')).toBe('Your trip to MSEUF departs soon.');
  });

  test('leaves other places alone', () => {
    expect(shortPlace('Tayabas Basilica, Tayabas City')).toBe('Tayabas Basilica, Tayabas City');
  });
});

describe('placeName', () => {
  test('keeps the first part of an address, and the campus as MSEUF', () => {
    expect(placeName('Sariaya Town Plaza, Sariaya, Quezon')).toBe('Sariaya Town Plaza');
    expect(placeName('Manuel S. Enverga University Foundation, Lucena City')).toBe('MSEUF');
  });
});
