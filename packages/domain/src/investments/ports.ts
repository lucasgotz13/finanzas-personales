import type { Position, PriceQuote, PriceSnapshot, RealizedTotals, Trade, TradeInput } from './types';

/** External source of fresh equity prices, one symbol per request (PI-2).
 * Quotes arrive already normalized to USD cents by the adapter. */
export interface PriceSource {
  fetch(ticker: string): Promise<PriceQuote>;
}

/** Snapshot store keyed by ticker (PI-3). */
export interface PriceCache {
  get(ticker: string): Promise<PriceSnapshot | null>;
  set(snapshot: PriceSnapshot): Promise<void>;
}

/** Derived position read model (PI-1): positions come from the trade ledger,
 * so mutations are gone — the port exposes a single read (D9). */
export interface PositionRepository {
  list(): Promise<Position[]>;
}

/** Trade ledger persistence (TH-1). Ordering by (date, id) is the repo's job. */
export interface TradeRepository {
  list(): Promise<Trade[]>;
  create(input: TradeInput): Promise<Trade>;
  update(id: number, input: TradeInput): Promise<Trade | null>;
  delete(id: number): Promise<boolean>;
}

/** Read-only access to the legacy positions table (rollback net, PI-1).
 * Only the id/name merge uses it (D2) — no fallback read for derivation. */
export interface LegacyPositionPort {
  list(): Promise<Position[]>;
}

/** Cumulative realized P&L provider feeding the portfolio summary (TH-4). */
export interface RealizedLedgerPort {
  realizedTotals(): Promise<RealizedTotals>;
}

/** Read-only CCL access for ARS valuation (PI-4). The portfolio never
 * fetches FX; it reuses the existing indicator cache. */
export interface PortfolioFxPort {
  getCcl(): Promise<{ value: number; fetchedAt: string } | null>;
}
