import { SUPPORTED_CURRENCIES } from '../vo/money';
import type { Currency } from '../vo/money';

export interface CurrencyNet {
  currency: Currency;
  expense: number;
  income: number;
  netFlow: number;
}

interface Nettable {
  currency: string;
  direction: string;
  amountMinor: number;
}

/**
 * Per-currency income/expense/net totals over a set of transactions.
 * Single source of truth for "surplus" (income − expenses): summaries and
 * savings goals share it so the two can never disagree. Totals are never
 * converted or mixed across currencies.
 */
export function netFlowByCurrency(txs: Nettable[]): CurrencyNet[] {
  const totals = new Map<Currency, { expense: number; income: number }>();
  for (const tx of txs) {
    const currency = tx.currency as Currency;
    const entry = totals.get(currency) ?? { expense: 0, income: 0 };
    if (tx.direction === 'expense') entry.expense += tx.amountMinor;
    else entry.income += tx.amountMinor;
    totals.set(currency, entry);
  }
  return SUPPORTED_CURRENCIES.map((currency) => {
    const t = totals.get(currency) ?? { expense: 0, income: 0 };
    return { currency, expense: t.expense, income: t.income, netFlow: t.income - t.expense };
  });
}
