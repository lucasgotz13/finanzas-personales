import { describe, expect, it } from 'vitest';
import { Transaction } from '../../src/entities/transaction';
import { ValidationError } from '../../src/errors';

const base = {
  direction: 'expense' as const,
  amountMinor: 15000,
  currency: 'ARS' as const,
  txDate: '2026-07-15',
  categoryId: 1,
};

describe('Transaction entity', () => {
  it('creates an ARS expense with rate normalized to 1 (ET-1)', () => {
    const tx = new Transaction({ ...base, note: 'Lunch' });
    expect(tx.amountMinor).toBe(15000);
    expect(tx.currency).toBe('ARS');
    expect(tx.rate).toBe(1);
    expect(tx.txDate).toBe('2026-07-15');
    expect(tx.categoryId).toBe(1);
    expect(tx.note).toBe('Lunch');
  });

  it('creates a USD expense with the FX rate captured at entry (ET-1)', () => {
    const tx = new Transaction({ ...base, amountMinor: 2500, currency: 'USD', rate: 950 });
    expect(tx.rate).toBe(950);
  });

  it('creates an income transaction (IT-1)', () => {
    const tx = new Transaction({ ...base, direction: 'income', amountMinor: 900000 });
    expect(tx.direction).toBe('income');
  });

  it('allows an empty note (ET-4)', () => {
    expect(new Transaction({ ...base, note: '' }).note).toBe('');
    expect(new Transaction(base).note).toBe('');
  });

  it('rejects amount <= 0 (ET-2)', () => {
    expect(() => new Transaction({ ...base, amountMinor: 0 })).toThrow(ValidationError);
    expect(() => new Transaction({ ...base, amountMinor: -100 })).toThrow(ValidationError);
  });

  it('rejects a non-integer amount (ET-2)', () => {
    expect(() => new Transaction({ ...base, amountMinor: 10.5 })).toThrow(ValidationError);
  });

  it('rejects an unsupported currency (ET-2)', () => {
    expect(() => new Transaction({ ...base, currency: 'EUR' as never })).toThrow(ValidationError);
  });

  it('rejects USD without a rate and with rate <= 0 (ET-2)', () => {
    expect(() => new Transaction({ ...base, currency: 'USD' })).toThrow(ValidationError);
    expect(() => new Transaction({ ...base, currency: 'USD', rate: 0 })).toThrow(ValidationError);
    expect(() => new Transaction({ ...base, currency: 'USD', rate: -5 })).toThrow(ValidationError);
  });

  it('rejects an invalid transaction date (ET-3)', () => {
    expect(() => new Transaction({ ...base, txDate: '2026-13-40' })).toThrow(ValidationError);
    expect(() => new Transaction({ ...base, txDate: 'not-a-date' })).toThrow(ValidationError);
  });

  it('rejects a missing or non-positive categoryId', () => {
    expect(() => new Transaction({ ...base, categoryId: 0 })).toThrow(ValidationError);
    expect(() => new Transaction({ ...base, categoryId: -1 })).toThrow(ValidationError);
  });

  it('rejects an unknown direction', () => {
    expect(() => new Transaction({ ...base, direction: 'transfer' as never })).toThrow(ValidationError);
  });
});
