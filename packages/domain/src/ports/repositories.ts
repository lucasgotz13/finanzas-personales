import type { Transaction } from '../entities/transaction';
import type { Category } from '../entities/category';
import type { Budget } from '../entities/budget';

/** Abstraction over the current instant; the API adapter uses AR-timezone dates. */
export interface Clock {
  now(): Date;
}

export interface TransactionFilters {
  /** Inclusive lower bound, UTC instant. */
  from?: Date;
  /** Exclusive upper bound, UTC instant. */
  to?: Date;
  categoryId?: number;
  direction?: 'expense' | 'income';
}

export interface TransactionRepository {
  create(tx: Transaction): Promise<Transaction>;
  findById(id: number): Promise<Transaction | null>;
  list(filters: TransactionFilters): Promise<Transaction[]>;
  /** Returns null when the id does not exist. */
  update(id: number, tx: Transaction): Promise<Transaction | null>;
  delete(id: number): Promise<boolean>;
}

export interface CategoryRepository {
  create(cat: Category): Promise<Category>;
  update(id: number, cat: Category): Promise<Category | null>;
  findById(id: number): Promise<Category | null>;
  /** All categories, including soft-deleted (history + cycle walks). */
  listAll(): Promise<Category[]>;
  hasChildren(id: number): Promise<boolean>;
}

export interface BudgetRepository {
  /** Replaces the whole budget map (BM-3: PUT replaces all). */
  replaceAll(budgets: Budget[]): Promise<void>;
  listAll(): Promise<Budget[]>;
}
