export { DomainError, ValidationError, NotFoundError, ConflictError } from './errors';
export type { ErrorCode } from './errors';

export { Money, SUPPORTED_CURRENCIES, BASE_CURRENCY, isSupportedCurrency } from './vo/money';
export type { Currency, MoneyInput } from './vo/money';

export { DIRECTIONS, parseDirection, isDirection } from './vo/direction';
export type { Direction } from './vo/direction';

export { PeriodKey, arDateParts, arDateString, isArDateString } from './vo/period-key';
export type { PeriodType, ArDateParts } from './vo/period-key';

export { Transaction } from './entities/transaction';
export type { TransactionInput } from './entities/transaction';

export { Category } from './entities/category';
export type { CategoryInput } from './entities/category';

export { Budget } from './entities/budget';
export type { BudgetInput } from './entities/budget';

export type {
  Clock,
  TransactionRepository,
  TransactionFilters,
  CategoryRepository,
  BudgetRepository,
} from './ports/repositories';

export { TransactionService } from './use-cases/transactions';
export type { TransactionServiceDeps, CreateTransactionInput } from './use-cases/transactions';

export { CategoryService } from './use-cases/categories';
export type { CategoryServiceDeps } from './use-cases/categories';

export { BudgetService } from './use-cases/budgets';
export type { BudgetServiceDeps, BudgetStatus, CategoryBudgetStatus } from './use-cases/budgets';

export { SummaryService } from './use-cases/summaries';
export type { SummaryServiceDeps, PeriodSummary, CurrencySummary, CategorySummary } from './use-cases/summaries';
