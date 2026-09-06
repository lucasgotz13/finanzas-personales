import { useRef, useState } from 'react';
import type { HistoryResponse, SeriesCurrency, SeriesRange } from '../types';
import { useApi, type ApiState } from './useApi';

export const HISTORY_RANGES: SeriesRange[] = ['1m', '3m', '6m', '1y'];
export const HISTORY_CURRENCIES: SeriesCurrency[] = ['ARS', 'USD'];

interface UseHistoryChartOptions {
  /**
   * Cache-first read plus force-once write. Called with two args for normal
   * reads and three args (force=true) for the toggle-time force, matching the
   * underlying api call shapes.
   */
  fetchHistory: (range: SeriesRange, currency: SeriesCurrency, force?: boolean) => Promise<HistoryResponse>;
  /** Extra useApi deps (e.g. positionId for per-asset charts). */
  extraDeps?: unknown[];
}

interface UseHistoryChartResult {
  range: SeriesRange;
  setRange: (range: SeriesRange) => void;
  currency: SeriesCurrency;
  selectCurrency: (next: SeriesCurrency) => void;
  chart: ApiState<HistoryResponse>;
}

/**
 * Shared historical-chart behavior (PC-4): range/currency selection,
 * cache-first request handling via useApi, and toggle-time force-once
 * bookkeeping — one force per (range, currency) pair per session, covering
 * the warm-up race. The forced response itself is fire-and-forget; display
 * comes from the cache-first read (forced-response ignoring is a separate
 * regression investigation, left as-is).
 *
 * Presentation (headers, testids, disclosure text, degraded/empty states)
 * stays in the callers so asset identity and portfolio copy are preserved.
 */
export function useHistoryChart({ fetchHistory, extraDeps = [] }: UseHistoryChartOptions): UseHistoryChartResult {
  const [range, setRange] = useState<SeriesRange>('3m');
  const [currency, setCurrency] = useState<SeriesCurrency>('ARS');
  const forcedPairs = useRef(new Set<string>());
  // Latest fetch wins without resetting the useApi cadence on every render.
  const fetchRef = useRef(fetchHistory);
  fetchRef.current = fetchHistory;

  const chart = useApi(() => fetchRef.current(range, currency), [range, currency, ...extraDeps]);

  const selectCurrency = (next: SeriesCurrency): void => {
    setCurrency(next);
    const key = `${range}:${next}`;
    if (!forcedPairs.current.has(key)) {
      forcedPairs.current.add(key);
      void fetchRef.current(range, next, true).catch(() => undefined);
    }
  };

  return { range, setRange, currency, selectCurrency, chart };
}
