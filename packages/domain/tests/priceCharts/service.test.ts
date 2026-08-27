import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/errors';
import type { Position } from '../../src/investments/types';
import type { PositionRepository } from '../../src/investments/ports';
import type { CclPoint, ChartCacheEntry, NativeSeries, SeriesRange } from '../../src/priceCharts/types';
import type { CclSeriesSource, PriceSeriesSource, SeriesCache } from '../../src/priceCharts/ports';
import { ChartService } from '../../src/priceCharts/service';
import { FakeClock } from '../helpers/fakes';

const T0 = new Date('2026-08-09T23:58:00.000Z');
const HOUR = 3_600_000;
const iso = (offsetMs: number): string => new Date(T0.getTime() + offsetMs).toISOString();

/** AAPL: USD-native (US ticker); GGAL.BA: ARS-native (.BA ticker). CCL 1000
 * keeps conversions exact: 1 USD = 1000 ARS. */
const AAPL_SERIES: NativeSeries = {
  ticker: 'AAPL', nativeCurrency: 'USD',
  points: [{ date: '2026-08-06', valueMinor: 20000 }, { date: '2026-08-07', valueMinor: 21000 }],
};
const GGAL_SERIES: NativeSeries = {
  ticker: 'GGAL.BA', nativeCurrency: 'ARS',
  points: [{ date: '2026-08-06', valueMinor: 60000 }, { date: '2026-08-07', valueMinor: 61000 }],
};
const CCL: CclPoint[] = [{ date: '2026-08-06', value: 1000 }, { date: '2026-08-07', value: 1000 }];

class InMemoryPositionRepository implements PositionRepository {
  private rows = new Map<number, Position>();
  private nextId = 1;
  async create(p: Position): Promise<Position> { const s = { ...p, id: this.nextId++ }; this.rows.set(s.id as number, s); return s; }
  async update(id: number, p: Position): Promise<Position | null> { if (!this.rows.has(id)) return null; this.rows.set(id, { ...p, id }); return this.rows.get(id) ?? null; }
  async list(): Promise<Position[]> { return [...this.rows.values()]; }
  async delete(id: number): Promise<boolean> { return this.rows.delete(id); }
}

class InMemorySeriesCache implements SeriesCache {
  rows = new Map<string, ChartCacheEntry>();
  async get(key: string): Promise<ChartCacheEntry | null> { return this.rows.get(key) ?? null; }
  async set(entry: ChartCacheEntry): Promise<void> { this.rows.set(entry.key, { ...entry }); }
  stored(key: string): ChartCacheEntry | null { return this.rows.get(key) ?? null; }
}

class StubSeriesSource implements PriceSeriesSource {
  calls: string[] = [];
  constructor(private impl: (ticker: string, range: SeriesRange) => Promise<NativeSeries>) {}
  async fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries> { this.calls.push(ticker); return this.impl(ticker, range); }
}

class StubCclSource implements CclSeriesSource {
  calls = 0;
  constructor(private impl: () => Promise<CclPoint[]>) {}
  async fetchCclSeries(): Promise<CclPoint[]> { this.calls++; return this.impl(); }
}

interface Harness {
  repo: InMemoryPositionRepository; cache: InMemorySeriesCache;
  seriesSource: StubSeriesSource; cclSource: StubCclSource; service: ChartService;
}

function harness(): Harness {
  const repo = new InMemoryPositionRepository();
  const cache = new InMemorySeriesCache();
  const seriesSource = new StubSeriesSource(async () => { throw new Error('series source not configured'); });
  const cclSource = new StubCclSource(async () => { throw new Error('ccl source not configured'); });
  const service = new ChartService({ positions: repo, cache, seriesSource, cclSource, clock: new FakeClock(T0) });
  return { repo, cache, seriesSource, cclSource, service };
}

/** Replaces the sources inside the service (mirrors the investments tests). */
function setSources(h: Harness, seriesSource: StubSeriesSource, cclSource: StubCclSource): void {
  h.seriesSource = seriesSource;
  h.cclSource = cclSource;
  const deps = h.service as unknown as { deps: { seriesSource: PriceSeriesSource; cclSource: CclSeriesSource } };
  deps.deps.seriesSource = seriesSource;
  deps.deps.cclSource = cclSource;
}

async function seedPositions(h: Harness): Promise<void> {
  await h.repo.create({ ticker: 'AAPL', name: 'Apple', quantity: 10, avgCostMinor: 18000, currency: 'USD', createdAt: iso(0) });
  await h.repo.create({ ticker: 'GGAL.BA', name: 'Galicia', quantity: 5, avgCostMinor: 6000, currency: 'USD', createdAt: iso(0) });
}

