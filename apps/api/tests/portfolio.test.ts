import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { PriceQuote, PriceSource } from '@finanzas/domain';
import { derivedPositionId } from '@finanzas/domain';
import { createTestApp, seedLegacyPosition, seedTrade } from './helpers';
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

async function seedPrice(env: TestEnv, ticker: string, priceMinor: number, fetchedAt: string): Promise<void> {
  await env.db.execute({ sql: 'INSERT INTO price_snapshots (ticker, price_minor, currency, fetched_at, source) VALUES (?, ?, ?, ?, ?)', args: [ticker, priceMinor, 'USD', fetchedAt, 'yahoo'] });
}

async function seedCcl(env: TestEnv, fetchedAt: string): Promise<void> {
  await env.db.execute({ sql: "INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source) VALUES ('usd-ccl', 1345, 'ARS/USD', '2026-08-09', ?, 'fx')", args: [fetchedAt] });
}

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('GET /api/v1/portfolio — derived positions (PI-1, TH-3, TH-4)', () => {
  it('serves positions derived from trades with legacy id/name preserved and realized totals', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));
    await seedLegacyPosition(env, 'AAPL.BA', 'Apple');
    await seedLegacyPosition(env, 'GGAL.BA', 'Galicia');
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedTrade(env, { ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 3, priceMinor: 25000 });
    await seedTrade(env, { ticker: 'GGAL.BA', date: '2026-08-01', quantity: 5, priceMinor: 6000 });
    await seedTrade(env, { ticker: 'MELI.BA', date: '2026-08-01', quantity: 2, priceMinor: 1000 });

    const res = await request(env.app).get('/api/v1/portfolio');

    expect(res.status).toBe(200);
    expect(res.body.positions.map((v: { ticker: string }) => v.ticker)).toEqual(['AAPL.BA', 'GGAL.BA', 'MELI.BA']);
    const aapl = res.body.positions[0];
    expect(aapl).toMatchObject({
      id: 1,
      name: 'Apple',
      quantity: 7,
      avgCostMinor: 18000,
      realizedUsdMinor: 21000,
    });
    const ggal = res.body.positions[1];
    expect(ggal).toMatchObject({ id: 2, name: 'Galicia', quantity: 5, avgCostMinor: 6000, realizedUsdMinor: 0 });
    const meli = res.body.positions[2];
    expect(meli.id).toBe(derivedPositionId('MELI.BA')); // stable negative derived id (D3)
    expect(meli.name).toBe('MELI.BA');
    expect(res.body.totals.realizedUsdMinor).toBe(21000);
  });

  it('treats a fully sold ticker as gone until the next buy', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedTrade(env, { ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 10, priceMinor: 25000 });

    const gone = await request(env.app).get('/api/v1/portfolio');
    expect(gone.body.positions).toEqual([]);

    await request(env.app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-06', quantity: 5, priceMinor: 30000, currency: 'USD' });
    const back = await request(env.app).get('/api/v1/portfolio');
    expect(back.body.positions[0]).toMatchObject({ quantity: 5, avgCostMinor: 30000 });
  });

  it('records realized losses negative per asset and portfolio (TH-4)', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 20000 });
    await seedTrade(env, { ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 5, priceMinor: 15000 });

    const res = await request(env.app).get('/api/v1/portfolio');

    expect(res.body.positions[0].realizedUsdMinor).toBe(-25000);
    expect(res.body.totals.realizedUsdMinor).toBe(-25000);
  });

  it('recomputes derived values after a trade change without forced refetch (PI-1)', async () => {
    const source = new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' }));
    env = await makeEnv(source);
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');

    const before = await request(env.app).get('/api/v1/portfolio');
    expect(before.body.positions[0].valueUsdMinor).toBe(200000);

    await request(env.app).post('/api/v1/portfolio/trades').send({ type: 'buy', ticker: 'AAPL.BA', date: '2026-08-02', quantity: 10, priceMinor: 22000, currency: 'USD' });
    const after = await request(env.app).get('/api/v1/portfolio');

    expect(after.body.positions[0]).toMatchObject({ quantity: 20, avgCostMinor: 20000, valueUsdMinor: 400000 });
    expect(source.count('AAPL.BA')).toBe(0); // no forced refetch
  });
});

