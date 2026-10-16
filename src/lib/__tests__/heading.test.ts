import { describe, test, expect } from '@jest/globals';
import { bearing, nextHeading } from '../heading';

const P = { lat: 13.94, lng: 121.6 };

describe('heading', () => {
  test('bearing points north, east, south and west', () => {
    expect(bearing(P, { lat: 13.95, lng: 121.6 })).toBeCloseTo(0, 0);
    expect(bearing(P, { lat: 13.94, lng: 121.61 })).toBeCloseTo(90, 0);
    expect(bearing(P, { lat: 13.93, lng: 121.6 })).toBeCloseTo(180, 0);
    expect(bearing(P, { lat: 13.94, lng: 121.59 })).toBeCloseTo(270, 0);
  });

  test('the phone’s GPS heading wins when it has one', () => {
    expect(nextHeading({ from: null, heading: null }, P, 42).heading).toBe(42);
  });

  test('without it, the direction from the last point once the car moved', () => {
    const first = nextHeading({ from: null, heading: null }, P);
    expect(first.heading).toBeNull();
    const east = nextHeading(first, { lat: 13.94, lng: 121.6005 }); // about 54 m east
    expect(east.heading).toBeCloseTo(90, 0);
  });

  test('a few metres of GPS wobble keep the last heading', () => {
    const state = { from: P, heading: 90 };
    expect(nextHeading(state, { lat: 13.94002, lng: 121.6 })).toBe(state); // about 2 m north
  });
});
