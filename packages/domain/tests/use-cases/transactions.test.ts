import { describe, expect, it, beforeEach } from 'vitest';
import { TransactionService } from '../../src/use-cases/transactions';
import type { TransactionPatch } from '../../src/use-cases/transactions';
import { InMemoryTransactionRepository, InMemoryCategoryRepository } from '../helpers/fakes';
import { ValidationError, NotFoundError } from '../../src/errors';

const today = '2026-08-08';

function build() {
  const transactions = new InMemoryTransactionRepository();
  const categories = new InMemoryCategoryRepository();
  transactions.reset();
  categories.reset();
  // Seeded default categories (CM-2): stable ids 1..3 and 10 (Salary).
  for (const [id, name] of [
    [1, 'Food'],
    [2, 'Transport'],
    [3, 'Housing'],
    [10, 'Salary'],
  ] as const) {
    categories.create({ id, name, parentId: null, deletedAt: null });
  }
  const service = new TransactionService({ transactions, categories });
  return { transactions, categories, service };
}

describe('TransactionService.create (ET-1, ET-2, IT-1, IT-2)', () => {
  let env: ReturnType<typeof build>;
  beforeEach(() => {
    env = build();
  });

  it('creates an ARS expense with rate 1', async () => {
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 15000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
      note: 'Lunch',
    });
    expect(tx.amountMinor).toBe(15000);
    expect(tx.rate).toBe(1);
    expect(tx.note).toBe('Lunch');
  });

  it('persists the FX rate captured at entry for USD (ET-1)', async () => {
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 2500,
      currency: 'USD',
      rate: 950,
      txDate: today,
      categoryId: 1,
    });
    expect(tx.currency).toBe('USD');
    expect(tx.rate).toBe(950);
  });

  it('rejects a USD expense without a rate and persists nothing (ET-1)', async () => {
    await expect(
      env.service.create({ direction: 'expense', amountMinor: 2500, currency: 'USD', txDate: today, categoryId: 1 }),
    ).rejects.toThrow(ValidationError);
    expect(await env.transactions.list({})).toHaveLength(0);
  });

  it('rejects a negative amount and persists nothing (ET-2)', async () => {
    await expect(
      env.service.create({ direction: 'expense', amountMinor: -100, currency: 'ARS', txDate: today, categoryId: 1 }),
    ).rejects.toThrow(ValidationError);
    expect(await env.transactions.list({})).toHaveLength(0);
  });

  it('accepts a backdated transaction and attributes it to the given date (ET-3)', async () => {
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 5000,
      currency: 'ARS',
      txDate: '2026-07-15',
      categoryId: 1,
    });
    expect(tx.txDate).toBe('2026-07-15');
  });

  it('accepts duplicate entries (ET-6)', async () => {
    const input = { direction: 'expense' as const, amountMinor: 500, currency: 'ARS', txDate: '2026-07-01', categoryId: 1 };
    const first = await env.service.create(input);
    const second = await env.service.create(input);
    expect(first.id).not.toBe(second.id);
    expect(await env.transactions.list({})).toHaveLength(2);
  });

  it('registers income with the same currency/FX discipline (IT-1)', async () => {
    const tx = await env.service.create({
      direction: 'income',
      amountMinor: 900000,
      currency: 'ARS',
      txDate: '2026-08-01',
      categoryId: 10,
    });
    expect(tx.direction).toBe('income');
    expect(tx.amountMinor).toBe(900000);
  });

  it('rejects zero income (IT-2)', async () => {
    await expect(
      env.service.create({ direction: 'income', amountMinor: 0, currency: 'ARS', txDate: today, categoryId: 10 }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an unknown category with NOT_FOUND', async () => {
    await expect(
      env.service.create({ direction: 'expense', amountMinor: 100, currency: 'ARS', txDate: today, categoryId: 999 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a soft-deleted category (ET-2, CM-4)', async () => {
    await env.categories.create({ id: 5, name: 'Health', parentId: null, deletedAt: '2026-08-01T12:00:00.000Z' });
    await expect(
      env.service.create({ direction: 'expense', amountMinor: 100, currency: 'ARS', txDate: today, categoryId: 5 }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('TransactionService.update (ET-5)', () => {
  it('re-validates the edited values and keeps the original on rejection', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    await expect(
      env.service.update(tx.id as number, {
        direction: 'expense',
        amountMinor: 0,
        currency: 'ARS',
        txDate: today,
        categoryId: 1,
      }),
    ).rejects.toThrow(ValidationError);
    const stored = await env.transactions.findById(tx.id as number);
    expect(stored?.amountMinor).toBe(1000);
  });

  it('allows editing amount, currency, rate, date, category and note (ET-5)', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    const updated = await env.service.update(tx.id as number, {
      direction: 'expense',
      amountMinor: 5000,
      currency: 'USD',
      rate: 950,
      txDate: '2026-06-10',
      categoryId: 2,
      note: 'Edited',
    });
    expect(updated.amountMinor).toBe(5000);
    expect(updated.currency).toBe('USD');
    expect(updated.rate).toBe(950);
    expect(updated.txDate).toBe('2026-06-10');
    expect(updated.categoryId).toBe(2);
    expect(updated.note).toBe('Edited');
  });

  it('throws NOT_FOUND for a missing transaction', async () => {
    const env = build();
    await expect(
      env.service.update(999, { direction: 'expense', amountMinor: 100, currency: 'ARS', txDate: today, categoryId: 1 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('applies a partial patch and keeps the untouched fields', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 2500,
      currency: 'USD',
      rate: 950,
      txDate: today,
      categoryId: 1,
      note: 'Before',
    });
    const updated = await env.service.update(tx.id as number, { note: 'After' });
    expect(updated.note).toBe('After');
    expect(updated.currency).toBe('USD');
    expect(updated.rate).toBe(950);
    expect(updated.amountMinor).toBe(2500);
    expect(updated.txDate).toBe(today);
    expect(updated.categoryId).toBe(1);
  });

  it('returns the unchanged transaction for an empty patch', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    const updated = await env.service.update(tx.id as number, {});
    expect(updated).toMatchObject({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      rate: 1,
      txDate: today,
      categoryId: 1,
    });
  });

  it('rejects changing ARS to USD without a rate (W1, ET-1)', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    await expect(env.service.update(tx.id as number, { currency: 'USD' })).rejects.toMatchObject({
      message: 'Rate is required when changing currency to a non-ARS currency',
      details: ['rate is required for currency USD'],
      reason: 'RATE_REQUIRED_FOR_CURRENCY',
      meta: { currency: 'USD' },
    });
    const stored = await env.transactions.findById(tx.id as number);
    expect(stored).toMatchObject({ currency: 'ARS', rate: 1 });
  });

  it('accepts changing ARS to USD when the patch carries a rate (W1, ET-1)', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    const updated = await env.service.update(tx.id as number, { currency: 'USD', rate: 950 });
    expect(updated.currency).toBe('USD');
    expect(updated.rate).toBe(950);
  });

  it('ignores unknown keys in the patch', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    const updated = await env.service.update(tx.id as number, {
      note: 'x',
      hacker: 'yes',
    } as TransactionPatch);
    expect(updated.note).toBe('x');
    const stored = await env.transactions.findById(tx.id as number);
    expect((stored as unknown as Record<string, unknown>).hacker).toBeUndefined();
  });
});

describe('TransactionService.remove (ET-5)', () => {
  it('deletes an existing transaction', async () => {
    const env = build();
    const tx = await env.service.create({
      direction: 'expense',
      amountMinor: 1000,
      currency: 'ARS',
      txDate: today,
      categoryId: 1,
    });
    await env.service.remove(tx.id as number);
    expect(await env.transactions.list({})).toHaveLength(0);
  });

  it('throws NOT_FOUND when deleting a missing transaction', async () => {
    const env = build();
    await expect(env.service.remove(999)).rejects.toThrow(NotFoundError);
  });
});

describe('TransactionService.list', () => {
  it('filters by direction, category and date range', async () => {
    const env = build();
    await env.service.create({ direction: 'expense', amountMinor: 100, currency: 'ARS', txDate: '2026-07-01', categoryId: 1 });
    await env.service.create({ direction: 'expense', amountMinor: 200, currency: 'ARS', txDate: '2026-08-01', categoryId: 2 });
    await env.service.create({ direction: 'income', amountMinor: 900000, currency: 'ARS', txDate: '2026-08-02', categoryId: 10 });

    const expenses = await env.service.list({ direction: 'expense' });
    expect(expenses).toHaveLength(2);

    const category2 = await env.service.list({ categoryId: 2 });
    expect(category2).toHaveLength(1);
    expect(category2[0].amountMinor).toBe(200);

    const august = await env.service.list({ from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z') });
    expect(august).toHaveLength(2);
  });
});
