import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('GET/PUT /api/v1/budgets (BM-3)', () => {
  it('returns an empty map initially and stores the map on PUT', async () => {
    env = createTestApp();
    const app = env.app;
    const empty = await request(app).get('/api/v1/budgets');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({});
    const put = await request(app).put('/api/v1/budgets').send({ 1: 100000, 2: 50000 });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ 1: 100000, 2: 50000 });
    const again = await request(app).get('/api/v1/budgets');
    expect(again.body).toEqual({ 1: 100000, 2: 50000 });
  });

  it('PUT replaces the whole map (BM-3)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).put('/api/v1/budgets').send({ 1: 100000, 2: 50000 });
    await request(app).put('/api/v1/budgets').send({ 1: 70000 });
    const res = await request(app).get('/api/v1/budgets');
    expect(res.body).toEqual({ 1: 70000 });
  });

  it('rejects a non-positive cap with 422', async () => {
    env = createTestApp();
    const res = await request(env.app).put('/api/v1/budgets').send({ 1: 0 });
    expect(res.status).toBe(422);
  });

  it('rejects an unknown category with 404', async () => {
    env = createTestApp();
    const res = await request(env.app).put('/api/v1/budgets').send({ 99: 10000 });
    expect(res.status).toBe(404);
  });

  it('rejects a deleted category with 422', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5');
    const res = await request(app).put('/api/v1/budgets').send({ 5: 10000 });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/budgets/status (BM-1, BM-2, BM-4)', () => {
  it('computes consumption converting foreign expenses at entry rate (BM-1)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).put('/api/v1/budgets').send({ 1: 100000 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 50, currency: 'USD', rate: 950, date: '2026-07-10', categoryId: 1 });
    const res = await request(app).get('/api/v1/budgets/status?month=2026-07');
    expect(res.status).toBe(200);
    expect(res.body.categories[0]).toMatchObject({ categoryId: 1, cap: 100000, consumed: 47500, overBudget: false });
  });

  it('attributes expenses to their transaction-date month (BM-1)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).put('/api/v1/budgets').send({ 1: 100000 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 60000, currency: 'ARS', date: '2026-07-15', categoryId: 1 });
    const july = await request(app).get('/api/v1/budgets/status?month=2026-07');
    const august = await request(app).get('/api/v1/budgets/status?month=2026-08');
    expect(july.body.categories[0].consumed).toBe(60000);
    expect(august.body.categories[0].consumed).toBe(0);
  });

  it('reports global over-budget when budgeted consumption exceeds the sum of caps (BM-4)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).put('/api/v1/budgets').send({ 1: 100000, 2: 50000 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 120000, currency: 'ARS', date: '2026-07-10', categoryId: 1 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 40000, currency: 'ARS', date: '2026-07-11', categoryId: 2 });
    const res = await request(app).get('/api/v1/budgets/status?month=2026-07');
    expect(res.body.categories[0].overBudget).toBe(true);
    expect(res.body.global).toEqual({ cap: 150000, consumed: 160000, overBudget: true });
  });

  it('excludes uncapped categories from status and global (BM-2)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).put('/api/v1/budgets').send({ 1: 100000 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 999999, currency: 'ARS', date: '2026-07-10', categoryId: 2 });
    const res = await request(app).get('/api/v1/budgets/status?month=2026-07');
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.global.cap).toBe(100000);
  });

  it('rejects a malformed month with 422', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/budgets/status?month=2026-13');
    expect(res.status).toBe(422);
  });

  it('requires the month parameter', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/budgets/status');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/summaries (PS-1..5, IT-3)', () => {
  it('returns per-currency totals, net flow and savings rate (PS-2, PS-3, PS-4)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 900000, currency: 'ARS', date: '2026-07-01', categoryId: 10 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 600000, currency: 'ARS', date: '2026-07-02', categoryId: 1 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 100, currency: 'USD', rate: 950, date: '2026-07-03', categoryId: 10 });
    const res = await request(app).get('/api/v1/summaries?period=month&date=2026-07-15');
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('2026-07');
    const ars = res.body.currencies.find((c: { currency: string }) => c.currency === 'ARS');
    const usd = res.body.currencies.find((c: { currency: string }) => c.currency === 'USD');
    expect(ars).toMatchObject({ expense: 600000, income: 900000, netFlow: 300000, savingsRate: 0.333 });
    expect(usd).toMatchObject({ expense: 0, income: 100, netFlow: 100 });
  });

  it('returns zeroed totals for an empty period (PS-1)', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/summaries?period=month&date=2026-06-15');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
    for (const c of res.body.currencies) {
      expect(c.expense).toBe(0);
      expect(c.income).toBe(0);
    }
  });

  it('attributes a backdated entry to its transaction-date period (PS-1, ET-3)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 5000, currency: 'ARS', date: '2026-07-15', categoryId: 1 });
    const july = await request(app).get('/api/v1/summaries?period=month&date=2026-07-15');
    const august = await request(app).get('/api/v1/summaries?period=month&date=2026-08-15');
    expect(july.body.currencies.find((c: { currency: string }) => c.currency === 'ARS').expense).toBe(5000);
    expect(august.body.currencies.find((c: { currency: string }) => c.currency === 'ARS').expense).toBe(0);
  });

  it('supports quarter and year periods', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 1000, currency: 'ARS', date: '2026-02-10', categoryId: 1 });
    const q1 = await request(app).get('/api/v1/summaries?period=quarter&date=2026-02-15');
    const year = await request(app).get('/api/v1/summaries?period=year&date=2026-02-15');
    expect(q1.body.period).toBe('2026-Q1');
    expect(year.body.period).toBe('2026');
    expect(year.body.currencies.find((c: { currency: string }) => c.currency === 'ARS').expense).toBe(1000);
  });

  it('groups deleted-category expenses under the current name (PS-5)', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 8000, currency: 'ARS', date: '2026-07-05', categoryId: 5 });
    await request(app).patch('/api/v1/categories/5').send({ name: 'Salud' });
    await request(app).delete('/api/v1/categories/5');
    const res = await request(app).get('/api/v1/summaries?period=month&date=2026-07-15');
    const health = res.body.categories.find((c: { categoryId: number }) => c.categoryId === 5);
    expect(health.name).toBe('Salud');
    expect(health.expense).toBe(8000);
  });

  it('rejects an invalid period with 422', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/summaries?period=week&date=2026-07-15');
    expect(res.status).toBe(422);
  });

  it('defaults the date to today when omitted', async () => {
    env = createTestApp(new Date('2026-08-08T12:00:00.000Z'));
    const res = await request(env.app).get('/api/v1/summaries?period=month');
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('2026-08');
  });
});
