import { beforeEach, describe, expect, it } from 'vitest';
import { SummaryService } from '../../src/use-cases/summaries';
import { InMemoryCategoryRepository, InMemoryTransactionRepository } from '../helpers/fakes';

function build() {
  const categories = new InMemoryCategoryRepository();
  const transactions = new InMemoryTransactionRepository();
  categories.reset();
  transactions.reset();
  for (const [id, name] of [
    [1, 'Food'],
    [2, 'Transport'],
    [5, 'Health'],
    [10, 'Salary'],
  ] as const) {
    categories.create({ id, name, parentId: null, deletedAt: null });
  }
  const service = new SummaryService({ transactions, categories });
  return { categories, transactions, service };
}

function midMonth(month: number): Date {
  return new Date(Date.UTC(2026, month - 1, 15, 12, 0, 0));
}

async function addTx(
  env: ReturnType<typeof build>,
  txDate: string,
  direction: 'expense' | 'income',
  amountMinor: number,
  currency: 'ARS' | 'USD',
  categoryId: number,
) {
  await env.transactions.create({ direction, amountMinor, currency, rate: 1, txDate, categoryId, note: '' });
}

describe('SummaryService.getSummary — period grouping (PS-1)', () => {
  it('attributes a backdated entry to the July period (PS-1)', async () => {
    const env = build();
    await addTx(env, '2026-07-15', 'expense', 5000, 'ARS', 1);
    const july = await env.service.getSummary('month', midMonth(7));
    const august = await env.service.getSummary('month', midMonth(8));
    expect(july.currencies.find((c) => c.currency === 'ARS')?.expense).toBe(5000);
    expect(august.currencies.find((c) => c.currency === 'ARS')?.expense).toBe(0);
  });

  it('returns zeroed totals for an empty period without error (PS-1)', async () => {
    const env = build();
    const summary = await env.service.getSummary('month', midMonth(6));
    expect(summary.period).toBe('2026-06');
    expect(summary.currencies).toHaveLength(2);
    for (const c of summary.currencies) {
      expect(c.expense).toBe(0);
      expect(c.income).toBe(0);
      expect(c.netFlow).toBe(0);
    }
    expect(summary.categories).toEqual([]);
  });

  it('groups by quarter and year', async () => {
    const env = build();
    await addTx(env, '2026-02-10', 'expense', 1000, 'ARS', 1);
    await addTx(env, '2026-05-10', 'expense', 2000, 'ARS', 1);
    const q1 = await env.service.getSummary('quarter', midMonth(2));
    const q2 = await env.service.getSummary('quarter', midMonth(5));
    const year = await env.service.getSummary('year', midMonth(5));
    expect(q1.period).toBe('2026-Q1');
    expect(q1.currencies[0].expense).toBe(1000);
    expect(q2.period).toBe('2026-Q2');
    expect(q2.currencies[0].expense).toBe(2000);
    expect(year.period).toBe('2026');
    expect(year.currencies[0].expense).toBe(3000);
  });
});

describe('SummaryService.getSummary — net flow and savings rate (PS-2, PS-3, IT-3)', () => {
  it('reports net flow per currency, never mixed (PS-2, PS-4)', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'income', 900000, 'ARS', 10);
    await addTx(env, '2026-07-02', 'expense', 600000, 'ARS', 1);
    await addTx(env, '2026-07-03', 'income', 100, 'USD', 10);
    const summary = await env.service.getSummary('month', midMonth(7));
    const ars = summary.currencies.find((c) => c.currency === 'ARS');
    const usd = summary.currencies.find((c) => c.currency === 'USD');
    expect(ars?.netFlow).toBe(300000);
    expect(usd?.netFlow).toBe(100);
  });

  it('reports savings rate as undefined when income is zero (PS-3)', async () => {
    const env = build();
    await addTx(env, '2026-07-02', 'expense', 600000, 'ARS', 1);
    const summary = await env.service.getSummary('month', midMonth(7));
    expect(summary.currencies.find((c) => c.currency === 'ARS')?.savingsRate).toBeNull();
  });

  it('computes savings rate (income - expenses) / income (PS-3, IT-3)', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'income', 900000, 'ARS', 10);
    await addTx(env, '2026-07-02', 'expense', 600000, 'ARS', 1);
    const summary = await env.service.getSummary('month', midMonth(7));
    expect(summary.currencies.find((c) => c.currency === 'ARS')?.savingsRate).toBe(0.333);
  });

  it('computes savings rate per currency separately (IT-3)', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'income', 1000, 'USD', 10);
    await addTx(env, '2026-07-02', 'expense', 500, 'USD', 1);
    await addTx(env, '2026-07-03', 'income', 900000, 'ARS', 10);
    await addTx(env, '2026-07-04', 'expense', 900000, 'ARS', 1);
    const summary = await env.service.getSummary('month', midMonth(7));
    const usd = summary.currencies.find((c) => c.currency === 'USD');
    const ars = summary.currencies.find((c) => c.currency === 'ARS');
    expect(usd?.savingsRate).toBe(0.5);
    expect(ars?.savingsRate).toBe(0);
  });
});

describe('SummaryService.getSummary — per-category totals (PS-4, PS-5)', () => {
  it('reports totals per category and per currency, never summed across currencies (PS-4)', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'expense', 1000, 'ARS', 1);
    await addTx(env, '2026-07-02', 'expense', 500, 'USD', 1);
    const summary = await env.service.getSummary('month', midMonth(7));
    const foodArs = summary.categories.find((c) => c.categoryId === 1 && c.currency === 'ARS');
    const foodUsd = summary.categories.find((c) => c.categoryId === 1 && c.currency === 'USD');
    expect(foodArs?.expense).toBe(1000);
    expect(foodUsd?.expense).toBe(500);
  });

  it('groups expenses of a deleted category under its current name (PS-5)', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'expense', 8000, 'ARS', 5);
    await env.categories.update(5, { id: 5, name: 'Salud', parentId: null, deletedAt: '2026-08-01T12:00:00.000Z' });
    const summary = await env.service.getSummary('month', midMonth(7));
    const health = summary.categories.find((c) => c.categoryId === 5);
    expect(health?.name).toBe('Salud');
    expect(health?.expense).toBe(8000);
  });

  it('reports income per category too', async () => {
    const env = build();
    await addTx(env, '2026-07-01', 'income', 900000, 'ARS', 10);
    const summary = await env.service.getSummary('month', midMonth(7));
    const salary = summary.categories.find((c) => c.categoryId === 10);
    expect(salary?.income).toBe(900000);
  });
});
