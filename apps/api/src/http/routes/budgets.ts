import type { BudgetService, Clock } from '@finanzas/domain';
import { PeriodKey, ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface BudgetsRouterDeps {
  budgetService: BudgetService;
  clock: Clock;
}

export function budgetsRouter(deps: BudgetsRouterDeps): Router {
  const router = Router();
  const { budgetService } = deps;

  router.get(
    '/budgets',
    wrap(async (_req, res) => {
      res.json(await budgetService.list());
    }),
  );

  router.put(
    '/budgets',
    wrap(async (req, res) => {
      const map = req.body as Record<string, number>;
      if (typeof map !== 'object' || map === null || Array.isArray(map)) {
        throw new ValidationError('Invalid budgets payload', ['expected an object of categoryId -> capMinor'], 'INVALID_BUDGETS_PAYLOAD');
      }
      await budgetService.replaceAll(map);
      res.json(await budgetService.list());
    }),
  );

  router.get(
    '/budgets/status',
    wrap(async (req, res) => {
      const month = req.query.month;
      if (typeof month !== 'string') {
        throw new ValidationError('Invalid month', ['month query parameter is required as YYYY-MM'], 'INVALID_MONTH');
      }
      // Validate the key through the domain (throws 422 when malformed).
      PeriodKey.parse('month', month);
      res.json(await budgetService.getStatus(month));
    }),
  );

  return router;
}
