import { describe, test, expect } from '@jest/globals';
import React from 'react';
import { readOptions } from '../Select';

describe('readOptions', () => {
  test('reads <option> children as the dropdown’s choices, including a disabled placeholder', () => {
    const children = (
      <>
        <option value="" disabled>
          Choose one
        </option>
        {[2, 3].map((n) => (
          <option key={n} value={n}>
            {n} seats
          </option>
        ))}
      </>
    );
    expect(readOptions(children)).toEqual([
      { value: '', label: 'Choose one', disabled: true },
      { value: '2', label: '2 seats', disabled: false },
      { value: '3', label: '3 seats', disabled: false },
    ]);
  });

  test('an option without a value uses its text, like a <select>', () => {
    expect(readOptions(<option>Diesel</option>)).toEqual([{ value: 'Diesel', label: 'Diesel', disabled: false }]);
  });
});
