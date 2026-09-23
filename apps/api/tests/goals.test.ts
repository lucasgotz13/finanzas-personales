import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

async function createGoal(app: TestEnv['app'], body: Record<string, unknown>): Promise<number> {
  const res = await request(app).post('/api/v1/goals').send(body);
  expect(res.status).toBe(201);
  return res.body.id as number;
}

describe('goals CRUD', () => {
  it('lists no goals initially and returns the created goal with derived progress', async () => {
    env = await createTestApp();
    const app = env.app;
    expect((await request(app).get('/api/v1/goals')).body).toEqual([]);
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS', deadline: '2026-12-31' });
    const list = await request(app).get('/api/v1/goals');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id,
      name: 'Viaje',
      targetMinor: 100000,
      currency: 'ARS',
      deadline: '2026-12-31',
      completed: false,
      automaticMinor: 0,
      manualNetMinor: 0,
      totalMinor: 0,
      remainingMinor: 100000,
    });
  });

  it('edits name/target/currency and clears the deadline with null', async () => {
    env = await createTestApp();
    const app = env.app;
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS', deadline: '2026-12-31' });
    const patch = await request(app).patch(`/api/v1/goals/${id}`).send({ name: 'Viaje 2027', targetMinor: 200000, deadline: null });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ name: 'Viaje 2027', targetMinor: 200000, deadline: null });
  });

  it('deletes the goal with its adjustments', async () => {
    env = await createTestApp();
    const app = env.app;
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'aporte', amountMinor: 5000 });
    const del = await request(app).delete(`/api/v1/goals/${id}`);
    expect(del.status).toBe(204);
    expect((await request(app).get('/api/v1/goals')).body).toEqual([]);
    expect((await request(app).delete(`/api/v1/goals/${id}`)).status).toBe(404);
  });

  it('rejects invalid payloads with 422 and unknown ids with 404', async () => {
    env = await createTestApp();
    const app = env.app;
    for (const body of [
      { name: '', targetMinor: 1000, currency: 'ARS' },
      { name: 'Viaje', targetMinor: 0, currency: 'ARS' },
      { name: 'Viaje', targetMinor: 1000, currency: 'EUR' },
      { name: 'Viaje', targetMinor: 1000, currency: 'ARS', deadline: 'ayer' },
    ]) {
      expect((await request(app).post('/api/v1/goals').send(body)).status).toBe(422);
    }
    expect((await request(app).patch('/api/v1/goals/999').send({ name: 'X' })).status).toBe(404);
    expect((await request(app).patch('/api/v1/goals/abc').send({ name: 'X' })).status).toBe(422);
    expect((await request(app).delete('/api/v1/goals/999')).status).toBe(404);
  });
});

describe('goal adjustments (aportes/retiros)', () => {
  it('records signed movements and exposes the automatic/manual split', async () => {
    env = await createTestApp();
    const app = env.app;
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    const aporte = await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'aporte', amountMinor: 10000 });
    expect(aporte.status).toBe(201);
    expect(aporte.body).toMatchObject({ goalId: id, amountMinor: 10000 });
    const retiro = await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'retiro', amountMinor: 3000 });
    expect(retiro.status).toBe(201);
    expect(retiro.body).toMatchObject({ goalId: id, amountMinor: -3000 });

    const list = await request(app).get('/api/v1/goals');
    expect(list.body[0]).toMatchObject({
      manualAportesMinor: 10000,
      manualRetirosMinor: 3000,
      manualNetMinor: 7000,
      totalMinor: 7000,
    });
  });

  it('rejects unknown kinds, non-positive amounts and unknown goals', async () => {
    env = await createTestApp();
    const app = env.app;
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    expect((await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'gift', amountMinor: 100 })).status).toBe(422);
    expect((await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'aporte', amountMinor: 0 })).status).toBe(422);
    expect((await request(app).post('/api/v1/goals/999/adjustments').send({ kind: 'aporte', amountMinor: 100 })).status).toBe(404);
  });
});

