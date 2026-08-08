import { Transaction } from '../entities/transaction';
import { NotFoundError, ValidationError } from '../errors';
import type { Direction } from '../vo/direction';
import type { TransactionRepository, CategoryRepository, TransactionFilters } from '../ports/repositories';

export interface TransactionServiceDeps {
  transactions: TransactionRepository;
  categories: CategoryRepository;
}

export interface CreateTransactionInput {
  direction: Direction;
  amountMinor: number;
  currency: string;
  rate?: number;
  txDate: string;
  categoryId: number;
  note?: string;
}

/**
 * Expense/income CRUD use cases (ET-1..6, IT-1/2). All validation happens
 * before any persistence, so rejected inputs never reach the repository.
 */
export class TransactionService {
  constructor(private deps: TransactionServiceDeps) {}

  async create(input: CreateTransactionInput): Promise<Transaction> {
    await this.assertUsableCategory(input.categoryId);
    const tx = new Transaction(input);
    return this.deps.transactions.create(tx);
  }

  async update(id: number, input: CreateTransactionInput): Promise<Transaction> {
    const existing = await this.deps.transactions.findById(id);
    if (!existing) throw new NotFoundError(`Transaction ${id} not found`);
    await this.assertUsableCategory(input.categoryId);
    const tx = new Transaction({ ...input, id });
    const stored = await this.deps.transactions.update(id, tx);
    if (!stored) throw new NotFoundError(`Transaction ${id} not found`);
    return stored;
  }

  async remove(id: number): Promise<void> {
    const ok = await this.deps.transactions.delete(id);
    if (!ok) throw new NotFoundError(`Transaction ${id} not found`);
  }

  async getById(id: number): Promise<Transaction> {
    const tx = await this.deps.transactions.findById(id);
    if (!tx) throw new NotFoundError(`Transaction ${id} not found`);
    return tx;
  }

  list(filters: TransactionFilters): Promise<Transaction[]> {
    return this.deps.transactions.list(filters);
  }

  /** Every transaction must reference a valid, non-deleted category (ET-2, CM-4). */
  private async assertUsableCategory(categoryId: number): Promise<void> {
    const category = await this.deps.categories.findById(categoryId);
    if (!category) throw new NotFoundError(`Category ${categoryId} not found`);
    if (category.deletedAt !== null) {
      throw new ValidationError('Cannot use a deleted category', [`category ${categoryId} is deleted`]);
    }
  }
}
