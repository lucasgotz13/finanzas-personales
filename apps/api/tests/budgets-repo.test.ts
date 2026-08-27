import type { Client, InStatement, ResultSet, TransactionMode } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { SqliteBudgetRepository } from '../src/sqlite/repositories';

/** A db double that only records batch calls; replaceAll must not use execute. */
function fakeDb() {
  const emptyResult = (): ResultSet => ({
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({}),
  });
  const batch = vi.fn((_stmts: InStatement[], _mode?: TransactionMode): Promise<ResultSet> => {
    return Promise.resolve(emptyResult());
  });
  const execute = vi.fn(
    (_stmt: InStatement): Promise<ResultSet> => Promise.resolve(emptyResult()),
  );
  return { batch, execute, client: { batch, execute } as unknown as Client };
}

describe('SqliteBudgetRepository.replaceAll (issue #99 atomic replacement)', () => {
  it('issues exactly one batch call: DELETE first, then every INSERT with its args, in write mode', async () => {
    const { client, batch } = fakeDb();
    const repo = new SqliteBudgetRepository(client);

    await repo.replaceAll([
      { categoryId: 7, capMinor: 12345 },
      { categoryId: 3, capMinor: 678 },
    ]);

    expect(batch).toHaveBeenCalledTimes(1);
    const [stmts, mode] = batch.mock.calls[0];
    expect(mode).toBe('write');
    expect(stmts).toEqual([
      { sql: 'DELETE FROM budgets' },
      { sql: 'INSERT INTO budgets (category_id, cap_minor) VALUES (?, ?)', args: [7, 12345] },
      { sql: 'INSERT INTO budgets (category_id, cap_minor) VALUES (?, ?)', args: [3, 678] },
    ]);
  });

  it('replacing with an empty map still empties the table (DELETE alone, no empty batch)', async () => {
    const { client, batch } = fakeDb();
    const repo = new SqliteBudgetRepository(client);

    await repo.replaceAll([]);

    expect(batch).toHaveBeenCalledTimes(1);
    const [stmts, mode] = batch.mock.calls[0];
    expect(mode).toBe('write');
    expect(stmts).toEqual([{ sql: 'DELETE FROM budgets' }]);
  });
});
