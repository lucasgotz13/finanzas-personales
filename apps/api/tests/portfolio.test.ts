import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { PriceQuote, PriceSource } from '@finanzas/domain';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

const T0 = new Date('2026-08-09T23:58:00.000Z');

class StubPriceSource implements PriceSource {
  private calls = new Map<string, number>();
  constructor(private impl: (ticker: string) => Promise<PriceQuote>) {}
  async fetch(ticker: string): Promise<PriceQuote> {
    this.calls.set(ticker, (this.calls.get(ticker) ?? 0) + 1);
    return this.impl(ticker);
  }
  count(ticker: string): number {
    return this.calls.get(ticker) ?? 0;
  }
}

function makeEnv(source: StubPriceSource): Promise<TestEnv> {
  return createTestApp(T0, { portfolioSource: source });
}

async function seedPosition(env: TestEnv, ticker: string, quantity: number, avgCostMinor: number): Promise<void> {
  await env.db.execute({ sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)', args: [ticker, ticker, quantity, avgCostMinor, T0.toISOString()] });
}

async function seedPrice(env: TestEnv, ticker: string, priceMinor: number, fetchedAt: string): Promise<void> {
  await env.db.execute({ sql: 'INSERT INTO price_snapshots (ticker, price_minor, currency, fetched_at, source) VALUES (?, ?, ?, ?, ?)', args: [ticker, priceMinor, 'USD', fetchedAt, 'yahoo'] });
}

async function seedCcl(env: TestEnv, fetchedAt: string): Promise<void> {
  await env.db.execute({ sql: "INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source) VALUES ('usd-ccl', 1345, 'ARS/USD', '2026-08-09', ?, 'fx')", args: [fetchedAt] });
}

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('POST /api/v1/portfolio/positions (PI-1)', () => {
  it('creates with ticker uppercased + .BA, USD currency and name defaulting to the ticker', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));

    const res = await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'aapl', quantity: 10, avgCostMinor: 18000 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticker: 'AAPL.BA',
      quantity: 10,
      avgCostMinor: 18000,
      currency: 'USD',
      createdAt: T0.toISOString(),
    });
  });

  it('rejects invalid input with 422 and persists nothing', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));

    const cases = [
      { ticker: '', quantity: 1, avgCostMinor: 100 },
      { ticker: 'aapl', quantity: 0, avgCostMinor: 100 },
      { ticker: 'aapl', quantity: 1, avgCostMinor: 0 },
      { ticker: 'aapl', quantity: 1, avgCostMinor: 100, currency: 'ARS' },
    ];
    for (const body of cases) {
      const res = await request(env.app).post('/api/v1/portfolio/positions').send(body);
      expect(res.status).toBe(422);
    }
    const get = await request(env.app).get('/api/v1/portfolio');
    expect(get.body.positions).toEqual([]);
  });

  it('rejects a duplicate ticker with 409', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));
    await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'aapl', quantity: 10, avgCostMinor: 18000 });

    const res = await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'AAPL.BA', quantity: 1, avgCostMinor: 100 });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/portfolio (PI-3, PI-4)', () => {
  it('returns fresh views with USD/ARS values, P&L and totals — zero source calls', async () => {
    const source = new StubPriceSource(async () => {
      throw new Error('GET must never fetch');
    });
    env = await makeEnv(source);
    await seedPosition(env, 'AAPL.BA', 10, 18000);
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');
    await seedCcl(env, '2026-08-09T23:55:00.000Z');

    const res = await request(env.app).get('/api/v1/portfolio');

    expect(res.status).toBe(200);
    expect(res.body.ccStatus).toBe('fresh');
    expect(res.body.positions).toHaveLength(1);
    expect(res.body.positions[0]).toMatchObject({
      priceMinor: 20000,
      status: 'fresh',
      valueUsdMinor: 200000,
      valueArsMinor: Math.round(2000 * 1345),
      pnlUsdMinor: 20000,
    });
    expect(res.body.totals).toEqual({
      valueUsdMinor: 200000,
      valueArsMinor: Math.round(2000 * 1345),
      pnlUsdMinor: 20000,
      pnlPct: 20000 / 180000,
      pnlArsMinor: Math.round((20000 / 100) * 1345),
    });
    expect(source.count('AAPL.BA')).toBe(0);
  });

  it('serves expired snapshots as stale and snapshot-less positions as absent (PI-3)', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    await seedPosition(env, 'AAPL.BA', 10, 18000);
    await seedPosition(env, 'GGAL.BA', 5, 6000);
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:45:00.000Z'); // 13 min old

    const res = await request(env.app).get('/api/v1/portfolio');

    const aapl = res.body.positions.find((v: { ticker: string }) => v.ticker === 'AAPL.BA');
    expect(aapl.status).toBe('stale');
    expect(aapl.priceMinor).toBe(20000);
    const ggal = res.body.positions.find((v: { ticker: string }) => v.ticker === 'GGAL.BA');
    expect(ggal.status).toBe('absent');
    expect(ggal.priceMinor).toBeNull();
  });

  it('uses a stale CCL with ccStatus stale and degrades to USD-only when absent (PI-4)', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    await seedPosition(env, 'AAPL.BA', 10, 18000);
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');
    await seedCcl(env, '2026-08-09T23:40:00.000Z'); // 18 min old → stale

    const stale = await request(env.app).get('/api/v1/portfolio');
    expect(stale.body.ccStatus).toBe('stale');
    expect(stale.body.positions[0].valueArsMinor).toBe(Math.round(2000 * 1345));

    await env.db.execute("DELETE FROM indicator_snapshots WHERE key = 'usd-ccl'");
    const absent = await request(env.app).get('/api/v1/portfolio');
    expect(absent.body.ccStatus).toBe('absent');
    expect(absent.body.totals.valueUsdMinor).toBe(200000);
    expect(absent.body.totals.valueArsMinor).toBeNull();
    expect(absent.body.positions[0].valueArsMinor).toBeNull();
  });
});

