import { Goal, GoalAdjustment } from '../entities/goal';
import { NotFoundError, ValidationError } from '../errors';
import { isSupportedCurrency } from '../vo/money';
import type { Currency } from '../vo/money';
import { arDateString, isArDateString } from '../vo/period-key';
import type { Clock, GoalAdjustmentRepository, GoalRepository, TransactionRepository } from '../ports/repositories';
import { netFlowByCurrency } from './surplus';

export interface GoalServiceDeps {
  goals: GoalRepository;
  adjustments: GoalAdjustmentRepository;
  transactions: TransactionRepository;
  clock: Clock;
}

export interface CreateGoalInput {
  name: string;
  targetMinor: number;
  currency: string;
  deadline?: string | null;
}

export interface UpdateGoalInput {
  name?: string;
  targetMinor?: number;
  currency?: string;
  /** undefined keeps the stored deadline; null clears it. */
  deadline?: string | null;
}

export type AdjustmentKind = 'aporte' | 'retiro';

export interface GoalView {
  id: number;
  name: string;
  targetMinor: number;
  currency: Currency;
  deadline: string | null;
  createdAt: string;
  priority: number;
  completed: boolean;
  automaticMinor: number;
  manualAportesMinor: number;
  manualRetirosMinor: number;
  manualNetMinor: number;
  totalMinor: number;
  remainingMinor: number;
  /** Whole days from today (AR) to the deadline; null without deadline. */
  daysRemaining: number | null;
  /** Remaining minor units per calendar month left (ceil); null without deadline. */
  requiredPaceMinor: number | null;
}

function orderGoals<T extends { priority: number; createdAt: string; id?: number }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/** AR-calendar date (YYYY-MM-DD) of an ISO instant. */
function arDateOfInstant(iso: string): string {
  return arDateString(new Date(iso));
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function diffDays(fromStr: string, toStr: string): number {
  const parse = (s: string): number => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toStr) - parse(fromStr)) / 86_400_000);
}

/**
 * Savings goals ("Metas de ahorro").
 *
 * Progress per goal = automatic surplus accumulation in the goal's currency
 * (income − expenses, the same per-currency net the summaries compute, shared
 * through `netFlowByCurrency`) counted since the goal's own creation, plus
 * signed manual adjustments (aportes/retiros). The total is always derived,
 * never stored, so it cannot be overwritten by hand.
 *
 * Waterfall: per currency, each calendar day's net surplus fills the first
 * incomplete goal in priority order that already exists that day; overflow
 * cascades to the next. Surplus from before a goal's creation never counts
 * for it (leftover from earlier days is dropped, never banked for future
 * goals). Daily deficits draw back the most recently allocated surplus first
 * (LIFO), floored at zero per goal. No currency conversion, ever.
 */
export class GoalService {
  constructor(private deps: GoalServiceDeps) {}

  async create(input: CreateGoalInput): Promise<Goal> {
    const now = this.deps.clock.now().toISOString();
    const existing = await this.deps.goals.listAll();
    const nextPriority = existing.reduce((max, g) => Math.max(max, g.priority), -1) + 1;
    const goal = new Goal({
      name: input.name,
      targetMinor: input.targetMinor,
      currency: input.currency,
      deadline: input.deadline ?? null,
      createdAt: now,
      priority: nextPriority,
    });
    return this.deps.goals.create(goal);
  }

  async update(id: number, patch: UpdateGoalInput): Promise<Goal> {
    const existing = await this.deps.goals.findById(id);
    if (!existing) throw new NotFoundError(`Goal ${id} not found`);
    const goal = new Goal({
      id,
      name: patch.name ?? existing.name,
      targetMinor: patch.targetMinor ?? existing.targetMinor,
      currency: patch.currency ?? existing.currency,
      deadline: patch.deadline !== undefined ? patch.deadline : existing.deadline,
      createdAt: existing.createdAt,
      priority: existing.priority,
    });
    const stored = await this.deps.goals.update(id, goal);
    if (!stored) throw new NotFoundError(`Goal ${id} not found`);
    return stored;
  }

