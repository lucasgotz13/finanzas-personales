import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('GET /api/v1/categories/tree (CM-1, CM-4)', () => {
  it('returns the seeded tree with nested children', async () => {
    env = await createTestApp();
    const app = env.app;
    const child = await request(app).post('/api/v1/categories').send({ name: 'Rent', parentId: 3 });
    expect(child.status).toBe(201);
    const res = await request(app).get('/api/v1/categories/tree');
    expect(res.status).toBe(200);
    const housing = res.body.find((n: { id: number }) => n.id === 3);
    expect(housing.children.map((c: { name: string }) => c.name)).toEqual(['Rent']);
    expect(res.body).toHaveLength(10);
  });

  it('hides soft-deleted categories (CM-4)', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5');
    const res = await request(app).get('/api/v1/categories/tree');
    expect(res.body.find((n: { id: number }) => n.id === 5)).toBeUndefined();
    expect(res.body).toHaveLength(9);
  });
});

describe('POST /api/v1/categories', () => {
  it('creates a root category (201)', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories').send({ name: 'Hobbies' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Hobbies');
    expect(res.body.parentId).toBeNull();
  });

  it('rejects an empty name with 422', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories').send({ name: '  ' });
    expect(res.status).toBe(422);
  });

  it('rejects a missing parent with 404', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories').send({ name: 'X', parentId: 99 });
    expect(res.status).toBe(404);
  });

  it('rejects a deleted parent with 422', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5');
    const res = await request(app).post('/api/v1/categories').send({ name: 'X', parentId: 5 });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/categories/:id (CM-1, CM-3)', () => {
  it('renames a category keeping its stable id (CM-3)', async () => {
    env = await createTestApp();
    const res = await request(env.app).patch('/api/v1/categories/1').send({ name: 'Comida' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Comida' });
  });

  it('moves a category to a new parent', async () => {
    env = await createTestApp();
    const res = await request(env.app).patch('/api/v1/categories/2').send({ parentId: 3 });
    expect(res.status).toBe(200);
    expect(res.body.parentId).toBe(3);
  });

  it('rejects a cycle with 409 (CM-1)', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).post('/api/v1/categories').send({ name: 'Rent', parentId: 3 });
    // Moving Housing (3) under its own child Rent would create a cycle.
    const res = await request(app).patch('/api/v1/categories/3').send({ parentId: 11 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects moving a category under itself with 409', async () => {
    env = await createTestApp();
    const res = await request(env.app).patch('/api/v1/categories/3').send({ parentId: 3 });
    expect(res.status).toBe(409);
  });

  it('moves a category back to root with parentId null', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).patch('/api/v1/categories/2').send({ parentId: 3 });
    const res = await request(app).patch('/api/v1/categories/2').send({ parentId: null });
    expect(res.status).toBe(200);
    expect(res.body.parentId).toBeNull();
  });
});

describe('DELETE /api/v1/categories/:id (CM-4)', () => {
  it('soft-deletes a leaf category (204)', async () => {
    env = await createTestApp();
    const res = await request(env.app).delete('/api/v1/categories/5');
    expect(res.status).toBe(204);
  });

  it('rejects deleting a category with children with 409 (CM-4)', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).post('/api/v1/categories').send({ name: 'Rent', parentId: 3 });
    const res = await request(app).delete('/api/v1/categories/3');
    expect(res.status).toBe(409);
  });

  it('rejects deleting a missing category with 404', async () => {
    env = await createTestApp();
    const res = await request(env.app).delete('/api/v1/categories/99');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/categories/deleted', () => {
  it('returns only soft-deleted categories', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5');
    await request(app).delete('/api/v1/categories/8');
    const res = await request(app).get('/api/v1/categories/deleted');
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: number }) => c.id).sort()).toEqual([5, 8]);
    expect(res.body.every((c: { deletedAt: string }) => c.deletedAt !== null)).toBe(true);
  });

  it('returns an empty list when nothing is deleted', async () => {
    env = await createTestApp();
    const res = await request(env.app).get('/api/v1/categories/deleted');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/v1/categories/:id/restore', () => {
  it('restores a deleted category and brings it back into the tree (200)', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5');
    const res = await request(app).post('/api/v1/categories/5/restore');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5, name: 'Health', parentId: null });
    expect(res.body.deletedAt).toBeNull();
    const tree = await request(app).get('/api/v1/categories/tree');
    expect(tree.body.find((n: { id: number }) => n.id === 5)).toBeDefined();
    expect(tree.body).toHaveLength(10);
    const deleted = await request(app).get('/api/v1/categories/deleted');
    expect(deleted.body).toEqual([]);
  });

  it('detaches from a deleted parent when restoring', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).post('/api/v1/categories').send({ name: 'Rent', parentId: 3 });
    await request(app).delete('/api/v1/categories/11');
    await request(app).delete('/api/v1/categories/3');
    const res = await request(app).post('/api/v1/categories/11/restore');
    expect(res.status).toBe(200);
    expect(res.body.parentId).toBeNull();
  });

  it('rejects restoring an active category with 404', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories/5/restore');
    expect(res.status).toBe(404);
  });

  it('rejects restoring a missing category with 404', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories/99/restore');
    expect(res.status).toBe(404);
  });

  it('rejects an invalid id with 422', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/categories/abc/restore');
    expect(res.status).toBe(422);
  });
});

describe('Deleted categories are not assignable (ET-2, CM-4)', () => {
  it('rejects a new expense referencing a deleted category with 422', async () => {
    env = await createTestApp();
    const app = env.app;
    await request(app).delete('/api/v1/categories/5'); // Health
    const res = await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 100, currency: 'ARS', date: '2026-08-01', categoryId: 5 });
    expect(res.status).toBe(422);
  });
});
