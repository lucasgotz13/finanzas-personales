import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalClient, MIGRATIONS_DIR, migrate } from '../../../scripts/migrate';
import { SqliteBudgetRepository } from '../src/sqlite/repositories';

const clients: Client[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const client of clients) client.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  clients.length = 0;
  dirs.length = 0;
});

async function tempDb(): Promise<Client> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzas-budgets-'));
  dirs.push(dir);
  const dbPath = join(dir, 'test.db');
  await migrate(dbPath, MIGRATIONS_DIR);
  const db = await createLocalClient(dbPath);
  clients.push(db);
  return db;
}

async function seedCategory(db: Client, name: string): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO categories (name, parent_id, deleted_at) VALUES (?, ?, ?)',
    args: [name, null, null],
  });
  return Number(result.lastInsertRowid);
}

describe('SqliteBudgetRepository.replaceAll (issue #99 atomic replacement)', () => {
  it('replaces the whole map and lists it back ordered by category', async () => {
    const db = await tempDb();
    const food = await seedCategory(db, 'Food');
    const transport = await seedCategory(db, 'Transport');
    const repo = new SqliteBudgetRepository(db);

    await repo.replaceAll([
      { categoryId: transport, capMinor: 678 },
      { categoryId: food, capMinor: 12345 },
    ]);
    expect(await repo.listAll()).toEqual([
      { categoryId: food, capMinor: 12345 },
      { categoryId: transport, capMinor: 678 },
    ]);

    await repo.replaceAll([{ categoryId: food, capMinor: 999 }]);
    expect(await repo.listAll()).toEqual([{ categoryId: food, capMinor: 999 }]);
  });

  it('a failed replacement preserves the previous caps', async () => {
    const db = await tempDb();
    const food = await seedCategory(db, 'Food');
    const transport = await seedCategory(db, 'Transport');
    const repo = new SqliteBudgetRepository(db);
    await repo.replaceAll([
      { categoryId: food, capMinor: 12345 },
      { categoryId: transport, capMinor: 678 },
    ]);

    // cap_minor 0 violates the CHECK (cap_minor > 0), so the batch fails
    // after a valid INSERT: without atomicity the table would be left
    // partially written instead of keeping the previous map.
    await expect(
      repo.replaceAll([
        { categoryId: food, capMinor: 99999 },
        { categoryId: transport, capMinor: 0 },
      ]),
    ).rejects.toThrow();
    expect(await repo.listAll()).toEqual([
      { categoryId: food, capMinor: 12345 },
      { categoryId: transport, capMinor: 678 },
    ]);
  });

  it('replacing with an empty map still empties the table', async () => {
    const db = await tempDb();
    const food = await seedCategory(db, 'Food');
    const repo = new SqliteBudgetRepository(db);
    await repo.replaceAll([{ categoryId: food, capMinor: 12345 }]);
    expect(await repo.listAll()).toHaveLength(1);

    await repo.replaceAll([]);

    expect(await repo.listAll()).toEqual([]);
  });
});
