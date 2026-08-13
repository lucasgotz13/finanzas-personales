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

/** Ledger operation kind: buys add to the balance, sells subtract (TH-1). */
export type TradeType = 'buy' | 'sell';

/** One trade row of the operations ledger (TH-1). `date` is YYYY-MM-DD,
 * `priceMinor` is the per-unit price in USD cents. */
export interface Trade {
  id: number;
  ticker: string;
  type: TradeType;
  date: string;
  quantity: number;
  priceMinor: number;
  currency: 'USD';
}

/** Payload for create/update; the service validates and normalizes (TH-1). */
export interface TradeInput {
  ticker: string;
  type: TradeType;
  date: string;
  quantity: number;
  priceMinor: number;
  currency: 'USD';
}

/** Cumulative realized P&L in USD minor units; losses are negative (TH-4). */
export interface RealizedTotals {
  perTicker: Record<string, number>;
  total: number;
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
  realizedUsdMinor: number;
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
    realizedUsdMinor: number;
  };
  positions: PositionView[];
}

/** Per-ticker outcome of a refresh (PI-5). */
export interface PortfolioRefreshResult {
  ticker: string;
  status: 'updated' | 'cached' | 'failed';
  error?: string;
}
