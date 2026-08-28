import { describe, expect, it } from 'vitest';
import { formatPctEsAr, inputValueEsAr, parseEsArAmount } from '../amount';

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

describe('inputValueEsAr (S7 prefill formatting)', () => {
  it.each([
    [50000, '500'],
    [10050, '100,5'],
    [100, '1'],
    [5, '0,05'],
    [150, '1,5'],
    [-2030, '-20,3'],
    [0, '0'],
  ] as Array<[number, string]>)('formats %i minor units as %s', (minor, expected) => {
    expect(inputValueEsAr(minor, 'ARS')).toBe(expected);
  });

  it.each([50000, 10050, 150, 5, 12345678])('round-trips %i through parseEsArAmount', (minor) => {
    expect(Math.round((parseEsArAmount(inputValueEsAr(minor, 'USD')) as number) * 100)).toBe(minor);
  });
});

describe('formatPctEsAr (S6 rate register)', () => {
  it.each([
    [0.333, '33,3%'],
    [0.5, '50,0%'],
    [0, '0,0%'],
  ] as Array<[number, string]>)('formats %i as %s', (value, expected) => {
    expect(formatPctEsAr(value)).toBe(expected);
  });
});