  async remove(id: number): Promise<void> {
    await this.deps.adjustments.deleteByGoal(id);
    const deleted = await this.deps.goals.delete(id);
    if (!deleted) throw new NotFoundError(`Goal ${id} not found`);
    // Renumber so priorities stay a dense 0..n-1 rank after deletes.
    const remaining = orderGoals(await this.deps.goals.listAll());
    for (let i = 0; i < remaining.length; i++) {
      const g = remaining[i];
      if (g.priority !== i) {
        await this.deps.goals.update(g.id as number, new Goal({ ...g, id: g.id, priority: i }));
      }
    }
  }

  /** Replaces the priority rank with the given id order (up/down buttons send a swapped array). */
  async reorder(ids: number[]): Promise<void> {
    const existing = await this.deps.goals.listAll();
    const known = new Set(existing.map((g) => g.id as number));
    const seen = new Set<number>();
    const valid =
      ids.length === existing.length && ids.every((id) => Number.isInteger(id) && known.has(id) && !seen.has(id) && (seen.add(id), true));
    if (!valid) {
      throw new ValidationError('Invalid goal order', ['ids must contain each goal id exactly once']);
    }
    for (let i = 0; i < ids.length; i++) {
      const goal = existing.find((g) => g.id === ids[i]) as Goal;
      if (goal.priority !== i) {
        await this.deps.goals.update(ids[i], new Goal({ ...goal, id: ids[i], priority: i }));
      }
    }
  }

