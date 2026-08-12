/** Equity snapshot freshness as seen by the UI (PI-3): fresh within TTL,
 * stale beyond TTL (last price kept), absent = never fetched. */
export type PriceStatus = 'fresh' | 'stale' | 'absent';

/** CCL freshness for ARS valuation (PI-4): same lifecycle, different entity. */
export type CcStatus = 'fresh' | 'stale' | 'absent';

/** Native currency of positions in v1: USD only (PI-1). */
export type PositionCurrency = 'USD';

/** A manually entered portfolio position (CEDEAR/BYMA stock). `avgCostMinor`
 * is the average cost basis in USD cents; `quantity` is REAL so fractional
 * CEDEARs are allowed. */
export interface Position {
  id?: number;
  ticker: string;
  name: string;
  quantity: number;
  avgCostMinor: number;
  currency: PositionCurrency;
  createdAt: string;
}

/** Cached price row for one ticker. `priceMinor` is normalized to USD cents
 * by the source adapter; `fetchedAt` is a UTC ISO instant. */
export interface PriceSnapshot {
  ticker: string;
  priceMinor: number;
  currency: 'USD';
  fetchedAt: string;
  source: string;
}

/** A fresh quote returned by a price source, already normalized to USD. */
export interface PriceQuote {
  priceMinor: number;
  currency: 'USD';
}

/** API view of one position: always present, with price-dependent fields null
 * when no snapshot exists (PI-4, snapshot-less positions render '—'). */
export interface PositionView {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  avgCostMinor: number;
  priceMinor: number | null;
  status: PriceStatus;
  valueUsdMinor: number | null;
  valueArsMinor: number | null;
  pnlUsdMinor: number | null;
  pnlPct: number | null;
  pnlArsMinor: number | null;
}

/** Portfolio read model: per-position views plus CCL-aware totals (PI-4).
 * ARS totals are null when no CCL is available — USD-only, never blank. */
export interface PortfolioSummary {
  ccStatus: CcStatus;
  totals: {
    valueUsdMinor: number;
    valueArsMinor: number | null;
    pnlUsdMinor: number;
    pnlPct: number | null;
    pnlArsMinor: number | null;
  };
  positions: PositionView[];
}

/** Per-ticker outcome of a refresh (PI-5). */
export interface PortfolioRefreshResult {
  ticker: string;
  status: 'updated' | 'cached' | 'failed';
  error?: string;
}
