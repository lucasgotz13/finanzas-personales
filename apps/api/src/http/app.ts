import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '@finanzas/domain';
import { CategoryService, TransactionService } from '@finanzas/domain';
import express from 'express';
import { SqliteCategoryRepository, SqliteTransactionRepository } from '../sqlite/repositories';
import { errorHandler, notFoundHandler } from './errors';
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
  const transactionService = new TransactionService({ transactions: transactionsRepo, categories: categoriesRepo });
  const categoryService = new CategoryService({ categories: categoriesRepo, clock });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', transactionsRouter({ transactionService }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
