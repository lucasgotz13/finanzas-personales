import { describe, expect, it } from 'vitest';
import { Goal } from '../../src/entities/goal';
import { GoalService } from '../../src/use-cases/goals';
import {
  FakeClock,
  InMemoryGoalAdjustmentRepository,
  InMemoryGoalRepository,
  InMemoryTransactionRepository,
} from '../helpers/fakes';

function build(now: string) {
  const goals = new InMemoryGoalRepository();
  const adjustments = new InMemoryGoalAdjustmentRepository();
  const transactions = new InMemoryTransactionRepository();
  goals.reset();
  adjustments.reset();
  transactions.reset();
  const clock = new FakeClock(new Date(now));
  const service = new GoalService({ goals, adjustments, transactions, clock });
  return { goals, adjustments, transactions, clock, service };
}

async function addTx(
  env: ReturnType<typeof build>,
  txDate: string,
  direction: 'expense' | 'income',
  amountMinor: number,
  currency: 'ARS' | 'USD',
) {
  await env.transactions.create({ direction, amountMinor, currency, rate: 1, txDate, categoryId: 1, note: '' });
}

describe('GoalService validation', () => {
  it('rejects an empty name, a non-positive target, a bad currency and a bad deadline', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    await expect(env.service.create({ name: '  ', targetMinor: 1000, currency: 'ARS' })).rejects.toThrow('Invalid goal');
    await expect(env.service.create({ name: 'Viaje', targetMinor: 0, currency: 'ARS' })).rejects.toThrow('Invalid goal');
    await expect(env.service.create({ name: 'Viaje', targetMinor: 1000, currency: 'EUR' })).rejects.toThrow('Invalid goal');
    await expect(env.service.create({ name: 'Viaje', targetMinor: 1000, currency: 'ARS', deadline: '2026-02-31' })).rejects.toThrow(
      'Invalid goal',
    );
  });

  it('rejects adjustments with an unknown kind or a non-positive amount', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await expect(env.service.addAdjustment(goal.id as number, 'gift' as never, 1000)).rejects.toThrow('Invalid adjustment');
    await expect(env.service.addAdjustment(goal.id as number, 'aporte', 0)).rejects.toThrow('Invalid adjustment');
    await expect(env.service.addAdjustment(999, 'aporte', 1000)).rejects.toThrow('Goal 999 not found');
  });

  it('rejects updates of unknown goals and reorder payloads that skip or duplicate ids', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    await expect(env.service.update(999, { name: 'X' })).rejects.toThrow('Goal 999 not found');
    const a = await env.service.create({ name: 'A', targetMinor: 1000, currency: 'ARS' });
    const b = await env.service.create({ name: 'B', targetMinor: 1000, currency: 'ARS' });
    const aid = a.id as number;
    const bid = b.id as number;
    await expect(env.service.reorder([aid, aid])).rejects.toThrow('Invalid goal order');
    await expect(env.service.reorder([aid])).rejects.toThrow('Invalid goal order');
    await expect(env.service.reorder([aid, 999])).rejects.toThrow('Invalid goal order');
    await expect(env.service.reorder([bid, aid])).resolves.toBeUndefined();
  });
});

