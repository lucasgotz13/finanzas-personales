import type { Client } from '@libsql/client';
import type { Clock, IndicatorSource, PortfolioFxPort, PriceSource } from '@finanzas/domain';
import {
  BudgetService,
  CategoryService,
  IndicatorService,
  PortfolioService,
  SummaryService,
  TransactionService,
} from '@finanzas/domain';
import express from 'express';
import { SqliteBudgetRepository, SqliteCategoryRepository, SqliteTransactionRepository } from '../sqlite/repositories';
import { SqliteIndicatorCache } from '../sqlite/indicator-cache';
import { SqlitePositionRepository } from '../sqlite/positions-repo';
import { SqlitePriceCache } from '../sqlite/price-cache';
import { ArgentinadatosSource } from '../sources/argentinadatos';
import { BcraSource } from '../sources/bcra';
import { DolarApiSource } from '../sources/dolar-api';
import { YahooSource } from '../sources/yahoo';
import { errorHandler, notFoundHandler } from './errors';
import { budgetsRouter } from './routes/budgets';
import { categoriesRouter } from './routes/categories';
import { indicatorsRouter } from './routes/indicators';
import { portfolioRouter } from './routes/portfolio';
import { summariesRouter } from './routes/summaries';
import { transactionsRouter } from './routes/transactions';

export interface AppDeps {
  db: Client;
  clock: Clock;
  /** Optional indicator sources; tests inject stubs (EI-7). Defaults to the real adapters. */
  indicatorSources?: IndicatorSource[];
  /** Optional portfolio price source; tests inject a stub (PI-7). Defaults to Yahoo. */
  portfolioSource?: PriceSource;
}

/** Read-only CCL access: wraps the SAME indicator cache the IndicatorService writes (PI-4). */
class CclAccessor implements PortfolioFxPort {
  constructor(private cache: SqliteIndicatorCache) {}

  async getCcl(): Promise<{ value: number; fetchedAt: string } | null> {
    const snapshot = await this.cache.get('usd-ccl');
    return snapshot === null ? null : { value: snapshot.value, fetchedAt: snapshot.fetchedAt };
  }
}

function defaultIndicatorSources(): IndicatorSource[] {
  // One ArgentinaDatos client per class: the domain resolves sources by class
  // (issue #33). The IPC class reuses the riesgo país adapter's API family.
  return [
    new DolarApiSource(),
    new BcraSource(),
    new ArgentinadatosSource(undefined, undefined, 'ipc'),
    new ArgentinadatosSource(),
  ];
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
  const indicatorCache = new SqliteIndicatorCache(db);
  const indicatorService = new IndicatorService({
    sources: deps.indicatorSources ?? defaultIndicatorSources(),
    cache: indicatorCache,
    clock,
  });
  const positionsRepo = new SqlitePositionRepository(db);
  const cclAccessor = new CclAccessor(indicatorCache);
  const portfolioService = new PortfolioService({
    repo: positionsRepo,
    cache: new SqlitePriceCache(db),
    source: deps.portfolioSource ?? new YahooSource(() => cclAccessor.getCcl()),
    fx: cclAccessor,
    clock,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', transactionsRouter({ transactionService }));
  app.use('/api/v1', categoriesRouter({ categoryService, clock }));
  app.use('/api/v1', budgetsRouter({ budgetService, clock }));
  app.use('/api/v1', summariesRouter({ summaryService, clock }));
  app.use('/api/v1', indicatorsRouter({ indicatorService }));
  app.use('/api/v1', portfolioRouter({ portfolioService, positions: positionsRepo, clock }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
