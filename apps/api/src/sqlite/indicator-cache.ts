import type { DatabaseSync } from 'node:sqlite';
import type { IndicatorCache, IndicatorSnapshot } from '@finanzas/domain';

interface SnapshotRow {
  key: string;
  value: number;
  unit: string;
  reference_date: string;
  fetched_at: string;
  source: string;
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
  constructor(private db: DatabaseSync) {}

  async get(key: string): Promise<IndicatorSnapshot | null> {
    const row = this.db.prepare('SELECT * FROM indicator_snapshots WHERE key = ?').get(key) as
      | SnapshotRow
      | undefined;
    return row ? toSnapshot(row) : null;
  }

  async set(snapshot: IndicatorSnapshot): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           unit = excluded.unit,
           reference_date = excluded.reference_date,
           fetched_at = excluded.fetched_at,
           source = excluded.source`,
      )
      .run(
        snapshot.key,
        snapshot.value,
        snapshot.unit,
        snapshot.referenceDate,
        snapshot.fetchedAt,
        snapshot.source,
      );
  }
}