describe('GoalService automatic surplus', () => {
  it('accumulates income minus expenses in the goal currency since creation (no conversion)', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const ars = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    const usd = await env.service.create({ name: 'Laptop', targetMinor: 10000, currency: 'USD' });
    await addTx(env, '2026-08-05', 'income', 90000, 'ARS');
    await addTx(env, '2026-08-06', 'expense', 20000, 'ARS');
    await addTx(env, '2026-08-06', 'income', 5000, 'USD');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const views = await env.service.list();
    const arsView = views.find((v) => v.id === ars.id) as NonNullable<ReturnType<typeof views.find>>;
    const usdView = views.find((v) => v.id === usd.id) as NonNullable<ReturnType<typeof views.find>>;
    expect(arsView.automaticMinor).toBe(70000);
    expect(arsView.totalMinor).toBe(70000);
    expect(arsView.remainingMinor).toBe(30000);
    expect(arsView.completed).toBe(false);
    expect(usdView.automaticMinor).toBe(5000);
  });

  it('never counts surplus from before the goal creation (not even the same pool)', async () => {
    const env = build('2026-08-10T12:00:00.000Z');
    await addTx(env, '2026-08-01', 'income', 500000, 'ARS');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await addTx(env, '2026-08-10', 'income', 30000, 'ARS');

    const views = await env.service.list();
    expect(views.find((v) => v.id === goal.id)?.automaticMinor).toBe(30000);
  });

  it('fills the first incomplete goal in priority order and overflows to the next', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const a = await env.service.create({ name: 'A', targetMinor: 50000, currency: 'ARS' });
    const b = await env.service.create({ name: 'B', targetMinor: 100000, currency: 'ARS' });
    await addTx(env, '2026-08-05', 'income', 120000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const views = await env.service.list();
    const aView = views.find((v) => v.id === a.id) as NonNullable<ReturnType<typeof views.find>>;
    const bView = views.find((v) => v.id === b.id) as NonNullable<ReturnType<typeof views.find>>;
    expect(aView.automaticMinor).toBe(50000);
    expect(aView.completed).toBe(true);
    expect(bView.automaticMinor).toBe(70000);
    expect(bView.completed).toBe(false);
  });

  it('breaks priority ties by creation order', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    // Same priority rank: older creation fills first.
    const first = await env.goals.create(
      new Goal({ name: 'First', targetMinor: 50000, currency: 'ARS', deadline: null, createdAt: '2026-08-01T12:00:00.000Z', priority: 0 }),
    );
    const second = await env.goals.create(
      new Goal({ name: 'Second', targetMinor: 50000, currency: 'ARS', deadline: null, createdAt: '2026-08-02T12:00:00.000Z', priority: 0 }),
    );
    await addTx(env, '2026-08-05', 'income', 60000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const views = await env.service.list();
    expect(views.find((v) => v.id === first.id)?.automaticMinor).toBe(50000);
    expect(views.find((v) => v.id === second.id)?.automaticMinor).toBe(10000);
  });

  it('floors automatic progress at zero when later deficits draw it back', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    await addTx(env, '2026-08-05', 'income', 50000, 'ARS');
    await addTx(env, '2026-08-06', 'expense', 80000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const views = await env.service.list();
    const view = views.find((v) => v.id === goal.id) as NonNullable<ReturnType<typeof views.find>>;
    expect(view.automaticMinor).toBe(0);
    expect(view.totalMinor).toBe(0);
    expect(view.completed).toBe(false);
  });
});

describe('GoalService manual adjustments', () => {
  it('tracks aportes and retiros separately and adds the net to the total', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    const id = goal.id as number;
    await env.service.addAdjustment(id, 'aporte', 10000);
    await env.service.addAdjustment(id, 'retiro', 3000);
    await addTx(env, '2026-08-05', 'income', 20000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const view = (await env.service.list()).find((v) => v.id === id) as NonNullable<Awaited<ReturnType<typeof env.service.list>>[number]>;
    expect(view.manualAportesMinor).toBe(10000);
    expect(view.manualRetirosMinor).toBe(3000);
    expect(view.manualNetMinor).toBe(7000);
    expect(view.automaticMinor).toBe(20000);
    expect(view.totalMinor).toBe(27000);
  });

  it('routes later surplus to the next goal once a manual aporte completes the first', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const a = await env.service.create({ name: 'A', targetMinor: 20000, currency: 'ARS' });
    const b = await env.service.create({ name: 'B', targetMinor: 100000, currency: 'ARS' });
    const aid = a.id as number;
    const bid = b.id as number;
    await addTx(env, '2026-08-05', 'income', 50000, 'ARS');
    // Manual completion on 08-06: the 08-05 surplus already filled A, and
    // later surplus must flow to B. A keeps no automatic beyond its need.
    env.clock.set(new Date('2026-08-06T12:00:00.000Z'));
    await env.service.addAdjustment(aid, 'aporte', 20000);
    await addTx(env, '2026-08-07', 'income', 40000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const views = await env.service.list();
    const aView = views.find((v) => v.id === aid) as NonNullable<ReturnType<typeof views.find>>;
    const bView = views.find((v) => v.id === bid) as NonNullable<ReturnType<typeof views.find>>;
    expect(aView.completed).toBe(true);
    expect(aView.totalMinor).toBeGreaterThanOrEqual(20000);
    expect(bView.automaticMinor).toBe(70000);
  });
});

describe('GoalService adjustment history', () => {
  it('returns the stored movements newest first and rejects an unknown goal', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS' });
    const id = goal.id as number;
    await env.service.addAdjustment(id, 'aporte', 10000);
    env.clock.set(new Date('2026-08-02T12:00:00.000Z'));
    await env.service.addAdjustment(id, 'retiro', 3000);

    const stored = await env.adjustments.listByGoal(id);
    const movements = await env.service.listAdjustments(id);
    // The service returns the repository result untouched, newest first.
    expect(movements).toEqual(stored);
    expect(movements.map((m) => m.amountMinor)).toEqual([-3000, 10000]);
    await expect(env.service.listAdjustments(999)).rejects.toThrow('Goal 999 not found');
  });
});

