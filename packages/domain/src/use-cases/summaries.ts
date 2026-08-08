import { PeriodKey } from '../vo/period-key';
import type { PeriodType } from '../vo/period-key';
import { SUPPORTED_CURRENCIES } from '../vo/money';
import type { Currency } from '../vo/money';
import type { CategoryRepository, TransactionRepository } from '../ports/repositories';

export interface SummaryServiceDeps {
  transactions: TransactionRepository;
  categories: CategoryRepository;
}

export interface CurrencySummary {
  currency: Currency;
  expense: number;
  income: number;
  netFlow: number;
  savingsRate: number | null;
}

export interface CategorySummary {
  categoryId: number;
  name: string;
  currency: Currency;
  expense: number;
  income: number;
}

export interface PeriodSummary {
  period: string;
  currencies: CurrencySummary[];
  categories: CategorySummary[];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Month/quarter/year summaries (PS-1..5, IT-3). Transactions are attributed by
 * transaction date with AR-timezone boundaries; totals are never converted or
 * mixed across currencies; deleted categories keep their current name.
 */
export class SummaryService {
  constructor(private deps: SummaryServiceDeps) {}

  async getSummary(period: PeriodType, date: Date): Promise<PeriodSummary> {
    const key = PeriodKey.of(period, date);
    const { start, end } = key.bounds();
    const txs = await this.deps.transactions.list({ from: start, to: end });
    const allCategories = await this.deps.categories.listAll();
    const nameById = new Map<number, string>(allCategories.map((c) => [c.id as number, c.name]));

    const currencyTotals = new Map<Currency, { expense: number; income: number }>();
    const categoryTotals = new Map<string, { categoryId: number; currency: Currency; expense: number; income: number }>();

    for (const tx of txs) {
      const currency = tx.currency as Currency;
      const ct = currencyTotals.get(currency) ?? { expense: 0, income: 0 };
      if (tx.direction === 'expense') ct.expense += tx.amountMinor;
      else ct.income += tx.amountMinor;
      currencyTotals.set(currency, ct);

      const ckey = `${tx.categoryId}:${currency}`;
      const cat = categoryTotals.get(ckey) ?? { categoryId: tx.categoryId, currency, expense: 0, income: 0 };
      if (tx.direction === 'expense') cat.expense += tx.amountMinor;
      else cat.income += tx.amountMinor;
      categoryTotals.set(ckey, cat);
    }

    const currencies: CurrencySummary[] = SUPPORTED_CURRENCIES.map((currency) => {
      const t = currencyTotals.get(currency) ?? { expense: 0, income: 0 };
      const netFlow = t.income - t.expense;
      const savingsRate = t.income > 0 ? round3(netFlow / t.income) : null;
      return { currency, expense: t.expense, income: t.income, netFlow, savingsRate };
    });

    const categories: CategorySummary[] = [...categoryTotals.values()]
      .map((c) => ({ ...c, name: nameById.get(c.categoryId) ?? `#${c.categoryId}` }))
      .sort((a, b) => a.categoryId - b.categoryId || a.currency.localeCompare(b.currency));

    return { period: key.key, currencies, categories };
  }
}
