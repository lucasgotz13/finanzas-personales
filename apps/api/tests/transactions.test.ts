import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

function expense(overrides: Record<string, unknown> = {}) {
  return {
    direction: 'expense',
    amountMinor: 15000,
    currency: 'ARS',
    date: '2026-07-15',
    categoryId: 1,
    note: 'Lunch',
    ...overrides,
  };
}

describe('POST /api/v1/transactions (ET-1, ET-2, IT-1)', () => {
  it('creates an ARS expense with rate 1 and returns 201 (ET-1)', async () => {
    env = createTestApp();
    const res = await request(env.app).post('/api/v1/transactions').send(expense());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ amountMinor: 15000, currency: 'ARS', rate: 1, date: '2026-07-15', note: 'Lunch' });
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('stores the FX rate captured at entry for USD (ET-1)', async () => {
    env = createTestApp();
    const res = await request(env.app).post('/api/v1/transactions').send(expense({ amountMinor: 2500, currency: 'USD', rate: 950 }));
    expect(res.status).toBe(201);
    expect(res.body.currency).toBe('USD');
    expect(res.body.rate).toBe(950);
  });

  it('rejects USD without a rate with 422 VALIDATION_ERROR (ET-1)', async () => {
    env = createTestApp();
    const res = await request(env.app).post('/api/v1/transactions').send(expense({ currency: 'USD' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects a negative amount with 422 (ET-2)', async () => {
    env = createTestApp();
    const res = await request(env.app).post('/api/v1/transactions').send(expense({ amountMinor: -100 }));
    expect(res.status).toBe(422);
  });

  it('rejects an unknown category with 404 NOT_FOUND', async () => {
    env = createTestApp();
    const res = await request(env.app).post('/api/v1/transactions').send(expense({ categoryId: 999 }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('accepts income (IT-1)', async () => {
    env = createTestApp();
    const res = await request(env.app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 900000, currency: 'ARS', date: '2026-08-01', categoryId: 10 });
    expect(res.status).toBe(201);
    expect(res.body.direction).toBe('income');
  });
});

describe('GET /api/v1/transactions filters (ET-3, PS-1)', () => {
  it('filters by month with exact AR-tz bounds', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).post('/api/v1/transactions').send(expense({ date: '2026-07-15' }));
    await request(app).post('/api/v1/transactions').send(expense({ date: '2026-07-31' }));
    await request(app).post('/api/v1/transactions').send(expense({ date: '2026-08-01' }));
    const res = await request(app).get('/api/v1/transactions?month=2026-07');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by categoryId and direction', async () => {
    env = createTestApp();
    const app = env.app;
    await request(app).post('/api/v1/transactions').send(expense({ categoryId: 1 }));
    await request(app).post('/api/v1/transactions').send(expense({ categoryId: 2 }));
    await request(app).post('/api/v1/transactions').send({ ...expense({ categoryId: 10 }), direction: 'income' });
    const res = await request(app).get('/api/v1/transactions?categoryId=1&direction=expense');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].categoryId).toBe(1);
  });

  it('rejects a malformed month with 422', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/transactions?month=2026-13');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/v1/transactions/:id (ET-5)', () => {
  it('re-validates edited values: amount 0 rejected, original kept', async () => {
    env = createTestApp();
    const app = env.app;
    const created = await request(app).post('/api/v1/transactions').send(expense());
    const id = created.body.id;
    const bad = await request(app).patch(`/api/v1/transactions/${id}`).send({ amountMinor: 0 });
    expect(bad.status).toBe(422);
    const after = await request(app).get(`/api/v1/transactions?month=2026-07`);
    expect(after.body[0].amountMinor).toBe(15000);
  });

  it('updates amount, currency, rate, date, category and note', async () => {
    env = createTestApp();
    const app = env.app;
    const created = await request(app).post('/api/v1/transactions').send(expense());
    const res = await request(app)
      .patch(`/api/v1/transactions/${created.body.id}`)
      .send({ amountMinor: 5000, currency: 'USD', rate: 950, date: '2026-06-10', categoryId: 2, note: 'Edited' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amountMinor: 5000, currency: 'USD', rate: 950, date: '2026-06-10', categoryId: 2, note: 'Edited' });
  });

  it('returns 404 for a missing transaction', async () => {
    env = createTestApp();
    const res = await request(env.app).patch('/api/v1/transactions/999').send({ amountMinor: 100 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/transactions/:id (ET-5)', () => {
  it('deletes an expense (204) and removes it from period listings', async () => {
    env = createTestApp();
    const app = env.app;
    const created = await request(app).post('/api/v1/transactions').send(expense());
    const res = await request(app).delete(`/api/v1/transactions/${created.body.id}`);
    expect(res.status).toBe(204);
    const list = await request(app).get('/api/v1/transactions?month=2026-07');
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 when deleting a missing transaction', async () => {
    env = createTestApp();
    const res = await request(env.app).delete('/api/v1/transactions/999');
    expect(res.status).toBe(404);
  });
});

describe('API error envelope', () => {
  it('returns 404 with the error envelope for unknown routes', async () => {
    env = createTestApp();
    const res = await request(env.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
