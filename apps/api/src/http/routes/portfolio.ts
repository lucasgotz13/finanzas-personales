import type { Clock, Position, PositionRepository, PortfolioService } from '@finanzas/domain';
import { ConflictError, NotFoundError, normalizeTicker, ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface PortfolioRouterDeps {
  portfolioService: PortfolioService;
  positions: PositionRepository;
  clock: Clock;
}

export interface ApiPosition {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  avgCostMinor: number;
  currency: 'USD';
  createdAt: string;
}

export function toApiPosition(position: Position): ApiPosition {
  return {
    id: position.id as number,
    ticker: position.ticker,
    name: position.name,
    quantity: position.quantity,
    avgCostMinor: position.avgCostMinor,
    currency: 'USD',
    createdAt: position.createdAt,
  };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Invalid position id', ['id must be a positive integer']);
  return id;
}

function parseTicker(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new ValidationError('Invalid ticker', ['ticker must be a non-empty string']);
  return normalizeTicker(raw);
}

function parseName(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
}

function parseQuantity(raw: unknown): number {
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ValidationError('Invalid quantity', ['quantity must be a positive number']);
  return quantity;
}

function parseAvgCostMinor(raw: unknown): number {
  const minor = Number(raw);
  if (!Number.isFinite(minor) || minor <= 0) throw new ValidationError('Invalid avgCostMinor', ['avgCostMinor must be a positive number (USD cents)']);
  return Math.round(minor);
}

function parseCurrency(raw: unknown): void {
  if (raw !== undefined && raw !== 'USD') throw new ValidationError('Unsupported currency', ['currency must be USD in v1']);
}

/** Portfolio routes (PI-1..PI-5): CRUD + cache-first GET + per-symbol refresh. */
export function portfolioRouter(deps: PortfolioRouterDeps): Router {
  const router = Router();
  const { portfolioService, positions, clock } = deps;

  router.get(
    '/portfolio',
    wrap(async (_req, res) => {
      // PI-3/PI-4: always 200 with fresh|stale|absent views; never fetches.
      res.json(await portfolioService.getPortfolio());
    }),
  );

  router.post(
    '/portfolio/positions',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const ticker = parseTicker(body.ticker);
      parseCurrency(body.currency);
      const quantity = parseQuantity(body.quantity);
      const avgCostMinor = parseAvgCostMinor(body.avgCostMinor);
      if ((await positions.findByTicker(ticker)) !== null) {
        throw new ConflictError('Position already exists', [`a position for ${ticker} already exists`]);
      }
      const position = await positions.create({
        ticker,
        name: parseName(body.name) ?? ticker,
        quantity,
        avgCostMinor,
        currency: 'USD',
        createdAt: clock.now().toISOString(),
      });
      res.status(201).json(toApiPosition(position));
    }),
  );

  router.patch(
    '/portfolio/positions/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const existing = (await positions.list()).find((p) => p.id === id);
      if (!existing) throw new NotFoundError('Position not found', [`no position with id ${id}`]);
      parseCurrency(body.currency);
      const updated = await positions.update(id, {
        ...existing,
        name: parseName(body.name) ?? existing.name,
        quantity: body.quantity !== undefined ? parseQuantity(body.quantity) : existing.quantity,
        avgCostMinor: body.avgCostMinor !== undefined ? parseAvgCostMinor(body.avgCostMinor) : existing.avgCostMinor,
      });
      if (updated === null) throw new NotFoundError('Position not found', [`no position with id ${id}`]);
      res.json(toApiPosition(updated));
    }),
  );

  router.delete(
    '/portfolio/positions/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const deleted = await positions.delete(id);
      if (!deleted) throw new NotFoundError('Position not found', [`no position with id ${id}`]);
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

  return router;
}
