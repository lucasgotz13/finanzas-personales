/** Time window of a price chart (PC-1): 1 month, 3 months, 6 months or 1 year. */
export type SeriesRange = '1m' | '3m' | '6m' | '1y';

/** Chart display currency (PC-1): Argentine pesos or US dollars. */
export type SeriesCurrency = 'ARS' | 'USD';

/** Freshness of a served series (PC-1): fresh within the daily TTL, stale
 * beyond it, absent when no series was ever fetched. */
export type SeriesStatus = 'fresh' | 'stale' | 'absent';

/** One daily observation: ISO calendar date (YYYY-MM-DD) plus an integer
 * value in minor units — cents (D8). CCL rows are REAL rates (CclPoint). */
export interface PricePoint {
  date: string;
  valueMinor: number;
}

/** One contado-con-liqui observation: date plus the REAL venta rate (D8). */
export interface CclPoint {
  date: string;
  value: number;
}

/** Daily series for one ticker in its NATIVE currency (D1): USD-native
 * assets arrive in USD, .BA assets in ARS. */
export interface NativeSeries {
  ticker: string;
  nativeCurrency: SeriesCurrency;
  points: PricePoint[];
}

/** Cached ticker series row (PC-4), keyed `series:{ticker}:{range}`. */
export interface SeriesSnapshot {
  kind: 'series';
  key: string;
  ticker: string;
  range: SeriesRange;
  nativeCurrency: SeriesCurrency;
  points: PricePoint[];
  fetchedAt: string;
}

/** Cached CCL row (PC-4), keyed `ccl:{range}`; points hold REAL rates. */
export interface CclSnapshot {
  kind: 'ccl';
  key: string;
  range: SeriesRange;
  points: CclPoint[];
  fetchedAt: string;
}

/** Cache entry: either a ticker series or the CCL series. */
export type ChartCacheEntry = SeriesSnapshot | CclSnapshot;

/** REST response of the history endpoints (PC-1, PC-3): points plus the
 * currency actually served — degraded responses serve another currency. */
export interface HistoryResponse {
  points: PricePoint[];
  currency: SeriesCurrency;
  range: SeriesRange;
  status: SeriesStatus;
  degraded?: boolean;
}
