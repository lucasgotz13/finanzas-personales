import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '@finanzas/domain';
import { BudgetService, CategoryService, SummaryService, TransactionService } from '@finanzas/domain';
import express from 'express';
import { SqliteBudgetRepository, SqliteCategoryRepository, SqliteTransactionRepository } from '../sqlite/repositories';
import { errorHandler, notFoundHandler } from './errors';
import { budgetsRouter } from './routes/budgets';
import { categoriesRouter } from './routes/categories';
import { summariesRouter } from './routes/summaries';
import { transactionsRouter } from './routes/transactions';

export interface AppDeps {
  db: DatabaseSync;
  clock: Clock;
}

/** Builds the Express app with the SQLite adapters wired to the domain services. */
export function buildApp(deps: AppDeps): express.Express {
  const { db, clock } = deps;
  const categoriesRepo = new SqliteCategoryRepository(db);
  const transactionsRepo = new SqliteTransactionRepository(db);
  const budgetsRepo = new SqliteBudgetRepository(db);
  const transactionService = new TransactionService({ transactions: transactionsRepo, categories: categoriesRepo });
  const categoryService = new CategoryService({ categories: categoriesRepo, clock });
  const budgetService = new BudgetService({ budgets: budgetsRepo, categories: categoriesRepo, transactions: transactionsRepo });
  const summaryService = new SummaryService({ transactions: transactionsRepo, categories: categoriesRepo });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', transactionsRouter({ transactionService }));
  app.use('/api/v1', categoriesRouter({ categoryService, clock }));
  app.use('/api/v1', budgetsRouter({ budgetService, clock }));
  app.use('/api/v1', summariesRouter({ summaryService, clock }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
