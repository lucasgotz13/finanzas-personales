import { describe, expect, it } from 'vitest';
import { Money, SUPPORTED_CURRENCIES } from '../../src/vo/money';
import { ValidationError } from '../../src/errors';

describe('Money', () => {
  it('stores an ARS amount with rate 1', () => {
    const money = new Money({ amountMinor: 15000, currency: 'ARS' });
    expect(money.amountMinor).toBe(15000);
    expect(money.currency).toBe('ARS');
    expect(money.rate).toBe(1);
  });

  it('requires and persists an FX rate for non-base currencies (ET-1)', () => {
    const money = new Money({ amountMinor: 2500, currency: 'USD', rate: 950 });
    expect(money.amountMinor).toBe(2500);
    expect(money.currency).toBe('USD');
    expect(money.rate).toBe(950);
  });

  it('rejects a zero amount (ET-2)', () => {
    expect(() => new Money({ amountMinor: 0, currency: 'ARS' })).toThrow(ValidationError);
  });

  it('rejects a negative amount (ET-2)', () => {
    expect(() => new Money({ amountMinor: -100, currency: 'ARS' })).toThrow(ValidationError);
  });

  it('rejects a non-integer amount', () => {
    expect(() => new Money({ amountMinor: 10.5, currency: 'ARS' })).toThrow(ValidationError);
  });

  it('rejects an unsupported currency (ET-2)', () => {
    expect(() => new Money({ amountMinor: 10, currency: 'EUR' as never })).toThrow(ValidationError);
  });

  it('rejects USD without a rate (ET-1)', () => {
    expect(() => new Money({ amountMinor: 2500, currency: 'USD' })).toThrow(ValidationError);
  });

  it('rejects a zero rate for USD (ET-2)', () => {
    expect(() => new Money({ amountMinor: 2500, currency: 'USD', rate: 0 })).toThrow(ValidationError);
  });

  it('rejects a negative rate for USD', () => {
    expect(() => new Money({ amountMinor: 2500, currency: 'USD', rate: -1 })).toThrow(ValidationError);
  });

  it('normalizes an ARS rate to 1', () => {
    expect(new Money({ amountMinor: 100, currency: 'ARS', rate: 999 }).rate).toBe(1);
  });

  it('converts to ARS minor units using the entry rate, rounding once (BM-1)', () => {
    expect(new Money({ amountMinor: 5000, currency: 'USD', rate: 950 }).toArsMinor()).toBe(4750000);
    expect(new Money({ amountMinor: 3, currency: 'USD', rate: 1.5 }).toArsMinor()).toBe(5);
  });

  it('supports only ARS and USD in v1', () => {
    expect(SUPPORTED_CURRENCIES).toEqual(['ARS', 'USD']);
  });
});
