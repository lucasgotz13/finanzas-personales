import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/entities/budget';
import { ValidationError } from '../../src/errors';

describe('Budget entity', () => {
  it('creates a monthly cap in ARS minor units (BM-1)', () => {
    const budget = new Budget({ categoryId: 1, capMinor: 100000 });
    expect(budget.categoryId).toBe(1);
    expect(budget.capMinor).toBe(100000);
  });

  it('rejects a cap <= 0 (BM-1)', () => {
    expect(() => new Budget({ categoryId: 1, capMinor: 0 })).toThrow(ValidationError);
    expect(() => new Budget({ categoryId: 1, capMinor: -50 })).toThrow(ValidationError);
  });

  it('rejects a non-integer cap', () => {
    expect(() => new Budget({ categoryId: 1, capMinor: 10.5 })).toThrow(ValidationError);
  });

  it('rejects an invalid categoryId', () => {
    expect(() => new Budget({ categoryId: 0, capMinor: 100 })).toThrow(ValidationError);
  });
});
