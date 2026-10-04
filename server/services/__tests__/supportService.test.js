const { validateTicketInput, validateMessageBody, SUBJECT_MAX, BODY_MAX } = require('../supportService');

const valid = { category: 'SAFETY', subject: '  Driver was speeding  ', body: '  It happened on the highway.  ' };

describe('validateTicketInput', () => {
  test('accepts a valid ticket and trims the text', () => {
    expect(validateTicketInput(valid)).toEqual({
      data: { category: 'SAFETY', subject: 'Driver was speeding', body: 'It happened on the highway.', relatedTripId: null },
    });
  });

  test('keeps a related trip id', () => {
    expect(validateTicketInput({ ...valid, relatedTripId: 'trip1' }).data.relatedTripId).toBe('trip1');
  });

  test.each([
    [{ ...valid, category: 'URGENT' }, 'category'],
    [{ ...valid, category: undefined }, 'category'],
    [{ ...valid, subject: '   ' }, 'subject'],
    [{ ...valid, subject: 'x'.repeat(SUBJECT_MAX + 1) }, 'subject'],
    [{ ...valid, body: '' }, 'body'],
    [{ ...valid, body: 'x'.repeat(BODY_MAX + 1) }, 'body'],
    [{ ...valid, relatedTripId: 42 }, 'relatedTripId'],
  ])('rejects %j on field %s', (input, field) => {
    expect(validateTicketInput(input)).toEqual({ field });
  });

  test('a subject of exactly the maximum length is accepted', () => {
    expect(validateTicketInput({ ...valid, subject: 'x'.repeat(SUBJECT_MAX) }).data).toBeDefined();
  });

  test('handles a missing body object', () => {
    expect(validateTicketInput(undefined)).toEqual({ field: 'category' });
  });
});

describe('validateMessageBody', () => {
  test('returns the trimmed text, or null when empty, too long or not a string', () => {
    expect(validateMessageBody('  thanks  ')).toBe('thanks');
    expect(validateMessageBody('   ')).toBeNull();
    expect(validateMessageBody('x'.repeat(BODY_MAX + 1))).toBeNull();
    expect(validateMessageBody(5)).toBeNull();
  });
});
