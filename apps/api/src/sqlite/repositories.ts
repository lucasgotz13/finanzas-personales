import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { arDateString } from '@finanzas/domain';
import type {
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
  constructor(private db: DatabaseSync) {}

  async create(tx: Transaction): Promise<Transaction> {
    const result = this.db
      .prepare(
        `INSERT INTO transactions (direction, amount_minor, currency, rate, tx_date, category_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(tx.direction, tx.amountMinor, tx.currency, tx.rate, tx.txDate, tx.categoryId, tx.note || null);
    return { ...tx, id: Number(result.lastInsertRowid) };
  }

  async findById(id: number): Promise<Transaction | null> {
    const row = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow | undefined;
    return row ? toTransaction(row) : null;
  }

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
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
    const rows = this.db.prepare(`SELECT * FROM transactions ${where} ORDER BY tx_date, id`).all(...params) as unknown as TransactionRow[];
    return rows.map(toTransaction);
  }

  async update(id: number, tx: Transaction): Promise<Transaction | null> {
    const result = this.db
      .prepare(
        `UPDATE transactions
         SET direction = ?, amount_minor = ?, currency = ?, rate = ?, tx_date = ?, category_id = ?, note = ?
         WHERE id = ?`,
      )
      .run(tx.direction, tx.amountMinor, tx.currency, tx.rate, tx.txDate, tx.categoryId, tx.note || null, id);
    if (result.changes === 0) return null;
    return { ...tx, id };
  }

  async delete(id: number): Promise<boolean> {
    return this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id).changes > 0;
  }
}

/** SQLite category repository; rows are soft-deleted via deleted_at (CM-4). */
export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private db: DatabaseSync) {}

  async create(cat: Category): Promise<Category> {
    const result = this.db
      .prepare('INSERT INTO categories (name, parent_id, deleted_at) VALUES (?, ?, ?)')
      .run(cat.name, cat.parentId, cat.deletedAt);
    return { ...cat, id: Number(result.lastInsertRowid) };
  }

  async update(id: number, cat: Category): Promise<Category | null> {
    const result = this.db
      .prepare('UPDATE categories SET name = ?, parent_id = ?, deleted_at = ? WHERE id = ?')
      .run(cat.name, cat.parentId, cat.deletedAt, id);
    if (result.changes === 0) return null;
    return { ...cat, id };
  }

  async findById(id: number): Promise<Category | null> {
    const row = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined;
    return row ? toCategory(row) : null;
  }

  async listAll(): Promise<Category[]> {
    const rows = this.db.prepare('SELECT * FROM categories ORDER BY id').all() as unknown as CategoryRow[];
    return rows.map(toCategory);
  }

  async hasChildren(id: number): Promise<boolean> {
    const row = this.db
      .prepare('SELECT EXISTS(SELECT 1 FROM categories WHERE parent_id = ? AND deleted_at IS NULL) AS found')
      .get(id) as { found: number };
    return row.found === 1;
  }
}
