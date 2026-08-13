import { PRICE_TTL_MS } from './catalog';
import type { PositionRepository, PortfolioFxPort, PriceCache, PriceSource, RealizedLedgerPort } from './ports';
import type { CcStatus, PortfolioRefreshResult, PortfolioSummary, PositionView } from './types';
import { TTL_BY_CLASS } from '../indicators/catalog';

export interface PortfolioServiceDeps {
  repo: PositionRepository;
  cache: PriceCache;
  source: PriceSource;
  fx: PortfolioFxPort;
  /** Trade ledger feeding cumulative realized P&L (TH-4). */
  ledger: RealizedLedgerPort;
  clock: { now(): Date };
}

/** CCL freshness reuses the FX class TTL (design: ≈ 5 min). */
const CCL_TTL_MS = TTL_BY_CLASS.fx;

/**
 * Portfolio read model service (PI-3..PI-5). getPortfolio() is cache-only and
 * never fetches prices; refresh() runs per position SEQUENTIALLY with TTL
 * gating, force bypass, finite-value validation and try/catch isolation so one
 * failing symbol never affects the others.
 */
export class PortfolioService {
  constructor(private deps: PortfolioServiceDeps) {}

  /** Cache-first views + CCL-aware totals; absent/stale degrade, never blank (PI-4). */
  async getPortfolio(): Promise<PortfolioSummary> {
    const positions = await this.deps.repo.list();
    const fx = await this.deps.fx.getCcl();
    const realized = await this.deps.ledger.realizedTotals();
    const ccStatus = this.ccStatusOf(fx);
    const views: PositionView[] = [];
    for (const position of positions) {
      views.push(await this.toView(position, fx, realized.perTicker[position.ticker] ?? 0));
    }
    return { ccStatus, totals: this.totalsOf(views, fx, realized.total), positions: views };
  }

  /** Refresh every position sequentially; within-TTL positions are skipped
   * unless forced (PI-5). */
  async refresh(force = false): Promise<PortfolioRefreshResult[]> {
    const positions = await this.deps.repo.list();
    const results: PortfolioRefreshResult[] = [];
    for (const position of positions) {
      results.push(await this.refreshOne(position.ticker, force));
    }
    return results;
  }

  private async refreshOne(ticker: string, force: boolean): Promise<PortfolioRefreshResult> {
    const snapshot = await this.deps.cache.get(ticker);
    if (!force && snapshot) {
      const age = this.deps.clock.now().getTime() - Date.parse(snapshot.fetchedAt);
      if (age <= PRICE_TTL_MS) return { ticker, status: 'cached' };
    }
    try {
      const quote = await this.deps.source.fetch(ticker);
      if (!Number.isFinite(quote.priceMinor)) {
        throw new Error(`source returned a non-finite price for ${ticker}`);
      }
      await this.deps.cache.set({
        ticker,
        priceMinor: quote.priceMinor,
        currency: 'USD',
        fetchedAt: this.deps.clock.now().toISOString(),
        source: 'yahoo',
      });
      return { ticker, status: 'updated' };
    } catch (err) {
      return { ticker, status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  private ccStatusOf(fx: { value: number; fetchedAt: string } | null): CcStatus {
    if (fx === null) return 'absent';
    const age = this.deps.clock.now().getTime() - Date.parse(fx.fetchedAt);
    return age > CCL_TTL_MS ? 'stale' : 'fresh';
  }

  private async toView(position: {
    id?: number;
    ticker: string;
    name: string;
    quantity: number;
    avgCostMinor: number;
  }, fx: { value: number; fetchedAt: string } | null, realizedUsdMinor: number): Promise<PositionView> {
    const base: PositionView = {
      id: position.id as number,
      ticker: position.ticker,
      name: position.name,
      quantity: position.quantity,
      avgCostMinor: position.avgCostMinor,
      priceMinor: null,
      status: 'absent',
      valueUsdMinor: null,
      valueArsMinor: null,
      pnlUsdMinor: null,
      pnlPct: null,
      pnlArsMinor: null,
      realizedUsdMinor,
    };
    const snapshot = await this.deps.cache.get(position.ticker);
    if (snapshot === null) return base;
    const age = this.deps.clock.now().getTime() - Date.parse(snapshot.fetchedAt);
    const status = age > PRICE_TTL_MS ? 'stale' : 'fresh';
    // Valuation rounds once per figure (design: quantity REAL, one rounding).
    const valueUsdMinor = Math.round(snapshot.priceMinor * position.quantity);
    const pnlUsdMinor = Math.round((snapshot.priceMinor - position.avgCostMinor) * position.quantity);
    return {
      ...base,
      priceMinor: snapshot.priceMinor,
      status,
      valueUsdMinor,
      valueArsMinor: fx === null ? null : Math.round(valueUsdMinor * fx.value),
      pnlUsdMinor,
      pnlPct: (snapshot.priceMinor - position.avgCostMinor) / position.avgCostMinor,
      pnlArsMinor: fx === null ? null : Math.round(pnlUsdMinor * fx.value),
    };
  }

  /** Totals over priced positions only; ARS variants null without CCL (PI-4). */
  private totalsOf(views: PositionView[], fx: { value: number } | null, realizedUsdMinor: number): PortfolioSummary['totals'] {
    const valueUsdMinor = views.reduce((sum, v) => sum + (v.valueUsdMinor ?? 0), 0);
    const pnlUsdMinor = views.reduce((sum, v) => sum + (v.pnlUsdMinor ?? 0), 0);
    const costMinor = views.reduce((sum, v) => (v.priceMinor === null ? sum : sum + v.avgCostMinor * v.quantity), 0);
    return {
      valueUsdMinor,
      valueArsMinor: fx === null ? null : Math.round(valueUsdMinor * fx.value),
      pnlUsdMinor,
      pnlPct: costMinor > 0 ? pnlUsdMinor / costMinor : null,
      pnlArsMinor: fx === null ? null : Math.round(pnlUsdMinor * fx.value),
      realizedUsdMinor,
    };
  }
}
