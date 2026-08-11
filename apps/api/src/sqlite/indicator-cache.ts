import type { Client, Row } from '@libsql/client';
import type { IndicatorCache, IndicatorSnapshot } from '@finanzas/domain';

interface SnapshotRow {
  key: string;
  value: number;
  unit: string;
  reference_date: string;
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

function toSnapshot(row: SnapshotRow): IndicatorSnapshot {
  return {
    key: row.key,
    value: row.value,
    unit: row.unit,
    referenceDate: row.reference_date,
    fetchedAt: row.fetched_at,
    source: row.source,
  };
}

/** SQLite snapshot store for indicator rows; upserts on conflict (EI-1). */
export class SqliteIndicatorCache implements IndicatorCache {
  constructor(private db: Client) {}

  async get(key: string): Promise<IndicatorSnapshot | null> {
    const result = await this.db.execute({ sql: 'SELECT * FROM indicator_snapshots WHERE key = ?', args: [key] });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toSnapshot(row as unknown as SnapshotRow) : null;
  }

  async set(snapshot: IndicatorSnapshot): Promise<void> {
    await this.db.execute({
      sql: `INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           unit = excluded.unit,
           reference_date = excluded.reference_date,
           fetched_at = excluded.fetched_at,
           source = excluded.source`,
      args: [
        snapshot.key,
        snapshot.value,
        snapshot.unit,
        snapshot.referenceDate,
        snapshot.fetchedAt,
        snapshot.source,
      ],
    });
  }
}
