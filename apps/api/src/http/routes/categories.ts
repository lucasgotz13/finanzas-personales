import type { Category, CategoryService, Clock } from '@finanzas/domain';
import { ValidationError } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';
import { buildTree } from '../tree';

export interface CategoriesRouterDeps {
  categoryService: CategoryService;
  clock: Clock;
}

export function toApiCategory(cat: Category): Record<string, unknown> {
  return { id: cat.id, name: cat.name, parentId: cat.parentId, deletedAt: cat.deletedAt };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0)
    throw new ValidationError('Invalid category id', ['id must be a positive integer'], 'INVALID_CATEGORY_ID');
  return id;
}

function parseParentId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0)
    throw new ValidationError('Invalid parentId', ['parentId must be a positive integer or null'], 'INVALID_PARENT_ID');
  return id;
}

export function categoriesRouter(deps: CategoriesRouterDeps): Router {
  const router = Router();
  const { categoryService } = deps;

  router.get(
    '/categories/tree',
    wrap(async (_req, res) => {
      const active = await categoryService.listActive();
      res.json(buildTree(active));
    }),
  );

  router.get(
    '/categories/deleted',
    wrap(async (_req, res) => {
      const all = await categoryService.listAll();
      res.json(all.filter((c) => c.deletedAt !== null).map(toApiCategory));
    }),
  );

  router.post(
    '/categories/:id/restore',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      res.json(toApiCategory(await categoryService.restore(id)));
    }),
  );

  router.post(
    '/categories',
    wrap(async (req, res) => {
      const body = req.body as { name?: unknown; parentId?: unknown };
      const cat = await categoryService.create({
        name: typeof body.name === 'string' ? body.name : '',
        parentId: parseParentId(body.parentId),
      });
      res.status(201).json(toApiCategory(cat));
    }),
  );

  router.patch(
    '/categories/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const body = req.body as { name?: unknown; parentId?: unknown };
      let updated: Category | undefined;
      if (body.name !== undefined) {
        if (typeof body.name !== 'string') throw new ValidationError('Invalid name', ['name must be a string'], 'INVALID_NAME');
        updated = await categoryService.rename(id, body.name);
      }
      if ('parentId' in body) {
        updated = await categoryService.move(id, parseParentId(body.parentId));
      }
      if (!updated) throw new ValidationError('Nothing to update', ['provide name and/or parentId'], 'NOTHING_TO_UPDATE');
      res.json(toApiCategory(updated));
    }),
  );

  router.delete(
    '/categories/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      await categoryService.remove(id, deps.clock.now().toISOString());
      res.status(204).end();
    }),
  );

  return router;
}