describe('Removed position mutation endpoints (PI-1, D5)', () => {
  it('returns 404 for POST/PATCH/DELETE on positions', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 20000, currency: 'USD' })));
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });

    const post = await request(env.app).post('/api/v1/portfolio/positions').send({ ticker: 'aapl', quantity: 1, avgCostMinor: 100 });
    expect(post.status).toBe(404);
    const patch = await request(env.app).patch('/api/v1/portfolio/positions/1').send({ quantity: 2 });
    expect(patch.status).toBe(404);
    const del = await request(env.app).delete('/api/v1/portfolio/positions/1');
    expect(del.status).toBe(404);
  });
});

describe('GET /api/v1/portfolio valuation (PI-3, PI-4)', () => {
  it('returns fresh views with USD/ARS values, P&L and totals — zero source calls', async () => {
    const source = new StubPriceSource(async () => {
      throw new Error('GET must never fetch');
    });
    env = await makeEnv(source);
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
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
      valueArsMinor: Math.round(200000 * 1345),
      pnlUsdMinor: 20000,
      realizedUsdMinor: 0,
    });
    expect(res.body.totals).toEqual({
      valueUsdMinor: 200000,
      valueArsMinor: Math.round(200000 * 1345),
      pnlUsdMinor: 20000,
      pnlPct: 20000 / 180000,
      pnlArsMinor: Math.round(20000 * 1345),
      realizedUsdMinor: 0,
    });
    expect(source.count('AAPL.BA')).toBe(0);
  });

  it('uses the derived moving average for P&L (PI-4)', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-02', quantity: 10, priceMinor: 22000 });
    await seedPrice(env, 'AAPL.BA', 25000, '2026-08-09T23:55:00.000Z');

    const res = await request(env.app).get('/api/v1/portfolio');

    const aapl = res.body.positions[0];
    expect(aapl.avgCostMinor).toBe(20000);
    expect(aapl.pnlUsdMinor).toBe((25000 - 20000) * 20);
  });

  it('serves expired snapshots as stale and snapshot-less positions as absent (PI-3)', async () => {
    env = await makeEnv(new StubPriceSource(async () => ({ priceMinor: 1, currency: 'USD' })));
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedTrade(env, { ticker: 'GGAL.BA', date: '2026-08-01', quantity: 5, priceMinor: 6000 });
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
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedPrice(env, 'AAPL.BA', 20000, '2026-08-09T23:55:00.000Z');
    await seedCcl(env, '2026-08-09T23:40:00.000Z'); // 18 min old → stale

    const stale = await request(env.app).get('/api/v1/portfolio');
    expect(stale.body.ccStatus).toBe('stale');
    expect(stale.body.positions[0].valueArsMinor).toBe(Math.round(200000 * 1345));

    await env.db.execute("DELETE FROM indicator_snapshots WHERE key = 'usd-ccl'");
    const absent = await request(env.app).get('/api/v1/portfolio');
    expect(absent.body.ccStatus).toBe('absent');
    expect(absent.body.totals.valueUsdMinor).toBe(200000);
    expect(absent.body.totals.valueArsMinor).toBeNull();
    expect(absent.body.positions[0].valueArsMinor).toBeNull();
  });
});

describe('POST /api/v1/portfolio/refresh (PI-5)', () => {
  it('refreshes sequentially with mixed updated/cached/failed and keeps the prior cache', async () => {
    const source = new StubPriceSource(async (ticker) => {
      if (ticker === 'MELI.BA') throw new Error('yahoo down');
      return { priceMinor: ticker === 'AAPL.BA' ? 21000 : 8000, currency: 'USD' };
    });
    env = await makeEnv(source);
    await seedTrade(env, { ticker: 'AAPL.BA', date: '2026-08-01', quantity: 10, priceMinor: 18000 });
    await seedTrade(env, { ticker: 'GGAL.BA', date: '2026-08-01', quantity: 5, priceMinor: 6000 });
    await seedTrade(env, { ticker: 'MELI.BA', date: '2026-08-01', quantity: 2, priceMinor: 1000 });
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

  it('caches snapshots for tickers without a legacy position row', async () => {
    const source = new StubPriceSource(async () => ({ priceMinor: 50000, currency: 'USD' }));
    env = await makeEnv(source);
    await seedTrade(env, { ticker: 'MELI.BA', date: '2026-08-01', quantity: 2, priceMinor: 1000 });

    const res = await request(env.app).post('/api/v1/portfolio/refresh');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ ticker: 'MELI.BA', status: 'updated' }]);
    const get = await request(env.app).get('/api/v1/portfolio');
    expect(get.body.positions[0].priceMinor).toBe(50000);
  });
});