function seedAll(h: Harness, range: SeriesRange, fetchedAt: string): void {
  void h.cache.set({ kind: 'series', key: `series:AAPL:${range}`, ticker: 'AAPL', range, nativeCurrency: 'USD', points: AAPL_SERIES.points, fetchedAt });
  void h.cache.set({ kind: 'series', key: `series:GGAL.BA:${range}`, ticker: 'GGAL.BA', range, nativeCurrency: 'ARS', points: GGAL_SERIES.points, fetchedAt });
  void h.cache.set({ kind: 'ccl', key: `ccl:${range}`, range, points: CCL, fetchedAt });
}

describe('ChartService.getPortfolioHistory (PC-1..PC-4)', () => {
  it('serves a fresh cached ARS aggregate without any source call', async () => {
    const h = harness();
    await seedPositions(h);
    seedAll(h, '3m', iso(0));

    const res = await h.service.getPortfolioHistory('3m', 'ARS', false);

    expect(res).toMatchObject({ status: 'fresh', currency: 'ARS' });
    expect(res.degraded).toBeUndefined();
    // 08-06: 10 × (20000 × 1000) + 5 × 60000; 08-07: 10 × 21 000 000 + 5 × 61 000.
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300_000 },
      { date: '2026-08-07', valueMinor: 210_305_000 },
    ]);
    expect(h.seriesSource.calls).toEqual([]);
    expect(h.cclSource.calls).toBe(0);
  });

  it('drops points outside the 1m (30-day) window on aggregate reads', async () => {
    const h = harness();
    await seedPositions(h);
    // 2026-07-01 is 39 days before T0 (2026-08-09): outside the 30-day window.
    void h.cache.set({
      kind: 'series', key: 'series:AAPL:1m', ticker: 'AAPL', range: '1m', nativeCurrency: 'USD',
      points: [
        { date: '2026-07-01', valueMinor: 10000 },
        { date: '2026-08-06', valueMinor: 20000 },
        { date: '2026-08-07', valueMinor: 21000 },
      ], fetchedAt: iso(0),
    });
    void h.cache.set({ kind: 'series', key: 'series:GGAL.BA:1m', ticker: 'GGAL.BA', range: '1m', nativeCurrency: 'ARS', points: GGAL_SERIES.points, fetchedAt: iso(0) });
    void h.cache.set({ kind: 'ccl', key: 'ccl:1m', range: '1m', points: CCL, fetchedAt: iso(0) });

    const res = await h.service.getPortfolioHistory('1m', 'ARS', false);

    expect(res).toMatchObject({ status: 'fresh', currency: 'ARS', range: '1m' });
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300_000 },
      { date: '2026-08-07', valueMinor: 210_305_000 },
    ]);
    expect(h.seriesSource.calls).toEqual([]);
  });

  it('returns absent on a cache miss and never fetches on read (PC-1)', async () => {
    const h = harness();
    await seedPositions(h);

    const res = await h.service.getPortfolioHistory('3m', 'ARS', false);

    expect(res.status).toBe('absent');
    expect(res.points).toEqual([]);
    expect(h.seriesSource.calls).toEqual([]);
    expect(h.cclSource.calls).toBe(0);
  });

  it('serves rows beyond the daily TTL as stale without fetching', async () => {
    const h = harness();
    await seedPositions(h);
    seedAll(h, '3m', iso(-25 * HOUR));

    const res = await h.service.getPortfolioHistory('3m', 'ARS', false);

    expect(res.status).toBe('stale');
    expect(res.points).toHaveLength(2);
    expect(h.seriesSource.calls).toEqual([]);
  });

  it('force=true fetches sequentially (USD ÷ CCL), stores fresh rows', async () => {
    const h = harness();
    await seedPositions(h);
    setSources(h, new StubSeriesSource(async (t) => (t === 'AAPL' ? AAPL_SERIES : GGAL_SERIES)), new StubCclSource(async () => CCL));

    const res = await h.service.getPortfolioHistory('3m', 'USD', true);

    expect(res.status).toBe('fresh');
    expect(h.seriesSource.calls).toEqual(['AAPL', 'GGAL.BA']); // sequential, position order
    expect(h.cclSource.calls).toBe(1);
    expect(h.cache.stored('series:AAPL:3m')).toMatchObject({ fetchedAt: T0.toISOString(), kind: 'series' });
    expect(h.cache.stored('ccl:3m')).toMatchObject({ fetchedAt: T0.toISOString(), kind: 'ccl' });
    // 08-06: 10 × 20000 + 5 × (60000 / 1000); 08-07: 10 × 21000 + 5 × 61.
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_300 },
      { date: '2026-08-07', valueMinor: 210_305 },
    ]);
  });

  it('keeps the last cached series as stale when a forced refresh fails (PC-4)', async () => {
    const h = harness();
    await seedPositions(h);
    void h.cache.set({ kind: 'series', key: 'series:AAPL:3m', ticker: 'AAPL', range: '3m', nativeCurrency: 'USD', points: AAPL_SERIES.points, fetchedAt: iso(-25 * HOUR) });
    setSources(h, new StubSeriesSource(async () => { throw new Error('yahoo 429'); }), new StubCclSource(async () => CCL));

    const res = await h.service.getPortfolioHistory('3m', 'USD', true);

    expect(res.status).toBe('stale');
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_000 },
      { date: '2026-08-07', valueMinor: 210_000 },
    ]);
  });

  it('excludes a 404 asset and drops days only it had (PC-2)', async () => {
    const h = harness();
    await seedPositions(h);
    setSources(h, new StubSeriesSource(async (t) => {
      if (t === 'GGAL.BA') throw new Error('yahoo returned HTTP 404');
      return { ...AAPL_SERIES, points: [...AAPL_SERIES.points, { date: '2026-08-08', valueMinor: 22000 }] };
    }), new StubCclSource(async () => CCL));

    const res = await h.service.getPortfolioHistory('3m', 'USD', true);

    expect(res.status).toBe('fresh');
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_000 },
      { date: '2026-08-07', valueMinor: 210_000 },
      { date: '2026-08-08', valueMinor: 220_000 },
    ]);
  });

  it('degrades ARS to USD-only with degraded:true when CCL is unavailable (PC-3)', async () => {
    const h = harness();
    await seedPositions(h);
    setSources(h, new StubSeriesSource(async (t) => (t === 'AAPL' ? AAPL_SERIES : GGAL_SERIES)), new StubCclSource(async () => { throw new Error('argentinadatos down'); }));

    const res = await h.service.getPortfolioHistory('3m', 'ARS', true);

    expect(res.currency).toBe('USD');
    expect(res.degraded).toBe(true);
    expect(res.status).toBe('fresh');
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 200_000 },
      { date: '2026-08-07', valueMinor: 210_000 },
    ]);
  });

  it('never touches the CCL source when all assets are ARS-native and ARS is requested', async () => {
    const h = harness();
    await h.repo.create({ ticker: 'GGAL.BA', name: 'Galicia', quantity: 5, avgCostMinor: 6000, currency: 'USD', createdAt: iso(0) });
    setSources(h, new StubSeriesSource(async () => GGAL_SERIES), new StubCclSource(async () => CCL));

    const res = await h.service.getPortfolioHistory('3m', 'ARS', true);

    expect(h.cclSource.calls).toBe(0);
    expect(res).toMatchObject({ currency: 'ARS' });
    expect(res.degraded).toBeUndefined();
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 300_000 },
      { date: '2026-08-07', valueMinor: 305_000 },
    ]);
  });

  it('marks the response stale when a fresh series converts via a stale CCL row', async () => {
    const h = harness();
    await seedPositions(h);
    seedAll(h, '3m', iso(0));
    void h.cache.set({ kind: 'ccl', key: 'ccl:3m', range: '3m', points: CCL, fetchedAt: iso(-25 * HOUR) });

    const res = await h.service.getPortfolioHistory('3m', 'ARS', false);

    expect(res.status).toBe('stale');
    expect(h.cclSource.calls).toBe(0);
  });
});