  async addAdjustment(goalId: number, kind: AdjustmentKind, amountMinor: number): Promise<GoalAdjustment> {
    const goal = await this.deps.goals.findById(goalId);
    if (!goal) throw new NotFoundError(`Goal ${goalId} not found`);
    if (kind !== 'aporte' && kind !== 'retiro') {
      throw new ValidationError('Invalid adjustment', ['kind must be aporte or retiro']);
    }
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new ValidationError('Invalid adjustment', ['amountMinor must be a positive integer']);
    }
    const adjustment = new GoalAdjustment({
      goalId,
      amountMinor: kind === 'aporte' ? amountMinor : -amountMinor,
      createdAt: this.deps.clock.now().toISOString(),
    });
    return this.deps.adjustments.create(adjustment);
  }

  /** All goals in priority order with derived progress (automatic + manual split). */
  async list(): Promise<GoalView[]> {
    const goals = orderGoals(await this.deps.goals.listAll());
    if (goals.length === 0) return [];
    const todayStr = arDateString(this.deps.clock.now());
    const allAdjustments = await this.deps.adjustments.listAll();
    const byGoal = new Map<number, GoalAdjustment[]>();
    for (const adj of allAdjustments) {
      const list = byGoal.get(adj.goalId) ?? [];
      list.push(adj);
      byGoal.set(adj.goalId, list);
    }

    const minDate = goals.map((g) => arDateOfInstant(g.createdAt)).sort()[0];
    const txs = await this.deps.transactions.list({
      from: new Date(`${minDate}T12:00:00Z`),
      to: new Date(`${addDays(todayStr, 1)}T12:00:00Z`),
    });
    const netByDay = new Map<string, Map<Currency, number>>();
    const txsByDay = new Map<string, typeof txs>();
    for (const tx of txs) {
      const list = txsByDay.get(tx.txDate) ?? [];
      list.push(tx);
      txsByDay.set(tx.txDate, list);
    }
    for (const [day, dayTxs] of txsByDay) {
      const nets = new Map<Currency, number>();
      for (const n of netFlowByCurrency(dayTxs)) nets.set(n.currency, n.netFlow);
      netByDay.set(day, nets);
    }

    // Manual movements attributed by AR-calendar day (same attribution rule
    // as transactions), so a manual completion reroutes later surplus.
    const manualDaySums = new Map<number, Map<string, number>>();
    for (const goal of goals) {
      const sums = new Map<string, number>();
      for (const adj of byGoal.get(goal.id as number) ?? []) {
        const day = arDateOfInstant(adj.createdAt);
        sums.set(day, (sums.get(day) ?? 0) + adj.amountMinor);
      }
      manualDaySums.set(goal.id as number, sums);
    }

    const eventDays = new Set<string>();
    for (const day of txsByDay.keys()) eventDays.add(day);
    for (const sums of manualDaySums.values()) for (const day of sums.keys()) eventDays.add(day);
    const orderedDays = [...eventDays].filter((d) => d >= minDate && d <= todayStr).sort();

    const automatic = new Map<number, number>(goals.map((g) => [g.id as number, 0]));

    // Cumulative manual per goal up to each event day (recomputed from the
    // day sums: goals and movements are few, clarity wins over indexing).
    const manualUpTo = (goalId: number, day: string): number => {
      let total = 0;
      const sums = manualDaySums.get(goalId);
      if (!sums) return 0;
      for (const [d, sum] of sums) if (d <= day) total += sum;
      return total;
    };

    const createdDay = new Map<number, string>(goals.map((g) => [g.id as number, arDateOfInstant(g.createdAt)]));
    const remainingAt = (goalId: number, day: string): number => {
      const goal = goals.find((g) => g.id === goalId) as Goal;
      return goal.targetMinor - manualUpTo(goalId, day) - (automatic.get(goalId) ?? 0);
    };

    for (const day of orderedDays) {
      const nets = netByDay.get(day);
      if (!nets) continue;
      for (const [currency, net] of nets) {
        const candidates = goals.filter(
          (g) => g.currency === currency && (createdDay.get(g.id as number) as string) <= day,
        );
        if (candidates.length === 0) continue;
        if (net > 0) {
          let leftover = net;
          for (const goal of candidates) {
            if (leftover <= 0) break;
            const remaining = remainingAt(goal.id as number, day);
            if (remaining <= 0) continue;
            const fill = Math.min(leftover, remaining);
            automatic.set(goal.id as number, (automatic.get(goal.id as number) ?? 0) + fill);
            leftover -= fill;
          }
          // Leftover with no incomplete goal alive today is dropped: it must
          // never become historical surplus for goals created later.
        } else if (net < 0) {
          // Draw back the most recently filled allocation first (LIFO):
          // later goals absorb the deficit before earlier, completed ones.
          let deficit = -net;
          for (let i = candidates.length - 1; i >= 0 && deficit > 0; i--) {
            const id = candidates[i].id as number;
            const held = automatic.get(id) ?? 0;
            if (held <= 0) continue;
            const take = Math.min(deficit, held);
            automatic.set(id, held - take);
            deficit -= take;
          }
        }
      }
    }

    return goals.map((goal) => {
      const id = goal.id as number;
      const adjs = byGoal.get(id) ?? [];
      let aportes = 0;
      let retiros = 0;
      for (const adj of adjs) {
        if (adj.amountMinor > 0) aportes += adj.amountMinor;
        else retiros += -adj.amountMinor;
      }
      const manualNet = aportes - retiros;
      const auto = automatic.get(id) ?? 0;
      const total = manualNet + auto;
      const remaining = Math.max(0, goal.targetMinor - total);
      const completed = total >= goal.targetMinor;
      let daysRemaining: number | null = null;
      let requiredPaceMinor: number | null = null;
      if (goal.deadline !== null) {
        daysRemaining = diffDays(todayStr, goal.deadline);
        const [ty, tm] = todayStr.split('-').map(Number);
        const [dy, dm] = goal.deadline.split('-').map(Number);
        const monthsLeft = Math.max(1, (dy - ty) * 12 + (dm - tm) + 1);
        requiredPaceMinor = remaining === 0 ? 0 : Math.ceil(remaining / monthsLeft);
      }
      return {
        id,
        name: goal.name,
        targetMinor: goal.targetMinor,
        currency: goal.currency as Currency,
        deadline: goal.deadline,
        createdAt: goal.createdAt,
        priority: goal.priority,
        completed,
        automaticMinor: auto,
        manualAportesMinor: aportes,
        manualRetirosMinor: retiros,
        manualNetMinor: manualNet,
        totalMinor: total,
        remainingMinor: remaining,
        daysRemaining,
        requiredPaceMinor,
      };
    });
  }
}

/** Validates a currency string for goal inputs (create/update share it). */
export function assertGoalCurrency(currency: unknown): asserts currency is Currency {
  if (!isSupportedCurrency(currency)) {
    throw new ValidationError('Invalid goal', ['currency must be one of ARS, USD']);
  }
}

/** Validates an optional deadline (null clears it on update). */
export function assertGoalDeadline(deadline: unknown): asserts deadline is string | null {
  if (deadline !== null && !isArDateString(deadline)) {
    throw new ValidationError('Invalid goal', ['deadline must be a valid YYYY-MM-DD date or null']);
  }
}
