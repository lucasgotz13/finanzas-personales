import { describe, expect, it } from 'vitest';
import { PeriodKey, arDateString, isArDateString } from '../../src/vo/period-key';
import { ValidationError } from '../../src/errors';

describe('PeriodKey', () => {
  describe('of (AR timezone attribution, PS-1)', () => {
    it('attributes a mid-month instant to its calendar month', () => {
      const key = PeriodKey.of('month', new Date('2026-07-15T12:00:00Z'));
      expect(key.key).toBe('2026-07');
    });

    it('uses America/Argentina/Buenos_Aires boundaries (UTC-3, no DST)', () => {
      // 02:59 UTC is still June 30 23:59 in Buenos Aires
      expect(PeriodKey.of('month', new Date('2026-07-01T02:59:00Z')).key).toBe('2026-06');
      // 03:00 UTC is July 1 00:00 in Buenos Aires
      expect(PeriodKey.of('month', new Date('2026-07-01T03:00:00Z')).key).toBe('2026-07');
    });

    it('computes the quarter from the month', () => {
      expect(PeriodKey.of('quarter', new Date('2026-02-15T12:00:00Z')).key).toBe('2026-Q1');
      expect(PeriodKey.of('quarter', new Date('2026-05-15T12:00:00Z')).key).toBe('2026-Q2');
      expect(PeriodKey.of('quarter', new Date('2026-12-15T12:00:00Z')).key).toBe('2026-Q4');
    });

    it('computes the year', () => {
      expect(PeriodKey.of('year', new Date('2026-08-08T12:00:00Z')).key).toBe('2026');
    });
  });

  describe('bounds', () => {
    it('returns AR-tz month bounds as UTC instants [start, end)', () => {
      const { start, end } = PeriodKey.parse('month', '2026-07').bounds();
      expect(start.toISOString()).toBe('2026-07-01T03:00:00.000Z');
      expect(end.toISOString()).toBe('2026-08-01T03:00:00.000Z');
    });

    it('returns AR-tz quarter bounds', () => {
      const { start, end } = PeriodKey.parse('quarter', '2026-Q2').bounds();
      expect(start.toISOString()).toBe('2026-04-01T03:00:00.000Z');
      expect(end.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    });

    it('returns AR-tz year bounds', () => {
      const { start, end } = PeriodKey.parse('year', '2026').bounds();
      expect(start.toISOString()).toBe('2026-01-01T03:00:00.000Z');
      expect(end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
    });
  });

  describe('parse', () => {
    it('rejects malformed month keys', () => {
      expect(() => PeriodKey.parse('month', '2026-13')).toThrow(ValidationError);
      expect(() => PeriodKey.parse('month', '202607')).toThrow(ValidationError);
      expect(() => PeriodKey.parse('month', '')).toThrow(ValidationError);
    });

    it('rejects malformed quarter keys', () => {
      expect(() => PeriodKey.parse('quarter', '2026-Q5')).toThrow(ValidationError);
      expect(() => PeriodKey.parse('quarter', '2026-Q0')).toThrow(ValidationError);
    });

    it('rejects malformed year keys', () => {
      expect(() => PeriodKey.parse('year', '26')).toThrow(ValidationError);
      expect(() => PeriodKey.parse('year', 'abcd')).toThrow(ValidationError);
    });
  });
});

describe('arDateString / isArDateString', () => {
  it('formats an instant as an AR-calendar date string', () => {
    // 2026-07-01T02:59Z is still June 30 in Buenos Aires
    expect(arDateString(new Date('2026-07-01T02:59:00Z'))).toBe('2026-06-30');
    expect(arDateString(new Date('2026-07-01T03:00:00Z'))).toBe('2026-07-01');
  });

  it('accepts real calendar dates only', () => {
    expect(isArDateString('2026-07-15')).toBe(true);
    expect(isArDateString('2026-13-01')).toBe(false);
    expect(isArDateString('2026-02-30')).toBe(false);
    expect(isArDateString('2026/07/15')).toBe(false);
    expect(isArDateString('not-a-date')).toBe(false);
  });
});
