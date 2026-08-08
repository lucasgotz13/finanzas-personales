/** Shared API types mirroring the REST contract under /api/v1. */

export interface ApiTransaction {
  id: number;
  direction: 'expense' | 'income';
  amountMinor: number;
  currency: 'ARS' | 'USD';
  rate: number;
  date: string;
  categoryId: number;
  note: string;
}

export interface CreateTransactionInput {
  direction: 'expense' | 'income';
  amountMinor: number;
  currency: 'ARS' | 'USD';
  rate?: number;
  date: string;
  categoryId: number;
  note?: string;
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  children: CategoryNode[];
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

export interface CurrencySummary {
  currency: 'ARS' | 'USD';
  expense: number;
  income: number;
  netFlow: number;
  savingsRate: number | null;
}

export interface CategorySummary {
  categoryId: number;
  name: string;
  currency: 'ARS' | 'USD';
  expense: number;
  income: number;
}

export interface PeriodSummary {
  period: string;
  currencies: CurrencySummary[];
  categories: CategorySummary[];
}
