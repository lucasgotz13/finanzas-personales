import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalClient, MIGRATIONS_DIR, migrate } from '../../../scripts/migrate';
import { SqliteIndicatorCache } from '../src/sqlite/indicator-cache';

const clients: Client[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const client of clients) client.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  clients.length = 0;
  dirs.length = 0;
});

async function tempDb(): Promise<Client> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzas-indicator-'));
  dirs.push(dir);
  const dbPath = join(dir, 'test.db');
  await migrate(dbPath, MIGRATIONS_DIR);
  const db = await createLocalClient(dbPath);
  clients.push(db);
  return db;
}

const BASE = {
  key: 'usd-oficial',
  value: 1560,
  unit: 'ARS/USD',
  referenceDate: '2026-08-10T14:00:00-03:00',
  fetchedAt: '2026-08-10T17:05:00.000Z',
  source: 'fx',
};

describe('SqliteIndicatorCache (indicator-day-change)', () => {
  it('round-trips a snapshot including prev_value', async () => {
    const db = await tempDb();
    const cache = new SqliteIndicatorCache(db);

    await cache.set({ ...BASE, prevValue: 1540 });

    expect(await cache.get('usd-oficial')).toEqual({ ...BASE, prevValue: 1540 });
  });

  it('round-trips a null prev_value and overwrites it on upsert', async () => {
    const db = await tempDb();
    const cache = new SqliteIndicatorCache(db);

    await cache.set({ ...BASE, prevValue: null });
    expect((await cache.get('usd-oficial'))?.prevValue).toBeNull();

    await cache.set({ ...BASE, value: 1580, prevValue: 1560 });
    expect(await cache.get('usd-oficial')).toEqual({ ...BASE, value: 1580, prevValue: 1560 });
  });

  it('reads null for a row written without prev_value (pre-migration shape)', async () => {
    const db = await tempDb();
    await db.execute({
      sql: `INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['usd-blue', 1350.5, 'ARS/USD', '2026-08-09', '2026-08-09T23:00:00.000Z', 'fx'],
    });
    const cache = new SqliteIndicatorCache(db);

    expect((await cache.get('usd-blue'))?.prevValue).toBeNull();
  });
});
