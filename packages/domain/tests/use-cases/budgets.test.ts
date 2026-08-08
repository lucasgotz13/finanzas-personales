import { beforeEach, describe, expect, it } from 'vitest';
import { BudgetService } from '../../src/use-cases/budgets';
import { InMemoryBudgetRepository, InMemoryCategoryRepository, InMemoryTransactionRepository } from '../helpers/fakes';
import { NotFoundError, ValidationError } from '../../src/errors';

function build() {
  const budgets = new InMemoryBudgetRepository();
  const categories = new InMemoryCategoryRepository();
  const transactions = new InMemoryTransactionRepository();
  budgets.reset();
  categories.reset();
  transactions.reset();
  for (const [id, name] of [
    [1, 'Food'],
    [2, 'Transport'],
    [3, 'Housing'],
    [10, 'Salary'],
  ] as const) {
    categories.create({ id, name, parentId: null, deletedAt: null });
  }
  const service = new BudgetService({ budgets, categories, transactions });
  return { budgets, categories, transactions, service };
}

async function addExpense(env: ReturnType<typeof build>, txDate: string, categoryId: number, amountMinor: number, currency: 'ARS' | 'USD' = 'ARS', rate = 1) {
  await env.transactions.create({
    direction: 'expense',
    amountMinor,
    currency,
    rate,
    txDate,
    categoryId,
  });
}

describe('BudgetService.replaceAll (BM-3)', () => {
  it('replaces the whole budget map', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000, 2: 50000 });
    await env.service.replaceAll({ 1: 70000 });
    const stored = await env.budgets.listAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].categoryId).toBe(1);
    expect(stored[0].capMinor).toBe(70000);
  });

  it('rejects a cap <= 0', async () => {
    const env = build();
    await expect(env.service.replaceAll({ 1: 0 })).rejects.toThrow(ValidationError);
  });

  it('rejects an unknown category with NOT_FOUND', async () => {
    const env = build();
    await expect(env.service.replaceAll({ 99: 10000 })).rejects.toThrow(NotFoundError);
  });

  it('rejects a deleted category', async () => {
    const env = build();
    await env.categories.create({ id: 5, name: 'Health', parentId: null, deletedAt: '2026-08-01T12:00:00.000Z' });
    await expect(env.service.replaceAll({ 5: 10000 })).rejects.toThrow(ValidationError);
  });
});

describe('BudgetService.getStatus (BM-1, BM-2, BM-4)', () => {
  it('converts foreign expenses to ARS with the entry rate (BM-1)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000 });
    await addExpense(env, '2026-07-10', 1, 50, 'USD', 950); // 50 * 950 = 47500
    const status = await env.service.getStatus('2026-07');
    const food = status.categories.find((c) => c.categoryId === 1);
    expect(food?.consumed).toBe(47500);
    expect(food?.overBudget).toBe(false);
  });

  it('attributes expenses to the month of their transaction date (BM-1)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000 });
    await addExpense(env, '2026-07-15', 1, 60000); // backdated to July
    await addExpense(env, '2026-08-02', 1, 60000); // August
    const july = await env.service.getStatus('2026-07');
    const aug = await env.service.getStatus('2026-08');
    expect(july.categories[0].consumed).toBe(60000);
    expect(aug.categories[0].consumed).toBe(60000);
  });

  it('never flags an uncapped category and excludes it from the global cap (BM-2)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000 });
    await addExpense(env, '2026-07-10', 1, 5000);
    await addExpense(env, '2026-07-11', 2, 999999); // Transport has no cap
    const status = await env.service.getStatus('2026-07');
    expect(status.categories).toHaveLength(1);
    expect(status.categories[0].categoryId).toBe(1);
    expect(status.global.cap).toBe(100000);
    expect(status.global.consumed).toBe(5000);
    expect(status.global.overBudget).toBe(false);
  });

  it('flags a category over-budget when consumption exceeds its cap (BM-4)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000 });
    await addExpense(env, '2026-07-10', 1, 110000);
    const status = await env.service.getStatus('2026-07');
    expect(status.categories[0].overBudget).toBe(true);
  });

  it('flags the global budget over-budget when sum of consumed exceeds sum of caps (BM-4)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000, 2: 50000 });
    await addExpense(env, '2026-07-10', 1, 120000);
    await addExpense(env, '2026-07-11', 2, 40000);
    const status = await env.service.getStatus('2026-07');
    expect(status.categories[0].overBudget).toBe(true);
    expect(status.global.overBudget).toBe(true); // 160000 > 150000
  });

  it('keeps the global budget OK when only one category is over (BM-4)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000, 2: 50000 });
    await addExpense(env, '2026-07-10', 1, 110000);
    await addExpense(env, '2026-07-11', 2, 30000);
    const status = await env.service.getStatus('2026-07');
    expect(status.categories[0].overBudget).toBe(true);
    expect(status.global.overBudget).toBe(false); // 140000 <= 150000
  });

  it('reflects a raised cap immediately (BM-3)', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 50000 });
    await addExpense(env, '2026-07-10', 1, 60000);
    expect((await env.service.getStatus('2026-07')).categories[0].overBudget).toBe(true);
    await env.service.replaceAll({ 1: 70000 });
    expect((await env.service.getStatus('2026-07')).categories[0].overBudget).toBe(false);
  });

  it('rejects a malformed month key', async () => {
    const env = build();
    await expect(env.service.getStatus('2026-13')).rejects.toThrow(ValidationError);
  });

  it('ignores income when computing consumption', async () => {
    const env = build();
    await env.service.replaceAll({ 1: 100000 });
    await env.transactions.create({ direction: 'income', amountMinor: 900000, currency: 'ARS', rate: 1, txDate: '2026-07-01', categoryId: 10 });
    const status = await env.service.getStatus('2026-07');
    expect(status.global.consumed).toBe(0);
  });
});