describe('PATCH/DELETE /api/v1/portfolio/positions/:id (PI-1)', () => {
  it('updates quantity and recomputes valuation without refetching', async () => {
    const source = new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' }));
    env = await makeEnv(source);
    const created = await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'aapl', quantity: 10, avgCostMinor: 18000 });
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');

    const res = await request(env.app).patch(`/api/v1/portfolio/positions/${created.body.id}`).send({ quantity: 20 });

    expect(res.status).toBe(200);
    const get = await request(env.app).get('/api/v1/portfolio');
    expect(get.body.positions[0].valueUsdMinor).toBe(400000);
    expect(source.count('AAPL.BA')).toBe(0); // no forced refetch
  });

  it('returns 404 for an unknown id', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    const res = await request(env.app).patch('/api/v1/portfolio/positions/999').send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  it('hard-deletes the position and cascades its snapshots', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    const created = await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'aapl', quantity: 10, avgCostMinor: 18000 });
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');

    const res = await request(env.app).delete(`/api/v1/portfolio/positions/${created.body.id}`);

    expect(res.status).toBe(204);
    const snapshots = await env.db.execute('SELECT COUNT(*) AS n FROM price_snapshots');
    expect(Number(snapshots.rows[0][0])).toBe(0);
  });
});

describe('POST /api/v1/portfolio/refresh (PI-5)', () => {
  it('refreshes sequentially with mixed updated/cached/failed and keeps the prior cache', async () => {
    const source = new StubPriceSource(async (ticker) => {
      if (ticker === 'MELI.BA') throw new Error('yahoo down');
      return { priceMinor: ticker === 'AAPL.BA' ? 21000 : 8000, currency: 'USD' };
    });
    env = await makeEnv(source);
    await seedPosition(env, 'AAPL.BA', 10, 18000);
    await seedPosition(env, 'GGAL.BA', 5, 6000);
    await seedPosition(env, 'MELI.BA', 2, 1000);
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:45:00.000Z'); // stale → fetch
    await seedPrice(env, 'GGAL.BA', 8000, '2026-08-09T23:55:00.000Z'); // fresh → cached

    const res = await request(env.app).post('/api/v1/portfolio/refresh');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { ticker: 'AAPL.BA', status: 'updated' },
      { ticker: 'GGAL.BA', status: 'cached' },
      { ticker: 'MELI.BA', status: 'failed', error: 'yahoo down' },
    ]);
    expect(source.count('GGAL.BA')).toBe(0); // within TTL → never fetched
    const get = await request(env.app).get('/api/v1/portfolio');
    expect(get.body.positions.find((v: { ticker: string }) => v.ticker === 'AAPL.BA').priceMinor).toBe(21000);
  });
});
