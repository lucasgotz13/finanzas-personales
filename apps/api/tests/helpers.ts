import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import type { Express } from 'express';
import type { Clock, CclPoint, CclSeriesSource, IndicatorSource, NativeSeries, PriceSeriesSource, PriceSource, SeriesRange } from '@finanzas/domain';
import { createDbClient, MIGRATIONS_DIR, migrate } from '../../../scripts/migrate';
import { buildApp } from '../src/http/app';

export class FakeClock implements Clock {
  constructor(private date: Date) {}
  now(): Date {
    return this.date;
  }
}

export interface TestEnv {
  app: Express;
  db: Client;
  cleanup: () => void;
}

/** Stub price SERIES source with per-ticker call counts (PC-1). */
export class StubSeriesSource implements PriceSeriesSource {
  private calls = new Map<string, number>();
  constructor(private impl: (ticker: string, range: SeriesRange) => Promise<NativeSeries>) {}
  async fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries> {
    this.calls.set(ticker, (this.calls.get(ticker) ?? 0) + 1);
    return this.impl(ticker, range);
  }
  count(ticker: string): number {
    return this.calls.get(ticker) ?? 0;
  }
}

/** Stub CCL series source with a total call count (PC-3). */
export class StubCclSource implements CclSeriesSource {
  calls = 0;
  constructor(private impl: () => Promise<CclPoint[]>) {}
  async fetchCclSeries(): Promise<CclPoint[]> {
    this.calls++;
    return this.impl();
  }
}

/** Builds the app against a fresh temp SQLite database (migrated + seeded). */
export async function createTestApp(
  now = new Date('2026-08-08T12:00:00.000Z'),
  deps: {
    indicatorSources?: IndicatorSource[];
    portfolioSource?: PriceSource;
    seriesSource?: PriceSeriesSource;
    cclSource?: CclSeriesSource;
  } = {},
): Promise<TestEnv> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzas-test-'));
  const dbPath = join(dir, 'test.db');
  await migrate(dbPath, MIGRATIONS_DIR);
  const db = await createDbClient(dbPath);
  const app = buildApp({
    db,
    clock: new FakeClock(now),
    indicatorSources: deps.indicatorSources,
    portfolioSource: deps.portfolioSource,
    seriesSource: deps.seriesSource,
    cclSource: deps.cclSource,
  });
  return {
    app,
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Seeds a `series_cache` row for one ticker/range (PC-4). */
export async function seedSeriesRow(
  env: TestEnv,
  key: string,
  nativeCurrency: 'ARS' | 'USD',
  points: unknown,
  fetchedAt: string,
): Promise<void> {
  await env.db.execute({
    sql: 'INSERT INTO series_cache (key, kind, native_currency, points_json, fetched_at) VALUES (?, ?, ?, ?, ?)',
    args: [key, 'series', nativeCurrency, JSON.stringify(points), fetchedAt],
  });
}

/** Seeds a `series_cache` CCL row for one range (PC-4). */
export async function seedCclRow(env: TestEnv, key: string, points: unknown, fetchedAt: string): Promise<void> {
  await env.db.execute({
    sql: 'INSERT INTO series_cache (key, kind, native_currency, points_json, fetched_at) VALUES (?, ?, ?, ?, ?)',
    args: [key, 'ccl', 'ARS', JSON.stringify(points), fetchedAt],
  });
}
