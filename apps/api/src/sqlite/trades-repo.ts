import type { Client, Row } from '@libsql/client';
import type { LegacyPositionPort, Position, Trade, TradeInput, TradeRepository } from '@finanzas/domain';

interface TradeRow {
  id: number;
  ticker: string;
  type: 'buy' | 'sell';
  trade_date: string;
  quantity: number;
  price_minor: number;
  currency: string;
}

interface PositionRow {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  avg_cost_minor: number;
  created_at: string;
}

/** Map a positional result row to an object keyed by the result columns. */
function toObject(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    ticker: row.ticker,
    type: row.type,
    date: row.trade_date,
    quantity: row.quantity,
    priceMinor: row.price_minor,
    currency: 'USD',
  };
}

function toPosition(row: PositionRow): Position {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    quantity: row.quantity,
    avgCostMinor: row.avg_cost_minor,
    currency: 'USD',
    createdAt: row.created_at,
  };
}

/** SQLite trade ledger store; rows come back ordered by (trade_date, id) (D7). */
export class SqliteTradeRepository implements TradeRepository {
  constructor(private db: Client) {}

  async list(): Promise<Trade[]> {
    const result = await this.db.execute('SELECT * FROM trades ORDER BY trade_date, id');
    return result.rows.map((row) => toTrade(toObject(row, result.columns) as unknown as TradeRow));
  }

  async create(input: TradeInput): Promise<Trade> {
    const result = await this.db.execute({
      sql: `INSERT INTO trades (ticker, type, trade_date, quantity, price_minor, currency, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [input.ticker, input.type, input.date, input.quantity, input.priceMinor, input.currency, new Date().toISOString()],
    });
    return { ...input, id: Number(result.lastInsertRowid) };
  }

  async update(id: number, input: TradeInput): Promise<Trade | null> {
    const result = await this.db.execute({
      sql: `UPDATE trades SET ticker = ?, type = ?, trade_date = ?, quantity = ?, price_minor = ?, currency = ? WHERE id = ?`,
      args: [input.ticker, input.type, input.date, input.quantity, input.priceMinor, input.currency, id],
    });
    if (result.rowsAffected === 0) return null;
    return { ...input, id };
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execute({ sql: 'DELETE FROM trades WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  }
}

/** Read-only view of the legacy positions table — the id/name merge source (D2). */
export class SqliteLegacyPositionRepository implements LegacyPositionPort {
  constructor(private db: Client) {}

  async list(): Promise<Position[]> {
    const result = await this.db.execute('SELECT * FROM positions ORDER BY ticker');
    return result.rows.map((row) => toPosition(toObject(row, result.columns) as unknown as PositionRow));
  }
}
