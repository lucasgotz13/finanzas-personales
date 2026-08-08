import { describe, expect, it, beforeEach } from 'vitest';
import { CategoryService } from '../../src/use-cases/categories';
import { InMemoryCategoryRepository, FakeClock } from '../helpers/fakes';
import { ConflictError, NotFoundError, ValidationError } from '../../src/errors';

const NOW = new Date('2026-08-08T12:00:00.000Z');

function build() {
  const categories = new InMemoryCategoryRepository();
  categories.reset();
  const clock = new FakeClock(NOW);
  const service = new CategoryService({ categories, clock });
  return { categories, service };
}

/** Seeds the same tree in every test: 1 Food, 2 Transport, 3 Housing -> 4 Rent, 5 Health. */
async function seed(env: ReturnType<typeof build>): Promise<void> {
  const { categories } = env;
  await categories.create({ id: 1, name: 'Food', parentId: null, deletedAt: null });
  await categories.create({ id: 2, name: 'Transport', parentId: null, deletedAt: null });
  await categories.create({ id: 3, name: 'Housing', parentId: null, deletedAt: null });
  await categories.create({ id: 4, name: 'Rent', parentId: 3, deletedAt: null });
  await categories.create({ id: 5, name: 'Health', parentId: null, deletedAt: null });
}

describe('CategoryService.create (CM-1)', () => {
  let env: ReturnType<typeof build>;
  beforeEach(() => {
    env = build();
  });

  it('creates a nested category under a parent', async () => {
    await seed(env);
    const child = await env.service.create({ name: 'Rent', parentId: 3 });
    expect(child.parentId).toBe(3);
  });

  it('creates a root category when no parent is given', async () => {
    const cat = await env.service.create({ name: 'Hobbies' });
    expect(cat.parentId).toBeNull();
  });

  it('rejects an empty name', async () => {
    await expect(env.service.create({ name: '  ' })).rejects.toThrow(ValidationError);
  });

  it('rejects a missing parent with NOT_FOUND', async () => {
    await expect(env.service.create({ name: 'X', parentId: 99 })).rejects.toThrow(NotFoundError);
  });

  it('rejects a deleted parent', async () => {
    await env.categories.create({ id: 9, name: 'Old', parentId: null, deletedAt: NOW.toISOString() });
    await expect(env.service.create({ name: 'X', parentId: 9 })).rejects.toThrow(ValidationError);
  });
});

describe('CategoryService.rename (CM-3, CM-5)', () => {
  it('renames a category and keeps its stable id (CM-3)', async () => {
    const env = build();
    await env.categories.create({ id: 5, name: 'Food', parentId: null, deletedAt: null });
    const renamed = await env.service.rename(5, 'Comida');
    expect(renamed.name).toBe('Comida');
    expect(renamed.id).toBe(5);
    expect((await env.categories.findById(5))?.name).toBe('Comida');
  });

  it('rejects renaming a deleted category', async () => {
    const env = build();
    await env.categories.create({ id: 5, name: 'Food', parentId: null, deletedAt: NOW.toISOString() });
    await expect(env.service.rename(5, 'Comida')).rejects.toThrow(NotFoundError);
  });

  it('rejects renaming a missing category', async () => {
    const env = build();
    await expect(env.service.rename(99, 'X')).rejects.toThrow(NotFoundError);
  });
});

describe('CategoryService.move (CM-1 cycle guard)', () => {
  it('moves a category to a new parent', async () => {
    const env = build();
    await seed(env);
    const moved = await env.service.move(2, 3);
    expect(moved.parentId).toBe(3);
  });

  it('rejects moving a category under itself', async () => {
    const env = build();
    await seed(env);
    await expect(env.service.move(1, 1)).rejects.toThrow(ConflictError);
  });

  it('rejects a cycle: moving a parent under its own descendant (CM-1)', async () => {
    const env = build();
    await seed(env);
    // 3 (Housing) is parent of 4 (Rent); moving 3 under 4 would create a cycle.
    await expect(env.service.move(3, 4)).rejects.toThrow(ConflictError);
  });

  it('rejects a deep cycle: moving an ancestor under a grandchild', async () => {
    const env = build();
    await seed(env);
    await env.categories.create({ id: 6, name: 'Mortgage', parentId: 4, deletedAt: null });
    await expect(env.service.move(3, 6)).rejects.toThrow(ConflictError);
  });

  it('allows moving a category to an unrelated branch (no cycle)', async () => {
    const env = build();
    await seed(env);
    const moved = await env.service.move(4, 5);
    expect(moved.parentId).toBe(5);
  });

  it('rejects moving under a deleted parent', async () => {
    const env = build();
    await seed(env);
    await env.service.remove(5, NOW.toISOString());
    await expect(env.service.move(4, 5)).rejects.toThrow(ValidationError);
  });
});

describe('CategoryService.remove (CM-4 soft-delete)', () => {
  it('soft-deletes a leaf category and hides it from active listings', async () => {
    const env = build();
    await seed(env);
    const removed = await env.service.remove(5, NOW.toISOString());
    expect(removed.deletedAt).toBe(NOW.toISOString());
    const active = await env.service.listActive();
    expect(active.find((c) => c.id === 5)).toBeUndefined();
    // Still present for history (PS-5).
    expect(await env.categories.findById(5)).not.toBeNull();
  });

  it('rejects deleting a category that still has children (CM-4)', async () => {
    const env = build();
    await seed(env);
    await expect(env.service.remove(3, NOW.toISOString())).rejects.toThrow(ConflictError);
  });

  it('rejects deleting an already-deleted category', async () => {
    const env = build();
    await seed(env);
    await env.service.remove(5, NOW.toISOString());
    await expect(env.service.remove(5, NOW.toISOString())).rejects.toThrow(NotFoundError);
  });

  it('rejects deleting a missing category', async () => {
    const env = build();
    await expect(env.service.remove(99, NOW.toISOString())).rejects.toThrow(NotFoundError);
  });
});

describe('CategoryService.listActive', () => {
  it('returns only non-deleted categories (CM-4)', async () => {
    const env = build();
    await seed(env);
    await env.service.remove(5, NOW.toISOString());
    const active = await env.service.listActive();
    expect(active.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });
});
