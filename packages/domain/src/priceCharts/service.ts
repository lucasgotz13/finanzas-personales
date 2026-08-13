import { NotFoundError } from '../errors';
import type { Clock } from '../ports/repositories';
import type { PositionRepository } from '../investments/ports';
import type { Position } from '../investments/types';
import { RANGE_WINDOW_DAYS, SERIES_TTL_MS } from './catalog';
import { alignToCalendar } from './align';
import { convertSeries } from './ccl';
import type { CclSeriesSource, PriceSeriesSource, SeriesCache } from './ports';
import type {
  CclPoint,
  HistoryResponse,
  PricePoint,
  SeriesCurrency,
  SeriesRange,
  SeriesStatus,
} from './types';

export interface ChartServiceDeps {
  positions: PositionRepository;
  seriesSource: PriceSeriesSource;
  cclSource: CclSeriesSource;
  cache: SeriesCache;
  clock: Clock;
}

/** One asset's resolved series: points plus freshness (PC-1, PC-4). */
interface AssetSeries {
  ticker: string;
  nativeCurrency: SeriesCurrency;
  points: PricePoint[];
  status: SeriesStatus;
}

/**
 * Price chart read model (PC-1..PC-4): cache-first — reads NEVER fetch.
 * `force=true` refreshes sequentially and keeps the last cached row on
 * failure (`stale`). Aggregates are computed per read from per-asset caches
 * (D2) using TODAY's quantities; CCL(t) conversion is per asset (D1).
 */
export class ChartService {
  constructor(private deps: ChartServiceDeps) {}

  /** Portfolio aggregate curve: value(t) = Σ quantity_i(today) × close_i(t). */
  async getPortfolioHistory(range: SeriesRange, currency: SeriesCurrency, force: boolean): Promise<HistoryResponse> {
    const positions = await this.deps.positions.list();
    const assets: AssetSeries[] = [];
    for (const position of positions) {
      const series = await this.loadSeries(position.ticker, range, force);
      if (series !== null) assets.push(series);
    }
    return this.composeAggregate(assets, positions, range, currency, force);
  }

  /** One asset's series; unknown position id → NotFoundError (PC-1). */
  async getPositionHistory(positionId: number, range: SeriesRange, currency: SeriesCurrency, force: boolean): Promise<HistoryResponse> {
    const positions = await this.deps.positions.list();
    const position = positions.find((p) => p.id === positionId);
    if (position === undefined) throw new NotFoundError('Position not found', [`no position with id ${positionId}`]);
    const series = await this.loadSeries(position.ticker, range, force);
    if (series === null) return { points: [], currency, range, status: 'absent' };
    if (series.nativeCurrency === currency) {
      return { points: series.points, currency, range, status: series.status };
    }
    const ccl = await this.loadCcl(range, force);
    if (ccl === null) {
      // PC-3: no CCL → degrade to the native currency, never an error.
      return { points: series.points, currency: series.nativeCurrency, range, status: series.status, degraded: true };
    }
    const points = convertSeries(series.points, series.nativeCurrency, currency, ccl.points);
    const status = series.status === 'stale' || ccl.status === 'stale' ? 'stale' : 'fresh';
    return { points, currency, range, status };
  }

  /** Cache-first series load; force=true fetches, keeping stale on failure (D3, PC-4). */
  private async loadSeries(ticker: string, range: SeriesRange, force: boolean): Promise<AssetSeries | null> {
    const key = `series:${ticker}:${range}`;
    const cached = await this.deps.cache.get(key);
    if (!force) {
      if (cached === null || cached.kind !== 'series') return null;
      return { ticker, nativeCurrency: cached.nativeCurrency, points: cached.points, status: this.statusOf(cached.fetchedAt) };
    }
    try {
      const fetched = await this.deps.seriesSource.fetchSeries(ticker, range);
      await this.deps.cache.set({
        kind: 'series',
        key,
        ticker,
        range,
        nativeCurrency: fetched.nativeCurrency,
        points: fetched.points,
        fetchedAt: this.deps.clock.now().toISOString(),
      });
      return { ticker, nativeCurrency: fetched.nativeCurrency, points: fetched.points, status: 'fresh' };
    } catch {
      if (cached === null || cached.kind !== 'series') return null;
      return { ticker, nativeCurrency: cached.nativeCurrency, points: cached.points, status: 'stale' };
    }
  }

