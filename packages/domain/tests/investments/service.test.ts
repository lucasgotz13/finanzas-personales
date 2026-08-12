import { describe, expect, it } from 'vitest';
import type { Position, PriceQuote, PriceSnapshot } from '../../src/investments/types';
import type { PositionRepository, PortfolioFxPort, PriceCache, PriceSource } from '../../src/investments/ports';
import { PortfolioService } from '../../src/investments/service';
import { PRICE_TTL_MS } from '../../src/investments/catalog';
import { TTL_BY_CLASS } from '../../src/indicators/catalog';
import { FakeClock } from '../helpers/fakes';

const T0 = new Date('2026-08-09T23:58:00.000Z');

function iso(offsetMs: number): string { return new Date(T0.getTime() + offsetMs).toISOString(); }

class InMemoryPriceCache implements PriceCache {
  private rows = new Map<string, PriceSnapshot>();
  async get(ticker: string): Promise<PriceSnapshot | null> { return this.rows.get(ticker) ?? null; }
  async set(snapshot: PriceSnapshot): Promise<void> { this.rows.set(snapshot.ticker, { ...snapshot }); }
  stored(ticker: string): PriceSnapshot | null { return this.rows.get(ticker) ?? null; }
}

class InMemoryPositionRepository implements PositionRepository {
  private rows = new Map<number, Position>();
  private nextId = 1;
  async create(p: Position): Promise<Position> {
    const stored = { ...p, id: this.nextId++ };
    this.rows.set(stored.id as number, stored);
    return stored;
  }
  async update(id: number, p: Position): Promise<Position | null> {
    if (!this.rows.has(id)) return null;
    const stored = { ...p, id };
    this.rows.set(id, stored);
    return stored;
  }
  async list(): Promise<Position[]> { return [...this.rows.values()]; }
  async findByTicker(ticker: string): Promise<Position | null> {
    return [...this.rows.values()].find((p) => p.ticker === ticker) ?? null;
  }
  async delete(id: number): Promise<boolean> { return this.rows.delete(id); }
}

class StubSource implements PriceSource {
  calls = 0;
  constructor(private impl: (ticker: string) => Promise<PriceQuote>) {}
  async fetch(ticker: string): Promise<PriceQuote> { this.calls++; return this.impl(ticker); }
}

class StubFx implements PortfolioFxPort {
  ccl: { value: number; fetchedAt: string } | null = null;
  async getCcl(): Promise<{ value: number; fetchedAt: string } | null> { return this.ccl; }
}

interface Harness {
  repo: InMemoryPositionRepository;
  cache: InMemoryPriceCache;
  source: StubSource;
  fx: StubFx;
  service: PortfolioService;
}

function harness(now = T0): Harness {
  const repo = new InMemoryPositionRepository();
  const cache = new InMemoryPriceCache();
  const source = new StubSource(async () => {
    throw new Error('source not configured');
  });
  const fx = new StubFx();
  const service = new PortfolioService({ repo, cache, source, fx, clock: new FakeClock(now) });
  return { repo, cache, source, fx, service };
}

/** Seed two positions: AAPL.BA (qty 10 @ 180 USD) and GGAL.BA (qty 5 @ 60 USD). */
async function seedPositions(h: Harness): Promise<void> {
  await h.repo.create({ ticker: 'AAPL.BA', name: 'Apple', quantity: 10, avgCostMinor: 18000, currency: 'USD', createdAt: iso(0) });
  await h.repo.create({ ticker: 'GGAL.BA', name: 'Galicia', quantity: 5, avgCostMinor: 6000, currency: 'USD', createdAt: iso(0) });
}

function seedPrice(h: Harness, ticker: string, priceMinor: number, fetchedAt: string): void {
  void h.cache.set({ ticker, priceMinor, currency: 'USD', fetchedAt, source: 'yahoo' });
}

function withSource(h: Harness, source: StubSource): void {
  (h.service as unknown as { deps: { source: PriceSource } }).deps.source = source;
  h.source = source;
}

