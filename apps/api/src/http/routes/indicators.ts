import type { IndicatorService } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface IndicatorsRouterDeps {
  indicatorService: IndicatorService;
}

/** Indicator read routes: cache-first GET, per-class refresh with ?force (EI-1..EI-3). */
export function indicatorsRouter(deps: IndicatorsRouterDeps): Router {
  const router = Router();
  const { indicatorService } = deps;

  router.get(
    '/indicators',
    wrap(async (_req, res) => {
      // EI-1/EI-4: always 200 with fresh|stale|absent views; never fetches.
      res.json(await indicatorService.getAll());
    }),
  );

  router.post(
    '/indicators/refresh',
    wrap(async (req, res) => {
      const force = req.query.force === 'true';
      const results = await indicatorService.refresh(force);
      res.json({ results });
    }),
  );

  return router;
}