describe('GoalService reorder', () => {
  it('moves the surplus stream to the newly first goal', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const a = await env.service.create({ name: 'A', targetMinor: 100000, currency: 'ARS' });
    const b = await env.service.create({ name: 'B', targetMinor: 100000, currency: 'ARS' });
    const aid = a.id as number;
    const bid = b.id as number;
    await addTx(env, '2026-08-05', 'income', 100000, 'ARS');
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    let views = await env.service.list();
    expect(views.find((v) => v.id === aid)?.automaticMinor).toBe(100000);
    expect(views.find((v) => v.id === bid)?.automaticMinor).toBe(0);

    await env.service.reorder([bid, aid]);
    views = await env.service.list();
    expect(views.map((v) => v.id)).toEqual([bid, aid]);
    expect(views.find((v) => v.id === bid)?.automaticMinor).toBe(100000);
    expect(views.find((v) => v.id === aid)?.automaticMinor).toBe(0);
  });
});

describe('GoalService deadlines', () => {
  it('reports days remaining and the required monthly pace without any verdict', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 90000, currency: 'ARS', deadline: '2026-10-15' });
    await addTx(env, '2026-08-08', 'income', 30000, 'ARS');

    const view = (await env.service.list()).find((v) => v.id === goal.id) as NonNullable<Awaited<ReturnType<typeof env.service.list>>[number]>;
    // Aug 8 → Oct 15: 23 + 30 + 15 = 68 days; months Aug/Sep/Oct = 3.
    expect(view.daysRemaining).toBe(68);
    // Remaining 60000 over 3 months.
    expect(view.requiredPaceMinor).toBe(20000);
  });

  it('returns null pace/days without a deadline and caps overdue pace at the full remainder', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    const open = await env.service.create({ name: 'Open', targetMinor: 10000, currency: 'ARS' });
    const late = await env.service.create({ name: 'Late', targetMinor: 10000, currency: 'ARS', deadline: '2026-08-01' });

    const views = await env.service.list();
    const openView = views.find((v) => v.id === open.id) as NonNullable<ReturnType<typeof views.find>>;
    const lateView = views.find((v) => v.id === late.id) as NonNullable<ReturnType<typeof views.find>>;
    expect(openView.daysRemaining).toBeNull();
    expect(openView.requiredPaceMinor).toBeNull();
    expect(lateView.daysRemaining).toBe(-7);
    expect(lateView.requiredPaceMinor).toBe(10000);
  });
});

describe('GoalService CRUD', () => {
  it('edits name/target/currency and clears the deadline with null', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Viaje', targetMinor: 100000, currency: 'ARS', deadline: '2026-10-15' });
    const id = goal.id as number;
    const updated = await env.service.update(id, { name: 'Viaje 2027', targetMinor: 200000, deadline: null });
    expect(updated.name).toBe('Viaje 2027');
    expect(updated.targetMinor).toBe(200000);
    expect(updated.deadline).toBeNull();
    await expect(env.service.update(id, { deadline: 'ayer' })).rejects.toThrow('Invalid goal');
  });

  it('recomputes the automatic pool in the new currency after a currency change', async () => {
    const env = build('2026-08-01T12:00:00.000Z');
    const goal = await env.service.create({ name: 'Laptop', targetMinor: 100000, currency: 'ARS' });
    const id = goal.id as number;
    await addTx(env, '2026-08-05', 'income', 60000, 'ARS');
    await addTx(env, '2026-08-05', 'income', 700, 'USD');
    await env.service.update(id, { currency: 'USD' });
    env.clock.set(new Date('2026-08-10T12:00:00.000Z'));

    const view = (await env.service.list()).find((v) => v.id === id) as NonNullable<Awaited<ReturnType<typeof env.service.list>>[number]>;
    expect(view.automaticMinor).toBe(700);
  });

  it('deletes the goal with its adjustments and keeps a dense priority rank', async () => {
    const env = build('2026-08-08T12:00:00.000Z');
    const a = await env.service.create({ name: 'A', targetMinor: 1000, currency: 'ARS' });
    const b = await env.service.create({ name: 'B', targetMinor: 1000, currency: 'ARS' });
    await env.service.addAdjustment(a.id as number, 'aporte', 500);
    await env.service.remove(a.id as number);

    const views = await env.service.list();
    expect(views.map((v) => v.name)).toEqual(['B']);
    expect(views[0].priority).toBe(0);
    expect(await env.adjustments.listAll()).toEqual([]);
    await expect(env.service.remove(a.id as number)).rejects.toThrow(`Goal ${a.id} not found`);
    void b;
  });
});
