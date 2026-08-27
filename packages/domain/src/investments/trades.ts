import { NotFoundError, ValidationError } from '../errors';
import { normalizeTicker } from './catalog';
import { isArDateString } from '../vo/period-key';
import type { TradeRepository } from './ports';
import type { Position, RealizedTotals, Trade, TradeInput } from './types';

export interface TradeServiceDeps {
  trades: TradeRepository;
}

/** Floating-point tolerance for REAL quantities (fractional CEDEARs). */
const EPSILON = 1e-9;

interface TimelineRow {
  id: number;
  ticker: string;
  type: 'buy' | 'sell';
  date: string;
  quantity: number;
  priceMinor: number;
}

/** Stable negative id for tickers without a legacy position (D3): never
 * collides with AUTOINCREMENT legacy ids and stable across recomputes. */
export function derivedPositionId(ticker: string): number {
  return -Math.abs(fnv1a(ticker));
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function byDateThenId(a: TimelineRow, b: TimelineRow): number {
  if (a.date === b.date) return a.id - b.id;
  return a.date < b.date ? -1 : 1;
}

/**
 * Trade ledger service (TH-1..TH-4): owns CRUD, chronological running-balance
 * validation, the moving-average cost basis, derived positions and cumulative
 * realized P&L. Pure TypeScript — persistence comes through TradeRepository.
 */
export class TradeService {
  constructor(private deps: TradeServiceDeps) {}

  /** All trades ordered by (date, id) — same-date rows in insertion order (TH-2). */
  async list(): Promise<Trade[]> {
    const rows = (await this.deps.trades.list()).map(toTimelineRow);
    return [...rows].sort(byDateThenId).map((r) => ({ ...r, currency: 'USD' as const }));
  }

  /** Validates, normalizes and timeline-checks a new trade (TH-1, TH-2). */
  async create(input: TradeInput): Promise<Trade> {
    const clean = this.validate(input);
    await this.assertTimelineValid(clean.ticker, clean, null);
    return this.deps.trades.create(clean);
  }

  /** Full replace (PUT): the new timeline is re-validated end to end (TH-1, TH-2). */
  async update(id: number, input: TradeInput): Promise<Trade> {
    const clean = this.validate(input);
    const all = await this.deps.trades.list();
    const existing = all.find((t) => t.id === id);
    if (existing === undefined) throw new NotFoundError('Trade not found', [`no trade with id ${id}`]);
    await this.assertTimelineValid(clean.ticker, clean, { id, ticker: existing.ticker });
    const updated = await this.deps.trades.update(id, clean);
    if (updated === null) throw new NotFoundError('Trade not found', [`no trade with id ${id}`]);
    return updated;
  }

  /** Deletes after proving the remaining timeline stays valid (TH-2). */
  async delete(id: number): Promise<void> {
    const all = await this.deps.trades.list();
    const existing = all.find((t) => t.id === id);
    if (existing === undefined) throw new NotFoundError('Trade not found', [`no trade with id ${id}`]);
    await this.assertTimelineValid(existing.ticker, null, { id, ticker: existing.ticker });
    const deleted = await this.deps.trades.delete(id);
    if (!deleted) throw new NotFoundError('Trade not found', [`no trade with id ${id}`]);
  }

  /** Derived positions from the ledger (TH-3, PI-1): quantity = Σbuys − Σsells,
   * avgCostMinor = moving average; fully sold tickers disappear. */
  async derivedPositions(): Promise<Position[]> {
    const rows = await this.list();
    const positions: Position[] = [];
    for (const [ticker, trades] of groupByTicker(rows)) {
      const { quantity, avg } = foldTimeline(trades);
      if (quantity <= EPSILON) continue; // fully sold → no position
      positions.push({
        id: derivedPositionId(ticker),
        ticker,
        name: ticker,
        quantity,
        avgCostMinor: Math.round(avg),
        currency: 'USD',
        createdAt: '',
      });
    }
    return positions.sort((a, b) => (a.ticker < b.ticker ? -1 : 1));
  }

  /** Cumulative realized P&L per ticker and portfolio (TH-4), minor units;
   * each sell realizes (price − moving avg at sell time) × quantity. */
  async realizedTotals(): Promise<RealizedTotals> {
    const rows = await this.list();
    const perTicker: Record<string, number> = {};
    let total = 0;
    for (const [ticker, trades] of groupByTicker(rows)) {
      const { realized } = foldTimeline(trades);
      perTicker[ticker] = realized;
      total += realized;
    }
    return { perTicker, total };
  }

  private validate(input: TradeInput): TradeInput {
    const type = input?.type;
    if (type !== 'buy' && type !== 'sell') {
      throw new ValidationError('Invalid trade type', ['type must be buy or sell']);
    }
    if (typeof input.ticker !== 'string') {
      throw new ValidationError('Invalid ticker', ['ticker must be a non-empty string']);
    }
    const ticker = normalizeTicker(input.ticker);
    if (!isArDateString(input.date)) {
      throw new ValidationError('Invalid date', ['date must be a valid YYYY-MM-DD calendar date']);
    }
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('Invalid quantity', ['quantity must be a positive number']);
    }
    const priceMinor = Number(input.priceMinor);
    if (!Number.isFinite(priceMinor) || priceMinor <= 0) {
      throw new ValidationError('Invalid priceMinor', ['priceMinor must be a positive number (USD cents)']);
    }
    if (input.currency !== undefined && input.currency !== 'USD') {
      throw new ValidationError('Unsupported currency', ['currency must be USD in v1']);
    }
    return { type, ticker, date: input.date, quantity, priceMinor: Math.round(priceMinor), currency: 'USD' };
  }

  /**
   * Simulates the ticker timeline with the candidate trade applied (created,
   * replaced or removed) and rejects any state where the running balance goes
   * negative, naming the offending trade (TH-2).
   */
  private async assertTimelineValid(
    ticker: string,
    candidate: TradeInput | null,
    replacing: { id: number; ticker: string } | null,
  ): Promise<void> {
    const all = await this.deps.trades.list();
    const affected = new Set<string>([ticker]);
    if (replacing !== null) affected.add(replacing.ticker);

    for (const symbol of affected) {
      let rows = all
        .filter((t) => t.ticker === symbol && (replacing === null || t.id !== replacing.id))
        .map(toTimelineRow);
      if (candidate !== null) {
        rows.push({ ...candidate, id: replacing?.id ?? Number.POSITIVE_INFINITY });
      }
      rows.sort(byDateThenId);
      this.assertBalance(symbol, rows);
    }
  }

  private assertBalance(ticker: string, rows: TimelineRow[]): void {
    let balance = 0;
    for (const row of rows) {
      if (row.type === 'buy') {
        balance += row.quantity;
        continue;
      }
      if (row.quantity - balance > EPSILON) {
        const idPart = Number.isFinite(row.id) ? ` (id ${row.id})` : '';
        throw new ValidationError(
          'Invalid trade timeline',
          [`${row.type} of ${row.quantity} ${ticker} on ${row.date}${idPart} exceeds balance ${balance}; fix that ${row.type} first`],
          'TRADE_EXCEEDS_BALANCE',
          { type: row.type, ticker, quantity: row.quantity, date: row.date, balance },
        );
      }
      balance -= row.quantity;
    }
  }
}

function toTimelineRow(t: Trade): TimelineRow {
  return { id: t.id, ticker: t.ticker, type: t.type, date: t.date, quantity: t.quantity, priceMinor: t.priceMinor };
}

function groupByTicker(rows: TimelineRow[]): Map<string, TimelineRow[]> {
  const groups = new Map<string, TimelineRow[]>();
  for (const row of rows) {
    const list = groups.get(row.ticker) ?? [];
    list.push(row);
    groups.set(row.ticker, list);
  }
  return groups;
}

/** One chronological pass: running balance, moving average and realized P&L. */
function foldTimeline(rows: TimelineRow[]): { quantity: number; avg: number; realized: number } {
  let quantity = 0;
  let avg = 0;
  let realized = 0;
  for (const row of rows) {
    if (row.type === 'buy') {
      const total = quantity + row.quantity;
      avg = total > EPSILON ? (quantity * avg + row.quantity * row.priceMinor) / total : row.priceMinor;
      quantity = total;
    } else {
      realized += Math.round((row.priceMinor - avg) * row.quantity);
      quantity -= row.quantity;
    }
  }
  return { quantity, avg, realized };
}
