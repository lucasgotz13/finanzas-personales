import type { Client, InStatement, Row } from '@libsql/client';
import { arDateString } from '@finanzas/domain';
import type {
  Budget,
  BudgetRepository,
  Category,
  CategoryRepository,
  Transaction,
  TransactionFilters,
  TransactionRepository,
} from '@finanzas/domain';

interface TransactionRow {
  id: number;
  direction: 'expense' | 'income';
  amount_minor: number;
  currency: string;
  rate: number;
  tx_date: string;
  category_id: number;
  note: string | null;
}

interface CategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  deleted_at: string | null;
}

/** Map a positional result row to an object keyed by the result columns. */
function toObject(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    direction: row.direction,
    amountMinor: row.amount_minor,
    currency: row.currency,
    rate: row.rate,
    txDate: row.tx_date,
    categoryId: row.category_id,
    note: row.note ?? '',
  };
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    deletedAt: row.deleted_at,
  };
}

/**
 * SQLite transaction repository. tx_date is stored as an AR-calendar date
 * (YYYY-MM-DD); range filters convert UTC instants to AR date strings, which
 * is exact for AR-midnight bounds (as produced by PeriodKey.bounds()).
 */
export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private db: Client) {}

  async create(tx: Transaction): Promise<Transaction> {
    const result = await this.db.execute({
      sql: `INSERT INTO transactions (direction, amount_minor, currency, rate, tx_date, category_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [tx.direction, tx.amountMinor, tx.currency, tx.rate, tx.txDate, tx.categoryId, tx.note || null],
    });
    return { ...tx, id: Number(result.lastInsertRowid) };
  }

  async findById(id: number): Promise<Transaction | null> {
    const result = await this.db.execute({ sql: 'SELECT * FROM transactions WHERE id = ?', args: [id] });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toTransaction(row as unknown as TransactionRow) : null;
  }

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    const clauses: string[] = [];
    const params: Array<number | string> = [];
    if (filters.categoryId !== undefined) {
      clauses.push('category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.direction !== undefined) {
      clauses.push('direction = ?');
      params.push(filters.direction);
    }
    if (filters.from !== undefined) {
      clauses.push('tx_date >= ?');
      params.push(arDateString(filters.from));
    }
    if (filters.to !== undefined) {
      clauses.push('tx_date < ?');
      params.push(arDateString(filters.to));
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.execute({
      sql: `SELECT * FROM transactions ${where} ORDER BY tx_date, id`,
      args: params,
    });
    return result.rows.map((row) => toTransaction(toObject(row, result.columns) as unknown as TransactionRow));
  }

  async update(id: number, tx: Transaction): Promise<Transaction | null> {
    const result = await this.db.execute({
      sql: `UPDATE transactions
         SET direction = ?, amount_minor = ?, currency = ?, rate = ?, tx_date = ?, category_id = ?, note = ?
         WHERE id = ?`,
      args: [tx.direction, tx.amountMinor, tx.currency, tx.rate, tx.txDate, tx.categoryId, tx.note || null, id],
    });
    if (result.rowsAffected === 0) return null;
    return { ...tx, id };
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execute({ sql: 'DELETE FROM transactions WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  }
}

/** SQLite category repository; rows are soft-deleted via deleted_at (CM-4). */
export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private db: Client) {}

  async create(cat: Category): Promise<Category> {
    const result = await this.db.execute({
      sql: 'INSERT INTO categories (name, parent_id, deleted_at) VALUES (?, ?, ?)',
      args: [cat.name, cat.parentId, cat.deletedAt],
    });
    return { ...cat, id: Number(result.lastInsertRowid) };
  }

  async update(id: number, cat: Category): Promise<Category | null> {
    const result = await this.db.execute({
      sql: 'UPDATE categories SET name = ?, parent_id = ?, deleted_at = ? WHERE id = ?',
      args: [cat.name, cat.parentId, cat.deletedAt, id],
    });
    if (result.rowsAffected === 0) return null;
    return { ...cat, id };
  }

  async findById(id: number): Promise<Category | null> {
    const result = await this.db.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [id] });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toCategory(row as unknown as CategoryRow) : null;
  }

  async listAll(): Promise<Category[]> {
    const result = await this.db.execute('SELECT * FROM categories ORDER BY id');
    return result.rows.map((row) => toCategory(toObject(row, result.columns) as unknown as CategoryRow));
  }

  async hasChildren(id: number): Promise<boolean> {
    const result = await this.db.execute({
      sql: 'SELECT EXISTS(SELECT 1 FROM categories WHERE parent_id = ? AND deleted_at IS NULL) AS found',
      args: [id],
    });
    return result.rows[0][0] === 1;
  }
}

/** SQLite budget repository: the budgets table maps category_id -> cap_minor. */
export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private db: Client) {}

  /** Replaces the whole map atomically (BM-3): the DELETE and every INSERT run
   * as one libsql batch (implicit transaction), so a failure mid-way leaves the
   * previous map intact instead of a partially written one. The batch always
   * contains at least the DELETE, so an empty map empties the table. */
  async replaceAll(budgets: Budget[]): Promise<void> {
    const stmts: InStatement[] = [{ sql: 'DELETE FROM budgets' }];
    for (const b of budgets) {
      stmts.push({
        sql: 'INSERT INTO budgets (category_id, cap_minor) VALUES (?, ?)',
        args: [b.categoryId, b.capMinor],
      });
    }
    await this.db.batch(stmts, 'write');
  }

  async listAll(): Promise<Budget[]> {
    const result = await this.db.execute('SELECT category_id, cap_minor FROM budgets ORDER BY category_id');
    return result.rows.map((row) => ({ categoryId: Number(row[0]), capMinor: Number(row[1]) }));
  }
}
