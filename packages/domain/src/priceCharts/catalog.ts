import type { SeriesCurrency, SeriesRange } from './types';

/** Series cache TTL (PC-4): ≈ 24 h — daily series, NOT the 5-min snapshot TTL. */
export const SERIES_TTL_MS = 24 * 60 * 60_000;

/** Max CCL forward-fill (PC-3, D4): 5 calendar days; older dates are dropped. */
export const FF_MAX_DAYS = 5;

/** Calendar window per range (design): 30/90/180/365 days, today included. */
export const RANGE_WINDOW_DAYS: Record<SeriesRange, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };

export const SERIES_RANGES: readonly SeriesRange[] = ['1m', '3m', '6m', '1y'];

export const SERIES_CURRENCIES: readonly SeriesCurrency[] = ['ARS', 'USD'];

/** Guards an unknown query value as a valid range (PC-1: invalid → 422). */
export function isSeriesRange(raw: unknown): raw is SeriesRange {
  return typeof raw === 'string' && (SERIES_RANGES as readonly string[]).includes(raw);
}

/** Guards an unknown query value as a valid currency (PC-1: invalid → 422). */
export function isSeriesCurrency(raw: unknown): raw is SeriesCurrency {
  return typeof raw === 'string' && (SERIES_CURRENCIES as readonly string[]).includes(raw);
}
