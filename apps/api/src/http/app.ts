import type { Client } from '@libsql/client';
import type { CclSeriesSource, Clock, IndicatorSource, PortfolioFxPort, PriceSeriesSource, PriceSource } from '@finanzas/domain';
import {
  BudgetService,
  CategoryService,
  ChartService,
  DerivedPositionRepository,
  IndicatorService,
  PortfolioService,
  SummaryService,
  TransactionService,
  TradeService,
} from '@finanzas/domain';
import express from 'express';
import { SqliteBudgetRepository, SqliteCategoryRepository, SqliteTransactionRepository } from '../sqlite/repositories';
import { SqliteIndicatorCache } from '../sqlite/indicator-cache';
import { SqlitePriceCache } from '../sqlite/price-cache';
import { SqliteSeriesCache } from '../sqlite/series-cache';
import { SqliteLegacyPositionRepository, SqliteTradeRepository } from '../sqlite/trades-repo';
import { ArgentinadatosSource } from '../sources/argentinadatos';
import { ArgentinadatosCclSeriesSource } from '../sources/argentinadatos-ccl';
import { BcraSource } from '../sources/bcra';
import { DolarApiSource } from '../sources/dolar-api';
import { YahooSource } from '../sources/yahoo';
import { YahooSeriesSource } from '../sources/yahoo-series';
import { createAuthRouter, createLockout, requireAuth } from './auth';
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
  /** Optional chart series sources; tests inject stubs (PC-1). Defaults to Yahoo + argentinadatos. */
  seriesSource?: PriceSeriesSource;
  cclSource?: CclSeriesSource;
  /** Passphrase enabling single-user auth; absent disables enforcement (dev). */
  authSecret?: string;
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
  const tradeService = new TradeService({ trades: new SqliteTradeRepository(db) });
  const derivedPositions = new DerivedPositionRepository(tradeService, new SqliteLegacyPositionRepository(db));
  const cclAccessor = new CclAccessor(indicatorCache);
  const portfolioService = new PortfolioService({
    repo: derivedPositions,
    cache: new SqlitePriceCache(db),
    source: deps.portfolioSource ?? new YahooSource(() => cclAccessor.getCcl()),
    fx: cclAccessor,
    ledger: tradeService,
    clock,
  });
  const chartService = new ChartService({
    positions: derivedPositions,
    cache: new SqliteSeriesCache(db),
    seriesSource: deps.seriesSource ?? new YahooSeriesSource(),
    cclSource: deps.cclSource ?? new ArgentinadatosCclSeriesSource(),
    clock,
  });

  const app = express();
  app.use(express.json());
  // API responses are per-user dynamic data — never let browsers or edges
  // serve stale JSON after a redeploy (the deployment fix for stale portfolios).
  app.use('/api/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const lockout = createLockout(() => clock.now());
  app.use('/api/v1', createAuthRouter({ passphrase: deps.authSecret, clock, lockout }));
  app.use('/api/v1', requireAuth(deps.authSecret));
  app.use('/api/v1', transactionsRouter({ transactionService }));
  app.use('/api/v1', categoriesRouter({ categoryService, clock }));
  app.use('/api/v1', budgetsRouter({ budgetService, clock }));
  app.use('/api/v1', summariesRouter({ summaryService, clock }));
  app.use('/api/v1', indicatorsRouter({ indicatorService }));
  app.use('/api/v1', portfolioRouter({ portfolioService, chartService, trades: tradeService }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
