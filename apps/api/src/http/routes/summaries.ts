import type { Clock, PeriodType, SummaryService } from '@finanzas/domain';
import { ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface SummariesRouterDeps {
  summaryService: SummaryService;
  clock: Clock;
}

const PERIODS = ['month', 'quarter', 'year'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function summariesRouter(deps: SummariesRouterDeps): Router {
  const router = Router();
  const { summaryService, clock } = deps;

  router.get(
    '/summaries',
    wrap(async (req, res) => {
      const period = req.query.period;
      const dateParam = req.query.date;
      if (typeof period !== 'string' || !(PERIODS as readonly string[]).includes(period)) {
        throw new ValidationError('Invalid period', ['period must be one of month, quarter, year']);
      }
      let date: Date;
      if (dateParam === undefined) {
        date = clock.now();
      } else if (typeof dateParam === 'string' && DATE_RE.test(dateParam)) {
        // Interpret the query date as an AR-calendar date (noon UTC keeps the
        // AR calendar day unambiguous).
        date = new Date(`${dateParam}T12:00:00Z`);
      } else {
        throw new ValidationError('Invalid date', ['date must be YYYY-MM-DD']);
      }
      res.json(await summaryService.getSummary(period as PeriodType, date));
    }),
  );

  return router;
}