describe('goal adjustment history', () => {
  it('lists the movements newest first with their signs', async () => {
    env = await createTestApp();
    const app = env.app;
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'aporte', amountMinor: 10000 });
    env.clock.advance(1000);
    await request(app).post(`/api/v1/goals/${id}/adjustments`).send({ kind: 'retiro', amountMinor: 3000 });

    const res = await request(app).get(`/api/v1/goals/${id}/adjustments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((a: { amountMinor: number }) => a.amountMinor)).toEqual([-3000, 10000]);
    expect(res.body[0]).toMatchObject({ goalId: id, amountMinor: -3000 });
    expect(res.body[1]).toMatchObject({ goalId: id, amountMinor: 10000 });
  });

  it('returns 404 for an unknown goal and 422 for an invalid id', async () => {
    env = await createTestApp();
    const app = env.app;
    expect((await request(app).get('/api/v1/goals/999/adjustments')).status).toBe(404);
    expect((await request(app).get('/api/v1/goals/abc/adjustments')).status).toBe(422);
  });
});

describe('goal automatic progress', () => {
  it('fills from the per-currency surplus since creation, ignoring older transactions', async () => {
    env = await createTestApp();
    const app = env.app;
    // Test clock is fixed at 2026-08-08: the goal is created "today".
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 500000, currency: 'ARS', date: '2026-08-01', categoryId: 10 });
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 90000, currency: 'ARS', date: '2026-08-08', categoryId: 10 });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'expense', amountMinor: 20000, currency: 'ARS', date: '2026-08-08', categoryId: 1 });

    const list = await request(app).get('/api/v1/goals');
    expect(list.body.find((g: { id: number }) => g.id === id)).toMatchObject({
      automaticMinor: 70000,
      totalMinor: 70000,
      remainingMinor: 30000,
      completed: false,
    });
  });

  it('runs the waterfall in priority order and reroutes it on reorder', async () => {
    env = await createTestApp();
    const app = env.app;
    const a = await createGoal(app, { name: 'A', targetMinor: 50000, currency: 'ARS' });
    const b = await createGoal(app, { name: 'B', targetMinor: 100000, currency: 'ARS' });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 120000, currency: 'ARS', date: '2026-08-08', categoryId: 10 });

    let list = await request(app).get('/api/v1/goals');
    expect(list.body.find((g: { id: number }) => g.id === a)).toMatchObject({ automaticMinor: 50000, completed: true });
    expect(list.body.find((g: { id: number }) => g.id === b)).toMatchObject({ automaticMinor: 70000, completed: false });

    const reorder = await request(app).put('/api/v1/goals/order').send({ ids: [b, a] });
    expect(reorder.status).toBe(200);
    expect(reorder.body.map((g: { id: number }) => g.id)).toEqual([b, a]);
    list = await request(app).get('/api/v1/goals');
    expect(list.body.find((g: { id: number }) => g.id === b)).toMatchObject({ automaticMinor: 100000, completed: true });
    expect(list.body.find((g: { id: number }) => g.id === a)).toMatchObject({ automaticMinor: 20000, completed: false });
  });

  it('rejects reorder payloads that skip, duplicate or invent ids', async () => {
    env = await createTestApp();
    const app = env.app;
    const a = await createGoal(app, { name: 'A', targetMinor: 1000, currency: 'ARS' });
    await createGoal(app, { name: 'B', targetMinor: 1000, currency: 'ARS' });
    expect((await request(app).put('/api/v1/goals/order').send({ ids: [a] })).status).toBe(422);
    expect((await request(app).put('/api/v1/goals/order').send({ ids: [a, a] })).status).toBe(422);
    expect((await request(app).put('/api/v1/goals/order').send({ ids: [a, 999] })).status).toBe(422);
    expect((await request(app).put('/api/v1/goals/order').send({})).status).toBe(422);
  });

  it('reports deadline pace and days remaining with the progress', async () => {
    env = await createTestApp();
    const app = env.app;
    // Today is 2026-08-08; deadline 2026-10-15 → 68 days, 3 calendar months.
    const id = await createGoal(app, { name: 'Viaje', targetMinor: 90000, currency: 'ARS', deadline: '2026-10-15' });
    await request(app)
      .post('/api/v1/transactions')
      .send({ direction: 'income', amountMinor: 30000, currency: 'ARS', date: '2026-08-08', categoryId: 10 });

    const list = await request(app).get('/api/v1/goals');
    expect(list.body.find((g: { id: number }) => g.id === id)).toMatchObject({
      automaticMinor: 30000,
      daysRemaining: 68,
      requiredPaceMinor: 20000,
    });
  });
});
