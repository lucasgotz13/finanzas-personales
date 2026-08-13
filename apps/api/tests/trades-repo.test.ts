import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createDbClient, MIGRATIONS_DIR, migrate } from '../../../scripts/migrate';
import { SqliteLegacyPositionRepository, SqliteTradeRepository } from '../src/sqlite/trades-repo';
import type { TradeInput } from '@finanzas/domain';

function buy(ticker: string, date: string, quantity: number, priceMinor: number): TradeInput {
  return { ticker, type: 'buy', date, quantity, priceMinor, currency: 'USD' };
}

const clients: Client[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const client of clients) client.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  clients.length = 0;
  dirs.length = 0;
});

async function tempDb(): Promise<{ db: Client; path: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzas-trades-'));
  dirs.push(dir);
  const dbPath = join(dir, 'test.db');
  await migrate(dbPath, MIGRATIONS_DIR);
  const db = await createDbClient(dbPath);
  clients.push(db);
  return { db, path: dbPath };
}

describe('SqliteTradeRepository (TH-1, D7)', () => {
  it('lists trades ordered by (trade_date, id) — same-date rows in insertion order', async () => {
    const { db } = await tempDb();
    const repo = new SqliteTradeRepository(db);
    await repo.create(buy('AAPL.BA', '2026-08-02', 10, 18000));
    await repo.create(buy('GGAL.BA', '2026-08-01', 5, 6000));
    const third = await repo.create(buy('AAPL.BA', '2026-08-02', 2, 19000));
    const fourth = await repo.create(buy('AAPL.BA', '2026-08-02', 1, 20000));

    const rows = await repo.list();
    expect(rows.map((t) => t.id)).toEqual([2, 1, third.id, fourth.id]);
    expect(rows[0]).toMatchObject({ ticker: 'GGAL.BA', date: '2026-08-01' });
  });

  it('creates, updates and deletes trades', async () => {
    const { db } = await tempDb();
    const repo = new SqliteTradeRepository(db);
    const created = await repo.create(buy('aapl', '2026-08-01', 10, 18000));
    expect(created.id).toBeGreaterThan(0);

    const updated = await repo.update(created.id, { ...buy('AAPL.BA', '2026-08-03', 3, 21000), type: 'sell' });
    expect(updated).toMatchObject({ id: created.id, type: 'sell', date: '2026-08-03', quantity: 3, priceMinor: 21000 });
    expect(await repo.update(999, buy('AAPL.BA', '2026-08-03', 3, 21000))).toBeNull();

    expect(await repo.delete(created.id)).toBe(true);
    expect(await repo.delete(created.id)).toBe(false);
    expect(await repo.list()).toEqual([]);
  });
});

describe('Migration 006 seed (TH-5)', () => {
  it('seeds one BUY trade per position once and keeps rows editable; a re-run adds nothing', async () => {
    // Stage a database at 005: copy every migration except 006.
    const dir = mkdtempSync(join(tmpdir(), 'finanzas-seed-'));
    dirs.push(dir);
    const partialDir = join(dir, 'partial');
    mkdirSync(partialDir);
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f !== '006_trades.sql').sort()) {
      copyFileSync(join(MIGRATIONS_DIR, file), join(partialDir, file));
    }
    const dbPath = join(dir, 'test.db');
    expect(await migrate(dbPath, partialDir)).not.toContain('006_trades');

    const db = await createDbClient(dbPath);
    clients.push(db);
    await db.execute({
      sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)',
      args: ['AAPL.BA', 'Apple', 10, 18000, '2026-08-01T00:00:00.000Z'],
    });
    await db.execute({
      sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)',
      args: ['GGAL.BA', 'Galicia', 5, 6000, '2026-08-01T00:00:00.000Z'],
    });

    // Applying the full set runs 006 and seeds today's BUY trades.
    expect(await migrate(dbPath, MIGRATIONS_DIR)).toEqual(['006_trades']);
    const repo = new SqliteTradeRepository(db);
    const seeded = await repo.list();
    expect(seeded).toHaveLength(2);
    const today = new Date().toISOString().slice(0, 10);
    expect(seeded).toEqual([
      expect.objectContaining({ ticker: 'AAPL.BA', type: 'buy', date: today, quantity: 10, priceMinor: 18000, currency: 'USD' }),
      expect.objectContaining({ ticker: 'GGAL.BA', type: 'buy', date: today, quantity: 5, priceMinor: 6000, currency: 'USD' }),
    ]);

    // Seed rows are ordinary trades: editable through the normal CRUD.
    const edited = await repo.update(seeded[0].id, { ...buy('AAPL.BA', '2026-08-04', 12, 17000) });
    expect(edited?.quantity).toBe(12);

    // A second run applies nothing — no duplicate seeds.
    expect(await migrate(dbPath, MIGRATIONS_DIR)).toEqual([]);
    expect(await repo.list()).toHaveLength(2);
  });
});

describe('SqliteLegacyPositionRepository (D2)', () => {
  it('lists the legacy positions table', async () => {
    const { db } = await tempDb();
    await db.execute({
      sql: 'INSERT INTO positions (ticker, name, quantity, avg_cost_minor, created_at) VALUES (?, ?, ?, ?, ?)',
      args: ['AAPL.BA', 'Apple', 10, 18000, '2026-08-01T00:00:00.000Z'],
    });
    const repo = new SqliteLegacyPositionRepository(db);
    const rows = await repo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, ticker: 'AAPL.BA', name: 'Apple' });
  });
});
