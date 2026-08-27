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
 * Partial update payload (ET-5). Every field is optional; omitted fields keep
 * the stored value. Accepts both date keys: `date` is the HTTP/API shape,
 * `txDate` the domain shape; `date` wins when both are present.
 */
export interface TransactionPatch extends Partial<CreateTransactionInput> {
  date?: string;
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

  async update(id: number, patch: TransactionPatch): Promise<Transaction> {
    const existing = await this.deps.transactions.findById(id);
    if (!existing) throw new NotFoundError(`Transaction ${id} not found`);
    // Whitelist: an HTTP body may carry unknown keys; they must not reach the entity.
    const p = {
      direction: patch.direction,
      amountMinor: patch.amountMinor,
      currency: patch.currency,
      rate: patch.rate,
      date: patch.date,
      txDate: patch.txDate,
      categoryId: patch.categoryId,
      note: patch.note,
    };
    // W1 (ET-1/ET-2): when the currency changes to a non-ARS currency, a rate
    // MUST be provided — the existing rate belongs to the old currency and must
    // never be silently inherited.
    if (p.currency !== undefined && p.currency !== 'ARS' && p.rate === undefined) {
      throw new ValidationError(
        'Rate is required when changing currency to a non-ARS currency',
        [`rate is required for currency ${p.currency}`],
        'RATE_REQUIRED_FOR_CURRENCY',
        { currency: p.currency },
      );
    }
    const merged = {
      direction: p.direction ?? existing.direction,
      amountMinor: p.amountMinor ?? existing.amountMinor,
      currency: p.currency ?? existing.currency,
      rate: p.rate ?? existing.rate,
      txDate: p.date ?? p.txDate ?? existing.txDate,
      categoryId: p.categoryId ?? existing.categoryId,
      note: p.note ?? existing.note,
    };
    await this.assertUsableCategory(merged.categoryId);
    const tx = new Transaction({ ...merged, id });
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
