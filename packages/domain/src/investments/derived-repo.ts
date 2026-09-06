import type { LegacyPositionPort, PortfolioSnapshot, PortfolioSnapshotPort, PositionRepository } from './ports';
import type { Position } from './types';
import type { TradeService } from './trades';

/**
 * Adapter turning the trade ledger into the PositionRepository port (D1):
 * positions derive solely from trades; the legacy positions table contributes
 * ONLY id and name for tickers that had a pre-migration record (D2, D3).
 * Tickers without trades have no position — no fallback read.
 */
export class DerivedPositionRepository implements PositionRepository, PortfolioSnapshotPort {
  constructor(
    private trades: TradeService,
    private legacy: LegacyPositionPort,
  ) {}

  async list(): Promise<Position[]> {
    const derived = await this.trades.derivedPositions();
    return this.withLegacyIdentity(derived);
  }

  /** Positions + realized totals from one request-scoped ledger snapshot:
   * a single trade-ledger read feeds both, with the same legacy id/name
   * merge as list(). The snapshot is a local value, not a cache. */
  async portfolioSnapshot(): Promise<PortfolioSnapshot> {
    const snapshot = await this.trades.portfolioSnapshot();
    return { positions: await this.withLegacyIdentity(snapshot.positions), totals: snapshot.totals };
  }

  private async withLegacyIdentity(derived: Position[]): Promise<Position[]> {
    const legacyRows = await this.legacy.list();
    const byTicker = new Map(legacyRows.map((p) => [p.ticker, p]));
    return derived.map((p) => {
      const legacyRow = byTicker.get(p.ticker);
      if (legacyRow === undefined) return p;
      return { ...p, id: legacyRow.id, name: legacyRow.name, createdAt: legacyRow.createdAt };
    });
  }
}
