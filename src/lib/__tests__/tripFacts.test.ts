import { describe, test, expect } from '@jest/globals';
import { seatsFact, priceFact, carFact, ruleFact } from '../tripFacts';

describe('trip facts: a short value and its full meaning', () => {
  test('seats', () => {
    expect(seatsFact(3, 1)).toEqual({ short: '2 left', long: '2 of 3 seats left, 1 taken' });
    expect(seatsFact(3, 2)).toEqual({ short: '1 left', long: '1 of 3 seats left, 2 taken' });
    expect(seatsFact(2, 2)).toEqual({ short: 'Full', long: 'All 2 seats are taken' });
    expect(seatsFact(4, 0)).toEqual({ short: '4 left', long: '4 of 4 seats left, none taken' });
  });
  test('fuel share per seat', () => {
    expect(priceFact(25.4)).toEqual({ short: '₱25/seat', long: 'Fuel share per seat, paid to the driver in person' });
    expect(priceFact(null)).toBeNull();
  });
  test('car', () => {
    expect(carFact({ make: 'Toyota', model: 'Vios', color: 'Silver' })).toEqual({ short: 'Vios', long: 'Toyota Vios, Silver' });
  });
  test('trip rules', () => {
    expect(ruleFact('Women+ trip')).toEqual({ short: 'Women+', long: 'Women+ trip: only women and non-binary riders can join' });
    expect(ruleFact('Familiar riders only')).toEqual({ short: 'Familiar', long: 'Familiar riders only: riders who have ridden with this driver before' });
    expect(ruleFact('Something new')).toEqual({ short: 'Something new', long: 'Something new' });
  });
});
