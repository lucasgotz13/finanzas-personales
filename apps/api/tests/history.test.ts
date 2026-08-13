import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { CclPoint, NativeSeries } from '@finanzas/domain';
import { createTestApp, seedCclRow, seedSeriesRow, StubCclSource, StubSeriesSource } from './helpers';
import type { TestEnv } from './helpers';

const T0 = new Date('2026-08-09T23:58:00.000Z');
const HOUR = 3_600_000;

/** AAPL: USD-native; GGAL.BA: ARS-native. CCL 1000 → exact conversions. */
const AAPL_POINTS = [
  { date: '2026-08-06', valueMinor: 20000 },
  { date: '2026-08-07', valueMinor: 21000 },
];
const GGAL_POINTS = [
  { date: '2026-08-06', valueMinor: 60000 },
  { date: '2026-08-07', valueMinor: 61000 },
];
const CCL: CclPoint[] = [
  { date: '2026-08-06', value: 1000 },
  { date: '2026-08-07', value: 1000 },
];

function makeEnv(seriesSource?: StubSeriesSource, cclSource?: StubCclSource): Promise<TestEnv> {
  return createTestApp(T0, { seriesSource, cclSource });
}

async function seedPositions(env: TestEnv): Promise<void> {
  await env.db.execute({
    sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)',
    args: ['AAPL', 'Apple', 10, 18000, T0.toISOString()],
  });
  await env.db.execute({
    sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)',
    args: ['GGAL.BA', 'Galicia', 5, 6000, T0.toISOString()],
  });
}

