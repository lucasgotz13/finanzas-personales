import type { ChartService, PortfolioService, SeriesRange, TradeInput, TradeService } from '@finanzas/domain';
import { isSeriesCurrency, isSeriesRange, ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface PortfolioRouterDeps {
  portfolioService: PortfolioService;
  chartService: ChartService;
  trades: TradeService;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid id', ['id must be a positive integer']);
  return id;
}

function parseRange(raw: unknown): SeriesRange {
  if (typeof raw !== 'string' || !isSeriesRange(raw)) throw new ValidationError('Invalid range', ['range must be 1m, 3m, 6m or 1y']);
  return raw;
}

function parseSeriesCurrency(raw: unknown): 'ARS' | 'USD' {
  if (typeof raw !== 'string' || !isSeriesCurrency(raw)) throw new ValidationError('Invalid currency', ['currency must be ARS or USD']);
  return raw;
}

/** Portfolio routes (PI-1..PI-5, TH-1..TH-4, PC-1): derived portfolio read,
 * trades CRUD (the only mutation surface), refresh and history reads.
 * Position mutation endpoints are removed — derived data changes only
 * through trades (PI-1, D5). */
export function portfolioRouter(deps: PortfolioRouterDeps): Router {
  const router = Router();
  const { portfolioService, chartService, trades } = deps;

  router.get(
    '/portfolio',
    wrap(async (_req, res) => {
      // PI-3/PI-4: always 200 with fresh|stale|absent views; never fetches.
      res.json(await portfolioService.getPortfolio());
    }),
  );

  router.get(
    '/portfolio/trades',
    wrap(async (_req, res) => {
      res.json(await trades.list());
    }),
  );

  router.post(
    '/portfolio/trades',
    wrap(async (req, res) => {
      const trade = await trades.create((req.body ?? {}) as unknown as TradeInput);
      res.status(201).json(trade);
    }),
  );

  router.put(
    '/portfolio/trades/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const trade = await trades.update(id, (req.body ?? {}) as unknown as TradeInput);
      res.json(trade);
    }),
  );

  router.delete(
    '/portfolio/trades/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      await trades.delete(id);
      res.status(204).end();
    }),
  );

  router.post(
    '/portfolio/refresh',
    wrap(async (req, res) => {
      const force = req.query.force === 'true';
      const results = await portfolioService.refresh(force);
      res.json({ results });
    }),
  );

  // PC-1: cache-first history reads; force=true is the ONLY fetch trigger.
  router.get(
    '/portfolio/history',
    wrap(async (req, res) => {
      const range = parseRange(req.query.range);
      const currency = parseSeriesCurrency(req.query.currency);
      const force = req.query.force === 'true';
      res.json(await chartService.getPortfolioHistory(range, currency, force));
    }),
  );

  router.get(
    '/portfolio/positions/:id/history',
    wrap(async (req, res) => {
      // Q1-A: no id-shape validation here — the domain owns the id-space
      // contract (positive legacy ids and negative derived ids); unknown or
      // non-numeric ids fall through to NotFoundError (404).
      const id = Number(req.params.id);
      const range = parseRange(req.query.range);
      const currency = parseSeriesCurrency(req.query.currency);
      const force = req.query.force === 'true';
      res.json(await chartService.getPositionHistory(id, range, currency, force));
    }),
  );

  return router;
}
