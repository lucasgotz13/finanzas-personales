import type { Position, PriceQuote, PriceSnapshot } from './types';

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

/** Position persistence (PI-1). Delete is hard; snapshots cascade. */
export interface PositionRepository {
  create(position: Position): Promise<Position>;
  update(id: number, position: Position): Promise<Position | null>;
  list(): Promise<Position[]>;
  findByTicker(ticker: string): Promise<Position | null>;
  delete(id: number): Promise<boolean>;
}

/** Read-only CCL access for ARS valuation (PI-4). The portfolio never
 * fetches FX; it reuses the existing indicator cache. */
export interface PortfolioFxPort {
  getCcl(): Promise<{ value: number; fetchedAt: string } | null>;
}
