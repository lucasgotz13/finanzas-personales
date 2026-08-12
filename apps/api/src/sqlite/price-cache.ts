import type { Client, Row } from '@libsql/client';
import type { PriceCache, PriceSnapshot } from '@finanzas/domain';

interface SnapshotRow {
  ticker: string;
  price_minor: number;
  currency: string;
  fetched_at: string;
  source: string;
}

/** Map a positional result row to an object keyed by the result columns. */
function toObject(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function toSnapshot(row: SnapshotRow): PriceSnapshot {
  return {
    ticker: row.ticker,
    priceMinor: row.price_minor,
    currency: 'USD',
    fetchedAt: row.fetched_at,
    source: row.source,
  };
}

/** SQLite snapshot store for equity prices; upserts on conflict (PI-3). */
export class SqlitePriceCache implements PriceCache {
  constructor(private db: Client) {}

  async get(ticker: string): Promise<PriceSnapshot | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM price_snapshots WHERE ticker = ?',
      args: [ticker],
    });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toSnapshot(row as unknown as SnapshotRow) : null;
  }

  async set(snapshot: PriceSnapshot): Promise<void> {
    await this.db.execute({
      sql: `INSERT INTO price_snapshots (ticker, price_minor, currency, fetched_at, source)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(ticker) DO UPDATE SET
           price_minor = excluded.price_minor,
           currency = excluded.currency,
           fetched_at = excluded.fetched_at,
           source = excluded.source`,
      args: [snapshot.ticker, snapshot.priceMinor, snapshot.currency, snapshot.fetchedAt, snapshot.source],
    });
  }
}
