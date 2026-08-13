import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

const T0 = new Date('2026-08-09T23:58:00.000Z');

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

async function makeEnv(): Promise<TestEnv> {
  env = await createTestApp(T0);
  return env;
}

describe('POST /api/v1/portfolio/trades (TH-1)', () => {
  it('creates a buy with ticker uppercased + .BA and lists it', async () => {
    const app = (await makeEnv()).app;
    const res = await request(app)
      .post('/api/v1/portfolio/trades')
      .send({ type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      type: 'buy',
      ticker: 'AAPL.BA',
      date: '2026-08-01',
      quantity: 10,
      priceMinor: 18000,
      currency: 'USD',
    });
    const list = await request(app).get('/api/v1/portfolio/trades');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects invalid input with 422 and persists nothing', async () => {
    const app = (await makeEnv()).app;
    const cases = [
      { type: 'hold', ticker: 'aapl', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' },
      { type: 'buy', ticker: '', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' },
      { type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 0, priceMinor: 18000, currency: 'USD' },
      { type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 10, priceMinor: 0, currency: 'USD' },
      { type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'ARS' },
      { type: 'buy', ticker: 'aapl', date: 'not-a-date', quantity: 10, priceMinor: 18000, currency: 'USD' },
      { type: 'buy', ticker: 'aapl', date: '2026-02-30', quantity: 10, priceMinor: 18000, currency: 'USD' },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/v1/portfolio/trades').send(body);
      expect(res.status).toBe(422);
    }
    const list = await request(app).get('/api/v1/portfolio/trades');
    expect(list.body).toEqual([]);
  });
});

describe('PUT/DELETE /api/v1/portfolio/trades/:id (TH-1, TH-2)', () => {
  it('returns 404 for an unknown id', async () => {
    const app = (await makeEnv()).app;
    const put = await request(app).put('/api/v1/portfolio/trades/999').send({ type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 1, priceMinor: 100, currency: 'USD' });
    expect(put.status).toBe(404);
    const del = await request(app).delete('/api/v1/portfolio/trades/999');
    expect(del.status).toBe(404);
  });

  it('replaces a trade and re-validates the full timeline', async () => {
    const app = (await makeEnv()).app;
    const created = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });

    // Turning the only buy into a sell of 15 would push the balance negative.
    const rejected = await request(app)
      .put(`/api/v1/portfolio/trades/${created.body.id}`)
      .send({ type: 'sell', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 15, priceMinor: 20000, currency: 'USD' });
    expect(rejected.status).toBe(422);

    const updated = await request(app)
      .put(`/api/v1/portfolio/trades/${created.body.id}`)
      .send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-02', quantity: 8, priceMinor: 19000, currency: 'USD' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: created.body.id, quantity: 8, date: '2026-08-02' });
  });

  it('deletes a trade with 204', async () => {
    const app = (await makeEnv()).app;
    const created = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });
    const res = await request(app).delete(`/api/v1/portfolio/trades/${created.body.id}`);
    expect(res.status).toBe(204);
    const list = await request(app).get('/api/v1/portfolio/trades');
    expect(list.body).toEqual([]);
  });
});

describe('Timeline integrity over HTTP (TH-2)', () => {
  it('rejects an oversold sell with 422 naming the trade; nothing persisted', async () => {
    const app = (await makeEnv()).app;
    await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 5, priceMinor: 18000, currency: 'USD' });

    const res = await request(app).post('/api/v1/portfolio/trades').send({ type: 'sell', ticker: 'AAPL.BA', date: '2026-08-10', quantity: 10, priceMinor: 25000, currency: 'USD' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual(['sell of 10 AAPL.BA on 2026-08-10 exceeds balance 5; fix that sell first']);
    const list = await request(app).get('/api/v1/portfolio/trades');
    expect(list.body).toHaveLength(1);
  });

  it('rejects an edit invalidating a later sell, naming that sell', async () => {
    const app = (await makeEnv()).app;
    const buy = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });
    const sell = await request(app).post('/api/v1/portfolio/trades').send({ type: 'sell', ticker: 'AAPL.BA', date: '2026-08-05', quantity: 8, priceMinor: 25000, currency: 'USD' });

    const res = await request(app)
      .put(`/api/v1/portfolio/trades/${buy.body.id}`)
      .send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 5, priceMinor: 18000, currency: 'USD' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([`sell of 8 AAPL.BA on 2026-08-05 (id ${sell.body.id}) exceeds balance 5; fix that sell first`]);
  });

  it('rejects a delete invalidating a later sell, naming that sell', async () => {
    const app = (await makeEnv()).app;
    const buy = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });
    const sell = await request(app).post('/api/v1/portfolio/trades').send({ type: 'sell', ticker: 'AAPL.BA', date: '2026-08-05', quantity: 8, priceMinor: 25000, currency: 'USD' });

    const res = await request(app).delete(`/api/v1/portfolio/trades/${buy.body.id}`);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([`sell of 8 AAPL.BA on 2026-08-05 (id ${sell.body.id}) exceeds balance 0; fix that sell first`]);
  });
});

describe('GET /api/v1/portfolio/trades ordering (TH-1, D7)', () => {
  it('lists trades by date, then insertion order on the same date', async () => {
    const app = (await makeEnv()).app;
    const first = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-02', quantity: 10, priceMinor: 18000, currency: 'USD' });
    await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'GGAL.BA', date: '2026-08-01', quantity: 5, priceMinor: 6000, currency: 'USD' });
    const third = await request(app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-02', quantity: 2, priceMinor: 19000, currency: 'USD' });

    const list = await request(app).get('/api/v1/portfolio/trades');

    expect(list.status).toBe(200);
    expect(list.body.map((t: { id: number }) => t.id)).toEqual([2, first.body.id, third.body.id]);
  });
});
