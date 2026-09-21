import type { Client } from '@libsql/client';
import type { IndicatorCache, IndicatorSnapshot } from '@finanzas/domain';

import { toObject } from './row';

interface SnapshotRow {
  key: string;
  value: number;
  unit: string;
  reference_date: string;
  fetched_at: string;
  source: string;
  prev_value: number | null;
}

function toSnapshot(row: SnapshotRow): IndicatorSnapshot {
  return {
    key: row.key,
    value: row.value,
    unit: row.unit,
    referenceDate: row.reference_date,
    fetchedAt: row.fetched_at,
    source: row.source,
    // NULL (or a column missing on an un-migrated database) reads as null.
    prevValue: row.prev_value ?? null,
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
      sql: `INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source, prev_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           unit = excluded.unit,
           reference_date = excluded.reference_date,
           fetched_at = excluded.fetched_at,
           source = excluded.source,
           prev_value = excluded.prev_value`,
      args: [
        snapshot.key,
        snapshot.value,
        snapshot.unit,
        snapshot.referenceDate,
        snapshot.fetchedAt,
        snapshot.source,
        snapshot.prevValue,
      ],
    });
  }
}
