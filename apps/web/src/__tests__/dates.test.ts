import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, formatRefMonth } from '../dates';

describe('dates (es-AR)', () => {
  it('formatMonth renders the long month name and year', () => {
    expect(formatMonth('2026-08')).toBe('Agosto 2026');
    expect(formatMonth('2026-07')).toBe('Julio 2026');
  });

  it('formatMonth falls back to the raw input when unparseable', () => {
    expect(formatMonth('not-a-month')).toBe('not-a-month');
    expect(formatMonth('2026-13')).toBe('2026-13');
    expect(formatMonth('')).toBe('');
  });

  it('formatDate renders dd/mm/yyyy', () => {
    expect(formatDate('2026-08-11')).toBe('11/08/2026');
    expect(formatDate('2026-07-01')).toBe('01/07/2026');
  });

  it('formatDate falls back to the raw input when unparseable', () => {
    expect(formatDate('11/08/2026')).toBe('11/08/2026');
    expect(formatDate('2026-02-30')).toBe('2026-02-30');
  });

  it('formatRefMonth renders the short month name and year for full dates and month keys', () => {
    expect(formatRefMonth('2026-07-31')).toBe('jul 2026');
    expect(formatRefMonth('2026-07')).toBe('jul 2026');
  });

  it('formatRefMonth falls back to the raw input when unparseable', () => {
    expect(formatRefMonth('2026-13')).toBe('2026-13');
  });
});