async function seedFreshCache(env: TestEnv): Promise<void> {
  await seedSeriesRow(env, 'series:AAPL:3m', 'USD', AAPL_POINTS, T0.toISOString());
  await seedSeriesRow(env, 'series:GGAL.BA:3m', 'ARS', GGAL_POINTS, T0.toISOString());
  await seedCclRow(env, 'ccl:3m', CCL, T0.toISOString());
}

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('GET /api/v1/portfolio/history (PC-1..PC-4)', () => {
  it('serves the fresh cached ARS aggregate with zero source calls', async () => {
    const seriesSource = new StubSeriesSource(async () => {
      throw new Error('GET must never fetch');
    });
    const cclSource = new StubCclSource(async () => {
      throw new Error('GET must never fetch');
    });
    env = await makeEnv(seriesSource, cclSource);
    await seedPositions(env);
    await seedFreshCache(env);

    const res = await request(env.app).get('/api/v1/portfolio/history?range=3m&currency=ARS');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ range: '3m', currency: 'ARS', status: 'fresh' });
    expect(res.body.degraded).toBeUndefined();
    // 08-06: 10 × 20 000 000 + 5 × 60 000; 08-07: 10 × 21 000 000 + 5 × 61 000.
    expect(res.body.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300_000 },
      { date: '2026-08-07', valueMinor: 210_305_000 },
    ]);
    expect(seriesSource.count('AAPL')).toBe(0);
    expect(seriesSource.count('GGAL.BA')).toBe(0);
    expect(cclSource.calls).toBe(0);
  });

  it('returns status absent with empty points on a cache miss, without fetching', async () => {
    const seriesSource = new StubSeriesSource(async () => {
      throw new Error('GET must never fetch');
    });
    env = await makeEnv(seriesSource);
    await seedPositions(env);

    const res = await request(env.app).get('/api/v1/portfolio/history?range=3m&currency=ARS');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ points: [], currency: 'ARS', range: '3m', status: 'absent' });
    expect(seriesSource.count('AAPL')).toBe(0);
  });

  it('rejects invalid range and currency with 422', async () => {
    env = await makeEnv();
    for (const url of [
      '/api/v1/portfolio/history?range=1w&currency=ARS',
      '/api/v1/portfolio/history?currency=ARS',
      '/api/v1/portfolio/history?range=3m&currency=EUR',
      '/api/v1/portfolio/history?range=3m',
    ]) {
      const res = await request(env.app).get(url);
      expect(res.status).toBe(422);
    }
  });

  it('force=true fetches sequentially through the stubs and serves fresh', async () => {
    const seriesSource = new StubSeriesSource(async (ticker) => {
      return ticker === 'AAPL'
        ? { ticker, nativeCurrency: 'USD', points: AAPL_POINTS }
        : { ticker, nativeCurrency: 'ARS', points: GGAL_POINTS };
    });
    const cclSource = new StubCclSource(async () => CCL);
    env = await makeEnv(seriesSource, cclSource);
    await seedPositions(env);

    const res = await request(env.app).get('/api/v1/portfolio/history?range=3m&currency=ARS&force=true');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('fresh');
    expect(seriesSource.count('AAPL')).toBe(1);
    expect(seriesSource.count('GGAL.BA')).toBe(1);
    expect(cclSource.calls).toBe(1);
    expect(res.body.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300_000 },
      { date: '2026-08-07', valueMinor: 210_305_000 },
    ]);
  });

  it('keeps the last cached series as stale when a forced refresh fails (PC-4)', async () => {
    const seriesSource = new StubSeriesSource(async () => {
      throw new Error('yahoo 429');
    });
    const cclSource = new StubCclSource(async () => CCL);
    env = await makeEnv(seriesSource, cclSource);
    await seedPositions(env);
    await seedFreshCache(env);
    // Force the cached rows past the daily TTL so the response is stale.
    await env.db.execute({ sql: "UPDATE series_cache SET fetched_at = ?", args: [new Date(T0.getTime() - 25 * HOUR).toISOString()] });

    const res = await request(env.app).get('/api/v1/portfolio/history?range=3m&currency=ARS&force=true');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('stale');
    expect(res.body.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300_000 },
      { date: '2026-08-07', valueMinor: 210_305_000 },
    ]);
  });

  it('degrades ARS to USD-only with degraded:true when CCL is unavailable (PC-3)', async () => {
    const seriesSource = new StubSeriesSource(async (ticker) => {
      return ticker === 'AAPL'
        ? { ticker, nativeCurrency: 'USD', points: AAPL_POINTS }
        : { ticker, nativeCurrency: 'ARS', points: GGAL_POINTS };
    });
    const cclSource = new StubCclSource(async () => {
      throw new Error('argentinadatos down');
    });
    env = await makeEnv(seriesSource, cclSource);
    await seedPositions(env);

    const res = await request(env.app).get('/api/v1/portfolio/history?range=3m&currency=ARS&force=true');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currency: 'USD', degraded: true, status: 'fresh' });
    expect(res.body.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_000 },
      { date: '2026-08-07', valueMinor: 210_000 },
    ]);
  });
});

describe('GET /api/v1/portfolio/positions/:id/history (PC-1)', () => {
  it('serves one asset series converted to the requested currency', async () => {
    env = await makeEnv();
    await seedPositions(env);
    await seedFreshCache(env);

    const res = await request(env.app).get('/api/v1/portfolio/positions/1/history?range=3m&currency=ARS');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ range: '3m', currency: 'ARS', status: 'fresh' });
    expect(res.body.points).toEqual([
      { date: '2026-08-06', valueMinor: 20_000_000 },
      { date: '2026-08-07', valueMinor: 21_000_000 },
    ]);
  });

  it('returns 404 for an unknown position id', async () => {
    env = await makeEnv();
    await seedPositions(env);

    const res = await request(env.app).get('/api/v1/portfolio/positions/999/history?range=3m&currency=ARS');

    expect(res.status).toBe(404);
  });

  it('returns absent with empty points on a cache miss', async () => {
    env = await makeEnv();
    await seedPositions(env);

    const res = await request(env.app).get('/api/v1/portfolio/positions/1/history?range=3m&currency=ARS');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ points: [], currency: 'ARS', range: '3m', status: 'absent' });
  });
});
