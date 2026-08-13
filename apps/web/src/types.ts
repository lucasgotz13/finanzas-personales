/** Shared API types mirroring the REST contract under /api/v1. */

export interface ApiTransaction {
  id: number;
  direction: 'expense' | 'income';
  amountMinor: number;
  currency: 'ARS' | 'USD';
  rate: number;
  date: string;
  categoryId: number;
  note: string;
}

export interface CreateTransactionInput {
  direction: 'expense' | 'income';
  amountMinor: number;
  currency: 'ARS' | 'USD';
  rate?: number;
  date: string;
  categoryId: number;
  note?: string;
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  children: CategoryNode[];
}

export interface CategoryBudgetStatus {
  categoryId: number;
  cap: number;
  consumed: number;
  overBudget: boolean;
}

export interface BudgetStatus {
  month: string;
  categories: CategoryBudgetStatus[];
  global: { cap: number; consumed: number; overBudget: boolean };
}

export interface CurrencySummary {
  currency: 'ARS' | 'USD';
  expense: number;
  income: number;
  netFlow: number;
  savingsRate: number | null;
}

export interface CategorySummary {
  categoryId: number;
  name: string;
  currency: 'ARS' | 'USD';
  expense: number;
  income: number;
}

export interface PeriodSummary {
  period: string;
  currencies: CurrencySummary[];
  categories: CategorySummary[];
}

export type IndicatorStatus = 'fresh' | 'stale' | 'absent';

export interface IndicatorView {
  key: string;
  value: number | null;
  unit: string;
  referenceDate: string | null;
  updatedAt: string | null;
  stale: boolean;
  status: IndicatorStatus;
  referenceAged: boolean;
}

export interface IndicatorRefreshResult {
  class: string;
  status: 'updated' | 'cached' | 'failed';
  error?: string;
}

/** Portfolio types mirroring the REST contract under /api/v1/portfolio. */
export type PriceStatus = 'fresh' | 'stale' | 'absent';
export type CcStatus = 'fresh' | 'stale' | 'absent';

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

/** Trade ledger types mirroring the REST contract under /api/v1/portfolio/trades. */
export interface Trade {
  id: number;
  ticker: string;
  type: 'buy' | 'sell';
  date: string;
  quantity: number;
  priceMinor: number;
  currency: 'USD';
}

export interface TradeInput {
  ticker: string;
  type: 'buy' | 'sell';
  date: string;
  quantity: number;
  priceMinor: number;
  currency: 'USD';
}

export interface PortfolioRefreshResult {
  ticker: string;
  status: 'updated' | 'cached' | 'failed';
  error?: string;
}

/** Price chart types mirroring the REST contract under /api/v1/portfolio/history. */
export type SeriesRange = '3m' | '6m' | '1y';
export type SeriesCurrency = 'ARS' | 'USD';
export type SeriesStatus = 'fresh' | 'stale' | 'absent';

export interface PricePoint {
  date: string;
  valueMinor: number;
}

export interface HistoryResponse {
  points: PricePoint[];
  currency: SeriesCurrency;
  range: SeriesRange;
  status: SeriesStatus;
  degraded?: boolean;
}
