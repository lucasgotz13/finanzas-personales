import { describe, expect, it } from 'vitest';
import { parseEsArAmount } from '../amount';

describe('parseEsArAmount', () => {
  it.each([
    ['1200', 1200],
    ['12,50', 12.5],
    ['1200.5', 1200.5],
    ['12.50', 12.5],
    ['1.234', 1234],
    ['1.234,56', 1234.56],
    ['1.234.567', 1234567],
    ['0.50', 0.5],
    ['.50', 0.5],
  ] as Array<[string, number]>)('parses %s as %s', (input, expected) => {
    expect(parseEsArAmount(input)).toBe(expected);
  });

  it.each([
    '',
    '1e3',
    '12,50,75',
    '1.2.3',
    'abc',
  ])('rejects invalid input %s', (input) => {
    expect(parseEsArAmount(input)).toBeNull();
  });
});
