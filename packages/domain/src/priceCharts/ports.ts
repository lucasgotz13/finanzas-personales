import type { CclPoint, ChartCacheEntry, NativeSeries, SeriesRange } from './types';

/** External source of daily price series, one ticker per request (PC-1).
 * Series arrive in the ticker's NATIVE currency (D1). */
export interface PriceSeriesSource {
  fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries>;
}

/** External source of the contado-con-liqui daily series (PC-3). */
export interface CclSeriesSource {
  fetchCclSeries(): Promise<CclPoint[]>;
}

/** Daily-TTL store for series and CCL rows (PC-4), keyed
 * `series:{ticker}:{range}` | `ccl:{range}`. */
export interface SeriesCache {
  get(key: string): Promise<ChartCacheEntry | null>;
  set(entry: ChartCacheEntry): Promise<void>;
}