describe('ChartService.getPositionHistory (PC-1, PC-3)', () => {
  it('throws NotFoundError for an unknown position id', async () => {
    const h = harness();
    await seedPositions(h);

    await expect(h.service.getPositionHistory(999, '3m', 'ARS', false)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns absent with empty points on a cache miss, without fetching', async () => {
    const h = harness();
    await seedPositions(h);

    const res = await h.service.getPositionHistory(1, '3m', 'ARS', false);

    expect(res).toEqual({ points: [], currency: 'ARS', range: '3m', status: 'absent' });
    expect(h.seriesSource.calls).toEqual([]);
  });

  it('degrades a per-asset chart to its native currency when CCL is missing', async () => {
    const h = harness();
    await seedPositions(h);
    void h.cache.set({ kind: 'series', key: 'series:AAPL:3m', ticker: 'AAPL', range: '3m', nativeCurrency: 'USD', points: AAPL_SERIES.points, fetchedAt: iso(0) });

    const res = await h.service.getPositionHistory(1, '3m', 'ARS', false);

    expect(res).toMatchObject({ currency: 'USD', degraded: true, status: 'fresh' });
    expect(res.points).toEqual(AAPL_SERIES.points);
    expect(h.cclSource.calls).toBe(0);
  });

  it('converts a per-asset series to the requested currency when CCL is cached', async () => {
    const h = harness();
    await seedPositions(h);
    seedAll(h, '3m', iso(0));

    const res = await h.service.getPositionHistory(1, '3m', 'ARS', false);

    expect(res).toMatchObject({ currency: 'ARS', status: 'fresh' });
    expect(res.degraded).toBeUndefined();
    expect(res.points).toEqual([
      { date: '2026-08-06', valueMinor: 20_000_000 },
      { date: '2026-08-07', valueMinor: 21_000_000 },
    ]);
  });
});
