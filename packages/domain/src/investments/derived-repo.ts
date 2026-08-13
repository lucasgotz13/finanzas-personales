import type { LegacyPositionPort, PositionRepository } from './ports';
import type { Position } from './types';
import type { TradeService } from './trades';

/**
 * Adapter turning the trade ledger into the PositionRepository port (D1):
 * positions derive solely from trades; the legacy positions table contributes
 * ONLY id and name for tickers that had a pre-migration record (D2, D3).
 * Tickers without trades have no position — no fallback read.
 */
export class DerivedPositionRepository implements PositionRepository {
  constructor(
    private trades: TradeService,
    private legacy: LegacyPositionPort,
  ) {}

  async list(): Promise<Position[]> {
    const derived = await this.trades.derivedPositions();
    const legacyRows = await this.legacy.list();
    const byTicker = new Map(legacyRows.map((p) => [p.ticker, p]));
    return derived.map((p) => {
      const legacyRow = byTicker.get(p.ticker);
      if (legacyRow === undefined) return p;
      return { ...p, id: legacyRow.id, name: legacyRow.name, createdAt: legacyRow.createdAt };
    });
  }

  async findByTicker(ticker: string): Promise<Position | null> {
    const positions = await this.list();
    return positions.find((p) => p.ticker === ticker) ?? null;
  }
}
