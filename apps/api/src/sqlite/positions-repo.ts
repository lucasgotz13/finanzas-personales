import type { Client, Row } from '@libsql/client';
import type { Position, PositionRepository } from '@finanzas/domain';

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

/** SQLite position store; deletion is hard and snapshots cascade via FK (PI-1). */
export class SqlitePositionRepository implements PositionRepository {
  constructor(private db: Client) {}

  async create(position: Position): Promise<Position> {
    const result = await this.db.execute({
      sql: `INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      args: [position.ticker, position.name, position.quantity, position.avgCostMinor, position.createdAt],
    });
    return { ...position, id: Number(result.lastInsertRowid) };
  }

  async update(id: number, position: Position): Promise<Position | null> {
    const result = await this.db.execute({
      sql: `UPDATE positions SET ticker = ?, name = ?, quantity = ?, avg_cost_minor = ? WHERE id = ?`,
      args: [position.ticker, position.name, position.quantity, position.avgCostMinor, id],
    });
    if (result.rowsAffected === 0) return null;
    return { ...position, id };
  }

  async list(): Promise<Position[]> {
    const result = await this.db.execute('SELECT * FROM positions ORDER BY ticker');
    return result.rows.map((row) => toPosition(toObject(row, result.columns) as unknown as PositionRow));
  }

  async findByTicker(ticker: string): Promise<Position | null> {
    const result = await this.db.execute({ sql: 'SELECT * FROM positions WHERE ticker = ?', args: [ticker] });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toPosition(row as unknown as PositionRow) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execute({ sql: 'DELETE FROM positions WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  }
}
