import type { AdjustmentKind, GoalService, GoalView } from '@finanzas/domain';
import { ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface GoalsRouterDeps {
  goalService: GoalService;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0)
    throw new ValidationError('Invalid goal id', ['id must be a positive integer'], 'INVALID_GOAL_ID');
  return id;
}

/** Savings-goal routes: CRUD, manual aportes/retiros and priority reorder.
 * Progress (automatic vs manual split, deadline pace) is computed on read;
 * the API never accepts a total to store. */
export function goalsRouter(deps: GoalsRouterDeps): Router {
  const router = Router();
  const { goalService } = deps;

  router.get(
    '/goals',
    wrap(async (_req, res) => {
      const goals: GoalView[] = await goalService.list();
      res.json(goals);
    }),
  );

  router.post(
    '/goals',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const goal = await goalService.create({
        name: body.name as string,
        targetMinor: body.targetMinor as number,
        currency: body.currency as string,
        deadline: (body.deadline as string | null | undefined) ?? null,
      });
      res.status(201).json(goal);
    }),
  );

  router.patch(
    '/goals/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      // The domain owns patch semantics: unknown keys never reach the
      // entity; `deadline: null` clears it, omitted keeps the stored one.
      const body = (req.body ?? {}) as Record<string, unknown>;
      const goal = await goalService.update(id, {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.targetMinor !== undefined && { targetMinor: body.targetMinor as number }),
        ...(body.currency !== undefined && { currency: body.currency as string }),
        ...(body.deadline !== undefined && { deadline: body.deadline as string | null }),
      });
      res.json(goal);
    }),
  );

  router.delete(
    '/goals/:id',
    wrap(async (req, res) => {
      await goalService.remove(parseId(req.params.id));
      res.status(204).end();
    }),
  );

  router.post(
    '/goals/:id/adjustments',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const adjustment = await goalService.addAdjustment(
        id,
        body.kind as AdjustmentKind,
        body.amountMinor as number,
      );
      res.status(201).json(adjustment);
    }),
  );

  router.put(
    '/goals/order',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!Array.isArray(body.ids)) {
        throw new ValidationError('Invalid goal order', ['ids must be an array of goal ids']);
      }
      await goalService.reorder(body.ids as number[]);
      const goals: GoalView[] = await goalService.list();
      res.json(goals);
    }),
  );

  return router;
}
