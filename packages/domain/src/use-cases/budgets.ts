import { Budget } from '../entities/budget';
import { Money } from '../vo/money';
import { PeriodKey } from '../vo/period-key';
import { NotFoundError, ValidationError } from '../errors';
import type { BudgetRepository, CategoryRepository, TransactionRepository } from '../ports/repositories';

export interface BudgetServiceDeps {
  budgets: BudgetRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
}

export interface CategoryBudgetStatus {
  categoryId: number;
  cap: number;
  consumed: number;
  overBudget: boolean;
}

export interface BudgetStatus {
  month: string;
  categories: CategoryBudgetStatus[];
  global: { cap: number; consumed: number; overBudget: boolean };
}

/**
 * Monthly per-category caps in ARS (BM-1..4). Consumption converts each
 * expense to ARS with the rate captured at entry and attributes it to the
 * calendar month of the transaction date. Status is computed on read.
 */
export class BudgetService {
  constructor(private deps: BudgetServiceDeps) {}

  /** Replaces the whole budget map (BM-3: manual re-adjustment, no automation). */
  async replaceAll(map: Record<string, number>): Promise<void> {
    const budgets: Budget[] = [];
    for (const [categoryId, capMinor] of Object.entries(map)) {
      const id = Number(categoryId);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Invalid budget categoryId', ['categoryId must be a positive integer']);
      }
      const category = await this.deps.categories.findById(id);
      if (!category) throw new NotFoundError(`Category ${id} not found`);
      if (category.deletedAt !== null) {
        throw new ValidationError('Cannot budget a deleted category', [`category ${id} is deleted`]);
      }
      budgets.push(new Budget({ categoryId: id, capMinor }));
    }
    await this.deps.budgets.replaceAll(budgets);
  }

  async getStatus(monthKey: string): Promise<BudgetStatus> {
    const { start, end } = PeriodKey.parse('month', monthKey).bounds();
    const budgets = await this.deps.budgets.listAll();
    const expenses = await this.deps.transactions.list({ from: start, to: end, direction: 'expense' });

    const consumedByCategory = new Map<number, number>();
    for (const tx of expenses) {
      const ars = new Money({ amountMinor: tx.amountMinor, currency: tx.currency, rate: tx.rate }).toArsMinor();
      consumedByCategory.set(tx.categoryId, (consumedByCategory.get(tx.categoryId) ?? 0) + ars);
    }

    const categories: CategoryBudgetStatus[] = budgets.map((b) => {
      const consumed = consumedByCategory.get(b.categoryId) ?? 0;
      return { categoryId: b.categoryId, cap: b.capMinor, consumed, overBudget: consumed > b.capMinor };
    });

    const globalCap = budgets.reduce((sum, b) => sum + b.capMinor, 0);
    const globalConsumed = categories.reduce((sum, c) => sum + c.consumed, 0);
    return {
      month: monthKey,
      categories,
      global: { cap: globalCap, consumed: globalConsumed, overBudget: globalConsumed > globalCap },
    };
  }
}
