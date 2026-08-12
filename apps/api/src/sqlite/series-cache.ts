import type { Client, Row } from '@libsql/client';
import type { CclPoint, ChartCacheEntry, PricePoint, SeriesCache, SeriesCurrency, SeriesRange } from '@finanzas/domain';

interface SeriesRow {
  key: string;
  kind: string;
  native_currency: string;
  points_json: string;
  fetched_at: string;
}

/** Map a positional result row to an object keyed by the result columns. */
function toObject(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

/** `ccl:{range}` → range; `series:{ticker}:{range}` → ticker + range (PC-4 keys). */
function parseSeriesKey(key: string): { ticker: string; range: SeriesRange } {
  const parts = key.split(':');
  return { ticker: parts[1], range: parts[2] as SeriesRange };
}

function toEntry(row: SeriesRow): ChartCacheEntry {
  if (row.kind === 'ccl') {
    return {
      kind: 'ccl',
      key: row.key,
      range: row.key.slice('ccl:'.length) as SeriesRange,
      points: JSON.parse(row.points_json) as CclPoint[],
      fetchedAt: row.fetched_at,
    };
  }
  const { ticker, range } = parseSeriesKey(row.key);
  return {
    kind: 'series',
    key: row.key,
    ticker,
    range,
    nativeCurrency: row.native_currency as SeriesCurrency,
    points: JSON.parse(row.points_json) as PricePoint[],
    fetchedAt: row.fetched_at,
  };
}

/** Daily-TTL store for chart series and CCL rows; upserts on conflict (PC-4). */
export class SqliteSeriesCache implements SeriesCache {
  constructor(private db: Client) {}

  async get(key: string): Promise<ChartCacheEntry | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM series_cache WHERE key = ?',
      args: [key],
    });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toEntry(row as unknown as SeriesRow) : null;
  }

  async set(entry: ChartCacheEntry): Promise<void> {
    const nativeCurrency = entry.kind === 'ccl' ? 'ARS' : entry.nativeCurrency;
    await this.db.execute({
      sql: `INSERT INTO series_cache (key, kind, native_currency, points_json, fetched_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           kind = excluded.kind,
           native_currency = excluded.native_currency,
           points_json = excluded.points_json,
           fetched_at = excluded.fetched_at`,
      args: [entry.key, entry.kind, nativeCurrency, JSON.stringify(entry.points), entry.fetchedAt],
    });
  }
}