  /** Cache-first CCL load with the same force/fallback policy (PC-4). */
  private async loadCcl(range: SeriesRange, force: boolean): Promise<{ points: CclPoint[]; status: SeriesStatus } | null> {
    const key = `ccl:${range}`;
    const cached = await this.deps.cache.get(key);
    if (!force) {
      if (cached === null || cached.kind !== 'ccl') return null;
      return { points: cached.points, status: this.statusOf(cached.fetchedAt) };
    }
    try {
      const points = await this.deps.cclSource.fetchCclSeries();
      await this.deps.cache.set({ kind: 'ccl', key, range, points, fetchedAt: this.deps.clock.now().toISOString() });
      return { points, status: 'fresh' };
    } catch {
      if (cached === null || cached.kind !== 'ccl') return null;
      return { points: cached.points, status: 'stale' };
    }
  }

  private statusOf(fetchedAt: string): SeriesStatus {
    const age = this.deps.clock.now().getTime() - Date.parse(fetchedAt);
    return age > SERIES_TTL_MS ? 'stale' : 'fresh';
  }

  /** Aggregates aligned native series into the target currency (D1, D2, D5). */
  private async composeAggregate(
    assets: AssetSeries[],
    positions: Position[],
    range: SeriesRange,
    requested: SeriesCurrency,
    force: boolean,
  ): Promise<HistoryResponse> {
    let target = requested;
    let degraded = false;
    let cclStatus: SeriesStatus = 'fresh';
    let cclPoints: CclPoint[] | null = null;
    let active = assets;

    const needsCcl = active.some((a) => a.nativeCurrency !== requested);
    if (needsCcl) {
      const ccl = await this.loadCcl(range, force);
      if (ccl === null) {
        // PC-3: degrade to the currency we can still produce — never an error.
        target = requested === 'ARS' ? 'USD' : 'ARS';
        active = active.filter((a) => a.nativeCurrency === target);
        degraded = true;
      } else {
        cclPoints = ccl.points;
        cclStatus = ccl.status;
      }
    }

    const today = this.deps.clock.now().toISOString().slice(0, 10);
    const aligned = alignToCalendar(
      active.map((a) => ({ ticker: a.ticker, nativeCurrency: a.nativeCurrency, points: a.points })),
      RANGE_WINDOW_DAYS[range],
      today,
    );
    const qty = new Map(positions.map((p) => [p.ticker, p.quantity]));
    const converted = new Map<string, Map<string, number>>();
    for (const a of active) {
      const native = aligned.byTicker.get(a.ticker) as Map<string, number>;
      const points = [...native.entries()].map(([date, valueMinor]) => ({ date, valueMinor }));
      const pts = a.nativeCurrency === target ? points : convertSeries(points, a.nativeCurrency, target, cclPoints ?? []);
      converted.set(a.ticker, new Map(pts.map((p) => [p.date, p.valueMinor])));
    }

    // D5: sum only assets with a point that day; drop the day when none have one.
    const points: PricePoint[] = [];
    for (const date of aligned.dates) {
      let sum = 0;
      let any = false;
      for (const a of active) {
        const value = converted.get(a.ticker)?.get(date);
        if (value === undefined) continue;
        sum += Math.round((qty.get(a.ticker) ?? 0) * value);
        any = true;
      }
      if (any) points.push({ date, valueMinor: sum });
    }

    let status: SeriesStatus = 'absent';
    if (points.length > 0) {
      const anyStale = active.some((a) => a.status === 'stale') || (!degraded && needsCcl && cclStatus === 'stale');
      status = anyStale ? 'stale' : 'fresh';
    }
    return { points, currency: target, range, status, ...(degraded ? { degraded: true } : {}) };
  }
}
