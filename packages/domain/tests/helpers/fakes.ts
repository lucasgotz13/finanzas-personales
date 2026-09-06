import type {
  BudgetRepository,
  CategoryRepository,
  Clock,
  GoalAdjustmentRepository,
  GoalRepository,
  TransactionFilters,
  TransactionRepository,
} from '../../src/ports/repositories';
import type { Transaction } from '../../src/entities/transaction';
import type { Category } from '../../src/entities/category';
import type { Budget } from '../../src/entities/budget';
import type { Goal, GoalAdjustment } from '../../src/entities/goal';
import { arDateString } from '../../src/vo/period-key';

/** Fixed clock for deterministic tests. */
export class FakeClock implements Clock {
  constructor(private date: Date) {}
  now(): Date {
    return this.date;
  }
  set(date: Date): void {
    this.date = date;
  }
}

let nextId = 1;
function takeId(): number {
  return nextId++;
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private rows = new Map<number, Transaction>();

  reset(): void {
    this.rows.clear();
    nextId = 1;
  }

  async create(tx: Transaction): Promise<Transaction> {
    const id = takeId();
    const stored = { ...tx, id };
    this.rows.set(id, stored);
    return stored;
  }

  async findById(id: number): Promise<Transaction | null> {
    return this.rows.get(id) ?? null;
  }

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    // Mirrors the SQLite adapter: compares AR-calendar dates (exact for
    // AR-midnight bounds such as PeriodKey.bounds()).
    const fromKey = filters.from !== undefined ? arDateString(filters.from) : undefined;
    const toKey = filters.to !== undefined ? arDateString(filters.to) : undefined;
    return [...this.rows.values()]
      .filter((tx) => filters.categoryId === undefined || tx.categoryId === filters.categoryId)
      .filter((tx) => filters.direction === undefined || tx.direction === filters.direction)
      .filter((tx) => fromKey === undefined || tx.txDate >= fromKey)
      .filter((tx) => toKey === undefined || tx.txDate < toKey);
  }

  async update(id: number, tx: Transaction): Promise<Transaction | null> {
    if (!this.rows.has(id)) return null;
    const stored = { ...tx, id };
    this.rows.set(id, stored);
    return stored;
  }

  async delete(id: number): Promise<boolean> {
    return this.rows.delete(id);
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private rows = new Map<number, Category>();

  reset(): void {
    this.rows.clear();
    nextId = 1;
  }

  async create(cat: Category): Promise<Category> {
    const id = cat.id ?? takeId();
    const stored = { ...cat, id };
    this.rows.set(id, stored);
    return stored;
  }

  async update(id: number, cat: Category): Promise<Category | null> {
    if (!this.rows.has(id)) return null;
    const stored = { ...cat, id };
    this.rows.set(id, stored);
    return stored;
  }

  async findById(id: number): Promise<Category | null> {
    return this.rows.get(id) ?? null;
  }

  async listAll(): Promise<Category[]> {
    return [...this.rows.values()];
  }

  async hasChildren(id: number): Promise<boolean> {
    return [...this.rows.values()].some((c) => c.parentId === id && c.deletedAt === null);
  }
}

export class InMemoryBudgetRepository implements BudgetRepository {
  private rows = new Map<number, Budget>();

  reset(): void {
    this.rows.clear();
  }

  async replaceAll(budgets: Budget[]): Promise<void> {
    this.rows.clear();
    for (const b of budgets) this.rows.set(b.categoryId, b);
  }

  async listAll(): Promise<Budget[]> {
    return [...this.rows.values()];
  }
}

export class InMemoryGoalRepository implements GoalRepository {
  private rows = new Map<number, Goal>();

  reset(): void {
    this.rows.clear();
    nextId = 1;
  }

  async create(goal: Goal): Promise<Goal> {
    const id = takeId();
    const stored = { ...goal, id };
    this.rows.set(id, stored);
    return stored;
  }

  async update(id: number, goal: Goal): Promise<Goal | null> {
    if (!this.rows.has(id)) return null;
    const stored = { ...goal, id };
    this.rows.set(id, stored);
    return stored;
  }

  async findById(id: number): Promise<Goal | null> {
    return this.rows.get(id) ?? null;
  }

  async listAll(): Promise<Goal[]> {
    return [...this.rows.values()];
  }

  async delete(id: number): Promise<boolean> {
    return this.rows.delete(id);
  }
}

export class InMemoryGoalAdjustmentRepository implements GoalAdjustmentRepository {
  private rows = new Map<number, GoalAdjustment>();

  reset(): void {
    this.rows.clear();
    nextId = 1;
  }

  async create(adj: GoalAdjustment): Promise<GoalAdjustment> {
    const id = takeId();
    const stored = { ...adj, id };
    this.rows.set(id, stored);
    return stored;
  }

  async listAll(): Promise<GoalAdjustment[]> {
    return [...this.rows.values()];
  }

  async deleteByGoal(goalId: number): Promise<void> {
    for (const [id, adj] of this.rows) {
      if (adj.goalId === goalId) this.rows.delete(id);
    }
  }
}