describe('PortfolioService.getPortfolio (PI-4)', () => {
  it('values USD and ARS via CCL, with avg-cost P&L abs + % per position and totals', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(0));
    seedPrice(h, 'GGAL.BA', 8000, iso(0));
    h.fx.ccl = { value: 1345, fetchedAt: iso(0) };

    const summary = await h.service.getPortfolio();

    expect(summary.ccStatus).toBe('fresh');
    const aapl = summary.positions.find((v) => v.ticker === 'AAPL.BA');
    expect(aapl).toMatchObject({
      priceMinor: 20000,
      status: 'fresh',
      valueUsdMinor: 200000,
      valueArsMinor: Math.round((200000 / 100) * 1345),
      pnlUsdMinor: 20000,
      pnlArsMinor: Math.round((20000 / 100) * 1345),
    });
    expect(aapl?.pnlPct).toBeCloseTo((20000 - 18000) / 18000);
    const ggal = summary.positions.find((v) => v.ticker === 'GGAL.BA');
    expect(ggal?.valueUsdMinor).toBe(40000);
    expect(ggal?.pnlUsdMinor).toBe(10000); // (8000 - 6000) * 5
    expect(summary.totals).toEqual({
      valueUsdMinor: 240000,
      valueArsMinor: Math.round((240000 / 100) * 1345),
      pnlUsdMinor: 30000,
      pnlPct: (240000 - (18000 * 10 + 6000 * 5)) / (18000 * 10 + 6000 * 5),
      pnlArsMinor: Math.round((30000 / 100) * 1345),
    });
    expect(h.source.calls).toBe(0);
  });

  it('marks snapshots beyond TTL stale but keeps the last price (PI-3)', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(-(PRICE_TTL_MS + 60_000)));

    const summary = await h.service.getPortfolio();

    const aapl = summary.positions.find((v) => v.ticker === 'AAPL.BA');
    expect(aapl?.status).toBe('stale');
    expect(aapl?.priceMinor).toBe(20000);
    expect(aapl?.valueUsdMinor).toBe(200000);
  });

  it('renders snapshot-less positions as absent with null money fields and excludes them from totals', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(0));
    h.fx.ccl = { value: 1345, fetchedAt: iso(0) };

    const summary = await h.service.getPortfolio();

    const ggal = summary.positions.find((v) => v.ticker === 'GGAL.BA');
    expect(ggal?.status).toBe('absent');
    expect(ggal?.priceMinor).toBeNull();
    expect(ggal?.valueUsdMinor).toBeNull();
    expect(ggal?.valueArsMinor).toBeNull();
    expect(ggal?.pnlUsdMinor).toBeNull();
    expect(ggal?.pnlPct).toBeNull();
    expect(summary.totals.valueUsdMinor).toBe(200000);
    expect(summary.totals.pnlUsdMinor).toBe(20000);
  });

  it('uses a stale CCL with a ccStatus warning (PI-4)', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(0));
    h.fx.ccl = { value: 1345, fetchedAt: iso(-(TTL_BY_CLASS.fx + 60_000)) };

    const summary = await h.service.getPortfolio();

    expect(summary.ccStatus).toBe('stale');
    expect(summary.positions.find((v) => v.ticker === 'AAPL.BA')?.valueArsMinor).toBe(Math.round(2000 * 1345));
  });

  it('degrades to USD-only when no CCL is available — never blank (PI-4)', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(0));
    h.fx.ccl = null;

    const summary = await h.service.getPortfolio();

    expect(summary.ccStatus).toBe('absent');
    expect(summary.totals.valueUsdMinor).toBe(200000);
    expect(summary.totals.valueArsMinor).toBeNull();
    expect(summary.totals.pnlArsMinor).toBeNull();
    expect(summary.positions.find((v) => v.ticker === 'AAPL.BA')?.valueUsdMinor).toBe(200000);
    expect(h.source.calls).toBe(0);
  });
});

describe('PortfolioService.refresh (PI-5)', () => {
  it('skips symbols within TTL with cached, fetching nothing', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(-2 * 60_000));
    seedPrice(h, 'GGAL.BA', 8000, iso(-2 * 60_000));
    const source = new StubSource(async () => {
      throw new Error('should not fetch');
    });
    withSource(h, source);

    const results = await h.service.refresh(false);

    expect(results).toEqual([
      { ticker: 'AAPL.BA', status: 'cached' },
      { ticker: 'GGAL.BA', status: 'cached' },
    ]);
    expect(h.source.calls).toBe(0);
  });

  it('refetches sequentially past TTL and stores the snapshot with the clock instant', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 19000, iso(-(PRICE_TTL_MS + 60_000)));
    seedPrice(h, 'GGAL.BA', 8000, iso(-2 * 60_000));
    const source = new StubSource(async (ticker) => ({ priceMinor: ticker === 'AAPL.BA' ? 21000 : 8000, currency: 'USD' }));
    withSource(h, source);

    const results = await h.service.refresh(false);

    expect(results).toEqual([
      { ticker: 'AAPL.BA', status: 'updated' },
      { ticker: 'GGAL.BA', status: 'cached' },
    ]);
    expect(h.source.calls).toBe(1);
    expect(h.cache.stored('AAPL.BA')).toMatchObject({ priceMinor: 21000, fetchedAt: iso(0), source: 'yahoo' });
    expect(h.cache.stored('GGAL.BA')?.priceMinor).toBe(8000);
  });

  it('force=true bypasses TTL and refetches every symbol', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(0));
    seedPrice(h, 'GGAL.BA', 8000, iso(0));
    const source = new StubSource(async (ticker) => ({ priceMinor: ticker === 'AAPL.BA' ? 21000 : 8100, currency: 'USD' }));
    withSource(h, source);

    const results = await h.service.refresh(true);

    expect(results.every((r) => r.status === 'updated')).toBe(true);
    expect(h.source.calls).toBe(2);
  });

  it('isolates a failing symbol: failed keeps its cache, others update (PI-5)', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(-(PRICE_TTL_MS + 60_000)));
    seedPrice(h, 'GGAL.BA', 8000, iso(-(PRICE_TTL_MS + 60_000)));
    const source = new StubSource(async (ticker) => {
      if (ticker === 'GGAL.BA') throw new Error('yahoo 429');
      return { priceMinor: 21000, currency: 'USD' };
    });
    withSource(h, source);

    const results = await h.service.refresh(false);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.ticker === 'GGAL.BA')).toMatchObject({ status: 'failed', error: 'yahoo 429' });
    expect(results.find((r) => r.ticker === 'AAPL.BA')?.status).toBe('updated');
    expect(h.cache.stored('GGAL.BA')?.priceMinor).toBe(8000);
    expect(h.cache.stored('AAPL.BA')?.priceMinor).toBe(21000);
  });

  it('rejects a non-finite quote as failed without touching the cache', async () => {
    const h = harness();
    await seedPositions(h);
    seedPrice(h, 'AAPL.BA', 20000, iso(-(PRICE_TTL_MS + 60_000)));
    const source = new StubSource(async () => ({ priceMinor: Number.NaN, currency: 'USD' }));
    withSource(h, source);

    const results = await h.service.refresh(false);

    expect(results.find((r) => r.ticker === 'AAPL.BA')?.status).toBe('failed');
    expect(h.cache.stored('AAPL.BA')?.priceMinor).toBe(20000);
  });
});
